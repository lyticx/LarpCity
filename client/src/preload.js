const { contextBridge } = require("electron");
const fs = require("fs");
const path = require("path");
const { io } = require("socket.io-client");

let config = { serverUrl: "http://localhost:3000" };
try {
  const configPath = path.join(__dirname, "..", "config.json");
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
} catch (e) {
  console.error("Nem sikerült beolvasni a config.json-t", e);
}

const socket = io(config.serverUrl, { transports: ["websocket", "polling"] });

const listeners = {
  newMessage: [],
  roomsUpdated: [],
  connectionChange: []
};

socket.on("new_message", (data) => {
  listeners.newMessage.forEach((cb) => cb(data));
});
socket.on("rooms_updated", (rooms) => {
  listeners.roomsUpdated.forEach((cb) => cb(rooms));
});
socket.on("connect", () => {
  listeners.connectionChange.forEach((cb) => cb(true));
});
socket.on("disconnect", () => {
  listeners.connectionChange.forEach((cb) => cb(false));
});

contextBridge.exposeInMainWorld("chatAPI", {
  serverUrl: config.serverUrl,

  join: (username) =>
    new Promise((resolve) => socket.emit("join", username, resolve)),

  selectRoom: (room) =>
    new Promise((resolve) => socket.emit("select_room", room, resolve)),

  createRoom: (name) =>
    new Promise((resolve) => socket.emit("create_room", name, resolve)),

  sendMessage: (text) =>
    new Promise((resolve) => socket.emit("send_message", { text }, resolve)),

  getFriends: () =>
    new Promise((resolve) => socket.emit("get_friends", resolve)),

  addFriend: (name) =>
    new Promise((resolve) => socket.emit("add_friend", name, resolve)),

  removeFriend: (name) =>
    new Promise((resolve) => socket.emit("remove_friend", name, resolve)),

  onNewMessage: (cb) => listeners.newMessage.push(cb),
  onRoomsUpdated: (cb) => listeners.roomsUpdated.push(cb),
  onConnectionChange: (cb) => listeners.connectionChange.push(cb)
});

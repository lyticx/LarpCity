// Beszélő szerver
// Egyszerű, valós idejű chat szerver: szobák, üzenetek, barátlista.
// Az adatok egy helyi db.json fájlban tárolódnak (nem törlődnek újraindításkor,
// amíg a hosting szolgáltató nem törli a lemezt - ingyenes Render planon
// alvó szerver felébredéskor megtartja a fájlt, de ha újra deployolsz, elveszhet).

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "db.json");
const PORT = process.env.PORT || 3000;

function loadDb() {
  if (fs.existsSync(DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
    } catch (e) {
      console.error("Nem sikerült beolvasni a db.json-t, üres adatbázissal indulok.", e);
    }
  }
  return {
    rooms: ["általános", "játékfejlesztés", "random"],
    messages: {},
    friends: {}
  };
}

let db = loadDb();

function saveDb() {
  fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (err) => {
    if (err) console.error("Mentési hiba:", err);
  });
}

// Biztosítjuk, hogy minden szobához legyen üzenettömb
for (const room of db.rooms) {
  if (!db.messages[room]) db.messages[room] = [];
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Beszélő szerver fut. Csatlakozz a kliens alkalmazással.");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, rooms: db.rooms.length });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Kik vannak most fenn (socket.id -> username)
const onlineUsers = new Map();

io.on("connection", (socket) => {
  let currentUsername = null;
  let currentRoom = null;

  socket.on("join", (username, cb) => {
    if (!username || typeof username !== "string" || !username.trim()) {
      if (cb) cb({ ok: false, error: "Érvénytelen felhasználónév." });
      return;
    }
    currentUsername = username.trim().slice(0, 24);
    onlineUsers.set(socket.id, currentUsername);
    if (!db.friends[currentUsername]) {
      db.friends[currentUsername] = [];
      saveDb();
    }
    if (cb) cb({ ok: true, rooms: db.rooms });
  });

  socket.on("select_room", (room, cb) => {
    if (!db.rooms.includes(room)) {
      if (cb) cb({ ok: false, error: "Nincs ilyen szoba." });
      return;
    }
    if (currentRoom) socket.leave(currentRoom);
    currentRoom = room;
    socket.join(room);
    if (cb) cb({ ok: true, messages: db.messages[room] || [] });
  });

  socket.on("create_room", (name, cb) => {
    const clean = String(name || "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 30);
    if (!clean) {
      if (cb) cb({ ok: false, error: "Érvénytelen szobanév." });
      return;
    }
    if (!db.rooms.includes(clean)) {
      db.rooms.push(clean);
      db.messages[clean] = [];
      saveDb();
      io.emit("rooms_updated", db.rooms);
    }
    if (cb) cb({ ok: true, rooms: db.rooms, room: clean });
  });

  socket.on("send_message", (payload, cb) => {
    if (!currentUsername || !currentRoom) {
      if (cb) cb({ ok: false, error: "Nem vagy csatlakozva egy szobához sem." });
      return;
    }
    const text = String((payload && payload.text) || "").trim().slice(0, 2000);
    if (!text) {
      if (cb) cb({ ok: false, error: "Üres üzenet." });
      return;
    }
    const msg = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      user: currentUsername,
      text,
      time: Date.now()
    };
    if (!db.messages[currentRoom]) db.messages[currentRoom] = [];
    db.messages[currentRoom].push(msg);
    // Ne nőjön a végtelenségig: max 500 üzenet szobánként
    if (db.messages[currentRoom].length > 500) {
      db.messages[currentRoom] = db.messages[currentRoom].slice(-500);
    }
    saveDb();
    io.to(currentRoom).emit("new_message", { room: currentRoom, message: msg });
    if (cb) cb({ ok: true });
  });

  socket.on("get_friends", (cb) => {
    if (!currentUsername) {
      if (cb) cb({ ok: false, error: "Nincs bejelentkezve." });
      return;
    }
    const friends = db.friends[currentUsername] || [];
    const mutual = {};
    for (const f of friends) {
      mutual[f] = (db.friends[f] || []).includes(currentUsername);
    }
    if (cb) cb({ ok: true, friends, mutual });
  });

  socket.on("add_friend", (name, cb) => {
    if (!currentUsername) {
      if (cb) cb({ ok: false, error: "Nincs bejelentkezve." });
      return;
    }
    const clean = String(name || "").trim().slice(0, 24);
    if (!clean || clean === currentUsername) {
      if (cb) cb({ ok: false, error: "Érvénytelen név." });
      return;
    }
    if (!db.friends[currentUsername]) db.friends[currentUsername] = [];
    if (!db.friends[currentUsername].includes(clean)) {
      db.friends[currentUsername].push(clean);
      saveDb();
    }
    const mutual = (db.friends[clean] || []).includes(currentUsername);
    if (cb) cb({ ok: true, friends: db.friends[currentUsername], mutual: { [clean]: mutual } });
  });

  socket.on("remove_friend", (name, cb) => {
    if (!currentUsername) {
      if (cb) cb({ ok: false, error: "Nincs bejelentkezve." });
      return;
    }
    if (db.friends[currentUsername]) {
      db.friends[currentUsername] = db.friends[currentUsername].filter((f) => f !== name);
      saveDb();
    }
    if (cb) cb({ ok: true, friends: db.friends[currentUsername] || [] });
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Beszélő szerver fut a ${PORT} porton.`);
});

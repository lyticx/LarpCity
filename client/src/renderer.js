const AVATAR_COLORS = ["#5865f2","#57f287","#fee75c","#eb459e","#ed4245","#3ba55d","#f0a020","#9b59b6"];

function hashColor(name){
  let h = 0;
  for (let i=0;i<name.length;i++){ h = name.charCodeAt(i) + ((h<<5)-h); }
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name){ return (name || "?").trim().slice(0,2).toUpperCase(); }
function formatTime(ts){
  const d = new Date(ts);
  return d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0");
}
function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

const root = document.getElementById("root");

let state = {
  username: localStorage.getItem("larpcity_username") || null,
  connected: false,
  rooms: [],
  currentRoom: null,
  messages: [],
  loginInput: "",
  loginError: "",
  loggingIn: false,
  showNewRoomInput: false,
  newRoomInput: "",
  composerText: "",
  friends: [],
  mutualMap: {},
  showAddFriendInput: false,
  addFriendInput: ""
};

function render(){
  if (!state.username){
    renderLogin();
    return;
  }
  renderApp();
}

function renderLogin(){
  root.innerHTML = `
    <div class="login-overlay">
      <div class="login-card">
        <h1>Üdv a LarpCity-ben</h1>
        <p>Add meg a neved a csatlakozáshoz.</p>
        <div class="server-line">Szerver: ${escapeHtml(window.chatAPI.serverUrl)}</div>
        <div class="login-error">${state.loginError || ""}</div>
        <input id="login-input" type="text" placeholder="Neved..." maxlength="24" value="${escapeHtml(state.loginInput)}" />
        <button id="login-btn" ${state.loggingIn ? "disabled" : ""}>${state.loggingIn ? "Csatlakozás..." : "Belépés"}</button>
      </div>
    </div>
  `;
  const input = document.getElementById("login-input");
  input.focus();
  input.addEventListener("input", e => { state.loginInput = e.target.value; });
  input.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  document.getElementById("login-btn").addEventListener("click", doLogin);
}

async function doLogin(){
  const name = state.loginInput.trim();
  if (!name){ state.loginError = "Adj meg egy nevet."; render(); return; }
  state.loggingIn = true;
  state.loginError = "";
  render();
  try {
    const res = await window.chatAPI.join(name);
    if (!res || !res.ok){
      state.loginError = (res && res.error) || "Nem sikerült csatlakozni a szerverhez.";
      state.loggingIn = false;
      render();
      return;
    }
    state.username = name;
    localStorage.setItem("larpcity_username", name);
    state.rooms = res.rooms || [];
    state.currentRoom = state.rooms[0] || null;
    state.loggingIn = false;
    await initApp();
  } catch (err){
    state.loginError = "Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot.";
    state.loggingIn = false;
    render();
  }
}

async function initApp(){
  if (state.currentRoom){
    const res = await window.chatAPI.selectRoom(state.currentRoom);
    state.messages = (res && res.messages) || [];
  }
  await refreshFriends();
  render();

  window.chatAPI.onNewMessage(({ room, message }) => {
    if (room === state.currentRoom){
      state.messages = state.messages.concat([message]);
      renderApp(true);
    }
  });
  window.chatAPI.onRoomsUpdated((rooms) => {
    state.rooms = rooms;
    renderApp(true);
  });
  window.chatAPI.onConnectionChange((isConnected) => {
    state.connected = isConnected;
    renderApp(true);
  });
  state.connected = true;
}

async function refreshFriends(){
  try {
    const res = await window.chatAPI.getFriends();
    if (res && res.ok){
      state.friends = res.friends || [];
      state.mutualMap = res.mutual || {};
    }
  } catch (e){ /* ignore */ }
}

async function selectRoom(room){
  state.currentRoom = room;
  state.showNewRoomInput = false;
  render();
  const res = await window.chatAPI.selectRoom(room);
  state.messages = (res && res.messages) || [];
  renderApp(true);
}

async function sendMessage(){
  const text = state.composerText.trim();
  if (!text || !state.currentRoom) return;
  state.composerText = "";
  renderApp(true);
  await window.chatAPI.sendMessage(text);
}

async function createRoom(){
  const name = state.newRoomInput.trim();
  if (!name) return;
  state.newRoomInput = "";
  state.showNewRoomInput = false;
  render();
  const res = await window.chatAPI.createRoom(name);
  if (res && res.ok){
    state.rooms = res.rooms;
    await selectRoom(res.room);
  }
}

async function addFriend(){
  const name = state.addFriendInput.trim();
  if (!name || name === state.username) return;
  state.addFriendInput = "";
  state.showAddFriendInput = false;
  render();
  const res = await window.chatAPI.addFriend(name);
  if (res && res.ok){
    state.friends = res.friends;
    state.mutualMap = Object.assign({}, state.mutualMap, res.mutual);
  }
  renderApp(true);
}

async function removeFriend(name){
  const res = await window.chatAPI.removeFriend(name);
  if (res && res.ok){
    state.friends = res.friends;
    delete state.mutualMap[name];
  }
  renderApp(true);
}

function groupMessages(messages){
  const groups = [];
  for (const m of messages){
    const last = groups[groups.length - 1];
    if (last && last.user === m.user && (m.time - last.items[last.items.length-1].time) < 5*60*1000){
      last.items.push(m);
    } else {
      groups.push({ user: m.user, items: [m] });
    }
  }
  return groups;
}

function renderApp(preserveScroll){
  const prevMsgEl = document.querySelector(".messages");
  const wasAtBottom = prevMsgEl ? (prevMsgEl.scrollHeight - prevMsgEl.scrollTop - prevMsgEl.clientHeight < 60) : true;

  const roomsHtml = state.rooms.map(r => `
    <div class="room-item ${r === state.currentRoom ? 'active' : ''}" data-room="${escapeHtml(r)}">
      <span class="room-hash">#</span><span>${escapeHtml(r)}</span>
    </div>
  `).join("");

  const groups = groupMessages(state.messages);
  const messagesHtml = groups.length === 0
    ? `<div class="empty-state"><div class="big-hash">#</div>Még nincs üzenet a(z) <strong>#${escapeHtml(state.currentRoom||"")}</strong> szobában.<br/>Legyél te az első!</div>`
    : groups.map(g => `
      <div class="msg-group">
        <div class="msg-avatar" style="background:${hashColor(g.user)}">${escapeHtml(initials(g.user))}</div>
        <div class="msg-body">
          <div class="msg-head">
            <span class="msg-author">${escapeHtml(g.user)}</span>
            <span class="msg-time">${formatTime(g.items[0].time)}</span>
          </div>
          ${g.items.map(m => `<div class="msg-text">${escapeHtml(m.text)}</div>`).join("")}
        </div>
      </div>
    `).join("");

  const newRoomRowHtml = state.showNewRoomInput ? `
    <div class="inline-row">
      <input id="new-room-input" type="text" placeholder="új-szoba-neve" maxlength="30" value="${escapeHtml(state.newRoomInput)}" />
      <button id="new-room-btn">Létrehoz</button>
    </div>
  ` : "";

  const addFriendRowHtml = state.showAddFriendInput ? `
    <div class="inline-row">
      <input id="add-friend-input" type="text" placeholder="barát neve..." maxlength="24" value="${escapeHtml(state.addFriendInput)}" />
      <button id="add-friend-btn">Hozzáad</button>
    </div>
  ` : "";

  const friendsHtml = state.friends.length === 0
    ? `<div class="friend-empty">Még nincs bejelölt barátod.</div>`
    : state.friends.map(f => `
      <div class="friend-item">
        <div class="friend-mini-avatar" style="background:${hashColor(f)}">${escapeHtml(initials(f))}</div>
        <span class="friend-name">${escapeHtml(f)}</span>
        ${state.mutualMap[f] ? '<span class="mutual-badge">kölcsönös</span>' : ''}
        <span class="friend-remove" data-friend="${escapeHtml(f)}" title="Törlés">×</span>
      </div>
    `).join("");

  root.innerHTML = `
    <div class="app">
      <div class="sidebar">
        <div class="sidebar-header">
          <span>Szöveges szobák</span>
          <span class="add-btn" id="add-room-toggle" title="Új szoba">+</span>
        </div>
        ${newRoomRowHtml}
        <div class="room-list">${roomsHtml}</div>
        <div class="sidebar-divider"></div>
        <div class="friend-section">
          <div class="sidebar-header">
            <span>Barátok</span>
            <span class="add-btn" id="add-friend-toggle" title="Barát hozzáadása">+</span>
          </div>
          ${addFriendRowHtml}
          <div class="friend-list">${friendsHtml}</div>
        </div>
        <div class="user-bar">
          <div class="user-avatar" style="background:${hashColor(state.username)}">
            ${escapeHtml(initials(state.username))}
            <span class="status-dot ${state.connected ? 'online' : ''}"></span>
          </div>
          <div>
            <div class="user-name">${escapeHtml(state.username)}</div>
            <div class="user-sub">${state.connected ? 'Kapcsolódva' : 'Kapcsolódás...'}</div>
          </div>
        </div>
      </div>
      <div class="main">
        <div class="chat-header">
          <span class="room-hash">#</span><span class="room-title">${escapeHtml(state.currentRoom || "")}</span>
        </div>
        <div class="messages">${messagesHtml}</div>
        <div class="composer">
          <div class="composer-inner">
            <textarea id="composer-input" rows="1" placeholder="Írj üzenetet ide: #${escapeHtml(state.currentRoom||"")}">${escapeHtml(state.composerText)}</textarea>
            <button class="send-btn ${state.composerText.trim() ? 'active' : ''}" id="send-btn">Küldés</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll(".room-item").forEach(el => {
    el.addEventListener("click", () => selectRoom(el.getAttribute("data-room")));
  });
  document.getElementById("add-room-toggle").addEventListener("click", () => {
    state.showNewRoomInput = !state.showNewRoomInput;
    renderApp();
    const el = document.getElementById("new-room-input");
    if (el) el.focus();
  });
  const newRoomInputEl = document.getElementById("new-room-input");
  if (newRoomInputEl){
    newRoomInputEl.addEventListener("input", e => { state.newRoomInput = e.target.value; });
    newRoomInputEl.addEventListener("keydown", e => { if (e.key === "Enter") createRoom(); });
  }
  const newRoomBtn = document.getElementById("new-room-btn");
  if (newRoomBtn) newRoomBtn.addEventListener("click", createRoom);

  document.getElementById("add-friend-toggle").addEventListener("click", () => {
    state.showAddFriendInput = !state.showAddFriendInput;
    renderApp();
    const el = document.getElementById("add-friend-input");
    if (el) el.focus();
  });
  const addFriendInputEl = document.getElementById("add-friend-input");
  if (addFriendInputEl){
    addFriendInputEl.addEventListener("input", e => { state.addFriendInput = e.target.value; });
    addFriendInputEl.addEventListener("keydown", e => { if (e.key === "Enter") addFriend(); });
  }
  const addFriendBtn = document.getElementById("add-friend-btn");
  if (addFriendBtn) addFriendBtn.addEventListener("click", addFriend);
  document.querySelectorAll(".friend-remove").forEach(el => {
    el.addEventListener("click", () => removeFriend(el.getAttribute("data-friend")));
  });

  const composerInput = document.getElementById("composer-input");
  composerInput.addEventListener("input", e => {
    state.composerText = e.target.value;
    const sendBtn = document.getElementById("send-btn");
    if (sendBtn) sendBtn.classList.toggle("active", !!state.composerText.trim());
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  });
  composerInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); sendMessage(); }
  });
  document.getElementById("send-btn").addEventListener("click", sendMessage);
  composerInput.focus();

  const msgContainer = document.querySelector(".messages");
  if (msgContainer && (wasAtBottom || !preserveScroll)){
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
}

async function boot(){
  if (state.username){
    render();
    try {
      const res = await window.chatAPI.join(state.username);
      if (res && res.ok){
        state.rooms = res.rooms || [];
        state.currentRoom = state.rooms[0] || null;
        await initApp();
        return;
      }
    } catch (e){ /* szerver még nem elérhető, login képernyőn maradunk */ }
    state.username = null;
  }
  render();
}

boot();

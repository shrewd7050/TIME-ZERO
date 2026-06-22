// ========================================================
//  HERO FADE ON SCROLL
// ========================================================
window.addEventListener('scroll', function() {
    const scrollY = window.scrollY;
    const textEl = document.querySelector('.hero-overlay-text');
    if (textEl) {
        const maxScroll = 500;
        let opacity = Math.min(scrollY / maxScroll, 1);
        textEl.style.opacity = opacity;
    }
});

// ========================================================
//  BATTLE SYSTEM (unchanged)
// ========================================================
let player1 = { health: 100 };
let player2 = { health: 100 };
let gameActive = false;
let gameMode = 'single';
let ws = null;
let myName = "", opponentName = "", roomId = null;
let onlineGameActive = false, cpmTimeout = null;

function updateHealthUI(myHealth, oppHealth) {
    document.getElementById('p1Health').innerText = myHealth;
    document.getElementById('p2Health').innerText = oppHealth;
    document.getElementById('p1HealthBar').style.width = `${myHealth}%`;
    document.getElementById('p2HealthBar').style.width = `${oppHealth}%`;
}

function addLog(msg, type='system') {
    const logDiv = document.getElementById('messageLog');
    if(!logDiv) return;
    const entry = document.createElement('div');
    entry.style.padding = '5px';
    entry.style.margin = '4px';
    entry.style.borderRadius = '16px';
    entry.style.background = 'rgba(255,255,255,0.08)';
    entry.innerHTML = `📢 ${msg}`;
    if(type === 'player') entry.innerHTML = `👤 ${msg}`;
    else if(type === 'opponent') entry.innerHTML = `👥 ${msg}`;
    else if(type === 'win') entry.innerHTML = `🏆 ${msg} 🏆`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
}
function clearLog() { let log = document.getElementById('messageLog'); if(log) log.innerHTML = ''; }

function applyDamage(choice1, choice2) {
    let dmg1=0,dmg2=0;
    if(choice1===1 && choice2===1) { dmg1=0; dmg2=0; }
    else if(choice1===1 && choice2===2) { dmg1=15; dmg2=0; }
    else if(choice1===1 && choice2===3) { dmg1=0; dmg2=20; }
    else if(choice1===2 && choice2===1) { dmg1=0; dmg2=15; }
    else if(choice1===2 && choice2===2) { dmg1=5; dmg2=5; }
    else if(choice1===2 && choice2===3) { dmg1=10; dmg2=0; }
    else if(choice1===3 && choice2===1) { dmg1=20; dmg2=0; }
    else if(choice1===3 && choice2===2) { dmg1=0; dmg2=10; }
    else if(choice1===3 && choice2===3) { dmg1=0; dmg2=0; }
    player1.health = Math.max(0, player1.health - dmg1);
    player2.health = Math.max(0, player2.health - dmg2);
    updateHealthUI(player1.health, player2.health);
    return { playerDamage: dmg1, opponentDamage: dmg2 };
}

function endSinglePlayerGame(winnerIsPlayer) {
    gameActive = false;
    if(cpmTimeout) clearTimeout(cpmTimeout);
    addLog(winnerIsPlayer ? "🔥 YOU WIN! 🔥" : "💀 CPM VICTORY 💀", 'win');
    document.getElementById('actionButtons').innerHTML = `<button onclick="resetGameLocal()" class="action-btn">🔄 Play Again</button>`;
}

async function handleSinglePlayerMove(choice) {
    if(!gameActive) return;
    const btns = document.querySelectorAll('#actionButtons button');
    btns.forEach(btn => btn.disabled = true);
    const moveName = choice===1?"Heavy Attack":choice===2?"Quick Attack":"Defend";
    addLog(`You used ${moveName}`, 'player');
    if(cpmTimeout) clearTimeout(cpmTimeout);
    cpmTimeout = setTimeout(() => {
        const cpmChoice = Math.floor(Math.random()*3)+1;
        const cpmName = cpmChoice===1?"Heavy Attack":cpmChoice===2?"Quick Attack":"Defend";
        addLog(`CPM used ${cpmName}`, 'opponent');
        const damages = applyDamage(choice, cpmChoice);
        if(damages.playerDamage>0) addLog(`You took ${damages.playerDamage} damage!`, 'player');
        if(damages.opponentDamage>0) addLog(`CPM took ${damages.opponentDamage} damage!`, 'opponent');
        if(player1.health<=0 || player2.health<=0) endSinglePlayerGame(player1.health>0);
        else { addLog("Your turn again", 'system'); btns.forEach(btn=>btn.disabled=false); }
        cpmTimeout = null;
    }, 1000);
}

function renderActionButtons() {
    const btnDiv = document.getElementById('actionButtons');
    btnDiv.innerHTML = `<button class="action-btn" onclick="handleSinglePlayerMove(1)">💥 Heavy Attack</button>
                        <button class="action-btn" onclick="handleSinglePlayerMove(2)">⚡ Quick Attack</button>
                        <button class="action-btn" onclick="handleSinglePlayerMove(3)">🛡️ Defend</button>`;
}

function startSinglePlayer() {
    if(cpmTimeout) clearTimeout(cpmTimeout);
    gameMode = 'single';
    player1 = { health:100 }; player2 = { health:100 };
    gameActive = true;
    clearLog();
    updateHealthUI(100,100);
    addLog("🔥 Battle started! You attack first.", 'system');
    renderActionButtons();
    document.getElementById('onlineSetup').style.display = 'none';
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('battleArea').style.display = 'block';
    document.getElementById('p1Name').innerText = "You";
    document.getElementById('p2Name').innerText = "CPM";
}

function setupOnlineMode() {
    document.getElementById('gameControls').style.display = 'none';
    document.getElementById('onlineSetup').style.display = 'block';
}
function cancelMatch() { if(ws) ws.close(); ws=null; document.getElementById('onlineSetup').style.display='none'; document.getElementById('gameControls').style.display='block'; document.getElementById('battleArea').style.display='none'; gameActive=false; onlineGameActive=false; }
function findMatch() {
    let name = document.getElementById('playerName').value.trim() || "Trainer"+Math.floor(Math.random()*900);
    myName = name;
    document.getElementById('matchStatus').innerHTML = "Connecting...";
    ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onopen = ()=> ws.send(JSON.stringify({action:"find", name:myName}));
    ws.onmessage = (e)=>{
        const data = JSON.parse(e.data);
        if(data.type === "matched") { roomId = data.room_id; ws.send(JSON.stringify({type:"join_room", room_id:roomId})); }
        else if(data.type === "game_start") { gameMode='online'; gameActive=true; onlineGameActive=true; clearLog(); updateHealthUI(data.your_health, data.opponent_health); document.getElementById('battleArea').style.display='block'; document.getElementById('onlineSetup').style.display='none'; document.getElementById('p1Name').innerText = myName; document.getElementById('p2Name').innerText = opponentName||"Rival"; addLog("⚡ ONLINE BATTLE!",'system'); window.myTurn = data.your_turn; if(window.myTurn) { addLog("Your turn",'system'); document.getElementById('actionButtons').innerHTML = `<button class="action-btn" onclick="sendOnlineMove(1)">💥 Heavy</button><button class="action-btn" onclick="sendOnlineMove(2)">⚡ Quick</button><button class="action-btn" onclick="sendOnlineMove(3)">🛡️ Defend</button>`; } else document.getElementById('actionButtons').innerHTML = `<button disabled class="action-btn">Waiting opponent...</button>`; }
        else if(data.type === "round_result") { const isP1 = (document.getElementById('p1Name').innerText === myName); const myHP = isP1?data.p1_health:data.p2_health; const oppHP = isP1?data.p2_health:data.p1_health; updateHealthUI(myHP, oppHP); window.myTurn = data.your_turn; if(window.myTurn) { addLog("Your turn",'system'); document.getElementById('actionButtons').innerHTML = `<button class="action-btn" onclick="sendOnlineMove(1)">💥 Heavy</button><button class="action-btn" onclick="sendOnlineMove(2)">⚡ Quick</button><button class="action-btn" onclick="sendOnlineMove(3)">🛡️ Defend</button>`; } else document.getElementById('actionButtons').innerHTML = `<button disabled class="action-btn">Opponent turn...</button>`; }
        else if(data.type === "game_over") { gameActive=false; addLog(`${data.winner_name} VICTORY!`,'win'); document.getElementById('actionButtons').innerHTML = `<button onclick="resetGameOnline()" class="action-btn">🔄 Rematch</button>`; ws.close(); }
        else if(data.type === "opponent_left") { addLog("Opponent left.",'system'); gameActive=false; }
    };
    ws.onerror = ()=> document.getElementById('matchStatus').innerHTML = "Server offline - use single player";
}
function sendOnlineMove(choice) { if(!gameActive||!window.myTurn) { addLog("Not your turn!",'system'); return; } ws.send(JSON.stringify({type:"move", move:choice, room_id:roomId})); document.getElementById('actionButtons').innerHTML = `<button disabled class="action-btn">Waiting...</button>`; window.myTurn=false; }
function resetGameOnline() { if(ws) ws.close(); setupOnlineMode(); }
function resetGameLocal() { if(gameMode === 'single') startSinglePlayer(); else setupOnlineMode(); }
function openGameModal() { document.getElementById('gameModal').style.display='flex'; document.getElementById('gameControls').style.display='flex'; document.getElementById('onlineSetup').style.display='none'; document.getElementById('battleArea').style.display='none'; if(cpmTimeout) clearTimeout(cpmTimeout); if(ws) ws.close(); ws=null; }
function closeGameModal() { document.getElementById('gameModal').style.display='none'; }

// Manual toggle
function toggleManual() {
    const overlay = document.getElementById('manualOverlay');
    if (overlay.style.display === 'flex') {
        overlay.style.display = 'none';
    } else {
        overlay.style.display = 'flex';
    }
}
// ========================================================
//  CHAT SYSTEM (fixed: no duplicates, name change works)
// ========================================================
let chatUsername = null;
let newsWS = null, musicWS = null;
let newsConnected = false, musicConnected = false;
let chatReconnectTimer = null;
let pendingNameCallback = null;
let roomsConnected = { News: false, Music: false }; // prevent double connect

// --- Name Modal ---
function showNameModal(callback) {
    pendingNameCallback = callback;
    document.getElementById('nameModal').style.display = 'flex';
    document.getElementById('nameInput').value = '';
    document.getElementById('nameInput').focus();
}

function confirmName() {
    const input = document.getElementById('nameInput');
    let name = input.value.trim();
    if (!name) name = "Traveler" + Math.floor(Math.random()*1000);
    name = name.substring(0,20);
    closeNameModal(true); // true = user confirmed
    if (pendingNameCallback) {
        pendingNameCallback(name);
        pendingNameCallback = null;
    }
}

function closeNameModal(confirmed = false) {
    document.getElementById('nameModal').style.display = 'none';
    // Only assign random if not confirmed and callback still pending
    if (!confirmed && pendingNameCallback) {
        const randomName = "Random-" + Math.floor(Math.random()*1000);
        pendingNameCallback(randomName);
        pendingNameCallback = null;
    }
}

function initChatUser() {
    let stored = localStorage.getItem("timezero_chatname");
    if (stored) {
        chatUsername = stored;
        return Promise.resolve(chatUsername);
    }
    return new Promise((resolve) => {
        showNameModal((name) => {
            chatUsername = name;
            localStorage.setItem("timezero_chatname", chatUsername);
            resolve(chatUsername);
        });
    });
}

function changeChatName() {
    // Use a new callback that updates the name and reconnects
    showNameModal((newName) => {
        chatUsername = newName;
        localStorage.setItem("timezero_chatname", chatUsername);
        document.getElementById('chatUserNameDisplay').innerText = chatUsername;
        // Reconnect both rooms if chat modal is open
        if (document.getElementById('chatModal').style.display === 'flex') {
            // Force close and reopen connections
            if (newsWS) { newsWS.close(); newsWS = null; }
            if (musicWS) { musicWS.close(); musicWS = null; }
            roomsConnected.News = false;
            roomsConnected.Music = false;
            connectChatRoom('News');
            connectChatRoom('Music');
        }
    });
}

// --- Message handling ---
function addChatMessage(room, username, text, isSystem=false) {
    const container = document.getElementById(`${room.toLowerCase()}MessagesArea`);
    if(!container) return;
    const div = document.createElement('div');
    div.className = isSystem ? 'system-bubble' : 'chat-bubble';
    if(!isSystem) div.innerHTML = `<b style="color:#ffd966;">${escapeHtml(username)}:</b> ${escapeHtml(text)}`;
    else div.innerText = `📢 ${text}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    while(container.children.length > 150) container.removeChild(container.firstChild);
}
function escapeHtml(str) { return str.replace(/[&<>]/g, m=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m])); }
function updateRoomStatus(room, connected) {
    const badge = document.getElementById(`${room.toLowerCase()}StatusBadge`);
    if(badge) badge.innerText = connected ? "● live" : "local mode";
    if(room === 'News') newsConnected = connected;
    else musicConnected = connected;
}

// --- Connect to a room ---
function connectChatRoom(room) {
    // Prevent duplicate connections
    if (roomsConnected[room]) return;
    roomsConnected[room] = true;

    const wsUrl = `ws://${window.location.host}/ws/chat`;
    const ws = new WebSocket(wsUrl);
    if(room === 'News') newsWS = ws;
    else musicWS = ws;

    ws.onopen = () => {
        ws.send(JSON.stringify({ action:"join", room:room, username:chatUsername }));
        updateRoomStatus(room, true);
        addChatMessage(room, "System", `✅ Connected to ${room} as ${chatUsername}`, true);
    };

    ws.onmessage = (ev) => {
        try {
            const data = JSON.parse(ev.data);
            if(data.type === "history") {
                const container = document.getElementById(`${room.toLowerCase()}MessagesArea`);
                if(container) container.innerHTML = '';
                data.messages.forEach(msg => addChatMessage(room, msg.username, msg.text, msg.username === "System"));
            } else if(data.type === "message") {
                addChatMessage(room, data.username, data.text, data.username === "System");
            }
        } catch(e) { console.error("Chat WS parse error", e); }
    };

    ws.onerror = () => {
        updateRoomStatus(room, false);
        addChatMessage(room, "System", "⚠️ Server offline — messages shown locally only.", true);
        roomsConnected[room] = false; // allow reconnection
    };

    ws.onclose = () => {
        updateRoomStatus(room, false);
        roomsConnected[room] = false;
        if (chatUsername && document.getElementById('chatModal').style.display === 'flex') {
            if (chatReconnectTimer) clearTimeout(chatReconnectTimer);
            chatReconnectTimer = setTimeout(() => {
                if (document.getElementById('chatModal').style.display === 'flex') {
                    connectChatRoom(room);
                }
            }, 5000);
        }
    };
}

// --- Open/Close Chat ---
async function openChatModal() {
    if (!chatUsername) {
        await initChatUser();
    }
    document.getElementById('chatModal').style.display = 'flex';
    // Clear messages to avoid duplication on reopen
    document.getElementById('newsMessagesArea').innerHTML = '<div class="system-bubble">📡 News Room — live conversation</div>';
    document.getElementById('musicMessagesArea').innerHTML = '<div class="system-bubble">🎧 Music Room — share vibes</div>';
    
    // Close any existing connections
    if (newsWS) { newsWS.close(); newsWS = null; }
    if (musicWS) { musicWS.close(); musicWS = null; }
    roomsConnected.News = false;
    roomsConnected.Music = false;
    
    connectChatRoom('News');
    connectChatRoom('Music');
    document.getElementById('chatUserNameDisplay').innerText = chatUsername;
}

function closeChatModal() {
    if (newsWS) newsWS.close();
    if (musicWS) musicWS.close();
    newsWS = musicWS = null;
    roomsConnected.News = false;
    roomsConnected.Music = false;
    if (chatReconnectTimer) clearTimeout(chatReconnectTimer);
    document.getElementById('chatModal').style.display = 'none';
}

function sendChatMsg(room) {
    if (!chatUsername) {
        initChatUser().then(() => {
            sendChatMsg(room);
        });
        return;
    }
    const input = document.getElementById(`${room.toLowerCase()}ChatInput`);
    const text = input.value.trim();
    if (!text) return;
    const ws = (room === 'News') ? newsWS : musicWS;
    if (ws && ws.readyState === WebSocket.OPEN && ((room==='News' && newsConnected) || (room==='Music' && musicConnected))) {
        ws.send(JSON.stringify({ type:"message", text:text }));
        input.value = '';
    } else {
        addChatMessage(room, chatUsername, text + " (local only)", false);
        input.value = '';
        addChatMessage(room, "System", "Server offline — message saved locally", true);
    }
}

// Init on load
window.addEventListener('DOMContentLoaded', function() {
    let stored = localStorage.getItem("timezero_chatname");
    if (stored) {
        chatUsername = stored;
    } else {
        chatUsername = "Guest"; // temporary
    }
    document.getElementById('chatUserNameDisplay').innerText = chatUsername;
});
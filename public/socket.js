/* ═══════════════════════════════════════════════════════════
   LUDO — SOCKET CLIENT v4
   Handles: randomMatch, customRoom, colorChoice,
            BOTH roll buttons (mobile + desktop)
   ═══════════════════════════════════════════════════════════ */
'use strict';

window._onlineMode = true;
const socket = io();

/* ── DOM ───────────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const lobbyScreen   = $('lobby-screen');
const waitingScreen = $('waiting-screen');
const gameScreen    = $('game-screen');

/* ── State ─────────────────────────────────────────────────── */
let myId      = null;
let myColor   = null;
let currentRoomId  = null;
let currentRoomType = null;   // 'random' | 'custom'
let lastGS    = null;
let inOffline = false;

/* ── Expose for offline.js ─────────────────────────────────── */
window._setOfflineMode = v => { inOffline = v; };
window.__setLastGS     = gs => { lastGS = gs; };
window.__getLastGS     = ()  => lastGS;

/* ═══════════════════════════════════════════════════════════
   LOBBY ACTIONS (called by index.html inline scripts)
   ═══════════════════════════════════════════════════════════ */

/* Random match */
window._lobbyRandomMatch = (name, color) => {
  if (inOffline) return;
  socket.emit('randomMatch', { playerName: name, preferredColor: color });
};

/* Custom room: roomId='' means create new */
window._lobbyCustomRoom = (name, color, roomId) => {
  if (inOffline) return;
  socket.emit('joinGame', { playerName: name, preferredColor: color, roomId });
};

/* Cancel random search */
window._cancelSearch = () => {
  socket.disconnect();
  socket.connect();   // fresh connection, drop from any room
  location.reload();
};

/* ═══════════════════════════════════════════════════════════
   ROLL BUTTONS — wire BOTH (mobile top + desktop sidebar)
   ═══════════════════════════════════════════════════════════ */
function _onRollClick() {
  if (inOffline) return;
  LudoGame.playSound('roll');
  LudoGame.setRollEnabled(false);
  socket.emit('rollDice');
}

/* Wire after DOM ready (buttons exist after game starts) */
function _wireRollBtns() {
  const b1 = $('roll-btn');
  const b2 = $('roll-btn-top');
  if (b1) { b1.replaceWith(b1.cloneNode(true)); $('roll-btn').addEventListener('click', _onRollClick); }
  if (b2) { b2.replaceWith(b2.cloneNode(true)); $('roll-btn-top').addEventListener('click', _onRollClick); }
}

/* Canvas token pick */
window._socketMoveToken = tokenIndex => {
  if (inOffline) return;
  socket.emit('moveToken', { tokenIndex });
  LudoGame.setMovableTokens([]);
  LudoGame.render();
};

/* Waiting room start button */
$('start-btn').addEventListener('click', () => {
  socket.emit('startGame');
  $('start-btn').disabled = true;
  $('start-btn').textContent = 'Starting…';
});

/* ═══════════════════════════════════════════════════════════
   SOCKET EVENTS
   ═══════════════════════════════════════════════════════════ */

socket.on('joinError', ({ message }) => {
  // Hide finding animation if shown
  if (window._hideFinding) _hideFinding();
  _showLobbyMsg(message);
});

/* ── playerJoined ──────────────────────────────────────────── */
socket.on('playerJoined', ({ players, gameState, yourPlayerId, colorAssigned, roomId, roomType }) => {
  if (!myId) {
    myId    = socket.id;
    myColor = colorAssigned;
    LudoGame.setMyPlayer(myId, myColor);
  }
  lastGS          = gameState;
  currentRoomId   = roomId;
  currentRoomType = roomType;

  // Hide finding spinner
  if (window._hideFinding) _hideFinding();

  // Show waiting screen
  _showScreen('waiting');
  _renderWaiting(players, roomType, roomId);

  // Show start btn when enough players
  $('start-btn').classList.toggle('hidden', players.length < 2);
  $('waiting-text').textContent = players.length < 2
    ? `${players.length}/4 joined — min 2 players chahiye`
    : `${players.length} players ready! Start karo 🚀`;
});

socket.on('readyToStart', ({ players, roomType }) => {
  _renderWaiting(players, roomType || currentRoomType, currentRoomId);
  $('start-btn').classList.remove('hidden');
  $('waiting-text').textContent = `${players.length} players ready! Start karo 🚀`;
});

/* ── gameStarted ───────────────────────────────────────────── */
socket.on('gameStarted', ({ gameState, currentTurn }) => {
  lastGS = gameState;
  window.__setLastGS(gameState);
  LudoGame.setGameState(gameState);
  _showScreen('game');
  LudoGame.initBoard();
  LudoGame.render();
  LudoGame.updatePlayerCards(gameState.players, currentTurn);
  LudoGame.updateTurnLabel(currentTurn);
  LudoGame.setHint('');
  LudoGame.addLog('🎮 Game shuru!', '');
  _wireRollBtns();
  _refreshRoll(gameState);
});

/* ── diceRolled ────────────────────────────────────────────── */
socket.on('diceRolled', ({ playerId, diceValue, movableTokens, forfeit, gameState }) => {
  lastGS = gameState;
  window.__setLastGS(gameState);
  LudoGame.setGameState(gameState);
  LudoGame.showDice(diceValue);

  const p = gameState.players.find(x => x.id === playerId);
  LudoGame.addLog(`${p?.name} ne ${diceValue} daala`, p?.color || '');

  if (forfeit) {
    LudoGame.showToast(`${p?.name}: 3 sixes — forfeit! 😱`);
    LudoGame.setMovableTokens([]);
    LudoGame.render();
    LudoGame.setHint('');
    LudoGame.setRollEnabled(false);
    return;
  }

  if (playerId === myId) {
    if (!movableTokens.length) {
      LudoGame.setMovableTokens([]);
      LudoGame.render();
      LudoGame.showToast('Koi token nahi chala! Turn pass…');
      LudoGame.setHint('Koi valid move nahi 😕');
      LudoGame.setRollEnabled(false);
    } else {
      LudoGame.setMovableTokens(movableTokens);
      LudoGame.render();
      LudoGame.setHint('👆 Highlighted token pe click karo!');
      LudoGame.showToast(`${diceValue} aaya! Token select karo`, 3000);
      LudoGame.setRollEnabled(false);
    }
  } else {
    LudoGame.setMovableTokens([]);
    LudoGame.render();
    LudoGame.setRollEnabled(false);
  }
});

/* ── tokenMoved ────────────────────────────────────────────── */
socket.on('tokenMoved', ({ playerId, tokenIndex, killedToken, gameState }) => {
  lastGS = gameState;
  window.__setLastGS(gameState);
  LudoGame.setGameState(gameState);
  LudoGame.setMovableTokens([]);
  LudoGame.playSound('move');
  LudoGame.render();
  LudoGame.setHint('');

  const mover = gameState.players.find(p => p.id === playerId);
  LudoGame.addLog(`${mover?.name} ne token ${tokenIndex+1} chala`, mover?.color || '');

  if (killedToken) {
    LudoGame.playSound('kill');
    const killed = gameState.players.find(p => p.id === killedToken.playerId);
    LudoGame.showToast(`💥 ${mover?.name} ne ${killed?.name} ka token kaata!`);
    LudoGame.addLog(`💥 ${mover?.name} ne ${killed?.name} ka token kaata!`, mover?.color);
  }
  LudoGame.setRollEnabled(false);
});

/* ── extraTurn ─────────────────────────────────────────────── */
socket.on('extraTurn', ({ currentTurn }) => {
  const isMe = currentTurn?.playerId === myId;
  LudoGame.updateTurnLabel(currentTurn);
  if (lastGS) LudoGame.updatePlayerCards(lastGS.players, currentTurn);
  const msg = isMe ? '🎲 Extra turn! Dobara daalo' : `🎲 ${currentTurn?.playerName} ko extra turn`;
  LudoGame.showToast(msg);
  LudoGame.addLog(msg, currentTurn?.color || '');
  LudoGame.setRollEnabled(isMe);
  LudoGame.setHint(isMe ? 'Extra turn! Dobara dice daalo 🎲' : '');
});

/* ── turnChanged ───────────────────────────────────────────── */
socket.on('turnChanged', ({ currentTurn, gameState }) => {
  if (gameState) {
    lastGS = gameState;
    window.__setLastGS(gameState);
    LudoGame.setGameState(gameState);
    LudoGame.updatePlayerCards(gameState.players, currentTurn);
  }
  LudoGame.setMovableTokens([]);
  LudoGame.updateTurnLabel(currentTurn);
  LudoGame.render();
  LudoGame.setHint('');
  _refreshRoll(gameState || lastGS, currentTurn);
});

/* ── playerWon ─────────────────────────────────────────────── */
socket.on('playerWon', ({ playerId, playerName, gameState }) => {
  lastGS = gameState;
  LudoGame.setGameState(gameState);
  LudoGame.render();
  const p = gameState.players.find(x => x.id === playerId);
  LudoGame.showWin(playerName, p?.color || '');
  LudoGame.setRollEnabled(false);
  LudoGame.setHint('');
});

/* ── playerLeft ────────────────────────────────────────────── */
socket.on('playerLeft', ({ playerId, players, gameState }) => {
  if (gameState) { lastGS = gameState; LudoGame.setGameState(gameState); }
  LudoGame.showToast('Ek player chala gaya 😢');
  LudoGame.addLog('Ek player disconnect hua', '');
  LudoGame.updatePlayerCards(players, gameState?.currentTurn || null);
  LudoGame.render();
  _refreshRoll(lastGS);
});

/* ── actionError ───────────────────────────────────────────── */
socket.on('actionError', ({ message }) => {
  LudoGame.showToast('⚠️ ' + message);
  _refreshRoll(lastGS);
});

socket.on('disconnect', () => LudoGame.showToast('❌ Server se disconnect…'));
socket.on('connect',    () => { if (myId) LudoGame.showToast('✅ Reconnected!'); });

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function _refreshRoll(gs, overrideTurn) {
  if (!gs) { LudoGame.setRollEnabled(false); return; }
  const ct      = overrideTurn || gs.currentTurn;
  const isMyT   = ct?.playerId === myId;
  const rolled  = gs.diceRolledThisTurn || false;
  LudoGame.setRollEnabled(isMyT && !rolled);
}

function _showScreen(name) {
  lobbyScreen.classList.remove('active');
  waitingScreen.classList.remove('active');
  gameScreen.classList.remove('active');
  if (name === 'lobby')   lobbyScreen.classList.add('active');
  if (name === 'waiting') waitingScreen.classList.add('active');
  if (name === 'game')    gameScreen.classList.add('active');
}

function _showLobbyMsg(msg) {
  const el = $('lobby-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function _renderWaiting(players, roomType, roomId) {
  // Title
  const title = roomType === 'random' ? '🌐 Random Match' : '🔒 Custom Room';
  $('waiting-title').textContent = title;

  // Room ID section
  const ridSection = $('room-id-section');
  const rndInfo    = $('random-wait-info');
  if (roomType === 'custom') {
    ridSection.classList.remove('hidden');
    rndInfo.classList.add('hidden');
    $('waiting-room-id-val').textContent = roomId || '—';
  } else {
    ridSection.classList.add('hidden');
    rndInfo.classList.remove('hidden');
  }

  // Slots label
  const list = $('players-waiting-list');
  list.innerHTML = '';

  // Joined players
  players.forEach((p, i) => {
    const isYou  = p.id === myId;
    const isHost = i === 0;
    const colHex = { red:'#e53935', green:'#43a047', yellow:'#fdd835', blue:'#1e88e5' }[p.color] || '#888';
    const d      = document.createElement('div');
    d.className  = 'w-player';
    d.innerHTML  = `<span class="w-dot" style="background:${colHex}"></span>
      <span class="w-name">${p.name}</span>
      ${isYou  ? '<span class="w-you">YOU</span>'  : ''}
      ${isHost ? '<span class="w-host">HOST</span>' : ''}`;
    list.appendChild(d);
  });

  // Empty slots
  const empty = 4 - players.length;
  for (let i = 0; i < empty; i++) {
    const d = document.createElement('div');
    d.className = 'w-player';
    d.style.opacity = '.35';
    d.innerHTML = `<span class="w-dot" style="background:#333"></span><span class="w-name" style="color:#555">Waiting for player…</span>`;
    list.appendChild(d);
  }
}

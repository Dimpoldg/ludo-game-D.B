/* ═══════════════════════════════════════════════════════════
   LUDO — SOCKET CLIENT  (Online Multiplayer Controller)
   BUG FIXES:
   ✅ Dice freeze fixed — roll button state always derived
      from server gameState, never from local flag
   ✅ Turn rotation always reliable
   ✅ extraTurn properly re-enables dice
   ✅ Canvas click properly routed
   ═══════════════════════════════════════════════════════════ */
'use strict';

// Only run if NOT in offline mode
window._onlineMode = true;

const socket = io();

/* ── DOM refs ─────────────────────────────────────────────── */
const lobbyScreen   = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen    = document.getElementById('game-screen');
const joinBtn       = document.getElementById('join-btn');
const lobbyMsg      = document.getElementById('lobby-msg');
const waitingText   = document.getElementById('waiting-text');
const playersWait   = document.getElementById('players-waiting-list');
const startBtn      = document.getElementById('start-btn');
const copyRoomBtn   = document.getElementById('copy-room-btn');
const rollBtn       = document.getElementById('roll-btn');
const hintLabel     = document.getElementById('hint-label');

/* ── State ────────────────────────────────────────────────── */
let myId       = null;   // socket.id
let myColor    = null;
let roomId     = 'lobby';
let lastGS     = null;   // last gameState from server
let inOffline  = false;  // set true when offline mode starts

/* ── Expose gameState cache (used by game.js / offline.js) ─ */
window.__getLastGS  = () => lastGS;
window.__setLastGS  = (gs) => { lastGS = gs; };

/* ═══════════════════════════════════════════════════════════
   LOBBY
   ═══════════════════════════════════════════════════════════ */
joinBtn.addEventListener('click', () => {
  if (inOffline) return;
  const name = document.getElementById('player-name').value.trim();
  const room = document.getElementById('room-id').value.trim() || 'lobby';
  if (!name) { showLobbyMsg('Naam likho pehle!'); return; }
  roomId = room;
  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining…';
  socket.emit('joinGame', { playerName: name, roomId: room });
});

document.getElementById('player-name')
  .addEventListener('keydown', e => { if (e.key === 'Enter') joinBtn.click(); });

const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom) document.getElementById('room-id').value = urlRoom;

/* ── Waiting Room ─────────────────────────────────────────── */
startBtn.addEventListener('click', () => {
  socket.emit('startGame');
  startBtn.disabled    = true;
  startBtn.textContent = 'Starting…';
});

copyRoomBtn.addEventListener('click', () => {
  const link = `${location.origin}?room=${roomId}`;
  navigator.clipboard.writeText(link)
    .then(() => LudoGame.showToast('📋 Link copied!'))
    .catch(() => LudoGame.showToast('Room: ' + roomId));
});

/* ── Roll buttons (online) — wire BOTH mobile + desktop ─── */
function _onRollClick() {
  if (inOffline) return;
  LudoGame.playSound('roll');
  LudoGame.setRollEnabled(false);  // disable both immediately
  socket.emit('rollDice');
}
if (rollBtn) rollBtn.addEventListener('click', _onRollClick);
// Wire the MOBILE top bar roll button too
const rollBtnTop = document.getElementById('roll-btn-top');
if (rollBtnTop) rollBtnTop.addEventListener('click', _onRollClick);

/* ── Canvas click → move token ────────────────────────────── */
// game.js calls window._socketMoveToken(idx) on canvas click
// online mode handler (offline.js may override this)
window._socketMoveToken = (tokenIndex) => {
  if (inOffline) return;
  socket.emit('moveToken', { tokenIndex });
  LudoGame.setMovableTokens([]);
  LudoGame.render();
};

/* ═══════════════════════════════════════════════════════════
   SOCKET EVENTS
   ═══════════════════════════════════════════════════════════ */

socket.on('joinError', ({ message }) => {
  showLobbyMsg(message);
  joinBtn.disabled    = false;
  joinBtn.textContent = 'Join Game 🚀';
});

/* ── playerJoined ─────────────────────────────────────────── */
socket.on('playerJoined', ({ players, gameState, yourPlayerId, colorAssigned }) => {
  if (!myId) {
    myId    = socket.id;
    myColor = colorAssigned;
    LudoGame.setMyPlayer(myId, myColor);
  }
  lastGS = gameState;
  showScreen('waiting');
  document.getElementById('display-room-id').textContent = roomId;
  renderWaitingList(players);
  startBtn.classList.toggle('hidden', players.length < 2);
  waitingText.textContent = players.length < 2
    ? `Waiting… (${players.length}/4 joined, min 2 required)`
    : `${players.length} players ready! Start karo 🚀`;
});

socket.on('readyToStart', ({ players }) => {
  renderWaitingList(players);
  startBtn.classList.remove('hidden');
  waitingText.textContent = `${players.length} players ready! Start karo 🚀`;
});

/* ── gameStarted ──────────────────────────────────────────── */
socket.on('gameStarted', ({ gameState, currentTurn }) => {
  lastGS = gameState;
  window.__setLastGS(gameState);
  LudoGame.setGameState(gameState);
  showScreen('game');
  LudoGame.initBoard();
  LudoGame.render();
  LudoGame.updatePlayerCards(gameState.players, currentTurn);
  LudoGame.updateTurnLabel(currentTurn);
  setHint('');
  LudoGame.addLog('🎮 Game shuru!', '');
  _refreshRollBtn(gameState);
});

/* ── diceRolled ───────────────────────────────────────────── */
socket.on('diceRolled', ({ playerId, diceValue, movableTokens, forfeit, gameState }) => {
  lastGS = gameState;
  window.__setLastGS(gameState);
  LudoGame.setGameState(gameState);
  LudoGame.showDice(diceValue);

  const player = gameState.players.find(p => p.id === playerId);
  const pname  = player?.name || '?';
  const pcolor = player?.color || '';
  LudoGame.addLog(`${pname} ne ${diceValue} daala`, pcolor);

  if (forfeit) {
    LudoGame.showToast(`${pname} ko 3 sixes penalty! 😱`);
    LudoGame.setMovableTokens([]);
    LudoGame.render();
    setHint('');
    rollBtn.disabled = true;
    return;
  }

  if (playerId === myId) {
    if (movableTokens.length === 0) {
      LudoGame.setMovableTokens([]);
      LudoGame.render();
      LudoGame.showToast('Koi token nahi chala! Turn pass…');
      setHint('Koi valid move nahi hai 😕');
    } else {
      LudoGame.setMovableTokens(movableTokens);
      LudoGame.render();
      setHint('👆 Board pe highlighted token pe click karo!');
      LudoGame.showToast(`${diceValue} aaya! Token select karo`, 3500);
    }
    rollBtn.disabled = true;  // wait for token move
  } else {
    LudoGame.setMovableTokens([]);
    LudoGame.render();
    rollBtn.disabled = true;
  }
});

/* ── tokenMoved ───────────────────────────────────────────── */
socket.on('tokenMoved', ({ playerId, tokenIndex, killedToken, gameState }) => {
  lastGS = gameState;
  window.__setLastGS(gameState);
  LudoGame.setGameState(gameState);
  LudoGame.setMovableTokens([]);
  LudoGame.playSound('move');
  LudoGame.render();
  setHint('');

  const mover = gameState.players.find(p => p.id === playerId);
  LudoGame.addLog(`${mover?.name} ne token ${tokenIndex + 1} chala`, mover?.color || '');

  if (killedToken) {
    LudoGame.playSound('kill');
    const killed = gameState.players.find(p => p.id === killedToken.playerId);
    LudoGame.showToast(`💥 ${mover?.name} ne ${killed?.name}'s token kaata!`);
    LudoGame.addLog(`💥 ${mover?.name} ne ${killed?.name} ka token kaata!`, mover?.color);
  }

  rollBtn.disabled = true;   // will be updated by turnChanged / extraTurn
});

/* ── extraTurn ────────────────────────────────────────────── */
socket.on('extraTurn', ({ currentTurn, reason }) => {
  const isMe = currentTurn?.playerId === myId;
  const msg  = reason === 'six' ? '🎲 6 aaya — extra turn!'
             : reason === 'kill' ? '💥 Kill! Extra turn milega!'
             : '🎯 Extra turn!';
  LudoGame.showToast(msg);
  LudoGame.addLog(msg, currentTurn?.color || '');
  LudoGame.updateTurnLabel(currentTurn);
  if (lastGS) LudoGame.updatePlayerCards(lastGS.players, currentTurn);

  /* KEY FIX: re-enable roll for extra turn */
  LudoGame.setRollEnabled(isMe);
  if (isMe) setHint('Extra turn! Dobara dice daalo 🎲');
  else setHint('');
});

/* ── turnChanged ─────────────────────────────────────────── */
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
  setHint('');

  /* KEY FIX: always re-derive roll state from server */
  _refreshRollBtn(gameState || lastGS, currentTurn);
});

/* ── playerWon ────────────────────────────────────────────── */
socket.on('playerWon', ({ playerId, playerName, gameState }) => {
  lastGS = gameState;
  LudoGame.setGameState(gameState);
  LudoGame.render();
  const p = gameState.players.find(x => x.id === playerId);
  LudoGame.showWin(playerName, p?.color || '');
  LudoGame.setRollEnabled(false);
  setHint('');
});

/* ── playerLeft ───────────────────────────────────────────── */
socket.on('playerLeft', ({ players, gameState }) => {
  if (gameState) {
    lastGS = gameState;
    LudoGame.setGameState(gameState);
    LudoGame.render();
  }
  LudoGame.showToast('Ek player chala gaya 😢');
  LudoGame.addLog('Ek player disconnect hua', '');
  LudoGame.updatePlayerCards(players, gameState?.currentTurn || null);
  _refreshRollBtn(gameState || lastGS);
});

/* ── actionError ──────────────────────────────────────────── */
socket.on('actionError', ({ message }) => {
  LudoGame.showToast('⚠️ ' + message);
  // Re-derive button state — don't leave user stuck
  _refreshRollBtn(lastGS);
});

socket.on('disconnect', () => LudoGame.showToast('❌ Server se connection toot gaya…'));
socket.on('connect',    () => { if (myId) LudoGame.showToast('✅ Reconnected!'); });

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

/**
 * Always derive roll-button state from server gameState.
 * This is the KEY fix for dice-freeze bug:
 * Instead of tracking a local `diceRolled` flag that can
 * desync, we ask: "Is it my turn AND dice not rolled yet?"
 */
function _refreshRollBtn(gs, overrideTurn) {
  if (!gs) { LudoGame.setRollEnabled(false); return; }
  const currentTurn   = overrideTurn || gs.currentTurn;
  const isMyTurn      = currentTurn?.playerId === myId;
  const alreadyRolled = gs.diceRolledThisTurn || false;
  // Use LudoGame.setRollEnabled so BOTH buttons (mobile + desktop) are synced
  LudoGame.setRollEnabled(isMyTurn && !alreadyRolled);
}

function showScreen(name) {
  [lobbyScreen, waitingScreen, gameScreen].forEach(s => s.classList.remove('active'));
  if (name === 'lobby')   lobbyScreen.classList.add('active');
  if (name === 'waiting') waitingScreen.classList.add('active');
  if (name === 'game')    gameScreen.classList.add('active');
}

function showLobbyMsg(msg) {
  lobbyMsg.textContent = msg;
  lobbyMsg.className   = 'lobby-msg';
  lobbyMsg.classList.remove('hidden');
}

function setHint(msg) {
  // Update both mobile and desktop hint labels
  if (typeof LudoGame !== 'undefined' && LudoGame.setHint) {
    LudoGame.setHint(msg);
  } else {
    const h = document.getElementById('hint-label');
    if (h) h.textContent = msg || '';
  }
}

function renderWaitingList(players) {
  playersWait.innerHTML = '';
  players.forEach(p => {
    const d = document.createElement('div');
    d.className = 'player-waiting-item';
    const isYou = p.id === myId;
    d.innerHTML = `
      <div class="player-color-dot" style="background:${colorHex(p.color)}"></div>
      <span class="pname">${p.name}</span>
      <span class="ptag ${isYou ? 'you-tag' : ''}">${isYou ? 'YOU' : p.color}</span>`;
    playersWait.appendChild(d);
  });
}

function colorHex(c) {
  return { red:'#e53935', green:'#43a047', yellow:'#fdd835', blue:'#1e88e5' }[c] || '#888';
}

/* Mark offline mode so socket events don't interfere */
window._setOfflineMode = (v) => { inOffline = v; };

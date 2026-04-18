/* ═══════════════════════════════════════════════
   LUDO GAME — SOCKET CLIENT + UI CONTROLLER
   ═══════════════════════════════════════════════ */
'use strict';

const socket = io();
// ── DOM refs ──────────────────────────────────────────────────────────────────
const lobbyScreen   = document.getElementById('lobby-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen    = document.getElementById('game-screen');

const playerNameInput = document.getElementById('player-name');
const roomIdInput     = document.getElementById('room-id');
const joinBtn         = document.getElementById('join-btn');
const lobbyMsg        = document.getElementById('lobby-msg');

const displayRoomId   = document.getElementById('display-room-id');
const waitingText     = document.getElementById('waiting-text');
const playersWaiting  = document.getElementById('players-waiting-list');
const startBtn        = document.getElementById('start-btn');
const copyRoomBtn     = document.getElementById('copy-room-btn');
const rollBtn         = document.getElementById('roll-btn');

// ── Local state ───────────────────────────────────────────────────────────────
let myPlayerId   = null;
let myColor      = null;
let currentRoomId = 'lobby';
let diceRolled    = false;

// ═════════════════════════════════════════════════════════════════════════════
//  LOBBY: Join
// ═════════════════════════════════════════════════════════════════════════════
joinBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  const room = roomIdInput.value.trim() || 'lobby';

  if (!name) {
    showLobbyMsg('Please enter your name!', false);
    playerNameInput.focus();
    return;
  }

  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining…';
  currentRoomId = room;

  socket.emit('joinGame', { playerName: name, roomId: room });
});

playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinBtn.click();
});

// ═════════════════════════════════════════════════════════════════════════════
//  WAITING ROOM
// ═════════════════════════════════════════════════════════════════════════════
startBtn.addEventListener('click', () => {
  socket.emit('startGame');
  startBtn.disabled = true;
  startBtn.textContent = 'Starting…';
});

copyRoomBtn.addEventListener('click', () => {
  const link = `${window.location.origin}?room=${currentRoomId}`;
  navigator.clipboard.writeText(link).then(() => {
    LudoGame.showToast('📋 Room link copied!');
  }).catch(() => {
    LudoGame.showToast('Room ID: ' + currentRoomId);
  });
});

// Auto-fill room from URL param
const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom) roomIdInput.value = urlRoom;

// ═════════════════════════════════════════════════════════════════════════════
//  DICE & MOVE
// ═════════════════════════════════════════════════════════════════════════════
rollBtn.addEventListener('click', () => {
  if (rollBtn.disabled) return;
  LudoGame.playSound('roll');
  rollBtn.disabled = true;
  socket.emit('rollDice');
});

// Allow socket.js to trigger moveToken from game.js canvas click
window._socketMoveToken = (tokenIndex) => {
  socket.emit('moveToken', { tokenIndex });
  LudoGame.setMovableTokens([]);
  LudoGame.render();
};

// ═════════════════════════════════════════════════════════════════════════════
//  SOCKET EVENTS
// ═════════════════════════════════════════════════════════════════════════════

// ── joinError ─────────────────────────────────────────────────────────────────
socket.on('joinError', ({ message }) => {
  showLobbyMsg(message, false);
  joinBtn.disabled = false;
  joinBtn.textContent = 'Join Game 🚀';
});

// ── playerJoined ──────────────────────────────────────────────────────────────
socket.on('playerJoined', ({ players, gameState, yourPlayerId, colorAssigned }) => {
  // First join? save my id + color
  if (!myPlayerId && yourPlayerId === socket.id) {
    myPlayerId  = socket.id;
    myColor     = colorAssigned;
    LudoGame.setMyPlayer(myPlayerId, myColor);
  }

  // Move to waiting room
  showScreen('waiting');
  displayRoomId.textContent = currentRoomId;
  renderWaitingPlayers(players);

  startBtn.classList.toggle('hidden', players.length < 2);
  waitingText.textContent = players.length < 2
    ? 'Waiting for more players… (min 2 required)'
    : `${players.length} players ready. Press Start!`;
});

// ── readyToStart ──────────────────────────────────────────────────────────────
socket.on('readyToStart', ({ players }) => {
  renderWaitingPlayers(players);
  startBtn.classList.remove('hidden');
  waitingText.textContent = `${players.length} players ready. Press Start!`;
});

// ── gameStarted ───────────────────────────────────────────────────────────────
socket.on('gameStarted', ({ gameState, currentTurn }) => {
  LudoGame.setGameState(gameState);
  showScreen('game');
  LudoGame.initBoard();
  LudoGame.render();
  LudoGame.updatePlayerCards(gameState.players, currentTurn);
  LudoGame.updateTurnLabel(currentTurn);
  LudoGame.addLog('🎮 Game started!', '');
  diceRolled = false;
  updateRollBtn(currentTurn);
});

// ── diceRolled ────────────────────────────────────────────────────────────────
socket.on('diceRolled', ({ playerId, diceValue, movableTokens, forfeit, gameState }) => {
  LudoGame.setGameState(gameState);
  LudoGame.showDice(diceValue);
  diceRolled = true;

  const player = gameState.players.find(p => p.id === playerId);
  const pname  = player ? player.name : 'Someone';
  const pcolor = player ? player.color : '';

  LudoGame.addLog(`${pname} rolled a ${diceValue}`, pcolor);

  if (forfeit) {
    LudoGame.showToast(`${pname} rolled 3 sixes! Turn forfeited 😱`);
    LudoGame.addLog(`${pname} forfeited (3 sixes)`, pcolor);
    LudoGame.setMovableTokens([]);
    LudoGame.render();
    return;
  }

  if (playerId === myPlayerId) {
    if (movableTokens.length === 0) {
      LudoGame.showToast('No tokens to move! Turn passes…');
      LudoGame.setMovableTokens([]);
    } else {
      LudoGame.setMovableTokens(movableTokens);
      LudoGame.showToast(`You rolled ${diceValue}! Click a highlighted token`, 3000);
    }
  } else {
    LudoGame.setMovableTokens([]);
  }
  LudoGame.render();
});

// ── tokenMoved ────────────────────────────────────────────────────────────────
socket.on('tokenMoved', ({ playerId, tokenIndex, killedToken, gameState: newState }) => {
  const oldState  = LudoGame.getGameState ? null : null;
  const player    = newState.players.find(p => p.id === playerId);
  const pcolor    = player ? player.color : '';
  const pname     = player ? player.name : 'Someone';

  LudoGame.setGameState(newState);
  LudoGame.setMovableTokens([]);
  LudoGame.render();

  LudoGame.playSound('move');
  LudoGame.addLog(`${pname} moved token ${tokenIndex + 1}`, pcolor);

  if (killedToken) {
    LudoGame.playSound('kill');
    const killed = newState.players.find(p => p.id === killedToken.playerId);
    LudoGame.showToast(`💥 ${pname} captured ${killed ? killed.name : '?'}'s token!`);
    LudoGame.addLog(`💥 ${pname} captured ${killed ? killed.name : '?'}!`, pcolor);
  }

  diceRolled = false;
});

// ── extraTurn ─────────────────────────────────────────────────────────────────
socket.on('extraTurn', ({ currentTurn, reason }) => {
  LudoGame.updateTurnLabel(currentTurn);
  LudoGame.updatePlayerCards(
    LudoGame.getGameStatePlayers ? LudoGame.getGameStatePlayers() : null,
    currentTurn
  );
  diceRolled = false;

  const isMyTurn = currentTurn && currentTurn.playerId === myPlayerId;
  const msg = reason === 'six' ? '🎲 Rolled 6! Extra turn!' :
              reason === 'kill' ? '💥 Captured! Extra turn!' :
              '🎯 Extra turn!';
  LudoGame.showToast(msg);
  LudoGame.addLog(msg, currentTurn ? currentTurn.color : '');
  updateRollBtnDirect(currentTurn);
});

// ── turnChanged ───────────────────────────────────────────────────────────────
socket.on('turnChanged', ({ currentTurn, gameState }) => {
  if (gameState) {
    LudoGame.setGameState(gameState);
    LudoGame.updatePlayerCards(gameState.players, currentTurn);
  }
  LudoGame.updateTurnLabel(currentTurn);
  LudoGame.setMovableTokens([]);
  diceRolled = false;
  updateRollBtnDirect(currentTurn);
  LudoGame.render();
});

// ── playerWon ─────────────────────────────────────────────────────────────────
socket.on('playerWon', ({ playerId, playerName, gameState }) => {
  LudoGame.setGameState(gameState);
  LudoGame.render();
  const player = gameState.players.find(p => p.id === playerId);
  LudoGame.showWin(playerName, player ? player.color : '');
  rollBtn.disabled = true;
});

// ── playerLeft ────────────────────────────────────────────────────────────────
socket.on('playerLeft', ({ playerId, players, gameState }) => {
  if (gameState) LudoGame.setGameState(gameState);
  const p = players.find(x => x.id !== playerId);
  LudoGame.showToast('A player left the game');
  LudoGame.addLog('A player disconnected', '');
  LudoGame.updatePlayerCards(players, gameState ? gameState.currentTurn : null);
  LudoGame.render();
});

// ── actionError ───────────────────────────────────────────────────────────────
socket.on('actionError', ({ message }) => {
  LudoGame.showToast('⚠️ ' + message);
  // Re-enable roll button if it was disabled erroneously
  if (!diceRolled) {
    const ct = getCurrentTurnFromState();
    updateRollBtnDirect(ct);
  }
});

// ── connect / disconnect ──────────────────────────────────────────────────────
socket.on('disconnect', () => {
  LudoGame.showToast('❌ Disconnected from server. Reconnecting…');
});

socket.on('connect', () => {
  if (myPlayerId) LudoGame.showToast('✅ Reconnected!');
});

// ═════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function showScreen(name) {
  lobbyScreen.classList.remove('active');
  waitingScreen.classList.remove('active');
  gameScreen.classList.remove('active');

  if (name === 'lobby')   lobbyScreen.classList.add('active');
  if (name === 'waiting') waitingScreen.classList.add('active');
  if (name === 'game')    gameScreen.classList.add('active');
}

function showLobbyMsg(msg, success) {
  lobbyMsg.textContent = msg;
  lobbyMsg.className = 'lobby-msg' + (success ? ' success' : '');
  lobbyMsg.classList.remove('hidden');
}

function renderWaitingPlayers(players) {
  playersWaiting.innerHTML = '';
  players.forEach(p => {
    const item = document.createElement('div');
    item.className = 'player-waiting-item';
    const isYou = p.id === myPlayerId;
    item.innerHTML = `
      <div class="player-color-dot" style="background:${getColorHex(p.color)}"></div>
      <span class="pname">${p.name}</span>
      <span class="ptag ${isYou ? 'you-tag' : ''}">${isYou ? 'YOU' : p.color}</span>
    `;
    playersWaiting.appendChild(item);
  });
}

function getColorHex(color) {
  const map = { red:'#e53935', green:'#43a047', yellow:'#fdd835', blue:'#1e88e5' };
  return map[color] || '#888';
}

function updateRollBtn(currentTurn) {
  updateRollBtnDirect(currentTurn);
}

function updateRollBtnDirect(currentTurn) {
  const isMyTurn = currentTurn && currentTurn.playerId === myPlayerId;
  rollBtn.disabled = !isMyTurn || diceRolled;
}

function getCurrentTurnFromState() {
  // Access game state via LudoGame global
  try {
    const gs = window.__ludoLastState;
    return gs ? gs.currentTurn : null;
  } catch { return null; }
}

// Expose getGameState to game.js
LudoGame.getGameState = () => window.__ludoLastState;

// Patch setGameState to also cache
const _origSet = LudoGame.setGameState.bind(LudoGame);
LudoGame.setGameState = (state) => {
  window.__ludoLastState = state;
  _origSet(state);
};

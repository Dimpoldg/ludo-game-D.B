'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const { GameRoom } = require('./server/gameLogic');
const { PlayerManager } = require('./server/players');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── State ────────────────────────────────────────────────────────────────────
const rooms         = {};   // roomId → GameRoom
const playerManager = new PlayerManager();

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── joinGame ───────────────────────────────────────────────────────────────
  socket.on('joinGame', ({ playerName, roomId }) => {
    const rid = (roomId || 'lobby').trim() || 'lobby';

    if (!rooms[rid]) {
      rooms[rid] = new GameRoom(rid, io);
    }

    const room   = rooms[rid];
    const result = room.addPlayer(socket.id, playerName);

    if (!result.success) {
      socket.emit('joinError', { message: result.message });
      return;
    }

    socket.join(rid);
    socket.roomId      = rid;
    socket.playerName  = playerName;
    playerManager.addPlayer(socket.id, playerName);

    io.to(rid).emit('playerJoined', {
      players:       room.getPlayersInfo(),
      gameState:     room.getGameState(),
      yourPlayerId:  socket.id,
      colorAssigned: result.color
    });

    if (room.canStart()) {
      io.to(rid).emit('readyToStart', { players: room.getPlayersInfo() });
    }
  });

  // ── startGame ─────────────────────────────────────────────────────────────
  socket.on('startGame', () => {
    const room = _getRoom(socket);
    if (!room) return;

    if (!room.canStart()) {
      socket.emit('actionError', { message: 'Need at least 2 players to start' });
      return;
    }

    if (room.startGame()) {
      io.to(socket.roomId).emit('gameStarted', {
        gameState:   room.getGameState(),
        currentTurn: room.getCurrentTurn()
      });
    }
  });

  // ── rollDice ──────────────────────────────────────────────────────────────
  socket.on('rollDice', () => {
    const room = _getRoom(socket);
    if (!room) return;

    const result = room.rollDice(socket.id);
    if (!result.success) {
      socket.emit('actionError', { message: result.message });
      return;
    }

    io.to(socket.roomId).emit('diceRolled', {
      playerId:      socket.id,
      diceValue:     result.diceValue,
      movableTokens: result.movableTokens,
      forfeit:       result.forfeit,
      gameState:     room.getGameState()
    });

    // No movable tokens OR forfeit → auto-advance turn after delay
    if (result.movableTokens.length === 0 || result.forfeit) {
      setTimeout(() => {
        if (!rooms[socket.roomId]) return;
        const next = room.nextTurn();
        io.to(socket.roomId).emit('turnChanged', {
          currentTurn: next.currentTurn,
          gameState:   room.getGameState()
        });
      }, 1800);
    }
  });

  // ── moveToken ─────────────────────────────────────────────────────────────
  socket.on('moveToken', ({ tokenIndex }) => {
    const room = _getRoom(socket);
    if (!room) return;

    const result = room.moveToken(socket.id, tokenIndex);
    if (!result.success) {
      socket.emit('actionError', { message: result.message });
      return;
    }

    io.to(socket.roomId).emit('tokenMoved', {
      playerId:    socket.id,
      tokenIndex,
      killedToken: result.killedToken,
      gameState:   room.getGameState()
    });

    if (result.won) {
      io.to(socket.roomId).emit('playerWon', {
        playerId:   socket.id,
        playerName: result.playerName,
        gameState:  room.getGameState()
      });
      return;
    }

    if (result.extraTurn) {
      io.to(socket.roomId).emit('extraTurn', {
        currentTurn: room.getCurrentTurn(),
        reason:      result.extraTurnReason
      });
    } else {
      const next = room.nextTurn();
      io.to(socket.roomId).emit('turnChanged', {
        currentTurn: next.currentTurn,
        gameState:   room.getGameState()
      });
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    playerManager.removePlayer(socket.id);
    const rid = socket.roomId;
    if (!rid || !rooms[rid]) return;

    rooms[rid].removePlayer(socket.id);
    io.to(rid).emit('playerLeft', {
      playerId: socket.id,
      players:  rooms[rid].getPlayersInfo(),
      gameState: rooms[rid].getGameState()
    });

    if (rooms[rid].isEmpty()) {
      delete rooms[rid];
      console.log(`[x] Room "${rid}" deleted (empty)`);
    }
  });
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function _getRoom(socket) {
  if (!socket.roomId || !rooms[socket.roomId]) {
    socket.emit('actionError', { message: 'Not in a room' });
    return null;
  }
  return rooms[socket.roomId];
}

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🎲  Ludo Game Server  →  http://localhost:${PORT}`);
  console.log(`🌐  PORT = ${PORT}`);
});

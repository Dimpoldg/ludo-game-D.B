'use strict';

const ALL_COLORS = ['red', 'green', 'yellow', 'blue'];

const PLAYER_PATHS = {
  red:[
    [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],
    [6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],
    [12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],
    [7,1],[7,2],[7,3],[7,4],[7,5],[7,6]
  ],
  green:[
    [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
    [7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],
    [13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],
    [8,3],[8,2],[8,1],[8,0],[7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],
    [1,7],[2,7],[3,7],[4,7],[5,7],[6,7]
  ],
  yellow:[
    [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
    [14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],
    [8,1],[8,0],[7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],
    [2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],
    [6,11],[6,12],[6,13],[6,14],[7,14],
    [7,13],[7,12],[7,11],[7,10],[7,9],[7,8]
  ],
  blue:[
    [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
    [7,0],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],
    [0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],
    [6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],
    [11,8],[12,8],[13,8],[14,8],[14,7],
    [13,7],[12,7],[11,7],[10,7],[9,7],[8,7]
  ]
};

const HOME_POSITIONS = {
  red:    [[2,2],[2,3],[3,2],[3,3]],
  green:  [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue:   [[11,2],[11,3],[12,2],[12,3]]
};

const SAFE_CELLS = new Set([
  '6,1','1,8','8,13','13,6','2,6','6,12','12,8','8,2'
]);

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.players = [];
    this.gameStarted = false;
    this.currentTurnIndex = 0;
    this.lastDiceValue = null;
    this.diceRolledThisTurn = false;
    this.movableTokens = [];
    this.consecutiveSixes = 0;
    this.isPublic = false; // set true for random matchmaking rooms
  }

  // ── addPlayer: supports color preference ──────────────────
  addPlayer(socketId, playerName, preferredColor) {
    if (this.players.length >= 4)
      return { success: false, message: 'Room is full (max 4 players)' };
    if (this.gameStarted)
      return { success: false, message: 'Game already in progress' };
    if (this.players.find(p => p.id === socketId))
      return { success: false, message: 'Already in room' };

    const usedColors = this.players.map(p => p.color);
    let color;

    // Try preferred color first, fall back to next available
    if (preferredColor && ALL_COLORS.includes(preferredColor) && !usedColors.includes(preferredColor)) {
      color = preferredColor;
    } else {
      color = ALL_COLORS.find(c => !usedColors.includes(c));
    }

    if (!color) return { success: false, message: 'No colors available' };

    const player = {
      id: socketId,
      name: playerName || `Player ${this.players.length + 1}`,
      color,
      preferredColor: preferredColor || null,
      tokens: Array.from({ length: 4 }, () => ({ position: -1, finished: false })),
      finishedTokens: 0
    };
    this.players.push(player);
    return { success: true, color };
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.id === socketId);
    if (idx !== -1) this.players.splice(idx, 1);
    if (this.currentTurnIndex >= this.players.length && this.players.length > 0)
      this.currentTurnIndex = 0;
  }

  canStart() { return this.players.length >= 2 && !this.gameStarted; }

  startGame() {
    if (!this.canStart()) return false;
    this.gameStarted = true;
    this.currentTurnIndex = 0;
    this.diceRolledThisTurn = false;
    return true;
  }

  getCurrentTurn() {
    if (!this.gameStarted || !this.players.length) return null;
    const p = this.players[this.currentTurnIndex];
    return { playerId: p.id, playerName: p.name, color: p.color, turnIndex: this.currentTurnIndex };
  }

  rollDice(socketId) {
    if (!this.gameStarted) return { success: false, message: 'Game not started' };
    const cur = this.players[this.currentTurnIndex];
    if (cur.id !== socketId) return { success: false, message: 'Not your turn!' };
    if (this.diceRolledThisTurn) return { success: false, message: 'Already rolled' };

    const dice = Math.floor(Math.random() * 6) + 1;
    this.lastDiceValue = dice;
    this.diceRolledThisTurn = true;

    if (dice === 6) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes >= 3) {
        this.consecutiveSixes = 0;
        this.diceRolledThisTurn = false;
        this.movableTokens = [];
        return { success: true, diceValue: dice, movableTokens: [], forfeit: true };
      }
    } else {
      this.consecutiveSixes = 0;
    }

    this.movableTokens = this._movable(cur, dice);
    return { success: true, diceValue: dice, movableTokens: this.movableTokens, forfeit: false };
  }

  _movable(player, dice) {
    const m = [];
    player.tokens.forEach((t, i) => {
      if (t.finished) return;
      if (t.position === -1) { if (dice === 6) m.push(i); }
      else { if (t.position + dice <= 57) m.push(i); }
    });
    return m;
  }

  moveToken(socketId, tokenIndex) {
    if (!this.gameStarted) return { success: false, message: 'Game not started' };
    const player = this.players[this.currentTurnIndex];
    if (player.id !== socketId) return { success: false, message: 'Not your turn!' };
    if (!this.diceRolledThisTurn) return { success: false, message: 'Roll dice first!' };
    if (!this.movableTokens.includes(tokenIndex)) return { success: false, message: 'Invalid token' };

    const token = player.tokens[tokenIndex];
    const path  = PLAYER_PATHS[player.color];
    let killedToken = null, extraTurn = false;

    if (token.position === -1) { token.position = 0; }
    else { token.position += this.lastDiceValue; }

    if (token.position === 57) {
      token.finished = true;
      player.finishedTokens++;
    } else if (token.position > 57) {
      token.position -= this.lastDiceValue;
      this.diceRolledThisTurn = false;
      this.movableTokens = [];
      return { success: false, message: 'Cannot overshoot finish' };
    }

    if (!token.finished && token.position >= 0 && token.position <= 50) {
      const [tr, tc] = path[token.position];
      const key = `${tr},${tc}`;
      if (!SAFE_CELLS.has(key)) {
        for (const other of this.players) {
          if (other.id === socketId) continue;
          const op = PLAYER_PATHS[other.color];
          for (let i = 0; i < other.tokens.length; i++) {
            const ot = other.tokens[i];
            if (ot.finished || ot.position < 0 || ot.position > 50) continue;
            const [or, oc] = op[ot.position];
            if (or === tr && oc === tc) {
              ot.position = -1;
              killedToken = { playerId: other.id, playerColor: other.color, tokenIndex: i };
              extraTurn = true;
            }
          }
        }
      }
    }

    if (this.lastDiceValue === 6 && !extraTurn) extraTurn = true;
    this.diceRolledThisTurn = false;
    this.movableTokens = [];

    // Sync finishedTokens
    player.finishedTokens = player.tokens.filter(t => t.finished).length;
    const won = player.tokens.every(t => t.finished);

    return { success: true, won, playerName: player.name, killedToken, extraTurn: extraTurn && !won };
  }

  nextTurn() {
    this.diceRolledThisTurn = false;
    this.movableTokens = [];
    this.lastDiceValue = null;
    this.consecutiveSixes = 0;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    return { currentTurn: this.getCurrentTurn() };
  }

  getPlayersInfo() {
    return this.players.map(p => ({ id: p.id, name: p.name, color: p.color, finishedTokens: p.finishedTokens }));
  }

  getGameState() {
    return {
      started: this.gameStarted,
      currentTurnIndex: this.currentTurnIndex,
      currentTurn: this.getCurrentTurn(),
      lastDiceValue: this.lastDiceValue,
      diceRolledThisTurn: this.diceRolledThisTurn,
      movableTokens: this.movableTokens,
      players: this.players.map(p => ({
        id: p.id, name: p.name, color: p.color, finishedTokens: p.finishedTokens,
        tokens: p.tokens.map(t => ({ position: t.position, finished: t.finished }))
      }))
    };
  }

  isEmpty()    { return this.players.length === 0; }
  isFull()     { return this.players.length >= 4; }
  playerCount(){ return this.players.length; }
}

module.exports = { GameRoom, PLAYER_PATHS, HOME_POSITIONS, SAFE_CELLS };

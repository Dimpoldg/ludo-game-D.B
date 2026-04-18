'use strict';

const COLORS = ['red', 'green', 'yellow', 'blue'];

// ─── Full 57-cell path per player ────────────────────────────────────────────
// Positions 0-50  = main outer track (shared, different starting offset)
// Positions 51-56 = player's exclusive colored home column
// Position  57    = center / finished
// Token pos -1    = still in home yard
// ─────────────────────────────────────────────────────────────────────────────
const PLAYER_PATHS = {
  red: [
    // Main track (0-50)
    [6,1],[6,2],[6,3],[6,4],[6,5],          // 0-4
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],    // 5-10
    [0,7],[0,8],                             // 11-12
    [1,8],[2,8],[3,8],[4,8],[5,8],          // 13-17
    [6,9],[6,10],[6,11],[6,12],[6,13],      // 18-22
    [6,14],[7,14],[8,14],                   // 23-25
    [8,13],[8,12],[8,11],[8,10],[8,9],      // 26-30
    [9,8],[10,8],[11,8],[12,8],[13,8],      // 31-35
    [14,8],[14,7],[14,6],                   // 36-38
    [13,6],[12,6],[11,6],[10,6],[9,6],      // 39-43
    [8,5],[8,4],[8,3],[8,2],[8,1],          // 44-48
    [8,0],[7,0],                             // 49-50
    // Home column going RIGHT on row 7 toward center (51-56)
    [7,1],[7,2],[7,3],[7,4],[7,5],[7,6]     // 51-56
  ],
  green: [
    // Main track (0-50)
    [1,8],[2,8],[3,8],[4,8],[5,8],          // 0-4
    [6,9],[6,10],[6,11],[6,12],[6,13],      // 5-9
    [6,14],[7,14],[8,14],                   // 10-12
    [8,13],[8,12],[8,11],[8,10],[8,9],      // 13-17
    [9,8],[10,8],[11,8],[12,8],[13,8],      // 18-22
    [14,8],[14,7],[14,6],                   // 23-25
    [13,6],[12,6],[11,6],[10,6],[9,6],      // 26-30
    [8,5],[8,4],[8,3],[8,2],[8,1],          // 31-35
    [8,0],[7,0],[6,0],                      // 36-38
    [6,1],[6,2],[6,3],[6,4],[6,5],          // 39-43
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],    // 44-49
    [0,7],                                   // 50
    // Home column going DOWN on col 7 toward center (51-56)
    [1,7],[2,7],[3,7],[4,7],[5,7],[6,7]     // 51-56
  ],
  yellow: [
    // Main track (0-50)
    [8,13],[8,12],[8,11],[8,10],[8,9],      // 0-4
    [9,8],[10,8],[11,8],[12,8],[13,8],      // 5-9
    [14,8],[14,7],[14,6],                   // 10-12
    [13,6],[12,6],[11,6],[10,6],[9,6],      // 13-17
    [8,5],[8,4],[8,3],[8,2],[8,1],          // 18-22
    [8,0],[7,0],[6,0],                      // 23-25
    [6,1],[6,2],[6,3],[6,4],[6,5],          // 26-30
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],    // 31-36
    [0,7],[0,8],                             // 37-38
    [1,8],[2,8],[3,8],[4,8],[5,8],          // 39-43
    [6,9],[6,10],[6,11],[6,12],[6,13],      // 44-48
    [6,14],[7,14],                          // 49-50
    // Home column going LEFT on row 7 toward center (51-56)
    [7,13],[7,12],[7,11],[7,10],[7,9],[7,8] // 51-56
  ],
  blue: [
    // Main track (0-50)
    [13,6],[12,6],[11,6],[10,6],[9,6],      // 0-4
    [8,5],[8,4],[8,3],[8,2],[8,1],          // 5-9
    [8,0],[7,0],[6,0],                      // 10-12
    [6,1],[6,2],[6,3],[6,4],[6,5],          // 13-17
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],    // 18-23
    [0,7],[0,8],                             // 24-25
    [1,8],[2,8],[3,8],[4,8],[5,8],          // 26-30
    [6,9],[6,10],[6,11],[6,12],[6,13],      // 31-35
    [6,14],[7,14],[8,14],                   // 36-38
    [8,13],[8,12],[8,11],[8,10],[8,9],      // 39-43
    [9,8],[10,8],[11,8],[12,8],[13,8],      // 44-48
    [14,8],[14,7],                          // 49-50
    // Home column going UP on col 7 toward center (51-56)
    [13,7],[12,7],[11,7],[10,7],[9,7],[8,7] // 51-56
  ]
};

// Safe zones: tokens here cannot be captured
// 4 starting cells + 4 eight-step cells
const SAFE_CELLS = new Set([
  '6,1',  // Red start
  '1,8',  // Green start
  '8,13', // Yellow start
  '13,6', // Blue start
  '2,6',  // Red position 8
  '6,12', // Green position 8
  '12,8', // Yellow position 8
  '8,2'   // Blue position 8
]);

// Visual home yard slot positions for each player's 4 tokens
const HOME_POSITIONS = {
  red:    [[2,2],[2,3],[3,2],[3,3]],
  green:  [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue:   [[11,2],[11,3],[12,2],[12,3]]
};

// ─── GameRoom class ───────────────────────────────────────────────────────────
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
  }

  // ── Player management ──────────────────────────────────────────────────────
  addPlayer(socketId, playerName) {
    if (this.players.length >= 4)
      return { success: false, message: 'Room is full (max 4 players)' };
    if (this.gameStarted)
      return { success: false, message: 'Game already in progress' };
    if (this.players.find(p => p.id === socketId))
      return { success: false, message: 'Already in room' };

    const color = COLORS[this.players.length];
    const player = {
      id: socketId,
      name: playerName || `Player ${this.players.length + 1}`,
      color,
      tokens: Array.from({ length: 4 }, () => ({ position: -1, finished: false })),
      finishedTokens: 0
    };

    this.players.push(player);
    return { success: true, color };
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.id === socketId);
    if (idx !== -1) this.players.splice(idx, 1);
    // Adjust turn index if necessary
    if (this.currentTurnIndex >= this.players.length && this.players.length > 0) {
      this.currentTurnIndex = 0;
    }
  }

  // ── Game control ───────────────────────────────────────────────────────────
  canStart() {
    return this.players.length >= 2 && !this.gameStarted;
  }

  startGame() {
    if (!this.canStart()) return false;
    this.gameStarted = true;
    this.currentTurnIndex = 0;
    this.diceRolledThisTurn = false;
    return true;
  }

  getCurrentTurn() {
    if (!this.gameStarted || this.players.length === 0) return null;
    const p = this.players[this.currentTurnIndex];
    return {
      playerId: p.id,
      playerName: p.name,
      color: p.color,
      turnIndex: this.currentTurnIndex
    };
  }

  // ── Dice roll ──────────────────────────────────────────────────────────────
  rollDice(socketId) {
    if (!this.gameStarted)
      return { success: false, message: 'Game not started yet' };

    const current = this.players[this.currentTurnIndex];
    if (current.id !== socketId)
      return { success: false, message: 'Not your turn!' };

    if (this.diceRolledThisTurn)
      return { success: false, message: 'Already rolled this turn' };

    const diceValue = Math.floor(Math.random() * 6) + 1;
    this.lastDiceValue = diceValue;
    this.diceRolledThisTurn = true;

    // 3 consecutive sixes rule → forfeit turn
    if (diceValue === 6) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes >= 3) {
        this.consecutiveSixes = 0;
        this.diceRolledThisTurn = false;
        this.movableTokens = [];
        return { success: true, diceValue, movableTokens: [], forfeit: true };
      }
    } else {
      this.consecutiveSixes = 0;
    }

    this.movableTokens = this._getMovableTokens(current, diceValue);
    return { success: true, diceValue, movableTokens: this.movableTokens, forfeit: false };
  }

  _getMovableTokens(player, diceValue) {
    const movable = [];
    player.tokens.forEach((token, idx) => {
      if (token.finished) return;
      if (token.position === -1) {
        if (diceValue === 6) movable.push(idx);
      } else {
        const newPos = token.position + diceValue;
        if (newPos <= 57) movable.push(idx);  // 57 = exact finish
      }
    });
    return movable;
  }

  // ── Move token ─────────────────────────────────────────────────────────────
  moveToken(socketId, tokenIndex) {
    if (!this.gameStarted)
      return { success: false, message: 'Game not started yet' };

    const player = this.players[this.currentTurnIndex];
    if (player.id !== socketId)
      return { success: false, message: 'Not your turn!' };

    if (!this.diceRolledThisTurn)
      return { success: false, message: 'Roll dice first!' };

    if (!this.movableTokens.includes(tokenIndex))
      return { success: false, message: 'That token cannot move' };

    const token = player.tokens[tokenIndex];
    const path = PLAYER_PATHS[player.color];
    let killedToken = null;
    let extraTurn = false;
    let extraTurnReason = '';

    // Move the token
    if (token.position === -1) {
      token.position = 0;  // Enter the board
    } else {
      token.position += this.lastDiceValue;
    }

    // Check finish
    if (token.position >= 57) {
      token.position = 57;
      token.finished = true;
      player.finishedTokens++;
    }

    // Kill check (only on main track, pos 0-50, not home col 51-56)
    if (!token.finished && token.position <= 50) {
      const [tr, tc] = path[token.position];
      const cellKey = `${tr},${tc}`;

      if (!SAFE_CELLS.has(cellKey)) {
        for (const other of this.players) {
          if (other.id === socketId) continue;
          const otherPath = PLAYER_PATHS[other.color];

          for (let i = 0; i < other.tokens.length; i++) {
            const ot = other.tokens[i];
            if (ot.finished || ot.position < 0 || ot.position > 50) continue;

            const [or, oc] = otherPath[ot.position];
            if (or === tr && oc === tc) {
              ot.position = -1;  // Send back to yard
              killedToken = { playerId: other.id, playerColor: other.color, tokenIndex: i };
              extraTurn = true;
              extraTurnReason = 'kill';
            }
          }
        }
      }
    }

    // Extra turn for rolling 6
    if (this.lastDiceValue === 6 && !extraTurn) {
      extraTurn = true;
      extraTurnReason = 'six';
    } else if (this.lastDiceValue === 6 && extraTurn) {
      extraTurnReason = 'six_and_kill';
    }

    // Reset dice state
    this.diceRolledThisTurn = false;
    this.movableTokens = [];
    const won = player.finishedTokens >= 4;

    return {
      success: true,
      won,
      playerName: player.name,
      killedToken,
      extraTurn: extraTurn && !won,
      extraTurnReason
    };
  }

  // ── Advance turn ───────────────────────────────────────────────────────────
  nextTurn() {
    this.diceRolledThisTurn = false;
    this.movableTokens = [];
    this.lastDiceValue = null;
    this.consecutiveSixes = 0;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    return { currentTurn: this.getCurrentTurn() };
  }

  // ── State helpers ──────────────────────────────────────────────────────────
  getPlayersInfo() {
    return this.players.map(p => ({
      id: p.id, name: p.name, color: p.color, finishedTokens: p.finishedTokens
    }));
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
        id: p.id,
        name: p.name,
        color: p.color,
        finishedTokens: p.finishedTokens,
        tokens: p.tokens.map(t => ({ position: t.position, finished: t.finished }))
      }))
    };
  }

  isEmpty() { return this.players.length === 0; }
}

module.exports = { GameRoom, PLAYER_PATHS, HOME_POSITIONS, SAFE_CELLS };

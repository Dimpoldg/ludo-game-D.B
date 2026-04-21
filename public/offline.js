/* ═══════════════════════════════════════════════════════════════
   LUDO OFFLINE MODE  —  Full AI Bot Engine (Client-side)
   ═══════════════════════════════════════════════════════════════
   Ek completely standalone offline game manager.
   Server ya Socket.io ki zaroorat nahi.
   LudoGame (game.js) ke canvas renderer ka use karta hai.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Path data (same as server/gameLogic.js) ───────────────────────────────────
const OFL_PATHS = {
  red: [
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],
    [6,14],[7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],
    [9,8],[10,8],[11,8],[12,8],[13,8],
    [14,8],[14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],
    [8,0],[7,0],
    [7,1],[7,2],[7,3],[7,4],[7,5],[7,6]
  ],
  green: [
    [1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],
    [6,14],[7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],
    [9,8],[10,8],[11,8],[12,8],[13,8],
    [14,8],[14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],
    [8,0],[7,0],[6,0],
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],
    [1,7],[2,7],[3,7],[4,7],[5,7],[6,7]
  ],
  yellow: [
    [8,13],[8,12],[8,11],[8,10],[8,9],
    [9,8],[10,8],[11,8],[12,8],[13,8],
    [14,8],[14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],
    [8,0],[7,0],[6,0],
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],
    [6,14],[7,14],
    [7,13],[7,12],[7,11],[7,10],[7,9],[7,8]
  ],
  blue: [
    [13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],
    [8,0],[7,0],[6,0],
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],
    [6,14],[7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],
    [9,8],[10,8],[11,8],[12,8],[13,8],
    [14,8],[14,7],
    [13,7],[12,7],[11,7],[10,7],[9,7],[8,7]
  ]
};

const OFL_HOME_SLOTS = {
  red:    [[2,2],[2,3],[3,2],[3,3]],
  green:  [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue:   [[11,2],[11,3],[12,2],[12,3]]
};

const OFL_SAFE = new Set([
  '6,1','1,8','8,13','13,6',
  '2,6','6,12','12,8','8,2'
]);

const OFL_COLORS = ['red','green','yellow','blue'];

// Bot thinking delay (ms) by difficulty
const BOT_DELAYS = { easy: 1400, medium: 900, hard: 500 };

// ═══════════════════════════════════════════════════════════════
//  OFFLINE GAME ENGINE
// ═══════════════════════════════════════════════════════════════
const OfflineGame = (() => {

  // ── Internal state ────────────────────────────────────────────
  let state = null;   // full game state object
  let isRunning = false;

  /* state shape:
    {
      players: [ { name, color, isBot, difficulty, tokens:[{position,finished}], finishedTokens } ],
      currentTurnIndex: 0,
      diceValue: null,
      diceRolled: false,
      movableTokens: [],
      consecutiveSixes: 0,
      gameOver: false
    }
  */

  // ── PUBLIC: start ─────────────────────────────────────────────
  function start(playerName, numBots, difficulty) {
    numBots = Math.min(Math.max(numBots, 1), 3);

    const players = [];

    // Human player
    players.push(_makePlayer(playerName, OFL_COLORS[0], false, difficulty));

    // Bot players
    const botNames = ['🤖 Bot Alpha','🤖 Bot Beta','🤖 Bot Gamma'];
    for (let i = 0; i < numBots; i++) {
      players.push(_makePlayer(botNames[i], OFL_COLORS[i + 1], true, difficulty));
    }

    state = {
      players,
      currentTurnIndex: 0,
      diceValue: null,
      diceRolled: false,
      movableTokens: [],
      consecutiveSixes: 0,
      gameOver: false
    };
    isRunning = true;

    // Show game screen
    _showGameScreen();

    // Show offline badge
    let badge = document.getElementById('offline-mode-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'offline-mode-badge';
      badge.className = 'offline-badge';
      badge.textContent = '🤖 Offline vs Bots';
      document.body.appendChild(badge);
    }
    badge.classList.remove('hidden');

    // Push state to renderer
    _syncRenderer();
    LudoGame.render();
    LudoGame.addLog('🎮 Offline game started!', '');

    // Setup roll button for human
    _setupRollButton();

    // Start first turn
    _beginTurn();
  }

  // ── PRIVATE helpers ───────────────────────────────────────────
  function _makePlayer(name, color, isBot, difficulty) {
    return {
      id: isBot ? `bot_${color}` : 'human',
      name, color, isBot, difficulty,
      tokens: Array.from({ length: 4 }, () => ({ position: -1, finished: false })),
      finishedTokens: 0
    };
  }

  function _showGameScreen() {
    document.getElementById('lobby-screen').classList.remove('active');
    document.getElementById('waiting-screen').classList.remove('active');
    const gs = document.getElementById('game-screen');
    gs.classList.add('active');
    LudoGame.initBoard();
  }

  function _setupRollButton() {
    const btn = document.getElementById('roll-btn');
    // Clone to remove any existing online listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      if (!isRunning || state.gameOver) return;
      const cur = state.players[state.currentTurnIndex];
      if (cur.isBot || state.diceRolled) return;
      LudoGame.playSound('roll');
      _doRoll();
    });
    newBtn.disabled = false;
  }

  function _syncRenderer() {
    if (!state) return;
    const gs = _buildGameStateForRenderer();
    LudoGame.setGameState(gs);
    LudoGame.setMyPlayer('human', state.players[0].color);
    LudoGame.setMovableTokens(
      _isHumanTurn() && state.diceRolled ? state.movableTokens : []
    );
    LudoGame.updatePlayerCards(gs.players, gs.currentTurn);
    LudoGame.updateTurnLabel(gs.currentTurn);
    _setRollEnabled(_isHumanTurn() && !state.diceRolled && !state.gameOver);
  }

  function _buildGameStateForRenderer() {
    const cur = state.players[state.currentTurnIndex];
    return {
      started: true,
      currentTurnIndex: state.currentTurnIndex,
      currentTurn: {
        playerId: cur.id,
        playerName: cur.name,
        color: cur.color
      },
      lastDiceValue: state.diceValue,
      diceRolledThisTurn: state.diceRolled,
      movableTokens: state.movableTokens,
      players: state.players.map(p => ({
        id: p.id, name: p.name, color: p.color,
        finishedTokens: p.finishedTokens,
        tokens: p.tokens.map(t => ({ position: t.position, finished: t.finished }))
      }))
    };
  }

  function _isHumanTurn() {
    return state && state.players[state.currentTurnIndex].id === 'human';
  }

  function _setRollEnabled(on) {
    const btn = document.getElementById('roll-btn');
    if (btn) btn.disabled = !on;
  }

  // ── Turn management ───────────────────────────────────────────
  function _beginTurn() {
    if (!state || state.gameOver) return;
    state.diceRolled = false;
    state.diceValue = null;
    state.movableTokens = [];
    _syncRenderer();

    const cur = state.players[state.currentTurnIndex];
    LudoGame.addLog(`${cur.isBot ? '🤖' : '🎯'} ${cur.name}'s turn`, cur.color);

    if (cur.isBot) {
      const delay = BOT_DELAYS[cur.difficulty] || 900;
      // Show "thinking" in turn label
      const tl = document.getElementById('turn-label');
      if (tl) {
        tl.innerHTML = `<span style="color:#c084fc;animation:pulse 1s infinite">🤖 ${cur.name} thinking…</span>`;
      }
      setTimeout(() => _botRoll(), delay);
    } else {
      _setRollEnabled(true);
    }
  }

  function _nextTurn(extraTurn) {
    if (!extraTurn) {
      state.currentTurnIndex = (state.currentTurnIndex + 1) % state.players.length;
      state.consecutiveSixes = 0;
    }
    _beginTurn();
  }

  // ── Dice roll ─────────────────────────────────────────────────
  function _doRoll() {
    if (state.diceRolled) return;
    const dice = Math.floor(Math.random() * 6) + 1;
    state.diceValue = dice;
    state.diceRolled = true;

    // 3 consecutive sixes → forfeit
    if (dice === 6) {
      state.consecutiveSixes++;
      if (state.consecutiveSixes >= 3) {
        const cur = state.players[state.currentTurnIndex];
        LudoGame.showDice(dice);
        LudoGame.addLog(`😱 ${cur.name} rolled 3 sixes — turn forfeited!`, cur.color);
        LudoGame.showToast(`${cur.name} forfeit! (3 sixes)`);
        state.consecutiveSixes = 0;
        state.diceRolled = false;
        _syncRenderer();
        setTimeout(() => _nextTurn(false), 1200);
        return;
      }
    } else {
      state.consecutiveSixes = 0;
    }

    const cur = state.players[state.currentTurnIndex];
    state.movableTokens = _getMovable(cur, dice);

    LudoGame.showDice(dice);
    LudoGame.addLog(`${cur.name} rolled ${dice}`, cur.color);
    _syncRenderer();

    if (state.movableTokens.length === 0) {
      // No moves — auto pass
      LudoGame.showToast(`${cur.name}: no moves!`);
      LudoGame.addLog('No movable tokens — pass', cur.color);
      setTimeout(() => _nextTurn(false), 1100);
    } else if (cur.isBot) {
      // Bot picks a token after a short pause
      const pickDelay = BOT_DELAYS[cur.difficulty] || 900;
      setTimeout(() => _botPickToken(cur), pickDelay);
    }
    // Human → waits for canvas click via _humanPickToken()
  }

  function _botRoll() {
    if (!state || state.gameOver) return;
    LudoGame.playSound('roll');
    _doRoll();
  }

  // ── Get movable token indices ──────────────────────────────────
  function _getMovable(player, dice) {
    const movable = [];
    player.tokens.forEach((t, i) => {
      if (t.finished) return;
      if (t.position === -1) {
        if (dice === 6) movable.push(i);
      } else {
        if (t.position + dice <= 57) movable.push(i);
      }
    });
    return movable;
  }

  // ── Move a token ──────────────────────────────────────────────
  function _moveToken(playerIndex, tokenIndex) {
    const player = state.players[playerIndex];
    const token  = player.tokens[tokenIndex];
    const path   = OFL_PATHS[player.color];
    const dice   = state.diceValue;

    const prevPos = token.position;

    // Move
    if (token.position === -1) {
      token.position = 0;
    } else {
      token.position += dice;
    }

    let killed = null;
    let extraTurn = false;

    // Check finish
    if (token.position >= 57) {
      token.position = 57;
      token.finished = true;
      player.finishedTokens++;
      LudoGame.addLog(`🏠 ${player.name}'s token ${tokenIndex+1} reached home!`, player.color);
      LudoGame.showToast(`${player.name}: token home! 🏠`);
    }

    // Kill check
    if (!token.finished && token.position <= 50) {
      const [tr, tc] = path[token.position];
      const cellKey = `${tr},${tc}`;
      if (!OFL_SAFE.has(cellKey)) {
        state.players.forEach((other, oi) => {
          if (oi === playerIndex) return;
          const otherPath = OFL_PATHS[other.color];
          other.tokens.forEach((ot, ti) => {
            if (ot.finished || ot.position < 0 || ot.position > 50) return;
            const [or, oc] = otherPath[ot.position];
            if (or === tr && oc === tc) {
              ot.position = -1;
              killed = { playerIndex: oi, tokenIndex: ti, name: other.name, color: other.color };
              extraTurn = true;
            }
          });
        });
      }
    }

    if (killed) {
      LudoGame.playSound('kill');
      LudoGame.addLog(`💥 ${player.name} captured ${killed.name}'s token!`, player.color);
      LudoGame.showToast(`💥 ${player.name} captured ${killed.name}!`);
    }

    if (dice === 6 && !extraTurn) extraTurn = true;

    // Clear dice state
    state.diceRolled = false;
    state.movableTokens = [];

    // Sync renderer
    _syncRenderer();
    LudoGame.playSound('move');
    LudoGame.render();

    // Check win
    if (player.finishedTokens >= 4) {
      state.gameOver = true;
      isRunning = false;
      _setRollEnabled(false);
      setTimeout(() => {
        LudoGame.showWin(player.name, player.color);
        LudoGame.addLog(`🏆 ${player.name} WINS!`, player.color);
      }, 400);
      return;
    }

    // Next turn
    setTimeout(() => _nextTurn(extraTurn), 350);
  }

  // ── Human token selection (canvas click) ─────────────────────
  // game.js calls window._socketMoveToken(idx) on canvas click
  window._socketMoveToken = (tokenIndex) => {
    if (!isRunning || !_isHumanTurn() || state.gameOver) return;
    if (!state.movableTokens.includes(tokenIndex)) return;
    _moveToken(state.currentTurnIndex, tokenIndex);
  };

  // ── Bot token selection AI ────────────────────────────────────
  function _botPickToken(bot) {
    if (!state || state.gameOver) return;
    const movable = state.movableTokens;
    if (movable.length === 0) return;

    const pidx = state.currentTurnIndex;
    const chosen = _aiChooseToken(bot, movable, state.diceValue, pidx);
    _moveToken(pidx, chosen);
  }

  // ─────────────────────────────────────────────────────────────
  //  BOT AI: Choose the best token to move
  //  Strategy by difficulty:
  //    easy   → random choice
  //    medium → prefer kill > enter board > advance furthest
  //    hard   → prefer kill > enter home col > near-finish > kill-threat avoid > furthest
  // ─────────────────────────────────────────────────────────────
  function _aiChooseToken(bot, movable, dice, playerIndex) {
    if (bot.difficulty === 'easy') {
      return movable[Math.floor(Math.random() * movable.length)];
    }

    const player  = state.players[playerIndex];
    const path    = OFL_PATHS[player.color];
    const scores  = movable.map(idx => _scoreMove(player, idx, dice, playerIndex, bot.difficulty, path));

    // Pick highest scored
    let best = movable[0], bestScore = scores[0];
    movable.forEach((idx, i) => {
      if (scores[i] > bestScore) { best = idx; bestScore = scores[i]; }
    });
    return best;
  }

  function _scoreMove(player, tokenIdx, dice, playerIndex, diff, path) {
    const token = player.tokens[tokenIdx];
    const newPos = token.position === -1 ? 0 : token.position + dice;
    let score = 0;

    // ── Will it finish? big reward
    if (newPos >= 57) return 1000;

    // ── Entering board from yard
    if (token.position === -1) score += 30;

    // ── Will it kill an opponent?
    if (newPos <= 50) {
      const [nr, nc] = path[newPos];
      const kills = _countKillsAt(nr, nc, playerIndex);
      score += kills * (diff === 'hard' ? 200 : 80);
    }

    // ── Hard: try to avoid landing on occupied safe cell (stack = no kill possible)
    // ── Prefer home column (pos > 50)
    if (newPos > 50) score += 60;

    // ── Advance tokens that are further along
    score += newPos * 0.5;

    // ── Hard: avoid being killed on new position
    if (diff === 'hard' && newPos <= 50) {
      const [nr, nc] = path[newPos];
      const cellKey = `${nr},${nc}`;
      if (!OFL_SAFE.has(cellKey)) {
        const threat = _threatScore(nr, nc, playerIndex);
        score -= threat * 40;
      }
    }

    return score;
  }

  function _countKillsAt(row, col, myPlayerIndex) {
    let kills = 0;
    state.players.forEach((other, oi) => {
      if (oi === myPlayerIndex) return;
      const otherPath = OFL_PATHS[other.color];
      other.tokens.forEach(ot => {
        if (ot.finished || ot.position < 0 || ot.position > 50) return;
        const [or, oc] = otherPath[ot.position];
        if (or === row && oc === col) kills++;
      });
    });
    return kills;
  }

  function _threatScore(row, col, myPlayerIndex) {
    // How many opponent tokens could land here in next 1-6 moves?
    let threat = 0;
    state.players.forEach((other, oi) => {
      if (oi === myPlayerIndex) return;
      const otherPath = OFL_PATHS[other.color];
      other.tokens.forEach(ot => {
        if (ot.finished || ot.position < 0 || ot.position > 50) return;
        for (let d = 1; d <= 6; d++) {
          const np = ot.position + d;
          if (np > 50) continue;
          const [nr, nc] = otherPath[np];
          if (nr === row && nc === col) { threat++; break; }
        }
      });
    });
    return threat;
  }

  // ── Public API ────────────────────────────────────────────────
  return { start };

})();

window.OfflineGame = OfflineGame;

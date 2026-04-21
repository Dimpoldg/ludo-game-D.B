/* ═══════════════════════════════════════════════════════════════
   LUDO — OFFLINE BOT ENGINE  (v2 — Full Bug-Fixed)

   FIXES v2:
   ✅ Color selection — player apna color choose kar sakta hai
   ✅ Dice freeze — single source of truth for turn state
   ✅ Fair token entry — sab 4 tokens barabar baahar aate hain
   ✅ Bot turn never overlaps — strict sequential flow
   ✅ No stale timers after game ends
   ✅ Move validation on both enter & advance
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Path tables ────────────────────────────────────────────
   Each path has 57 entries (index 0–56).
   position -1  = token in home yard (not yet entered)
   position  0  = just entered the board
   position 51–56 = colored home column toward center
   position 57  = finished (center reached — exact count needed)
   ─────────────────────────────────────────────────────────── */
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

const ALL_COLORS   = ['red','green','yellow','blue'];
const BOT_DELAY    = { easy:1500, medium:950, hard:550 };
const DICE_EMOJIS  = ['','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];

/* ═══════════════════════════════════════════════════════════
   OFFLINE GAME  (IIFE module)
   ═══════════════════════════════════════════════════════════ */
const OfflineGame = (() => {

  /* ── state ──────────────────────────────────────────────── */
  let G = null;        // game state object
  let botTimer = null; // current bot setTimeout handle
  let gameOver = false;

  /* G shape:
    {
      players: [{
        id, name, color, isBot, difficulty,
        tokens: [{position: -1|0..57, finished: bool}],
        finishedTokens: 0
      }],
      turnIdx:   0,          // whose turn
      dice:      null,       // last rolled value
      rolled:    false,      // has dice been rolled this turn?
      consec6:   0,          // consecutive sixes counter
      movable:   [],         // token indices human can move
    }
  */

  /* ── PUBLIC: start ─────────────────────────────────────── */
  function start(playerName, playerColor, numBots, difficulty) {
    /* Clear any pending bot timer */
    if (botTimer) { clearTimeout(botTimer); botTimer = null; }
    gameOver = false;

    /* Tell socket.js we're in offline mode */
    if (window._setOfflineMode) window._setOfflineMode(true);
    window._onlineMode = false;

    /* Build player list: human first, then bots with remaining colors */
    const usedColors   = [playerColor];
    const botColors    = ALL_COLORS.filter(c => c !== playerColor);
    const botNames     = ['🤖 Alpha','🤖 Beta','🤖 Gamma'];
    const numBotsClamped = Math.min(Math.max(numBots, 1), 3);

    const players = [];
    players.push(_mkPlayer('human', playerName, playerColor, false, difficulty));
    for (let i = 0; i < numBotsClamped; i++) {
      players.push(_mkPlayer(`bot_${i}`, botNames[i], botColors[i], true, difficulty));
    }

    G = {
      players,
      turnIdx:  0,
      dice:     null,
      rolled:   false,
      consec6:  0,
      movable:  []
    };

    /* Show game screen */
    _showGameScreen();

    /* Show offline badge */
    _showBadge();

    /* Wire up roll button (override online handler) */
    _wireRollBtn();

    /* Wire canvas click for human token selection */
    window._socketMoveToken = _humanPick;

    /* Initial render */
    _syncUI();
    LudoGame.addLog('🎮 Offline game shuru hua!', '');
    LudoGame.showToast('Game start! 🎮');

    /* Begin first turn */
    _beginTurn();
  }

  /* ── PRIVATE: build player ─────────────────────────────── */
  function _mkPlayer(id, name, color, isBot, difficulty) {
    return {
      id, name, color, isBot, difficulty,
      tokens: [{position:-1,finished:false},{position:-1,finished:false},
               {position:-1,finished:false},{position:-1,finished:false}],
      finishedTokens: 0
    };
  }

  /* ── Show game screen ──────────────────────────────────── */
  function _showGameScreen() {
    document.getElementById('lobby-screen').classList.remove('active');
    document.getElementById('waiting-screen').classList.remove('active');
    const gs = document.getElementById('game-screen');
    gs.classList.add('active');
    LudoGame.initBoard();
  }

  /* ── Offline badge ──────────────────────────────────────── */
  function _showBadge() {
    let b = document.getElementById('offline-mode-badge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'offline-mode-badge';
      b.style.cssText = `position:fixed;top:12px;right:14px;z-index:200;
        background:linear-gradient(135deg,#7c3aed,#db2777);
        color:#fff;font-size:12px;font-weight:800;padding:6px 14px;
        border-radius:50px;box-shadow:0 4px 16px rgba(139,92,246,.4);
        font-family:'Nunito',sans-serif;`;
      document.body.appendChild(b);
    }
    b.textContent = '🤖 Offline Mode';
  }

  /* ── Wire roll button ───────────────────────────────────── */
  function _wireRollBtn() {
    const old = document.getElementById('roll-btn');
    const btn = old.cloneNode(true);
    old.parentNode.replaceChild(btn, old);
    btn.addEventListener('click', () => {
      if (gameOver || G.rolled) return;
      const cur = G.players[G.turnIdx];
      if (cur.isBot) return;        // human turn only
      LudoGame.playSound('roll');
      _doRoll();
    });
  }

  /* ── Sync renderer with current G ─────────────────────── */
  function _syncUI() {
    if (!G) return;
    const cur = G.players[G.turnIdx];

    /* Build gameState shape expected by game.js */
    const gs = {
      started: true,
      currentTurnIndex: G.turnIdx,
      currentTurn: { playerId: cur.id, playerName: cur.name, color: cur.color },
      lastDiceValue: G.dice,
      diceRolledThisTurn: G.rolled,
      movableTokens: G.movable,
      players: G.players.map(p => ({
        id: p.id, name: p.name, color: p.color,
        finishedTokens: p.finishedTokens,
        tokens: p.tokens.map(t => ({ position: t.position, finished: t.finished }))
      }))
    };

    LudoGame.setGameState(gs);
    LudoGame.setMyPlayer('human', G.players[0].color);

    /* Show movable highlights only if it's the human's turn & dice rolled */
    const isHumanTurn = cur.id === 'human';
    LudoGame.setMovableTokens(isHumanTurn && G.rolled ? G.movable : []);

    LudoGame.updatePlayerCards(gs.players, gs.currentTurn);
    LudoGame.updateTurnLabel(gs.currentTurn);

    /* Roll button: enabled only for human, when dice not yet rolled */
    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) rollBtn.disabled = !(isHumanTurn && !G.rolled && !gameOver);

    /* Hint label */
    const hint = document.getElementById('hint-label');
    if (hint) {
      if (isHumanTurn && !G.rolled)          hint.textContent = '🎲 Dice daalo!';
      else if (isHumanTurn && G.rolled && G.movable.length > 0)
                                              hint.textContent = '👆 Token pe click karo!';
      else if (!isHumanTurn)                 hint.textContent = `🤖 ${cur.name} soch raha hai…`;
      else                                   hint.textContent = '';
    }

    LudoGame.render();
  }

  /* ═══════════════════════════════════════════════════════
     TURN FLOW
     ═══════════════════════════════════════════════════════ */

  function _beginTurn() {
    if (gameOver) return;
    G.rolled    = false;
    G.dice      = null;
    G.movable   = [];
    _syncUI();

    const cur = G.players[G.turnIdx];
    LudoGame.addLog(`${cur.isBot ? '🤖' : '🎯'} ${cur.name} ki baari`, cur.color);

    if (cur.isBot) {
      const delay = BOT_DELAY[cur.difficulty] || 900;
      botTimer = setTimeout(_botRoll, delay);
    }
    // Human: waits for roll button click
  }

  function _advanceTurn(extraTurn) {
    if (gameOver) return;
    if (!extraTurn) {
      G.consec6  = 0;
      G.turnIdx  = (G.turnIdx + 1) % G.players.length;
    }
    _beginTurn();
  }

  /* ═══════════════════════════════════════════════════════
     DICE
     ═══════════════════════════════════════════════════════ */

  function _doRoll() {
    if (G.rolled) return;

    const dice = Math.floor(Math.random() * 6) + 1;
    G.dice   = dice;
    G.rolled = true;

    /* 3 consecutive sixes rule */
    if (dice === 6) {
      G.consec6++;
      if (G.consec6 >= 3) {
        const cur = G.players[G.turnIdx];
        LudoGame.showDice(dice);
        LudoGame.showToast(`${cur.name} ko 3 sixes penalty! 😱`);
        LudoGame.addLog(`3 sixes — ${cur.name} ka turn forfeit!`, cur.color);
        G.consec6 = 0;
        G.rolled  = false;
        G.movable = [];
        _syncUI();
        botTimer = setTimeout(() => _advanceTurn(false), 1200);
        return;
      }
    } else {
      G.consec6 = 0;
    }

    /* Compute movable tokens */
    const cur = G.players[G.turnIdx];
    G.movable = _getMovable(cur, dice);

    LudoGame.showDice(dice);
    LudoGame.addLog(`${cur.name} ne ${dice} daala`, cur.color);
    _syncUI();

    if (G.movable.length === 0) {
      /* No valid moves — auto-pass */
      LudoGame.addLog('Koi move nahi — turn pass', cur.color);
      LudoGame.showToast(`${cur.name}: koi move nahi!`);
      botTimer = setTimeout(() => _advanceTurn(false), 1100);
    } else if (cur.isBot) {
      const delay = BOT_DELAY[cur.difficulty] || 900;
      botTimer = setTimeout(() => _botPick(cur), delay);
    }
    // Human picks by clicking canvas
  }

  function _botRoll() {
    if (gameOver) return;
    LudoGame.playSound('roll');
    _doRoll();
  }

  /* ═══════════════════════════════════════════════════════
     MOVABLE TOKEN CALCULATION
     ═══════════════════════════════════════════════════════ */

  /**
   * FIX: Fair token entry.
   * - Token at position -1 can enter ONLY on dice=6
   * - Token at position 0..56 can move if position+dice <= 57
   * - Token at position 57 is finished — skip
   * - All 4 tokens independently checked — no favorites
   */
  function _getMovable(player, dice) {
    const movable = [];
    player.tokens.forEach((t, i) => {
      if (t.finished) return;
      if (t.position === -1) {
        // Must roll 6 to enter board
        if (dice === 6) movable.push(i);
      } else {
        // Can move only if won't overshoot finish
        const newPos = t.position + dice;
        if (newPos <= 57) movable.push(i);
      }
    });
    return movable;
  }

  /* ═══════════════════════════════════════════════════════
     MOVE EXECUTION
     ═══════════════════════════════════════════════════════ */

  function _executeMove(playerIdx, tokenIdx) {
    if (gameOver) return;

    const player = G.players[playerIdx];
    const token  = player.tokens[tokenIdx];
    const path   = OFL_PATHS[player.color];
    const dice   = G.dice;

    /* Move token */
    if (token.position === -1) {
      token.position = 0;   // enter board at start cell
    } else {
      token.position = token.position + dice;
    }

    let extraTurn = false;
    let killedSomeone = false;

    /* Check finish */
    if (token.position >= 57) {
      token.position   = 57;
      token.finished   = true;
      player.finishedTokens++;
      LudoGame.addLog(`🏠 ${player.name} ka token ${tokenIdx+1} ghar pahuncha!`, player.color);
      LudoGame.showToast(`${player.name}: token ghar! 🏠`);
    }

    /* Kill check — only on main outer track (pos 0–50) */
    if (!token.finished && token.position >= 0 && token.position <= 50) {
      const [tr, tc] = path[token.position];
      const key = `${tr},${tc}`;

      if (!OFL_SAFE.has(key)) {
        G.players.forEach((other, oi) => {
          if (oi === playerIdx) return;
          const op = OFL_PATHS[other.color];
          other.tokens.forEach((ot, ti) => {
            if (ot.finished || ot.position < 0 || ot.position > 50) return;
            const [or, oc] = op[ot.position];
            if (or === tr && oc === tc) {
              ot.position    = -1;   // send home
              killedSomeone  = true;
              extraTurn      = true;
              LudoGame.playSound('kill');
              LudoGame.addLog(`💥 ${player.name} ne ${other.name} ka token kaata!`, player.color);
              LudoGame.showToast(`💥 ${player.name} ne ${other.name} ko kaata!`);
            }
          });
        });
      }
    }

    /* 6 also gives extra turn */
    if (dice === 6) extraTurn = true;

    /* Reset dice state */
    G.rolled  = false;
    G.movable = [];

    /* Play move sound + render */
    LudoGame.playSound('move');
    _syncUI();

    /* Win check */
    if (player.finishedTokens >= 4) {
      gameOver = true;
      const rollBtn = document.getElementById('roll-btn');
      if (rollBtn) rollBtn.disabled = true;
      const hint = document.getElementById('hint-label');
      if (hint) hint.textContent = '';
      setTimeout(() => {
        LudoGame.showWin(player.name, player.color);
        LudoGame.addLog(`🏆 ${player.name} JEET GAYA!`, player.color);
      }, 400);
      return;
    }

    /* Advance or extra turn */
    botTimer = setTimeout(() => _advanceTurn(extraTurn), 320);
  }

  /* ═══════════════════════════════════════════════════════
     HUMAN PICKS TOKEN (canvas click)
     ═══════════════════════════════════════════════════════ */

  function _humanPick(tokenIdx) {
    if (gameOver) return;
    if (G.players[G.turnIdx].id !== 'human') return;
    if (!G.rolled) { LudoGame.showToast('Pehle dice daalo!'); return; }
    if (!G.movable.includes(tokenIdx)) {
      LudoGame.showToast('Yeh token nahi chal sakta!');
      return;
    }
    _executeMove(G.turnIdx, tokenIdx);
  }

  /* ═══════════════════════════════════════════════════════
     BOT AI — Token selection
     ═══════════════════════════════════════════════════════ */

  function _botPick(bot) {
    if (gameOver) return;
    const pidx   = G.turnIdx;
    const movable = G.movable;
    if (!movable || movable.length === 0) return;

    const chosen = _aiChoose(bot, movable, G.dice, pidx);
    _executeMove(pidx, chosen);
  }

  /**
   * AI token selection by difficulty:
   *
   * EASY   → random
   * MEDIUM → kill > enter board > advance furthest
   * HARD   → kill > enter home col > avoid threat > furthest > enter board
   */
  function _aiChoose(bot, movable, dice, pidx) {
    if (bot.difficulty === 'easy') {
      return movable[Math.floor(Math.random() * movable.length)];
    }

    const player = G.players[pidx];
    const path   = OFL_PATHS[player.color];

    let best = movable[0], bestScore = -Infinity;
    movable.forEach(idx => {
      const score = _scoreToken(player, idx, dice, pidx, path, bot.difficulty);
      if (score > bestScore) { best = idx; bestScore = score; }
    });
    return best;
  }

  function _scoreToken(player, tIdx, dice, pidx, path, diff) {
    const token  = player.tokens[tIdx];
    const newPos = token.position === -1 ? 0 : token.position + dice;
    let score    = 0;

    /* Guaranteed win */
    if (newPos >= 57) return 10000;

    /* Entering home column (pos 51–56) */
    if (newPos > 50) score += 150;

    /* Kill? */
    if (newPos >= 0 && newPos <= 50) {
      const [nr, nc] = path[newPos];
      const kills    = _killsAt(nr, nc, pidx);
      score += kills * (diff === 'hard' ? 300 : 100);

      /* Hard: avoid being killed on new cell */
      if (diff === 'hard' && !OFL_SAFE.has(`${nr},${nc}`)) {
        score -= _threatAt(nr, nc, pidx) * 50;
      }
    }

    /* Prefer tokens that are further along */
    score += newPos * 0.8;

    /* Entering from yard */
    if (token.position === -1) score += 20;

    return score;
  }

  function _killsAt(row, col, myPidx) {
    let n = 0;
    G.players.forEach((other, oi) => {
      if (oi === myPidx) return;
      const op = OFL_PATHS[other.color];
      other.tokens.forEach(ot => {
        if (ot.finished || ot.position < 0 || ot.position > 50) return;
        const [or, oc] = op[ot.position];
        if (or === row && oc === col) n++;
      });
    });
    return n;
  }

  function _threatAt(row, col, myPidx) {
    let threat = 0;
    G.players.forEach((other, oi) => {
      if (oi === myPidx) return;
      const op = OFL_PATHS[other.color];
      other.tokens.forEach(ot => {
        if (ot.finished || ot.position < 0 || ot.position > 50) return;
        for (let d = 1; d <= 6; d++) {
          const np = ot.position + d;
          if (np > 50) break;
          const [nr, nc] = op[np];
          if (nr === row && nc === col) { threat++; break; }
        }
      });
    });
    return threat;
  }

  /* ── Public API ─────────────────────────────────────────── */
  return { start };

})();

window.OfflineGame = OfflineGame;

/* ═══════════════════════════════════════════════
   LUDO GAME — CANVAS RENDERER + ANIMATION
   ═══════════════════════════════════════════════ */

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const GRID  = 15;           // 15×15 board grid
const COLORS = {
  red:    { main: '#e53935', light: '#ffcdd2', dark: '#b71c1c', text: '#fff' },
  green:  { main: '#43a047', light: '#c8e6c9', dark: '#1b5e20', text: '#fff' },
  yellow: { main: '#fdd835', light: '#fff9c4', dark: '#f9a825', text: '#333' },
  blue:   { main: '#1e88e5', light: '#bbdefb', dark: '#0d47a1', text: '#fff' }
};

// Safe cells (row,col)
const SAFE_CELLS_SET = new Set([
  '6,1','1,8','8,13','13,6',
  '2,6','6,12','12,8','8,2'
]);

// Player path tables (row, col) 57 steps: 0=board entry … 56=last home col … 57=center
const PLAYER_PATHS = {
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

// Home yard slot positions for each player
const HOME_SLOTS = {
  red:    [[2,2],[2,3],[3,2],[3,3]],
  green:  [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue:   [[11,2],[11,3],[12,2],[12,3]]
};

// ── State ─────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('ludo-canvas');
const ctx    = canvas.getContext('2d');

let CELL;           // computed cell size px
let gameState = null;
let myPlayerId    = null;
let myColor       = null;
let movableTokens = [];
let animQueue     = [];
let isAnimating   = false;

// ── Init ──────────────────────────────────────────────────────────────────────
function initBoard() {
  const size = Math.min(
    window.innerWidth  - 440,
    window.innerHeight - 24
  );
  const S = Math.max(Math.floor(size / GRID) * GRID, 300);
  canvas.width  = S;
  canvas.height = S;
  CELL = S / GRID;
  drawBoard();
  if (gameState) drawTokens();
}
window.addEventListener('resize', initBoard);

// ═════════════════════════════════════════════════════════════════════════════
//  DRAW BOARD
// ═════════════════════════════════════════════════════════════════════════════
function drawBoard() {
  const S = canvas.width;
  ctx.clearRect(0, 0, S, S);

  // Board background
  ctx.fillStyle = '#fafafa';
  roundRect(ctx, 0, 0, S, S, 12);
  ctx.fill();

  // ── Home Zones (colored quadrants) ────────────────────────────────────────
  drawHomeZone(0,  0,  6, 6, 'red',    COLORS.red);
  drawHomeZone(0,  9,  6, 6, 'green',  COLORS.green);
  drawHomeZone(9,  9,  6, 6, 'yellow', COLORS.yellow);
  drawHomeZone(9,  0,  6, 6, 'blue',   COLORS.blue);

  // ── Grid lines (only on track cells) ─────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = .5;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (isTrackCell(r, c)) {
        ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
  }

  // ── Track lane colors ─────────────────────────────────────────────────────
  // Red home column (row 7, cols 1-5)
  for (let c = 1; c <= 5; c++) fillCell(7, c, COLORS.red.light);
  // Green home column (rows 1-5, col 7)
  for (let r = 1; r <= 5; r++) fillCell(r, 7, COLORS.green.light);
  // Yellow home column (row 7, cols 9-13)
  for (let c = 9; c <= 13; c++) fillCell(7, c, COLORS.yellow.light);
  // Blue home column (rows 9-13, col 7)
  for (let r = 9; r <= 13; r++) fillCell(r, 7, COLORS.blue.light);

  // ── Safe zone markers ──────────────────────────────────────────────────────
  SAFE_CELLS_SET.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    drawStar(r, c, 'rgba(255,200,0,0.6)');
  });

  // ── Starting cells (larger highlight) ─────────────────────────────────────
  highlightStart(6, 1, COLORS.red.main);
  highlightStart(1, 8, COLORS.green.main);
  highlightStart(8, 13, COLORS.yellow.main);
  highlightStart(13, 6, COLORS.blue.main);

  // ── Center finishing area (star shape) ────────────────────────────────────
  drawCenterArea();

  // ── Movable token highlights ───────────────────────────────────────────────
  drawMovableHighlights();

  // ── Outer border ─────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  roundRect(ctx, 0, 0, S, S, 12);
  ctx.stroke();
}

function drawHomeZone(startRow, startCol, rows, cols, colorName, color) {
  const x = startCol * CELL, y = startRow * CELL;
  const w = cols * CELL, h = rows * CELL;

  // Outer colored background
  ctx.fillStyle = color.main;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  // Inner white yard
  const pad = CELL * .5;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  roundRect(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, 6);
  ctx.fill();

  // Draw 4 home token placeholders (2×2 grid)
  HOME_SLOTS[colorName].forEach(([r, c]) => {
    const cx = (c + .5) * CELL, cy = (r + .5) * CELL;
    const rad = CELL * .35;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = color.light;
    ctx.fill();
    ctx.strokeStyle = color.main;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function fillCell(r, c, color) {
  ctx.fillStyle = color;
  ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
}

function drawStar(r, c, color) {
  const cx = (c + .5) * CELL, cy = (r + .5) * CELL;
  const outer = CELL * .38, inner = CELL * .18;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const rad = i % 2 === 0 ? outer : inner;
    if (i === 0) ctx.moveTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    else         ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function highlightStart(r, c, color) {
  ctx.fillStyle = color + '33';
  ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
}

function drawCenterArea() {
  // 4 triangle sections pointing inward
  const triangles = [
    { color: COLORS.red.main,    points: [[7,6],[7,7],[6,6],[6,7]] },
    { color: COLORS.green.main,  points: [[6,7],[7,7],[6,8],[7,8]] },
    { color: COLORS.yellow.main, points: [[7,8],[7,7],[8,8],[8,7]] },
    { color: COLORS.blue.main,   points: [[8,7],[7,7],[8,6],[7,6]] }
  ];

  // Draw the center 3×3 area background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(6 * CELL, 6 * CELL, 3 * CELL, 3 * CELL);

  // Draw colored triangles pointing to center
  const cx = 7.5 * CELL, cy = 7.5 * CELL;
  const corners = [
    [6 * CELL, 6 * CELL],
    [9 * CELL, 6 * CELL],
    [9 * CELL, 9 * CELL],
    [6 * CELL, 9 * CELL]
  ];
  const triColors = [COLORS.red.main, COLORS.green.main, COLORS.yellow.main, COLORS.blue.main];

  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = triColors[i] + 'cc';
    ctx.fill();
  }

  // Star in center
  drawStar(7, 7, 'rgba(255,255,255,0.9)');

  // Border
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(6 * CELL, 6 * CELL, 3 * CELL, 3 * CELL);
}

function drawMovableHighlights() {
  if (!gameState || movableTokens.length === 0 || !myColor) return;

  const player = gameState.players.find(p => p.id === myPlayerId);
  if (!player) return;

  const path = PLAYER_PATHS[myColor];

  movableTokens.forEach(tokenIdx => {
    const token = player.tokens[tokenIdx];
    let r, c;
    if (token.position === -1) {
      [r, c] = HOME_SLOTS[myColor][tokenIdx];
    } else if (token.position >= 57) {
      r = 7; c = 7;
    } else {
      [r, c] = path[token.position];
    }
    // Pulsing glow highlight
    const cx2 = (c + .5) * CELL, cy2 = (r + .5) * CELL;
    ctx.beginPath();
    ctx.arc(cx2, cy2, CELL * .45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  DRAW TOKENS
// ═════════════════════════════════════════════════════════════════════════════
function drawTokens() {
  if (!gameState) return;

  gameState.players.forEach(player => {
    const color  = COLORS[player.color];
    const path   = PLAYER_PATHS[player.color];
    const slots  = HOME_SLOTS[player.color];

    // Count stacking for shared cells
    const cellCount = {};

    player.tokens.forEach((token, idx) => {
      let r, c;
      if (token.position === -1) {
        [r, c] = slots[idx];
      } else if (token.position >= 57) {
        r = 7; c = 7;
      } else {
        [r, c] = path[token.position];
      }

      const key = `${r},${c}`;
      cellCount[key] = (cellCount[key] || 0);
      const offset = cellCount[key];
      cellCount[key]++;

      drawToken(r, c, offset, color, idx + 1, player.color);
    });
  });
}

function drawToken(r, c, stackOffset, color, num, colorName) {
  const isCenter = (r === 7 && c === 7);
  const totalSize = isCenter ? CELL * .22 : CELL * .38;
  let cx = (c + .5) * CELL;
  let cy = (r + .5) * CELL;

  // Stack offset so tokens don't fully overlap
  if (stackOffset > 0) {
    const offsets = [
      [0, 0], [.2, -.2], [-.2, .2], [.2, .2]
    ];
    const off = offsets[Math.min(stackOffset, 3)];
    cx += off[0] * CELL;
    cy += off[1] * CELL;
  }

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur  = 4;

  // Token body
  ctx.beginPath();
  ctx.arc(cx, cy, totalSize, 0, Math.PI * 2);
  ctx.fillStyle = color.main;
  ctx.fill();

  // Inner highlight
  ctx.beginPath();
  ctx.arc(cx - totalSize * .2, cy - totalSize * .2, totalSize * .45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  // Border
  ctx.beginPath();
  ctx.arc(cx, cy, totalSize, 0, Math.PI * 2);
  ctx.strokeStyle = color.dark;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Number label
  ctx.shadowBlur = 0;
  ctx.fillStyle  = color.text;
  ctx.font       = `bold ${Math.floor(totalSize * .9)}px Nunito, sans-serif`;
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(num, cx, cy + 1);
}

// ═════════════════════════════════════════════════════════════════════════════
//  ANIMATION
// ═════════════════════════════════════════════════════════════════════════════
function animateTokenMove(playerColor, tokenIndex, startPos, endPos, onDone) {
  if (startPos === endPos) { onDone && onDone(); return; }

  const path  = PLAYER_PATHS[playerColor];
  const steps = [];

  // Build step path
  if (startPos === -1) {
    // From home yard → first cell
    steps.push({ row: HOME_SLOTS[playerColor][tokenIndex][0], col: HOME_SLOTS[playerColor][tokenIndex][1] });
    if (endPos >= 0) steps.push({ row: path[0][0], col: path[0][1] });
  } else {
    for (let p = startPos; p <= Math.min(endPos, 56); p++) {
      steps.push({ row: path[p][0], col: path[p][1] });
    }
    if (endPos >= 57) steps.push({ row: 7, col: 7 });
  }

  let stepIdx = 1;
  const delay = 90; // ms per cell

  const interval = setInterval(() => {
    if (stepIdx >= steps.length) {
      clearInterval(interval);
      onDone && onDone();
      return;
    }
    // Redraw board + tokens (state is already updated by server)
    drawBoard();
    drawTokens();
    // Draw animated token at current step
    const s = steps[stepIdx];
    const color = COLORS[playerColor];
    drawToken(s.row, s.col, 0, color, tokenIndex + 1, playerColor);
    stepIdx++;
  }, delay);
}

// ═════════════════════════════════════════════════════════════════════════════
//  FULL RENDER
// ═════════════════════════════════════════════════════════════════════════════
function render() {
  drawBoard();
  if (gameState) drawTokens();
}

// ─── Canvas click → select token ─────────────────────────────────────────────
canvas.addEventListener('click', (e) => {
  if (!gameState || movableTokens.length === 0) return;
  if (!myColor) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top)  * scaleY;

  const clickCol = Math.floor(mx / CELL);
  const clickRow = Math.floor(my / CELL);

  const player = gameState.players.find(p => p.id === myPlayerId);
  if (!player) return;

  const path  = PLAYER_PATHS[myColor];
  const slots = HOME_SLOTS[myColor];

  let picked = -1;
  movableTokens.forEach(idx => {
    const token = player.tokens[idx];
    let r, c;
    if (token.position === -1) {
      [r, c] = slots[idx];
    } else if (token.position >= 57) {
      r = 7; c = 7;
    } else {
      [r, c] = path[token.position];
    }
    if (r === clickRow && c === clickCol) picked = idx;
  });

  if (picked !== -1 && window._socketMoveToken) {
    window._socketMoveToken(picked);
  }
});

// ─── Utility ──────────────────────────────────────────────────────────────────
function isTrackCell(r, c) {
  if (r >= 0  && r <= 5  && c >= 6  && c <= 8)  return true;
  if (r >= 6  && r <= 8  && c >= 0  && c <= 14) return true;
  if (r >= 9  && r <= 14 && c >= 6  && c <= 8)  return true;
  return false;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Player card UI ───────────────────────────────────────────────────────────
function updatePlayerCards(players, currentTurn) {
  ['red','green','yellow','blue'].forEach(col => {
    const card = document.getElementById(`card-${col}`);
    card.innerHTML = '';
    card.removeAttribute('data-color');
    card.classList.remove('active-turn');
  });

  if (!players) return;

  players.forEach(p => {
    const card = document.getElementById(`card-${p.color}`);
    if (!card) return;

    card.setAttribute('data-color', p.color);
    const isYou = p.id === myPlayerId;
    const isActive = currentTurn && currentTurn.playerId === p.id;

    card.innerHTML = `
      <div class="pc-header">
        <div class="pc-dot" style="background:${COLORS[p.color].main}"></div>
        <span class="pc-name">${p.name}</span>
        ${isYou ? '<span class="pc-you">YOU</span>' : ''}
      </div>
      <div class="pc-tokens">
        ${(p.tokens || Array(4).fill({ position: -1, finished: false }))
          .map(t => `<div class="pc-token-dot ${t.finished ? 'done' : t.position === -1 ? 'home' : ''}"
            style="background:${COLORS[p.color].main}"></div>`).join('')}
      </div>
      <div style="font-size:11px;color:#666;margin-top:4px">
        ${p.finishedTokens}/4 home
      </div>
    `;

    if (isActive) card.classList.add('active-turn');
  });
}

// ─── Turn label ───────────────────────────────────────────────────────────────
function updateTurnLabel(currentTurn) {
  const label = document.getElementById('turn-label');
  if (!currentTurn) { label.textContent = 'Waiting…'; return; }
  const isMe = currentTurn.playerId === myPlayerId;
  label.textContent = isMe
    ? '🎯 Your Turn!'
    : `⏳ ${currentTurn.playerName}'s turn`;
  label.style.color = COLORS[currentTurn.color]?.main || '#aaa';
}

// ─── Roll button state ────────────────────────────────────────────────────────
function setRollEnabled(enabled) {
  const btn = document.getElementById('roll-btn');
  btn.disabled = !enabled;
}

// ─── Dice face ────────────────────────────────────────────────────────────────
const DICE_EMOJI = ['', '1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];
function showDice(value, animate = true) {
  const face  = document.getElementById('dice-display');
  const emoji = document.getElementById('dice-emoji');
  if (animate) {
    face.classList.remove('rolling');
    void face.offsetWidth;
    face.classList.add('rolling');
    setTimeout(() => face.classList.remove('rolling'), 500);
  }
  emoji.textContent = value ? DICE_EMOJI[value] : '🎲';
}

// ─── Game log ─────────────────────────────────────────────────────────────────
function addLog(msg, color) {
  const el = document.createElement('div');
  el.className = `log-entry ${color || ''}`;
  el.textContent = msg;
  const container = document.getElementById('log-entries');
  container.prepend(el);
  // Keep last 30
  while (container.children.length > 30) container.lastChild.remove();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ─── Win overlay ──────────────────────────────────────────────────────────────
function showWin(playerName, color) {
  document.getElementById('win-title').textContent = `🏆 ${playerName} Wins!`;
  document.getElementById('win-sub').textContent =
    `The ${color} player has reached home!`;
  document.getElementById('win-overlay').classList.remove('hidden');
  playSound('win');
}

// ─── Sounds (Web Audio) ───────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playSound(type) {
  try {
    const ac  = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    if (type === 'roll') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + .12);
      gain.gain.setValueAtTime(.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .2);
      osc.start(); osc.stop(ac.currentTime + .2);
    } else if (type === 'move') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + .1);
      gain.gain.setValueAtTime(.08, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .15);
      osc.start(); osc.stop(ac.currentTime + .15);
    } else if (type === 'kill') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + .3);
      gain.gain.setValueAtTime(.15, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .3);
      osc.start(); osc.stop(ac.currentTime + .3);
    } else if (type === 'win') {
      // Victory fanfare
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ac.currentTime + i * .18);
        g.gain.setValueAtTime(.15, ac.currentTime + i * .18);
        g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + i * .18 + .35);
        o.start(ac.currentTime + i * .18);
        o.stop(ac.currentTime + i * .18 + .35);
      });
    }
  } catch (_) {}
}

// ─── Public exports ───────────────────────────────────────────────────────────
window.LudoGame = {
  initBoard,
  render,
  animateTokenMove,
  updatePlayerCards,
  updateTurnLabel,
  setRollEnabled,
  showDice,
  addLog,
  showToast,
  showWin,
  playSound,
  setGameState(state) { gameState = state; },
  setMyPlayer(id, color) { myPlayerId = id; myColor = color; },
  setMovableTokens(t) { movableTokens = t || []; },
  getMyColor() { return myColor; },
  PLAYER_PATHS,
  HOME_SLOTS
};

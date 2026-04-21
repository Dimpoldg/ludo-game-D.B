/* ═══════════════════════════════════════════════
   LUDO — CANVAS RENDERER + UI (v3 Mobile-First)
   ═══════════════════════════════════════════════ */
'use strict';

const GRID = 15;
const COLORS = {
  red:    { main:'#e53935', light:'#ffcdd2', dark:'#b71c1c', text:'#fff' },
  green:  { main:'#43a047', light:'#c8e6c9', dark:'#1b5e20', text:'#fff' },
  yellow: { main:'#fdd835', light:'#fff9c4', dark:'#f9a825', text:'#333' },
  blue:   { main:'#1e88e5', light:'#bbdefb', dark:'#0d47a1', text:'#fff' }
};

const SAFE_SET = new Set(['6,1','1,8','8,13','13,6','2,6','6,12','12,8','8,2']);

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

const HOME_SLOTS = {
  red:    [[2,2],[2,3],[3,2],[3,3]],
  green:  [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue:   [[11,2],[11,3],[12,2],[12,3]]
};

// ── Canvas setup ──────────────────────────────────────────────
const canvas = document.getElementById('ludo-canvas');
const ctx    = canvas.getContext('2d');
let CELL = 20;

let _gameState    = null;
let _myId         = null;
let _myColor      = null;
let _movable      = [];
let _isDesktop    = false;

function _checkDesktop() {
  _isDesktop = window.innerWidth >= 700 && window.innerHeight >= 600;
}

// ── Board sizing ──────────────────────────────────────────────
function initBoard() {
  _checkDesktop();

  let S;
  if (_isDesktop) {
    const sideW = 180 * 2 + 32;
    const maxW  = window.innerWidth  - sideW - 24;
    const maxH  = window.innerHeight - 24;
    S = Math.min(maxW, maxH);
  } else {
    // Mobile: use actual viewport minus fixed bars
    // top-bar ~56px, bottom-bar ~52px, padding 8px
    const topH   = 56;
    const botH   = 52;
    const padH   = 8;
    const availW = window.innerWidth  - 8;
    const availH = window.innerHeight - topH - botH - padH;
    S = Math.min(availW, availH);
  }

  S = Math.max(Math.floor(S / GRID) * GRID, 270);
  canvas.width  = S;
  canvas.height = S;
  CELL = S / GRID;

  // board-main: center the square canvas
  const boardMain = document.querySelector('.board-main');
  if (boardMain && !_isDesktop) {
    // Give board-main exact height so no black gap
    const topH = 56, botH = 52;
    boardMain.style.height = (window.innerHeight - topH - botH) + 'px';
    boardMain.style.maxHeight = boardMain.style.height;
  }

  // Show/hide desktop sidebars
  document.querySelectorAll('.desktop-only').forEach(el => {
    el.style.display = _isDesktop ? 'flex' : 'none';
  });
  const topBar = document.getElementById('top-bar');
  const botBar = document.querySelector('.bottom-bar');
  if (topBar) topBar.style.display = _isDesktop ? 'none' : 'flex';
  if (botBar) botBar.style.display = _isDesktop ? 'none' : 'flex';

  drawBoard();
  if (_gameState) drawTokens();
}

window.addEventListener('resize', () => {
  clearTimeout(window._resizeTimer);
  window._resizeTimer = setTimeout(initBoard, 120);
});
window.addEventListener('orientationchange', () => setTimeout(initBoard, 300));

// ═════════════════════════════════════════════════════════════
//  DRAW BOARD
// ═════════════════════════════════════════════════════════════
function drawBoard() {
  const S = canvas.width;
  ctx.clearRect(0, 0, S, S);

  // Background
  ctx.fillStyle = '#f9f9f9';
  _roundRect(0, 0, S, S, 10); ctx.fill();

  // Home zones
  _drawHomeZone(0,  0, 6, 6, 'red');
  _drawHomeZone(0,  9, 6, 6, 'green');
  _drawHomeZone(9,  9, 6, 6, 'yellow');
  _drawHomeZone(9,  0, 6, 6, 'blue');

  // Track lane colors
  for (let c = 1; c <= 5; c++) _fillCell(7, c, COLORS.red.light);
  for (let r = 1; r <= 5; r++) _fillCell(r, 7, COLORS.green.light);
  for (let c = 9; c <=13; c++) _fillCell(7, c, COLORS.yellow.light);
  for (let r = 9; r <=13; r++) _fillCell(r, 7, COLORS.blue.light);

  // Safe stars
  SAFE_SET.forEach(k => {
    const [r,c] = k.split(',').map(Number);
    _drawStar(r, c, 'rgba(255,190,0,0.55)');
  });

  // Start cell highlights
  _highlightCell(6,  1, COLORS.red.main);
  _highlightCell(1,  8, COLORS.green.main);
  _highlightCell(8, 13, COLORS.yellow.main);
  _highlightCell(13, 6, COLORS.blue.main);

  // Grid lines on track
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = .5;
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (_isTrack(r, c)) ctx.strokeRect(c*CELL, r*CELL, CELL, CELL);

  // Center area
  _drawCenter();

  // Movable highlights
  _drawMovableHighlights();

  // Outer border
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 2;
  _roundRect(0, 0, S, S, 10); ctx.stroke();
}

function _drawHomeZone(sr, sc, rows, cols, colorName) {
  const C = COLORS[colorName];
  const x = sc*CELL, y = sr*CELL, w = cols*CELL, h = rows*CELL;
  ctx.fillStyle = C.main;
  _roundRect(x, y, w, h, 8); ctx.fill();
  const pad = CELL * .5;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  _roundRect(x+pad, y+pad, w-pad*2, h-pad*2, 6); ctx.fill();
  HOME_SLOTS[colorName].forEach(([r,c]) => {
    const cx=(c+.5)*CELL, cy=(r+.5)*CELL, rad=CELL*.34;
    ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2);
    ctx.fillStyle=C.light; ctx.fill();
    ctx.strokeStyle=C.main; ctx.lineWidth=2; ctx.stroke();
  });
}

function _fillCell(r, c, color) {
  ctx.fillStyle = color;
  ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
}

function _drawStar(r, c, color) {
  const cx=(c+.5)*CELL, cy=(r+.5)*CELL, outer=CELL*.36, inner=CELL*.17;
  ctx.beginPath();
  for(let i=0;i<10;i++){
    const a=(i*Math.PI/5)-Math.PI/2;
    const rad=i%2===0?outer:inner;
    if(i===0) ctx.moveTo(cx+rad*Math.cos(a),cy+rad*Math.sin(a));
    else       ctx.lineTo(cx+rad*Math.cos(a),cy+rad*Math.sin(a));
  }
  ctx.closePath(); ctx.fillStyle=color; ctx.fill();
}

function _highlightCell(r, c, color) {
  ctx.fillStyle=color+'30';
  ctx.fillRect(c*CELL,r*CELL,CELL,CELL);
  ctx.strokeStyle=color; ctx.lineWidth=2;
  ctx.strokeRect(c*CELL+1,r*CELL+1,CELL-2,CELL-2);
}

function _drawCenter() {
  ctx.fillStyle='#f0f0f0';
  ctx.fillRect(6*CELL,6*CELL,3*CELL,3*CELL);
  const cx=7.5*CELL, cy=7.5*CELL;
  const corners=[[6*CELL,6*CELL],[9*CELL,6*CELL],[9*CELL,9*CELL],[6*CELL,9*CELL]];
  const cs=[COLORS.red.main,COLORS.green.main,COLORS.yellow.main,COLORS.blue.main];
  for(let i=0;i<4;i++){
    const p1=corners[i],p2=corners[(i+1)%4];
    ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.lineTo(cx,cy);
    ctx.closePath(); ctx.fillStyle=cs[i]+'cc'; ctx.fill();
  }
  _drawStar(7,7,'rgba(255,255,255,0.92)');
  ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=1;
  ctx.strokeRect(6*CELL,6*CELL,3*CELL,3*CELL);
}

function _drawMovableHighlights() {
  if (!_movable.length || !_myColor) return;
  const player = _gameState?.players?.find(p=>p.id===_myId);
  if (!player) return;
  const path=PLAYER_PATHS[_myColor];
  _movable.forEach(idx => {
    const t=player.tokens[idx]; let r,c;
    if(t.position===-1){ [r,c]=HOME_SLOTS[_myColor][idx]; }
    else if(t.position>=57){ r=7;c=7; }
    else { [r,c]=path[t.position]; }
    const cx=(c+.5)*CELL, cy=(r+.5)*CELL;
    // Pulsing ring
    ctx.beginPath(); ctx.arc(cx,cy,CELL*.44,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,CELL*.44,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fill();
  });
}

// ═════════════════════════════════════════════════════════════
//  DRAW TOKENS
// ═════════════════════════════════════════════════════════════
function drawTokens() {
  if (!_gameState) return;
  _gameState.players.forEach(player => {
    const path=PLAYER_PATHS[player.color];
    const slots=HOME_SLOTS[player.color];
    const cellCount={};
    player.tokens.forEach((token,idx) => {
      let r,c;
      if(token.position===-1){ [r,c]=slots[idx]; }
      else if(token.position>=57){ r=7;c=7; }
      else { [r,c]=path[token.position]; }
      const key=`${r},${c}`;
      const offset=cellCount[key]||0;
      cellCount[key]=(offset+1);
      _drawOneToken(r,c,offset,COLORS[player.color],idx+1);
    });
  });
}

function _drawOneToken(r, c, stack, color, num) {
  const isCenter=(r===7&&c===7);
  const sz = isCenter ? CELL*.20 : CELL*.36;
  let cx=(c+.5)*CELL, cy=(r+.5)*CELL;
  if(stack>0){
    const offs=[[0,0],[.22,-.22],[-.22,.22],[.22,.22]];
    const o=offs[Math.min(stack,3)];
    cx+=o[0]*CELL; cy+=o[1]*CELL;
  }
  ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=4;
  // Body
  ctx.beginPath(); ctx.arc(cx,cy,sz,0,Math.PI*2);
  ctx.fillStyle=color.main; ctx.fill();
  // Shine
  ctx.beginPath(); ctx.arc(cx-sz*.2,cy-sz*.2,sz*.42,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fill();
  // Border
  ctx.beginPath(); ctx.arc(cx,cy,sz,0,Math.PI*2);
  ctx.strokeStyle=color.dark; ctx.lineWidth=1.8; ctx.stroke();
  ctx.shadowBlur=0;
  // Number
  ctx.fillStyle=color.text;
  ctx.font=`bold ${Math.floor(sz*.85)}px Nunito,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(num,cx,cy+1);
}

// ═════════════════════════════════════════════════════════════
//  RENDER
// ═════════════════════════════════════════════════════════════
function render() {
  drawBoard();
  if (_gameState) drawTokens();
}

// ── Canvas touch/click → token pick ──────────────────────────
function _getCanvasXY(e) {
  const rect=canvas.getBoundingClientRect();
  const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
  if(e.touches&&e.touches[0]){
    return { x:(e.touches[0].clientX-rect.left)*scaleX, y:(e.touches[0].clientY-rect.top)*scaleY };
  }
  return { x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY };
}

function _handleCanvasHit(e) {
  if(!_gameState||!_movable.length||!_myColor) return;
  const {x,y}=_getCanvasXY(e);
  const col=Math.floor(x/CELL), row=Math.floor(y/CELL);
  const player=_gameState.players.find(p=>p.id===_myId);
  if(!player) return;
  const path=PLAYER_PATHS[_myColor];
  let picked=-1;
  _movable.forEach(idx=>{
    const t=player.tokens[idx]; let r,c;
    if(t.position===-1){ [r,c]=HOME_SLOTS[_myColor][idx]; }
    else if(t.position>=57){ r=7;c=7; }
    else { [r,c]=path[t.position]; }
    if(r===row&&c===col) picked=idx;
  });
  if(picked!==-1&&window._socketMoveToken) window._socketMoveToken(picked);
}
canvas.addEventListener('click',     _handleCanvasHit);
canvas.addEventListener('touchstart', e=>{e.preventDefault();_handleCanvasHit(e);},{passive:false});

// ═════════════════════════════════════════════════════════════
//  UI UPDATES  (mobile + desktop both)
// ═════════════════════════════════════════════════════════════

// Player chips in mobile top-bar
function _updateTopBarChips(players, currentTurn) {
  const bar=document.getElementById('top-bar');
  if(!bar) return;
  // Remove existing chips
  bar.querySelectorAll('.top-player-chip').forEach(el=>el.remove());
  if(!players) return;
  const spacer=bar.querySelector('.top-bar-spacer');
  players.forEach(p=>{
    const chip=document.createElement('div');
    chip.className='top-player-chip'+(currentTurn&&currentTurn.playerId===p.id?' active-chip':'');
    chip.setAttribute('data-color',p.color);
    const isYou=p.id===_myId;
    chip.innerHTML=`<span class="chip-dot" style="background:${COLORS[p.color].main}"></span>`+
      `<span style="font-size:12px;font-weight:800;color:${currentTurn&&currentTurn.playerId===p.id?COLORS[p.color].main:'#aaa'}">`+
      `${p.name.length>6?p.name.slice(0,5)+'…':p.name}</span>`+
      `<span class="chip-score">${p.finishedTokens}/4</span>`+
      (isYou?'<span class="chip-you">YOU</span>':'');
    bar.insertBefore(chip, spacer);
  });
}

// Desktop player cards
function _updateDesktopCards(players, currentTurn) {
  ['red','green','yellow','blue'].forEach(col=>{
    const card=document.getElementById(`dcard-${col}`);
    if(!card) return;
    card.innerHTML='';
    card.removeAttribute('data-color');
    card.classList.remove('active-turn');
  });
  if(!players) return;
  players.forEach(p=>{
    const card=document.getElementById(`dcard-${p.color}`);
    if(!card) return;
    const isYou=p.id===_myId;
    const isAct=currentTurn&&currentTurn.playerId===p.id;
    card.setAttribute('data-color',p.color);
    if(isAct) card.classList.add('active-turn');
    card.innerHTML=`<div class="pc-header">
      <div class="pc-dot" style="background:${COLORS[p.color].main}"></div>
      <span class="pc-name" style="color:${COLORS[p.color].main}">${p.name}</span>
      ${isYou?'<span class="pc-you">YOU</span>':''}
    </div>
    <div class="pc-tokens">${(p.tokens||[{},{},{},{}]).map(t=>
      `<div class="pc-token-dot ${t.finished?'done':t.position===-1?'home':''}" style="background:${COLORS[p.color].main}"></div>`
    ).join('')}</div>
    <div class="pc-footer">${p.finishedTokens||0}/4 ghar</div>`;
  });
}

function updatePlayerCards(players, currentTurn) {
  _updateTopBarChips(players, currentTurn);
  _updateDesktopCards(players, currentTurn);
}

function updateTurnLabel(currentTurn) {
  const isMe = currentTurn&&currentTurn.playerId===_myId;
  const name = currentTurn?.playerName||'';
  const col  = currentTurn?.color||'';
  const text = isMe?'🎯 Your Turn!': (name?`⏳ ${name}'s turn`:'Waiting…');
  const color= col? COLORS[col].main : '#a78bfa';

  // Mobile bottom bar
  const bl=document.getElementById('turn-label-bot');
  if(bl){ bl.textContent=text; bl.style.color=color; }
  // Desktop right sidebar
  const dl=document.getElementById('desktop-turn-label');
  if(dl){ dl.textContent=text; dl.style.color=color; }
}

// Sync BOTH roll buttons
function setRollEnabled(enabled) {
  const btn1=document.getElementById('roll-btn');
  const btn2=document.getElementById('roll-btn-top');
  if(btn1) btn1.disabled=!enabled;
  if(btn2) btn2.disabled=!enabled;
}

// Show dice on BOTH displays
const DEMOJI=['','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];
function showDice(val, anim=true) {
  const emoji = val?DEMOJI[val]:'🎲';
  // Mobile mini dice
  const md=document.getElementById('mini-dice');
  const me=document.getElementById('mini-dice-emoji');
  if(me) me.textContent=emoji;
  if(md&&anim){ md.classList.remove('rolling'); void md.offsetWidth; md.classList.add('rolling'); setTimeout(()=>md.classList.remove('rolling'),500); }
  // Desktop dice face
  const dd=document.getElementById('desktop-dice-face');
  const de=document.getElementById('desktop-dice-emoji');
  if(de) de.textContent=emoji;
  if(dd&&anim){ dd.classList.remove('rolling'); void dd.offsetWidth; dd.classList.add('rolling'); setTimeout(()=>dd.classList.remove('rolling'),500); }
}

// Hint label
function setHint(msg) {
  const h1=document.getElementById('hint-label');
  const h2=document.getElementById('desktop-hint-label');
  if(h1) h1.textContent=msg||'';
  if(h2) h2.textContent=msg||'';
}

// Log
function addLog(msg, color) {
  const entry=document.createElement('div');
  entry.className=`log-entry ${color||''}`;
  entry.textContent=msg;
  // Mobile drawer
  const mob=document.getElementById('log-entries');
  if(mob){ mob.prepend(entry.cloneNode(true)); while(mob.children.length>40)mob.lastChild.remove(); }
  // Desktop sidebar
  const desk=document.getElementById('desktop-log-entries');
  if(desk){ desk.prepend(entry.cloneNode(true)); while(desk.children.length>40)desk.lastChild.remove(); }
}

// Toast
let _toastTimer;
function showToast(msg, dur=2500) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>t.classList.add('hidden'),dur);
}

// Win
function showWin(playerName, color) {
  document.getElementById('win-title').textContent=`🏆 ${playerName} Wins!`;
  document.getElementById('win-sub').textContent=`${color} player ghar pahuncha!`;
  document.getElementById('win-overlay').classList.remove('hidden');
  playSound('win');
}

// ── Sound ─────────────────────────────────────────────────────
let _ac;
function _ac_() { if(!_ac) _ac=new(window.AudioContext||window.webkitAudioContext)(); return _ac; }
function playSound(type) {
  try {
    const ac=_ac_(), o=ac.createOscillator(), g=ac.createGain();
    o.connect(g); g.connect(ac.destination);
    if(type==='roll'){
      o.type='square'; o.frequency.setValueAtTime(300,ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(600,ac.currentTime+.12);
      g.gain.setValueAtTime(.1,ac.currentTime); g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.2);
      o.start(); o.stop(ac.currentTime+.2);
    } else if(type==='move'){
      o.type='sine'; o.frequency.setValueAtTime(440,ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(880,ac.currentTime+.1);
      g.gain.setValueAtTime(.07,ac.currentTime); g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.15);
      o.start(); o.stop(ac.currentTime+.15);
    } else if(type==='kill'){
      o.type='sawtooth'; o.frequency.setValueAtTime(600,ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(100,ac.currentTime+.3);
      g.gain.setValueAtTime(.12,ac.currentTime); g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.3);
      o.start(); o.stop(ac.currentTime+.3);
    } else if(type==='win'){
      [523,659,784,1047].forEach((f,i)=>{
        const o2=ac.createOscillator(),g2=ac.createGain();
        o2.connect(g2); g2.connect(ac.destination);
        o2.type='sine'; o2.frequency.setValueAtTime(f,ac.currentTime+i*.18);
        g2.gain.setValueAtTime(.13,ac.currentTime+i*.18); g2.gain.exponentialRampToValueAtTime(.001,ac.currentTime+i*.18+.35);
        o2.start(ac.currentTime+i*.18); o2.stop(ac.currentTime+i*.18+.35);
      });
    }
  } catch(_){}
}

// ── Utilities ─────────────────────────────────────────────────
function _roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}
function _isTrack(r,c){
  if(r>=0&&r<=5&&c>=6&&c<=8) return true;
  if(r>=6&&r<=8&&c>=0&&c<=14) return true;
  if(r>=9&&r<=14&&c>=6&&c<=8) return true;
  return false;
}

// ── Public API ─────────────────────────────────────────────────
window.LudoGame = {
  initBoard, render, addLog, showToast, showWin, playSound,
  showDice, setRollEnabled, setHint, updatePlayerCards, updateTurnLabel,
  setGameState(gs){ _gameState=gs; window.__ludoLastState=gs; },
  setMyPlayer(id,color){ _myId=id; _myColor=color; },
  setMovableTokens(t){ _movable=t||[]; },
  getMyColor(){ return _myColor; },
  PLAYER_PATHS, HOME_SLOTS
};

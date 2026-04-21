/* ═══════════════════════════════════════════════════════════
   LUDO — OFFLINE BOT ENGINE  v3 (Mobile + Win Fix)

   FIXES:
   ✅ Win condition: uses token.every(t=>t.finished)
   ✅ Both roll buttons (mobile top + desktop sidebar) synced
   ✅ Color choice from lobby
   ✅ Fair token entry (all 4 independently checked)
   ✅ No stale timers after game over
   ✅ Clean turn flow with single state object
   ═══════════════════════════════════════════════════════════ */
'use strict';

const OFL_PATHS = {
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

const OFL_HOME = {
  red:   [[2,2],[2,3],[3,2],[3,3]],
  green: [[2,11],[2,12],[3,11],[3,12]],
  yellow:[[11,11],[11,12],[12,11],[12,12]],
  blue:  [[11,2],[11,3],[12,2],[12,3]]
};

const OFL_SAFE = new Set(['6,1','1,8','8,13','13,6','2,6','6,12','12,8','8,2']);
const ALL_COLORS = ['red','green','yellow','blue'];
const BOT_MS = { easy:1500, medium:900, hard:500 };

/* ═══════════════════════════════════════════════════════════ */
const OfflineGame = (() => {

  let G = null;        // game state
  let T = null;        // current setTimeout handle
  let over = false;

  /* ── start ─────────────────────────────────────────────── */
  function start(playerName, playerColor, numBots, difficulty) {
    if (T) { clearTimeout(T); T=null; }
    over = false;
    if (window._setOfflineMode) window._setOfflineMode(true);
    window._onlineMode = false;

    const botColors = ALL_COLORS.filter(c=>c!==playerColor);
    const botNames  = ['🤖 Alpha','🤖 Beta','🤖 Gamma'];
    const nb = Math.min(Math.max(numBots,1),3);

    const players = [_mkP('human', playerName, playerColor, false, difficulty)];
    for (let i=0;i<nb;i++)
      players.push(_mkP(`bot${i}`, botNames[i], botColors[i], true, difficulty));

    G = { players, idx:0, dice:null, rolled:false, c6:0, movable:[] };

    // Show game screen
    document.getElementById('lobby-screen').classList.remove('active');
    const gs = document.getElementById('game-screen');
    gs.classList.add('active');
    LudoGame.initBoard();

    // Offline badge
    let b=document.getElementById('ofl-badge');
    if(!b){ b=document.createElement('div'); b.id='ofl-badge';
      b.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:200;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font-size:11px;font-weight:800;padding:5px 14px;border-radius:50px;font-family:Nunito,sans-serif;pointer-events:none;';
      document.body.appendChild(b); }
    b.textContent='🤖 Offline vs Bots';

    // Wire BOTH roll buttons
    _wireRoll();
    window._socketMoveToken = _humanPick;

    _sync();
    LudoGame.addLog('🎮 Offline game shuru!','');
    _beginTurn();
  }

  function _mkP(id, name, color, isBot, diff) {
    return {
      id, name, color, isBot, difficulty:diff,
      tokens:[{position:-1,finished:false},{position:-1,finished:false},
              {position:-1,finished:false},{position:-1,finished:false}],
      finishedTokens:0
    };
  }

  /* ── Wire both roll buttons ─────────────────────────────── */
  function _wireRoll() {
    ['roll-btn','roll-btn-top'].forEach(id=>{
      const old=document.getElementById(id); if(!old) return;
      const btn=old.cloneNode(true);
      old.parentNode.replaceChild(btn,old);
      btn.addEventListener('click',()=>{
        if(over||G.rolled) return;
        const cur=G.players[G.idx];
        if(cur.isBot) return;
        LudoGame.playSound('roll');
        _roll();
      });
    });
  }

  /* ── Sync renderer ──────────────────────────────────────── */
  function _sync() {
    if(!G) return;
    const cur=G.players[G.idx];
    const human=G.players[0];
    const isHuman=(cur.id==='human');

    const gs={
      started:true, currentTurnIndex:G.idx,
      currentTurn:{playerId:cur.id,playerName:cur.name,color:cur.color},
      lastDiceValue:G.dice, diceRolledThisTurn:G.rolled,
      movableTokens:G.movable,
      players:G.players.map(p=>({
        id:p.id, name:p.name, color:p.color,
        finishedTokens:p.tokens.filter(t=>t.finished).length,
        tokens:p.tokens.map(t=>({position:t.position,finished:t.finished}))
      }))
    };
    LudoGame.setGameState(gs);
    LudoGame.setMyPlayer('human', human.color);
    LudoGame.setMovableTokens(isHuman&&G.rolled ? G.movable : []);
    LudoGame.updatePlayerCards(gs.players, gs.currentTurn);
    LudoGame.updateTurnLabel(gs.currentTurn);

    // Roll buttons: only enabled for human, dice not yet rolled
    LudoGame.setRollEnabled(isHuman && !G.rolled && !over);

    // Hint
    if(isHuman&&!G.rolled)
      LudoGame.setHint('🎲 Dice daalo!');
    else if(isHuman&&G.rolled&&G.movable.length)
      LudoGame.setHint('👆 Board pe token pe click karo!');
    else if(!isHuman)
      LudoGame.setHint(`🤖 ${cur.name} soch raha hai…`);
    else
      LudoGame.setHint('');

    LudoGame.render();
  }

  /* ── Turn management ────────────────────────────────────── */
  function _beginTurn() {
    if(over) return;
    G.rolled=false; G.dice=null; G.movable=[];
    _sync();
    const cur=G.players[G.idx];
    LudoGame.addLog(`${cur.isBot?'🤖':'🎯'} ${cur.name} ki baari`,cur.color);
    if(cur.isBot) T=setTimeout(_botRoll, BOT_MS[cur.difficulty]||900);
  }

  function _next(extra) {
    if(over) return;
    if(!extra){ G.c6=0; G.idx=(G.idx+1)%G.players.length; }
    _beginTurn();
  }

  /* ── Roll ───────────────────────────────────────────────── */
  function _roll() {
    if(G.rolled) return;
    const d=Math.floor(Math.random()*6)+1;
    G.dice=d; G.rolled=true;

    if(d===6){ G.c6++; if(G.c6>=3){
      const cur=G.players[G.idx];
      LudoGame.showDice(d);
      LudoGame.showToast(`${cur.name}: 3 sixes — turn forfeit! 😱`);
      LudoGame.addLog(`3 sixes penalty — ${cur.name}`,cur.color);
      G.c6=0; G.rolled=false; G.movable=[];
      _sync(); T=setTimeout(()=>_next(false),1200); return;
    }} else { G.c6=0; }

    const cur=G.players[G.idx];
    G.movable=_getMovable(cur,d);
    LudoGame.showDice(d);
    LudoGame.addLog(`${cur.name} ne ${d} daala`,cur.color);
    _sync();

    if(!G.movable.length){
      LudoGame.showToast(`${cur.name}: koi move nahi!`);
      T=setTimeout(()=>_next(false),1100);
    } else if(cur.isBot) {
      T=setTimeout(()=>_botPick(cur), BOT_MS[cur.difficulty]||900);
    }
  }

  function _botRoll() { if(!over){ LudoGame.playSound('roll'); _roll(); } }

  /* ── Movable (FAIR: all 4 tokens independently) ─────────── */
  function _getMovable(player, dice) {
    const m=[];
    player.tokens.forEach((t,i)=>{
      if(t.finished) return;
      if(t.position===-1){ if(dice===6) m.push(i); }
      else { if(t.position+dice<=57) m.push(i); }
    });
    return m;
  }

  /* ── Execute move ───────────────────────────────────────── */
  function _move(pidx, tidx) {
    if(over) return;
    const player=G.players[pidx];
    const token=player.tokens[tidx];
    const path=OFL_PATHS[player.color];
    const d=G.dice;
    let extra=false;

    // Advance
    token.position = token.position===-1 ? 0 : token.position+d;

    // Finish check — EXACT: must land on 57
    if(token.position===57){
      token.finished=true;
    } else if(token.position>57){
      // shouldn't happen due to _getMovable guard
      token.position-=d;
      G.rolled=false; G.movable=[];
      _sync(); return;
    }

    // Kill check (main track 0–50 only)
    if(!token.finished && token.position>=0 && token.position<=50){
      const [tr,tc]=path[token.position];
      const key=`${tr},${tc}`;
      if(!OFL_SAFE.has(key)){
        G.players.forEach((other,oi)=>{
          if(oi===pidx) return;
          const op=OFL_PATHS[other.color];
          other.tokens.forEach((ot,ti)=>{
            if(ot.finished||ot.position<0||ot.position>50) return;
            const [or,oc]=op[ot.position];
            if(or===tr&&oc===tc){
              ot.position=-1; extra=true;
              LudoGame.playSound('kill');
              LudoGame.addLog(`💥 ${player.name} ne ${other.name} ka token kaata!`,player.color);
              LudoGame.showToast(`💥 ${player.name} ne ${other.name} ko kaata!`);
            }
          });
        });
      }
    }

    if(d===6) extra=true;

    // Sync finishedTokens count
    player.finishedTokens = player.tokens.filter(t=>t.finished).length;

    G.rolled=false; G.movable=[];
    LudoGame.playSound('move');
    _sync();

    // ── WIN CHECK: ALL 4 tokens must be finished ─────────────
    const won = player.tokens.every(t => t.finished);
    if(won){
      over=true;
      LudoGame.setRollEnabled(false);
      LudoGame.setHint('');
      setTimeout(()=>{
        LudoGame.showWin(player.name, player.color);
        LudoGame.addLog(`🏆 ${player.name} JEET GAYA!`,player.color);
      },400);
      return;
    }

    T=setTimeout(()=>_next(extra), 350);
  }

  /* ── Human picks token ──────────────────────────────────── */
  function _humanPick(tidx) {
    if(over) return;
    if(G.players[G.idx].id!=='human') return;
    if(!G.rolled){ LudoGame.showToast('Pehle dice daalo!'); return; }
    if(!G.movable.includes(tidx)){ LudoGame.showToast('Yeh token nahi chal sakta!'); return; }
    _move(G.idx, tidx);
  }

  /* ── Bot picks token (AI) ───────────────────────────────── */
  function _botPick(bot) {
    if(over) return;
    const pidx=G.idx, mv=G.movable;
    if(!mv||!mv.length) return;
    _move(pidx, _aiPick(bot, mv, G.dice, pidx));
  }

  function _aiPick(bot, movable, dice, pidx) {
    if(bot.difficulty==='easy') return movable[Math.floor(Math.random()*movable.length)];
    const player=G.players[pidx], path=OFL_PATHS[player.color];
    let best=movable[0], bs=-Infinity;
    movable.forEach(i=>{
      const s=_score(player,i,dice,pidx,path,bot.difficulty);
      if(s>bs){best=i;bs=s;}
    });
    return best;
  }

  function _score(player,ti,dice,pidx,path,diff) {
    const t=player.tokens[ti];
    const np=t.position===-1?0:t.position+dice;
    let s=0;
    if(np===57) return 10000;          // guaranteed finish
    if(np>50)   s+=150;                // entering home column
    if(np>=0&&np<=50){
      const [nr,nc]=path[np];
      s+=_kills(nr,nc,pidx)*( diff==='hard'?300:100 );
      if(diff==='hard'&&!OFL_SAFE.has(`${nr},${nc}`))
        s-=_threat(nr,nc,pidx)*50;
    }
    s+=np*0.8;
    if(t.position===-1) s+=20;
    return s;
  }

  function _kills(row,col,my) {
    let n=0;
    G.players.forEach((o,oi)=>{
      if(oi===my) return;
      const op=OFL_PATHS[o.color];
      o.tokens.forEach(ot=>{
        if(ot.finished||ot.position<0||ot.position>50) return;
        const [or,oc]=op[ot.position];
        if(or===row&&oc===col) n++;
      });
    });
    return n;
  }

  function _threat(row,col,my) {
    let n=0;
    G.players.forEach((o,oi)=>{
      if(oi===my) return;
      const op=OFL_PATHS[o.color];
      o.tokens.forEach(ot=>{
        if(ot.finished||ot.position<0||ot.position>50) return;
        for(let d=1;d<=6;d++){
          const np=ot.position+d; if(np>50) break;
          const [nr,nc]=op[np];
          if(nr===row&&nc===col){n++;break;}
        }
      });
    });
    return n;
  }

  return { start };
})();

window.OfflineGame = OfflineGame;

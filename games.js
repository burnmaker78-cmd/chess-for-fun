/* LAChess: saved games, Games tab, game viewer (step through + explore freely). Load after profile.js. */
(function () {
  const R = window.ChessRules, $ = id => document.getElementById(id);
  const G = () => window.getLAGame && window.getLAGame();
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FILES = 'abcdefgh', sq = (r, c) => FILES[c] + (8 - r);
  const myRec = () => { const k = get('lac-session', null); return k ? (get('lac-users', {})[k] || null) : null; };
  const saveRec = rec => { const all = get('lac-users', {}); all[rec.key] = rec; put('lac-users', all); if (window.Cloud) window.Cloud.saveElo(rec); };

  const css = document.createElement('style');
  css.textContent = `.gm-row{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.06);margin:6px 0;cursor:pointer;transition:transform .15s,background .15s;animation:slideIn .3s ease both}
  .gm-row:hover{transform:translateX(4px);background:rgba(255,255,255,.1)} .gm-row small{color:#9aa;display:block}
  .gm-res{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;flex-shrink:0}
  .gm-res.W{background:#4caf50}.gm-res.L{background:#d94a4a}.gm-res.D{background:#8a8a99}
  #vw-board .square{cursor:pointer}`;
  document.head.appendChild(css);

  const mk = (id, inner) => { const d = document.createElement('div'); d.id = id; d.className = 'screen hidden'; d.innerHTML = `<div class="wrap">${inner}</div>`; document.body.appendChild(d); };
  mk('screen-games', '<h2>My Games</h2><div id="gm-list"></div>');
  mk('screen-viewer', `<button class="back-btn" id="vw-exit">&larr; Back</button><h2 id="vw-title"></h2><p id="vw-sub" class="subtitle"></p>
    <div id="vw-board" class="board mini"></div><p id="vw-note" class="rv-note"></p>
    <div class="controls"><button id="vw-first">⏮</button><button id="vw-prev">◀</button><button id="vw-next">▶</button><button id="vw-last">⏭</button><button id="vw-flip">Flip</button><button id="vw-back">↩ Back to game</button></div>
    <ol id="vw-list" class="rv-moves"></ol>`);
  const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
  const visible = () => { const s = [...document.querySelectorAll('.screen')].find(x => !x.classList.contains('hidden')); return s ? s.id : 'screen-dashboard'; };

  /* ---------- sidebar entry ---------- */
  const side = document.querySelector('.lac-side');
  if (side) {
    const b = document.createElement('button');
    b.dataset.s = 'screen-games'; b.innerHTML = '<span>🎞</span>Games';
    b.onclick = () => { renderList(); show('screen-games'); };
    const prof = [...side.children].find(x => x.dataset && x.dataset.s === 'screen-profile');
    side.insertBefore(b, prof || null);
  }

  /* ---------- save finished games (normal games only; Chess Beta games are never saved) ---------- */
  const prevEnd = window.LA.onEnd;
  window.LA.onEnd = msg => {
    const g = G(), first = g && !g.gmSaved;
    if (prevEnd) prevEnd(msg);
    if (!first || !g.moves.length || g.chaosAssignment) return;
    g.gmSaved = true;
    try {
      const u = myRec(); if (!u) return;
      const res = /White wins/.test(msg) ? '1-0' : /Black wins/.test(msg) ? '0-1' : /draw|stalemate/i.test(msg) ? '1/2-1/2' : null;
      if (!res) return;
      let opp = 'Friend', oppElo = null, me = 'w';
      if (g.type === 'bot') { opp = g.bot.name; oppElo = g.bot.elo; }
      else if (g.type === 'online') {
        me = window.LA.myColor;
        const m = /vs (\S+) \((\d+)\)/.exec($('opponent-line').textContent);
        opp = m ? m[1] : 'Opponent'; oppElo = m ? +m[2] : null;
      }
      const rec = {
        id: Date.now(), res, me, opp, oppElo,
        tc: g._base === undefined ? 'No clock' : g._base + ' min',
        mv: g.moves.map(x => sq(x.from.r, x.from.c) + sq(x.move.r, x.move.c) + (x.promotionType || '')).join(' ')
      };
      u.games = [rec, ...(u.games || [])].slice(0, 50);
      saveRec(u);
    } catch (e) {}
  };

  /* ---------- game lists ---------- */
  const verdict = g => g.res === '1/2-1/2' ? 'D' : ((g.res === '1-0' && g.me === 'w') || (g.res === '0-1' && g.me === 'b')) ? 'W' : 'L';
  function rows(games, who) {
    return games.map((g, i) => `<div class="gm-row" data-i="${i}"><span class="gm-res ${verdict(g)}">${verdict(g)}</span>
      <div><b>${esc(who ? who + ' vs ' : 'vs ')}${esc(g.opp)}${g.oppElo ? ' (' + g.oppElo + ')' : ''}</b><small>${esc(g.tc)} · ${g.res} · ${new Date(g.id).toLocaleDateString()}</small></div></div>`).join('');
  }
  function bind(box, games, who) {
    box.querySelectorAll('.gm-row').forEach(r => r.onclick = () => open(games[+r.dataset.i], who));
  }
  function renderList() {
    const u = myRec(), box = $('gm-list');
    if (!u) { box.innerHTML = '<p>Log in to save and see your games.</p>'; return; }
    const games = u.games || [];
    box.innerHTML = games.length ? rows(games, '') : '<p>No saved games yet. Finish a game while logged in and it shows up here.</p>';
    bind(box, games, '');
  }

  // show a found player's recent games under their profile
  new MutationObserver(async () => {
    const out = $('fd-result');
    if (!out || !out.querySelector('.pf-head') || out.querySelector('.gm-box')) return;
    const key = $('fd-input').value.trim().toLowerCase();
    let u = null;
    try { u = window.Cloud && window.Cloud.getUser ? await window.Cloud.getUser(key) : get('lac-users', {})[key]; } catch (e) {}
    if (!u || !u.games || !u.games.length || out.querySelector('.gm-box')) return;
    const box = document.createElement('div'); box.className = 'gm-box';
    box.innerHTML = '<h3>Recent games</h3>' + rows(u.games, u.name);
    out.appendChild(box); bind(box, u.games, u.name);
  }).observe($('fd-result'), { childList: true });

  /* ---------- viewer ---------- */
  let V = null;
  function replay(mv) {
    let board = R.makeInitialBoard(), ep = null, turn = 'w';
    const states = [{ board, last: null, ep: null, turn }];
    for (const t of mv.split(' ').filter(Boolean)) {
      const fc = FILES.indexOf(t[0]), fr = 8 - +t[1], tc = FILES.indexOf(t[2]), tr = 8 - +t[3];
      const m = R.legalMovesForSquare(board, fr, fc, ep, null).find(x => x.r === tr && x.c === tc);
      if (!m) break;
      board = R.applyMove(board, { r: fr, c: fc }, { r: tr, c: tc }, m, t[4]).board;
      ep = m.doublePush ? { r: (fr + tr) / 2, c: fc } : null; turn = turn === 'w' ? 'b' : 'w';
      states.push({ board, last: { from: { r: fr, c: fc }, to: { r: tr, c: tc } }, ep, turn });
    }
    return states;
  }
  function open(g, who) {
    const states = replay(g.mv);
    V = { g, states, orig: states.slice(), idx: 0, flip: g.me === 'b', sel: null, exploring: false, ret: visible() };
    $('vw-title').textContent = `${who ? who + ' vs ' : 'You vs '}${g.opp}${g.oppElo ? ' (' + g.oppElo + ')' : ''}`;
    $('vw-sub').textContent = `${g.res} · ${g.tc} · ${new Date(g.id).toLocaleDateString()}`;
    const toks = g.mv.split(' ').filter(Boolean);
    $('vw-list').innerHTML = toks.map((t, i) => `<li data-i="${i + 1}"><span class="mn">${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}</span><span>${t}</span></li>`).join('');
    $('vw-list').querySelectorAll('li').forEach(li => li.onclick = () => { if (!V.exploring) go(+li.dataset.i); });
    show('screen-viewer'); draw();
  }
  function go(i) { V.idx = Math.max(0, Math.min(V.states.length - 1, i)); V.sel = null; draw(); }
  function click(r, c) {
    const st = V.states[V.idx];
    if (V.sel) {
      const m = R.legalMovesForSquare(st.board, V.sel.r, V.sel.c, st.ep, null).find(x => x.r === r && x.c === c);
      if (m) {
        const nb = R.applyMove(st.board, V.sel, { r, c }, m, 'q').board;
        V.states = V.states.slice(0, V.idx + 1);
        V.states.push({ board: nb, last: { from: V.sel, to: { r, c } }, ep: m.doublePush ? { r: (V.sel.r + r) / 2, c: V.sel.c } : null, turn: st.turn === 'w' ? 'b' : 'w' });
        V.exploring = true; V.idx++; V.sel = null; return draw();
      }
    }
    const p = st.board[r][c];
    V.sel = p && p.color === st.turn ? { r, c } : null;
    draw();
  }
  function draw() {
    const st = V.states[V.idx], el = $('vw-board'); el.innerHTML = '';
    const legal = V.sel ? R.legalMovesForSquare(st.board, V.sel.r, V.sel.c, st.ep, null) : [];
    for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
      const r = V.flip ? 7 - dr : dr, c = V.flip ? 7 - dc : dc, s = document.createElement('div');
      s.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      if (st.last && ((st.last.from.r === r && st.last.from.c === c) || (st.last.to.r === r && st.last.to.c === c))) s.classList.add('last-move');
      if (V.sel && V.sel.r === r && V.sel.c === c) s.classList.add('selected');
      const p = st.board[r][c]; if (p) s.appendChild(makePieceEl(p.color, p.type));
      const t = legal.find(m => m.r === r && m.c === c);
      if (t) { const d = document.createElement('div'); d.className = t.capture ? 'capture-ring' : 'move-dot'; s.appendChild(d); }
      s.onclick = () => click(r, c); el.appendChild(s);
    }
    $('vw-back').style.display = V.exploring ? '' : 'none';
    $('vw-note').textContent = V.exploring ? 'Exploring — this isn’t part of the real game.' : `Move ${V.idx} of ${V.states.length - 1}`;
    $('vw-list').querySelectorAll('li').forEach(li => li.classList.toggle('on', !V.exploring && +li.dataset.i === V.idx));
  }
  $('vw-first').onclick = () => go(0);
  $('vw-prev').onclick = () => go(V.idx - 1);
  $('vw-next').onclick = () => go(V.idx + 1);
  $('vw-last').onclick = () => go(V.states.length - 1);
  $('vw-flip').onclick = () => { V.flip = !V.flip; draw(); };
  $('vw-back').onclick = () => { V.states = V.orig.slice(); V.exploring = false; go(Math.min(V.idx, V.states.length - 1)); };
  $('vw-exit').onclick = () => show(V ? V.ret : 'screen-dashboard');
  document.addEventListener('keydown', e => {
    if (!V || $('screen-viewer').classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') go(V.idx + 1); else if (e.key === 'ArrowLeft') go(V.idx - 1);
  });
})();

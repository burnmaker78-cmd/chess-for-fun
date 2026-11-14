/* LAChess extras: draw rules, online rematch, leaderboard, PGN copy. Load after clock.js. */
(function () {
  const $ = id => document.getElementById(id);
  const G = () => window.getLAGame && window.getLAGame();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = document.createElement('style');
  css.textContent = `.lb-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.06);margin:6px 0;animation:slideIn .4s ease both}
  .lb-rank{width:30px;color:#9aa;font-weight:700}.lb-name{flex:1;font-weight:600}.lb-elo{color:#f5c542;font-weight:800}`;
  document.head.appendChild(css);

  /* ---------- end a game from here ---------- */
  function end(g, msg) {
    if (!g || g.gameOver) return;
    g.gameOver = true;
    $('turn-indicator').textContent = msg; $('check-indicator').textContent = '';
    $('gameover-text').textContent = msg; $('gameover-modal').classList.remove('hidden');
    if (window.LA.onEnd) window.LA.onEnd(msg);
  }

  /* ---------- automatic draws: insufficient material, threefold repetition, 50-move rule ---------- */
  const key = (b, turn, ep) => b.map(r => r.map(p => p ? p.color + p.type : '.').join('')).join('/') + turn + (ep ? ep.r + '' + ep.c : '');
  function insufficient(b) {
    const ps = [];
    b.forEach((row, r) => row.forEach((p, c) => { if (p && p.type !== 'k') ps.push({ type: p.type, color: p.color, sq: (r + c) % 2 }); }));
    if (!ps.length) return true;
    if (ps.length === 1 && (ps[0].type === 'b' || ps[0].type === 'n')) return true;
    return ps.length === 2 && ps.every(p => p.type === 'b') && ps[0].color !== ps[1].color && ps[0].sq === ps[1].sq;
  }
  function drawReason(g) {
    if (g.chaosAssignment || !g.moves.length) return null; // chaos games have no draw rules
    if (insufficient(g.board)) return 'insufficient material';
    const cur = key(g.board, g.turn, g.enPassantTarget);
    let n = 1;
    g.moves.forEach(m => { if (key(m.before, m.color, m.ep) === cur) n++; });
    if (n >= 3) return 'threefold repetition';
    let half = 0;
    for (let i = g.moves.length - 1; i >= 0; i--) {
      const m = g.moves[i], p = m.before[m.from.r][m.from.c], cap = m.before[m.move.r][m.move.c];
      if (!p || p.type === 'p' || cap || m.move.enPassant) break;
      half++;
    }
    return half >= 100 ? '50-move rule' : null;
  }
  let lastG = null, lastN = -1;
  setInterval(() => {
    const g = G();
    if (!g) return;
    if (g !== lastG) { lastG = g; lastN = -1; }
    if (!g.gameOver && g.moves.length !== lastN) {
      lastN = g.moves.length;
      const r = drawReason(g);
      if (r) end(g, 'Draw — ' + r);
    }
    // rematch button only for finished online games
    rb.style.display = g.type === 'online' && g.gameOver ? '' : 'none';
  }, 300);

  /* ---------- online rematch (both players must agree; colors stay the same) ---------- */
  const rb = document.createElement('button');
  rb.id = 'rematch-online'; rb.className = 'primary-btn'; rb.textContent = '🔁 Rematch'; rb.style.display = 'none';
  $('gameover-modal').querySelector('.modal-actions').prepend(rb);
  let mine = false, theirs = false;
  function reset() { mine = theirs = false; rb.textContent = '🔁 Rematch'; rb.disabled = false; }
  function startNew(chaos) {
    $('gameover-modal').classList.add('hidden');
    reset();
    window.LA.startGame({ mode: 'online', chaos: chaos || null });
  }
  function check() {
    if (mine && theirs && window.LA.myColor === 'w') { // white coordinates so both sides start together
      const chaos = G() ? G().chaosAssignment : null;
      window.LA.send({ t: 'rematchGo', chaos });
      startNew(chaos);
    }
  }
  rb.onclick = () => {
    if (!window.LA.send) return;
    mine = true; rb.disabled = true; rb.textContent = 'Waiting for opponent…';
    window.LA.send({ t: 'rematchReq' });
    check();
  };
  const prev = window.LA.onData;
  window.LA.onData = d => {
    const g = G();
    if (d.t === 'rematchReq' && g && g.gameOver) { theirs = true; if (!mine) rb.textContent = '🔁 Accept rematch'; check(); }
    if (d.t === 'rematchGo') startNew(d.chaos);
    if (prev) prev(d);
  };

  /* ---------- PGN copy ---------- */
  const pb = document.createElement('button');
  pb.id = 'pgn-btn'; pb.textContent = 'Copy PGN';
  document.querySelector('#screen-game .controls').appendChild(pb);
  pb.onclick = () => {
    const g = G(); if (!g || !g.moveLog.length) return;
    const txt = g.gameOver ? $('gameover-text').textContent : '';
    const res = /White wins/.test(txt) ? '1-0' : /Black wins/.test(txt) ? '0-1' : /draw|stalemate/i.test(txt) ? '1/2-1/2' : '*';
    let body = '';
    g.moveLog.forEach((m, i) => { body += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + m.notation + ' '; });
    const pgn = `[Event "LAChess game"]\n[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]\n[Result "${res}"]\n\n${body}${res}`;
    const done = () => { pb.textContent = 'Copied!'; setTimeout(() => { pb.textContent = 'Copy PGN'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(pgn).then(done); else prompt('Copy your PGN:', pgn);
  };

  /* ---------- leaderboard ---------- */
  const T = [[2600, 'GM', 'GoonMaster'], [2300, 'IM', 'International Master'], [2000, 'FM', 'FIDE Master'], [1800, 'CM', 'Candidate Master']];
  const badge = e => { const t = T.find(x => e >= x[0]); return t ? `<span class="ttl ttl-${t[1]}" title="${t[2]}">${t[1]}</span>` : ''; };
  const grid = document.querySelector('#screen-dashboard .card-grid');
  const card = document.createElement('button');
  card.className = 'big-card c2';
  card.innerHTML = '<span class="card-icon">📊</span><span class="card-title">Leaderboard</span><span class="card-desc">The top players, their ratings and titles.</span>';
  grid.appendChild(card);

  const scr = document.createElement('div');
  scr.id = 'screen-leaderboard'; scr.className = 'screen hidden';
  scr.innerHTML = '<div class="wrap"><button class="back-btn" id="lb-back">&larr; Back</button><h2>Top Players</h2><div id="lb-list"></div></div>';
  document.body.appendChild(scr);
  const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
  $('lb-back').onclick = () => show('screen-dashboard');

  card.onclick = async () => {
    show('screen-leaderboard');
    const list = $('lb-list');
    if (!window.Cloud || !window.Cloud.top) { list.textContent = 'The leaderboard needs the Firebase setup.'; return; }
    list.textContent = 'Loading…';
    try {
      const rows = await window.Cloud.top();
      list.innerHTML = rows.length ? rows.map((u, i) =>
        `<div class="lb-row" style="animation-delay:${i * 0.03}s"><span class="lb-rank">${i + 1}</span><span class="lb-name">${badge(u.elo)}${esc(u.name)}</span><span class="lb-elo">${Number(u.elo) || 0}</span></div>`).join('') : 'No players yet.';
    } catch (e) { list.textContent = 'Could not load the leaderboard.'; }
  };
})();

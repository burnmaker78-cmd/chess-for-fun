/* LAChess: analysis board with live Stockfish evaluation. Load after profile.js. */
(function () {
  const R = window.ChessRules, $ = id => document.getElementById(id);
  const FILES = 'abcdefgh', sq = (r, c) => FILES[c] + (8 - r);
  const ENGINE_FILE = 'stockfish-18-lite-single.js';
  const wpOf = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

  const css = document.createElement('style');
  css.textContent = `.an-row{display:flex;gap:8px;justify-content:center;align-items:stretch;margin:10px 0}
  #an-bar{width:22px;border-radius:6px;background:#222;position:relative;overflow:hidden;flex-shrink:0}
  #an-fill{position:absolute;left:0;right:0;bottom:0;height:50%;background:#f1f1f1;transition:height .35s ease}
  #an-wrap{position:relative;width:min(380px,calc(100vw - 280px));min-width:260px} #an-board .square{cursor:pointer}
  #an-arrow{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .an-lines{background:rgba(255,255,255,.06);border-radius:10px;padding:10px 12px;font-variant-numeric:tabular-nums;min-height:4.5em}
  .an-lines div{padding:3px 0} .an-lines b{display:inline-block;min-width:54px;color:#f5c542}`;
  document.head.appendChild(css);

  const scr = document.createElement('div');
  scr.id = 'screen-analysis'; scr.className = 'screen hidden';
  scr.innerHTML = `<div class="wrap"><h2>Analysis board</h2>
    <p class="subtitle">Move pieces for both sides. Stockfish evaluates every position.</p>
    <div class="an-row"><div id="an-bar"><div id="an-fill"></div></div>
      <div id="an-wrap"><div id="an-board" class="board mini" style="max-width:none"></div><svg id="an-arrow" viewBox="0 0 800 800"></svg></div></div>
    <p id="an-eval" class="rv-note"></p>
    <div class="controls"><button id="an-undo">↶ Undo</button><button id="an-reset">Reset</button><button id="an-flip">Flip</button></div>
    <div class="an-lines" id="an-lines">Starting engine…</div></div>`;
  document.body.appendChild(scr);

  const side = document.querySelector('.lac-side');
  if (side) {
    const b = document.createElement('button');
    b.dataset.s = 'screen-analysis'; b.innerHTML = '<span>🧠</span>Analysis';
    b.onclick = () => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); scr.classList.remove('hidden'); if (!states) reset(); boot(); };
    const prof = [...side.children].find(x => x.dataset && x.dataset.s === 'screen-profile');
    side.insertBefore(b, prof || null);
  }

  /* ---------- position state ---------- */
  let states, moves, sel = null, flip = false;
  function reset() { states = [{ board: R.makeInitialBoard(), ep: null, turn: 'w', last: null }]; moves = []; sel = null; draw(); request(); }
  const cur = () => states[states.length - 1];

  function draw() {
    const st = cur(), el = $('an-board'); el.innerHTML = '';
    const legal = sel ? R.legalMovesForSquare(st.board, sel.r, sel.c, st.ep, null) : [];
    for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
      const r = flip ? 7 - dr : dr, c = flip ? 7 - dc : dc, s = document.createElement('div');
      s.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      if (st.last && ((st.last.from.r === r && st.last.from.c === c) || (st.last.to.r === r && st.last.to.c === c))) s.classList.add('last-move');
      if (sel && sel.r === r && sel.c === c) s.classList.add('selected');
      const p = st.board[r][c]; if (p) s.appendChild(makePieceEl(p.color, p.type));
      const t = legal.find(m => m.r === r && m.c === c);
      if (t) { const d = document.createElement('div'); d.className = t.capture ? 'capture-ring' : 'move-dot'; s.appendChild(d); }
      s.onclick = () => click(r, c);
      el.appendChild(s);
    }
    $('an-arrow').innerHTML = '';
  }
  function click(r, c) {
    const st = cur();
    if (sel) {
      const m = R.legalMovesForSquare(st.board, sel.r, sel.c, st.ep, null).find(x => x.r === r && x.c === c);
      if (m) {
        const nb = R.applyMove(st.board, sel, { r, c }, m, 'q').board;
        moves.push(sq(sel.r, sel.c) + sq(r, c) + (m.promotion ? 'q' : ''));
        states.push({ board: nb, ep: m.doublePush ? { r: (sel.r + r) / 2, c: sel.c } : null, turn: st.turn === 'w' ? 'b' : 'w', last: { from: sel, to: { r, c } } });
        sel = null; draw(); request(); return;
      }
    }
    const p = st.board[r][c];
    sel = p && p.color === st.turn ? { r, c } : null;
    draw();
  }
  $('an-undo').onclick = () => { if (states.length > 1) { states.pop(); moves.pop(); sel = null; draw(); request(); } };
  $('an-reset').onclick = reset;
  $('an-flip').onclick = () => { flip = !flip; draw(); showInfo(); };

  /* ---------- engine ---------- */
  let w = null, ready = false, searching = false, want = false, info = {}, failed = false;
  function boot() {
    if (w || failed) { if (!w) $('an-lines').textContent = 'Add the Stockfish files to your repo to use the engine (see the review setup).'; if (w) return; return; }
    try { w = new Worker(ENGINE_FILE); } catch (e) { failed = true; return boot(); }
    const t = setTimeout(() => { if (!ready) { failed = true; w = null; boot(); } }, 25000);
    w.onerror = () => { failed = true; w = null; clearTimeout(t); boot(); };
    w.onmessage = e => {
      const l = String(e.data);
      if (!ready) {
        if (l === 'uciok') { w.postMessage('setoption name MultiPV value 3'); w.postMessage('isready'); }
        else if (l === 'readyok') { ready = true; clearTimeout(t); request(); }
        return;
      }
      if (l.startsWith('bestmove')) { searching = false; if (want) startSearch(); return; }
      if (want || !l.startsWith('info') || !l.includes(' score ')) return;
      const mpv = +((/multipv (\d+)/.exec(l) || [0, 1])[1]), sc = /score (cp|mate) (-?\d+)/.exec(l), pv = / pv (\S+)/.exec(l), d = /depth (\d+)/.exec(l);
      if (sc && pv) { info[mpv] = { kind: sc[1], v: +sc[2], mv: pv[1], depth: d ? +d[1] : 0 }; showInfo(); }
    };
    w.postMessage('uci');
  }
  function request() {
    if (!w || !ready) { if (!w && !failed) boot(); return; }
    const st = cur();
    if (!R.allLegalMoves(st.board, st.turn, st.ep, null).length) {
      info = {}; $('an-arrow').innerHTML = '';
      $('an-lines').textContent = R.isInCheck(st.board, st.turn) ? 'Checkmate — ' + (st.turn === 'w' ? 'Black' : 'White') + ' wins' : 'Stalemate — draw';
      $('an-eval').textContent = ''; $('an-fill').style.height = st.turn === 'w' ? '0%' : '100%';
      if (searching) { want = false; w.postMessage('stop'); }
      return;
    }
    if (searching) { want = true; w.postMessage('stop'); } else startSearch();
  }
  function startSearch() {
    want = false; searching = true; info = {};
    w.postMessage('position startpos' + (moves.length ? ' moves ' + moves.join(' ') : ''));
    w.postMessage('go movetime 4000');
  }

  function showInfo() {
    const st = cur(), top = info[1];
    if (!top) return;
    const sign = st.turn === 'w' ? 1 : -1;
    const txt = x => x.kind === 'mate' ? (x.v * sign > 0 ? '+' : '-') + 'M' + Math.abs(x.v) : ((x.v * sign > 0 ? '+' : x.v * sign < 0 ? '-' : '') + Math.abs(x.v * sign / 100).toFixed(2));
    const cpW = x => x.kind === 'mate' ? sign * (x.v > 0 ? 10000 : -10000) : sign * x.v;
    $('an-fill').style.height = wpOf(cpW(top)) + '%';
    $('an-eval').textContent = `${txt(top)} · depth ${top.depth}`;
    $('an-lines').innerHTML = [1, 2, 3].filter(i => info[i]).map(i => `<div><b>${txt(info[i])}</b>${info[i].mv}</div>`).join('');
    const m = top.mv, fr = 8 - +m[1], fc = FILES.indexOf(m[0]), tr = 8 - +m[3], tc = FILES.indexOf(m[2]);
    const ctr = (r, c) => ({ x: (flip ? 7 - c : c) * 100 + 50, y: (flip ? 7 - r : r) * 100 + 50 });
    const a = ctr(fr, fc), b = ctr(tr, tc), len = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const tip = { x: b.x - ux * 8, y: b.y - uy * 8 }, base = { x: tip.x - ux * 26, y: tip.y - uy * 26 };
    $('an-arrow').innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${base.x}" y2="${base.y}" stroke="#2ecc71" stroke-width="9" opacity=".75"/>
      <polygon points="${tip.x},${tip.y} ${base.x - uy * 14},${base.y + ux * 14} ${base.x + uy * 14},${base.y - ux * 14}" fill="#2ecc71" opacity=".75"/>`;
  }
})();

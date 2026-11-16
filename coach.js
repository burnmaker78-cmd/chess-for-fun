/* LAChess coach games: play Stockfish and get feedback after every move. Load after profile.js. */
(function () {
  const R = window.ChessRules, $ = id => document.getElementById(id);
  const FILES = 'abcdefgh', sq = (r, c) => FILES[c] + (8 - r);
  const rc = s => ({ r: 8 - +s[1], c: FILES.indexOf(s[0]) });
  const ENGINE_FILE = 'stockfish-18-lite-single.js';
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  const LEVELS = [['Beginner', 0, 120], ['Casual', 3, 200], ['Club', 8, 300], ['Strong', 14, 500], ['Master', 20, 800]];
  const wp = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

  const css = document.createElement('style');
  css.textContent = `#co-wrap{position:relative;width:min(400px,calc(100vw - 260px));min-width:260px;margin:10px auto} #co-board .square{cursor:pointer}
  #co-arrow{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .co-opts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0} .co-opts select{padding:8px;border-radius:8px}
  #co-fb{background:rgba(255,255,255,.06);border-left:5px solid #6c8cff;border-radius:10px;padding:12px 14px;margin:10px 0;min-height:3.2em;animation:slideIn .3s ease both}`;
  document.head.appendChild(css);

  const scr = document.createElement('div');
  scr.id = 'screen-coach'; scr.className = 'screen hidden';
  scr.innerHTML = `<div class="wrap"><h2>Coach game</h2>
    <p class="subtitle">Play Stockfish. After each move, your coach explains how it went.</p>
    <div class="co-opts"><select id="co-level">${LEVELS.map((l, i) => `<option value="${i}" ${i === 1 ? 'selected' : ''}>${l[0]}</option>`).join('')}</select>
      <select id="co-side"><option value="w">Play White</option><option value="b">Play Black</option></select>
      <button class="primary-btn" id="co-new" style="width:auto">New game</button></div>
    <div id="co-wrap"><div id="co-board" class="board mini" style="max-width:none"></div><svg id="co-arrow" viewBox="0 0 800 800"></svg></div>
    <div id="co-fb">Choose a level and press New game.</div>
    <div class="controls"><button id="co-hint">💡 Hint</button><button id="co-back">↶ Take back</button></div></div>`;
  document.body.appendChild(scr);

  const side = document.querySelector('.lac-side');
  if (side) {
    const b = document.createElement('button');
    b.dataset.s = 'screen-coach'; b.innerHTML = '<span>🎓</span>Coach';
    b.onclick = () => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); scr.classList.remove('hidden'); if (!states) newGame(); };
    const prof = [...side.children].find(x => x.dataset && x.dataset.s === 'screen-profile');
    side.insertBefore(b, prof || null);
  }

  /* ---------- engine ---------- */
  let w = null, enginePromise = null;
  function boot() {
    if (enginePromise) return enginePromise;
    enginePromise = new Promise((res, rej) => {
      let x;
      try { x = new Worker(ENGINE_FILE); } catch (e) { return rej(e); }
      const t = setTimeout(() => rej(new Error('timeout')), 25000);
      x.onerror = () => { clearTimeout(t); rej(new Error('load')); };
      x.onmessage = e => {
        const l = String(e.data);
        if (l === 'uciok') x.postMessage('isready');
        else if (l === 'readyok') { clearTimeout(t); x.onmessage = null; w = x; res(x); }
      };
      x.postMessage('uci');
    });
    enginePromise.catch(() => { enginePromise = null; });
    return enginePromise;
  }
  const skill = n => w.postMessage('setoption name Skill Level value ' + n);
  function run(mv, ms) {
    return new Promise(res => {
      let cp;
      w.onmessage = e => {
        const l = String(e.data);
        if (l.startsWith('info') && l.includes(' score ')) {
          const m = /score (cp|mate) (-?\d+)/.exec(l);
          if (m) cp = m[1] === 'cp' ? +m[2] : (+m[2] > 0 ? 1 : -1) * (10000 - Math.abs(+m[2]) * 10);
        } else if (l.startsWith('bestmove')) res({ cp, best: l.split(' ')[1] });
      };
      w.postMessage('position startpos' + (mv.length ? ' moves ' + mv.join(' ') : ''));
      w.postMessage('go movetime ' + ms);
    });
  }

  /* ---------- game state ---------- */
  let states = null, moves = [], sel = null, me = 'w', busy = false, token = 0;
  const cur = () => states[states.length - 1];
  const over = st => !R.allLegalMoves(st.board, st.turn, st.ep, null).length;
  const say = (html, color) => { $('co-fb').innerHTML = html; $('co-fb').style.borderLeftColor = color || '#6c8cff'; };

  function play(uci) {
    const st = cur(), f = rc(uci.slice(0, 2)), t = rc(uci.slice(2, 4));
    const m = R.legalMovesForSquare(st.board, f.r, f.c, st.ep, null).find(x => x.r === t.r && x.c === t.c);
    if (!m) return false;
    const nb = R.applyMove(st.board, f, t, m, uci[4] || 'q').board;
    moves.push(uci);
    states.push({ board: nb, ep: m.doublePush ? { r: (f.r + t.r) / 2, c: f.c } : null, turn: st.turn === 'w' ? 'b' : 'w', last: { from: f, to: t } });
    return true;
  }
  function draw() {
    const st = cur(), el = $('co-board'), flip = me === 'b';
    el.innerHTML = '';
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
  }
  function arrow(uci) {
    const flip = me === 'b', a = rc(uci.slice(0, 2)), b = rc(uci.slice(2, 4));
    const P = p => ({ x: (flip ? 7 - p.c : p.c) * 100 + 50, y: (flip ? 7 - p.r : p.r) * 100 + 50 });
    const A = P(a), Bp = P(b), len = Math.hypot(Bp.x - A.x, Bp.y - A.y) || 1, ux = (Bp.x - A.x) / len, uy = (Bp.y - A.y) / len;
    const tip = { x: Bp.x - ux * 8, y: Bp.y - uy * 8 }, base = { x: tip.x - ux * 26, y: tip.y - uy * 26 };
    $('co-arrow').innerHTML = `<line x1="${A.x}" y1="${A.y}" x2="${base.x}" y2="${base.y}" stroke="#2ecc71" stroke-width="9" opacity=".8"/>
      <polygon points="${tip.x},${tip.y} ${base.x - uy * 14},${base.y + ux * 14} ${base.x + uy * 14},${base.y - ux * 14}" fill="#2ecc71" opacity=".8"/>`;
  }

  function finishText(st) {
    return R.isInCheck(st.board, st.turn) ? `Checkmate — ${st.turn === 'w' ? 'Black' : 'White'} wins` : 'Stalemate — draw';
  }

  async function newGame() {
    const my = ++token;
    me = $('co-side').value; states = [{ board: R.makeInitialBoard(), ep: null, turn: 'w', last: null }]; moves = []; sel = null; busy = true;
    $('co-arrow').innerHTML = ''; draw();
    say('Starting Stockfish…');
    try { await boot(); } catch (e) { say('Add the Stockfish files to your repo to play coach games (see the review setup).', '#d94a4a'); busy = false; return; }
    if (my !== token) return;
    if (me === 'b') { await botMove(my); } else say('Your move. You’re White.');
    busy = false;
  }
  async function botMove(my) {
    const L = LEVELS[+$('co-level').value];
    skill(L[1]);
    const r = await run(moves, L[2]);
    if (my !== token || !r.best || r.best === '(none)') return;
    play(r.best); draw();
    if (over(cur())) say(finishText(cur()), '#f5c542');
  }

  function click(r, c) {
    if (busy || over(cur()) || cur().turn !== me) return;
    const st = cur();
    if (sel) {
      const m = R.legalMovesForSquare(st.board, sel.r, sel.c, st.ep, null).find(x => x.r === r && x.c === c);
      if (m) { const uci = sq(sel.r, sel.c) + sq(r, c) + (m.promotion ? 'q' : ''); sel = null; $('co-arrow').innerHTML = ''; return userMove(uci); }
    }
    const p = st.board[r][c];
    sel = p && p.color === me ? { r, c } : null;
    draw();
  }

  async function userMove(uci) {
    const my = token; busy = true;
    const before = cur(); play(uci); draw();
    const nx = cur();
    say('Coach is thinking…');
    skill(20);
    const b = await run(moves.slice(0, -1), 350);
    if (my !== token) return;
    const terminal = over(nx);
    const a = terminal ? { cp: R.isInCheck(nx.board, nx.turn) ? -10000 : 0, best: '(none)' } : await run(moves, 350);
    if (my !== token) return;
    const drop = Math.max(0, wp(b.cp || 0) - wp(-(a.cp || 0)));
    const isBest = b.best && b.best.slice(0, 4) === uci.slice(0, 4);
    let label, color, text;
    if (isBest || drop <= 1) { label = 'Best move'; color = '#7bb33a'; text = 'That’s exactly what Stockfish would play.'; }
    else if (drop <= 2) { label = 'Excellent'; color = '#8cc152'; text = 'A very strong move.'; }
    else if (drop <= 5) { label = 'Good'; color = '#8aa27a'; text = 'Solid. There was a slightly better option.'; }
    else {
      label = drop <= 10 ? 'Inaccuracy' : drop <= 20 ? 'Mistake' : 'Blunder';
      color = drop <= 10 ? '#e8b923' : drop <= 20 ? '#e8832a' : '#d94a4a';
      text = `Stockfish preferred <b>${b.best}</b>.`;
      const reply = a.best;
      if (-(a.cp || 0) <= -9000) text = `That allows a forced checkmate. Stockfish preferred <b>${b.best}</b>.`;
      else if (reply && reply !== '(none)') {
        const t = rc(reply.slice(2, 4)), victim = nx.board[t.r][t.c];
        if (victim && victim.color === me && VAL[victim.type] >= 300) text = `That lets your opponent play ${reply} and win your ${NAME[victim.type]}. Stockfish preferred <b>${b.best}</b>.`;
      }
    }
    say(`<b style="color:${color}">${label}</b> — ${text}`, color);
    if (terminal) { say(`<b style="color:#f5c542">${finishText(nx)}</b>`, '#f5c542'); busy = false; return; }
    await botMove(my);
    if (my === token) busy = false;
  }

  $('co-new').onclick = newGame;
  $('co-hint').onclick = async () => {
    if (busy || !states || over(cur()) || cur().turn !== me || !w) return;
    busy = true; const my = token;
    say('Looking for a hint…'); skill(20);
    const r = await run(moves, 400);
    if (my === token && r.best && r.best !== '(none)') { arrow(r.best); say(`💡 Try <b>${r.best}</b>.`); }
    busy = false;
  };
  $('co-back').onclick = () => {
    if (busy || !states) return;
    const min = me === 'b' ? 2 : 1;
    let n = cur().turn === me ? 2 : 1;
    while (n-- > 0 && states.length > min) { states.pop(); moves.pop(); }
    sel = null; $('co-arrow').innerHTML = ''; say('Move taken back. Your turn.'); draw();
  };
})();

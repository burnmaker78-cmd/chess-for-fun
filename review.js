/* LAChess game review: analyzes recorded moves with the bot engine. */
(function () {
  const R = window.ChessRules, B = window.ChessBot;
  const ICON_DIR = 'icons/'; // folder that holds your icon files
  const ICON_FILES = {
    brilliant:  'brilliant.svg',
    great:      'great_find.svg',
    best:       'best.svg',
    excellent:  'excellent.svg',
    good:       'good.svg',
    book:       'book.svg',
    inaccuracy: 'inaccuracy.svg',
    mistake:    'mistake.svg',
    blunder:    'blunder.svg'
  };

  const CLASSES = {
    brilliant:  { label: 'Brilliant',  color: '#1baca6', sym: '!!' },
    great:      { label: 'Great',      color: '#5b8def', sym: '!' },
    best:       { label: 'Best',       color: '#7bb33a', sym: '★' },
    excellent:  { label: 'Excellent',  color: '#8cc152', sym: '✓' },
    good:       { label: 'Good',       color: '#8aa27a', sym: '•' },
    book:       { label: 'Book',       color: '#a88b5e', sym: '≡' },
    inaccuracy: { label: 'Inaccuracy', color: '#e8b923', sym: '?!' },
    mistake:    { label: 'Mistake',    color: '#e8832a', sym: '?' },
    blunder:    { label: 'Blunder',    color: '#d94a4a', sym: '??' }
  };
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  function badge(key) {
    const c = CLASSES[key];
    if (ICON_DIR) return `<img class="bdg" src="${ICON_DIR}${ICON_FILES[key] || key + '.svg'}" alt="${c.label}">`;
    return `<svg class="bdg badge-pop" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${c.color}"/><text x="12" y="16.5" text-anchor="middle" font-size="${c.sym.length > 1 ? 11 : 13}" font-weight="800" fill="#fff" font-family="Arial,sans-serif">${c.sym}</text></svg>`;
  }

  function search(b, d, a, be, maxW, ep) {
    if (!d) return B.evaluate(b);
    const c = maxW ? 'w' : 'b', ms = R.allLegalMoves(b, c, ep, null);
    if (!ms.length) return R.isInCheck(b, c) ? (maxW ? -1e5 : 1e5) : 0;
    let best = maxW ? -Infinity : Infinity;
    for (const { from, move } of ms) {
      const nb = R.applyMove(b, from, { r: move.r, c: move.c }, move, 'q').board;
      const nep = move.doublePush ? { r: (from.r + move.r) / 2, c: from.c } : null;
      const s = search(nb, d - 1, a, be, !maxW, nep);
      if (maxW) { best = Math.max(best, s); a = Math.max(a, s); } else { best = Math.min(best, s); be = Math.min(be, s); }
      if (be <= a) break;
    }
    return best;
  }

  // Score (white's perspective) after playing a move, looking one reply ahead.
  function after(before, from, move, promo, color) {
    const nb = R.applyMove(before, from, { r: move.r, c: move.c }, move, promo || 'q').board;
    const nep = move.doublePush ? { r: (from.r + move.r) / 2, c: from.c } : null;
    return { board: nb, score: search(nb, 1, -Infinity, Infinity, color === 'b', nep) };
  }

  const sqName = (r, c) => 'abcdefgh'[c] + (8 - r);

  function analyzeMove(m, i) {
    const color = m.color, sign = color === 'w' ? 1 : -1;
    const played = after(m.before, m.from, m.move, m.promotionType, color);
    const bestMv = B.findBestMove(m.before, color, m.ep, 2);
    const best = bestMv ? after(m.before, bestMv.from, bestMv.move, 'q', color) : played;
    const loss = Math.max(0, sign * (best.score - played.score));
    const playedPOV = sign * played.score;
    const staticBefore = sign * B.evaluate(m.before);
    const piece = m.before[m.from.r][m.from.c];
    const opp = color === 'w' ? 'b' : 'w';
    const hanging = R.isSquareAttacked(played.board, m.move.r, m.move.c, opp);

    let cls;
    if (loss <= 20 && hanging && piece && VAL[piece.type] >= 300 && playedPOV >= staticBefore - 60) cls = 'brilliant';
    else if (loss <= 10 && playedPOV - staticBefore >= 150) cls = 'great';
    else if (i < 6 && loss <= 40) cls = 'book';
    else if (loss <= 10) cls = 'best';
    else if (loss <= 30) cls = 'excellent';
    else if (loss <= 60) cls = 'good';
    else if (loss <= 120) cls = 'inaccuracy';
    else if (loss <= 250) cls = 'mistake';
    else cls = 'blunder';
    return { cls, loss, after: played.board, best: bestMv };
  }

  function drawBoard(el, board, hi, bestSq) {
    el.innerHTML = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      if (hi && ((hi.from.r === r && hi.from.c === c) || (hi.to.r === r && hi.to.c === c))) sq.classList.add('last-move');
      if (bestSq && ((bestSq.from.r === r && bestSq.from.c === c) || (bestSq.to.r === r && bestSq.to.c === c))) sq.classList.add('best-sq');
      const p = board[r][c];
      if (p) sq.appendChild(makePieceEl(p.color, p.type));
      el.appendChild(sq);
    }
  }

  const $ = id => document.getElementById(id);
  let results = [], cur = 0, g = null;

  function show(i) {
    if (!results.length) return;
    cur = Math.max(0, Math.min(results.length - 1, i));
    const r = results[cur], m = g.moves[cur], c = CLASSES[r.cls];
    const bestTxt = r.best ? `${sqName(r.best.from.r, r.best.from.c)}→${sqName(r.best.move.r, r.best.move.c)}` : '';
    const mine = `${sqName(m.from.r, m.from.c)}→${sqName(m.move.r, m.move.c)}`;
    drawBoard($('review-board'), r.after, { from: m.from, to: { r: m.move.r, c: m.move.c } },
      r.cls === 'best' || r.cls === 'great' || r.cls === 'brilliant' || r.cls === 'book' ? null : r.best && { from: r.best.from, to: { r: r.best.move.r, c: r.best.move.c } });
    $('review-note').innerHTML = `${badge(r.cls)} <b style="color:${c.color}">${mine} is ${/^[aeiou]/i.test(c.label) ? 'an' : 'a'} ${c.label.toLowerCase()}</b>` +
      (['best', 'great', 'brilliant', 'book'].includes(r.cls) ? '' : `<br><small>Best was ${bestTxt} (shown in green)</small>`);
    document.querySelectorAll('#review-moves li').forEach((li, k) => li.classList.toggle('on', k === cur));
    const on = document.querySelector('#review-moves li.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }

  function finish() {
    const acc = { w: [], b: [] }, cnt = {};
    Object.keys(CLASSES).forEach(k => cnt[k] = { w: 0, b: 0 });
    results.forEach((r, i) => {
      const col = g.moves[i].color;
      acc[col].push(100 * Math.exp(-r.loss / 160));
      cnt[r.cls][col]++;
    });
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) + '%' : '–';
    $('acc-w').textContent = avg(acc.w); $('acc-b').textContent = avg(acc.b);
    $('review-counts').innerHTML = Object.keys(CLASSES).map(k =>
      `<div class="cnt">${badge(k)}<span>${CLASSES[k].label}</span><b>${cnt[k].w}</b><b>${cnt[k].b}</b></div>`).join('');
    $('review-moves').innerHTML = results.map((r, i) =>
      `<li data-i="${i}"><span class="mn">${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}</span>${badge(r.cls)}<span>${g.moveLog[i] ? g.moveLog[i].notation : ''}</span></li>`).join('');
    document.querySelectorAll('#review-moves li').forEach(li => li.addEventListener('click', () => show(+li.dataset.i)));
    $('review-progress').classList.add('hidden');
    $('review-body').classList.remove('hidden');
    show(0);
  }

  function start() {
    g = window.getLAGame && window.getLAGame();
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $('screen-review').classList.remove('hidden');
    $('gameover-modal').classList.add('hidden');
    $('review-body').classList.add('hidden');
    results = [];
    if (!g || !g.moves || !g.moves.length) { $('review-result').textContent = 'Play a few moves first, then come back to review.'; return; }
    if (g.chaosAssignment) { $('review-result').textContent = 'Review isn’t available for Chaos Mode games (the engine only knows normal chess).'; return; }
    $('review-result').textContent = g.gameOver ? $('gameover-text').textContent : 'Game in progress';
    $('review-progress').classList.remove('hidden');
    const bar = $('review-progress').firstElementChild;
    let i = 0;
    (function step() {
      if (i >= g.moves.length) return finish();
      results.push(analyzeMove(g.moves[i], i));
      i++;
      bar.style.width = Math.round(100 * i / g.moves.length) + '%';
      setTimeout(step, 0);
    })();
  }

  $('review-btn').addEventListener('click', start);
  $('gameover-review').addEventListener('click', start);
  $('rv-prev').addEventListener('click', () => show(cur - 1));
  $('rv-next').addEventListener('click', () => show(cur + 1));
})();

/* LAChess: review inside the game viewer (works for imported and saved games). Load after games.js. */
(function () {
  const R = window.ChessRules, B = window.ChessBot, $ = id => document.getElementById(id);
  const FILES = 'abcdefgh', sqn = (r, c) => FILES[c] + (8 - r);
  const CL = {
    brilliant: ['#1baca6', '!!', 'Brilliant'], great: ['#5b8def', '!', 'Great'], best: ['#7bb33a', '★', 'Best'],
    excellent: ['#8cc152', '✓', 'Excellent'], good: ['#8aa27a', '•', 'Good'], book: ['#a88b5e', '≡', 'Book'],
    inaccuracy: ['#e8b923', '?!', 'Inaccuracy'], mistake: ['#e8832a', '?', 'Mistake'], blunder: ['#d94a4a', '??', 'Blunder']
  };
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const badge = k => `<svg class="bdg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${CL[k][0]}"/><text x="12" y="16.5" text-anchor="middle" font-size="${CL[k][1].length > 1 ? 11 : 13}" font-weight="800" fill="#fff" font-family="Arial,sans-serif">${CL[k][1]}</text></svg>`;

  function search(b, d, a, be, maxW, ep) {
    if (!d) return B.evaluate(b);
    const c = maxW ? 'w' : 'b', ms = R.allLegalMoves(b, c, ep, null);
    if (!ms.length) return R.isInCheck(b, c) ? (maxW ? -1e5 : 1e5) : 0;
    let best = maxW ? -Infinity : Infinity;
    for (const { from, move } of ms) {
      const nb = R.applyMove(b, from, { r: move.r, c: move.c }, move, 'q').board;
      const s = search(nb, d - 1, a, be, !maxW, move.doublePush ? { r: (from.r + move.r) / 2, c: from.c } : null);
      if (maxW) { best = Math.max(best, s); a = Math.max(a, s); } else { best = Math.min(best, s); be = Math.min(be, s); }
      if (be <= a) break;
    }
    return best;
  }
  function after(board, from, move, promo, color) {
    const nb = R.applyMove(board, from, { r: move.r, c: move.c }, move, promo || 'q').board;
    const nep = move.doublePush ? { r: (from.r + move.r) / 2, c: from.c } : null;
    return { board: nb, score: search(nb, 1, -Infinity, Infinity, color === 'b', nep) };
  }

  function analyze(states, i) {
    const st = states[i], nx = states[i + 1], color = st.turn, sign = color === 'w' ? 1 : -1;
    const f = nx.last.from, t = nx.last.to;
    const m = R.legalMovesForSquare(st.board, f.r, f.c, st.ep, null).find(x => x.r === t.r && x.c === t.c);
    if (!m) return null;
    const promo = m.promotion ? nx.board[t.r][t.c].type : undefined;
    const played = after(st.board, f, m, promo, color);
    const bm = B.findBestMove(st.board, color, st.ep, 2);
    const best = bm ? after(st.board, bm.from, bm.move, 'q', color) : played;
    const loss = Math.max(0, sign * (best.score - played.score));
    const pPOV = sign * played.score, sBefore = sign * B.evaluate(st.board);
    const piece = st.board[f.r][f.c], opp = color === 'w' ? 'b' : 'w';
    const hanging = R.isSquareAttacked(played.board, t.r, t.c, opp), defended = R.isSquareAttacked(played.board, t.r, t.c, color);
    const capt = !!st.board[t.r][t.c];
    let cls;
    if (loss <= 5 && hanging && !defended && piece && VAL[piece.type] >= 300 && sBefore < 100 && pPOV >= sBefore - 30) cls = 'brilliant';
    else if (loss <= 5 && !capt && pPOV - sBefore >= 250) cls = 'great';
    else if (i < 6 && loss <= 40) cls = 'book';
    else if (loss <= 10) cls = 'best';
    else if (loss <= 30) cls = 'excellent';
    else if (loss <= 60) cls = 'good';
    else if (loss <= 120) cls = 'inaccuracy';
    else if (loss <= 250) cls = 'mistake';
    else cls = 'blunder';
    return { cls, loss, color, best: bm ? { from: bm.from, to: { r: bm.move.r, c: bm.move.c } } : null };
  }

  /* ---------- UI ---------- */
  const ctl = document.querySelector('#screen-viewer .controls');
  if (!ctl) return;
  const btn = document.createElement('button');
  btn.id = 'vr-btn'; btn.className = 'review-btn'; btn.textContent = '★ Review';
  ctl.appendChild(btn);
  const info = document.createElement('div');
  info.innerHTML = '<p id="vr-prog" class="rv-note"></p><p id="vr-acc" class="rv-note"></p>';
  ctl.parentNode.insertBefore(info, ctl.nextSibling);

  let A = null;
  const cur = () => window.LAV && window.LAV.get();

  btn.onclick = () => {
    const V = cur();
    if (!V || !window.LAV) return;
    const g = V.g, states = V.orig, n = states.length - 1;
    if (!n) return;
    A = { g, res: [], done: false };
    $('vr-acc').textContent = '';
    let i = 0;
    (function step() {
      const V2 = cur();
      if (!V2 || V2.g !== g) { A = null; $('vr-prog').textContent = ''; return; }
      if (i >= n) return finish();
      let r = null;
      try { r = analyze(states, i); } catch (e) {}
      A.res.push(r); i++;
      $('vr-prog').textContent = `Analyzing ${i}/${n}…`;
      setTimeout(step, 0);
    })();
  };

  function finish() {
    const acc = { w: [], b: [] };
    A.res.forEach(r => { if (r) acc[r.color].push(100 * Math.exp(-r.loss / 160)); });
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) + '%' : '–';
    $('vr-prog').textContent = '';
    $('vr-acc').textContent = `Accuracy — White ${avg(acc.w)} · Black ${avg(acc.b)}`;
    document.querySelectorAll('#vw-list li').forEach((li, k) => {
      const r = A.res[k];
      if (r && li.children[0]) li.children[0].insertAdjacentHTML('afterend', badge(r.cls));
    });
    A.done = true;
    decorate();
  }

  function decorate() {
    const V = cur();
    if (A && V && A.g !== V.g) { A = null; $('vr-acc').textContent = ''; $('vr-prog').textContent = ''; }
    if (!V || !A || !A.done || V.exploring) return;
    const k = V.idx - 1, r = A.res[k];
    if (!r) return;
    const mv = (V.g.mv.split(' ')[k] || '').slice(0, 4);
    const good = ['best', 'great', 'brilliant', 'book'].includes(r.cls);
    const bestTxt = r.best ? `${sqn(r.best.from.r, r.best.from.c)}→${sqn(r.best.to.r, r.best.to.c)}` : '';
    $('vw-note').innerHTML = `${badge(r.cls)} <b style="color:${CL[r.cls][0]}">${mv} is ${/^[aeiou]/i.test(CL[r.cls][2]) ? 'an' : 'a'} ${CL[r.cls][2].toLowerCase()}</b>` +
      (good || !bestTxt ? '' : `<br><small>Best was ${bestTxt} (shown in green)</small>`);
    if (!good && r.best) {
      const kids = $('vw-board').children;
      [r.best.from, r.best.to].forEach(p => {
        const dr = V.flip ? 7 - p.r : p.r, dc = V.flip ? 7 - p.c : p.c;
        if (kids[dr * 8 + dc]) kids[dr * 8 + dc].classList.add('best-sq');
      });
    }
  }
  new MutationObserver(decorate).observe($('vw-board'), { childList: true });
})();

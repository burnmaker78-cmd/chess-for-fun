/* LAChess: Stockfish review inside the game viewer (imported + saved games).
   Needs stockfish-18-lite-single.js and .wasm in the repo root; falls back to a basic review without them. */
(function () {
  const R = window.ChessRules, B = window.ChessBot, $ = id => document.getElementById(id);
  const FILES = 'abcdefgh', sqn = (r, c) => FILES[c] + (8 - r);
  const ENGINE_FILE = 'stockfish-18-lite-single.js';
  const CL = {
    brilliant: ['#1baca6', '!!', 'Brilliant'], great: ['#5b8def', '!', 'Great'], best: ['#7bb33a', '★', 'Best'],
    excellent: ['#8cc152', '✓', 'Excellent'], good: ['#8aa27a', '•', 'Good'], book: ['#a88b5e', '≡', 'Book'],
    inaccuracy: ['#e8b923', '?!', 'Inaccuracy'], mistake: ['#e8832a', '?', 'Mistake'], blunder: ['#d94a4a', '??', 'Blunder']
  };
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const svgBadge = k => `<svg class="bdg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${CL[k][0]}"/><text x="12" y="16.5" text-anchor="middle" font-size="${CL[k][1].length > 1 ? 11 : 13}" font-weight="800" fill="#fff" font-family="Arial,sans-serif">${CL[k][1]}</text></svg>`;
  const ICON_DIR = 'icons/'; // folder with your own icon files; set to null for the built-in round badges
  const ICON_FILES = {
    brilliant: 'brilliant.svg', great: 'great_find.svg', best: 'best.svg', excellent: 'excellent.svg', good: 'good.svg',
    book: 'book.svg', inaccuracy: 'inaccuracy.svg', mistake: 'mistake.svg', blunder: 'blunder.svg'
  };
  const badge = k => ICON_DIR ? `<img class="bdg" src="${ICON_DIR}${ICON_FILES[k] || k + '.svg'}" alt="${CL[k][2]}">` : svgBadge(k);
  const wp = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);           // win % from centipawns
  const accOf = drop => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
  const uci = s => ({ from: { r: 8 - +s[1], c: FILES.indexOf(s[0]) }, to: { r: 8 - +s[3], c: FILES.indexOf(s[2]) } });

  // biggest piece (minor or larger) of `color` that the other side can win, counting recaptures
  function exposure(board, color) {
    const opp = color === 'w' ? 'b' : 'w';
    let worst = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color || p.type === 'k' || VAL[p.type] < 300) continue;
      let low = 99999;
      for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
        const q = board[rr][cc];
        if (q && q.color === opp && R.legalMovesForSquare(board, rr, cc, null, null).some(m => m.r === r && m.c === c)) low = Math.min(low, VAL[q.type]);
      }
      if (low === 99999) continue;
      worst = Math.max(worst, VAL[p.type] - (R.isSquareAttacked(board, r, c, color) ? low : 0));
    }
    return worst;
  }

  /* ---------- Stockfish ---------- */
  const POOL = [], CACHE = {};
  function spawn() {
    return new Promise((res, rej) => {
      let w;
      try { w = new Worker(ENGINE_FILE); } catch (e) { return rej(e); }
      const t = setTimeout(() => rej(new Error('timeout')), 25000);
      w.onerror = () => { clearTimeout(t); rej(new Error('load')); };
      w.onmessage = e => {
        const l = String(e.data);
        if (l === 'uciok') { w.postMessage('setoption name MultiPV value 2'); w.postMessage('isready'); }
        else if (l === 'readyok') { clearTimeout(t); w.onmessage = null; res(w); }
      };
      w.postMessage('uci');
    });
  }
  async function getPool(n) {
    while (POOL.length < n) { try { POOL.push(await spawn()); } catch (e) { if (!POOL.length) throw e; break; } }
    return POOL.slice(0, n);
  }
  function evalPos(w, moves, ms) { // score is from the side to move's point of view
    return new Promise(res => {
      const sc = {};
      w.onmessage = e => {
        const l = String(e.data);
        if (l.startsWith('info') && l.includes(' score ')) {
          const mpv = +((/multipv (\d+)/.exec(l) || [0, 1])[1]), m = /score (cp|mate) (-?\d+)/.exec(l);
          if (m) sc[mpv] = m[1] === 'cp' ? +m[2] : (+m[2] > 0 ? 1 : -1) * (10000 - Math.abs(+m[2]) * 10);
        } else if (l.startsWith('bestmove')) res({ cp: sc[1], second: sc[2], best: l.split(' ')[1] });
      };
      w.postMessage('position startpos' + (moves.length ? ' moves ' + moves.join(' ') : ''));
      w.postMessage('go movetime ' + (ms || 300));
    });
  }

  function classifyEngine(states, toks, ev, i) {
    const st = states[i], nx = states[i + 1], color = st.turn;
    const before = wp(ev[i].cp), after = wp(-ev[i + 1].cp), drop = Math.max(0, before - after);
    const played = toks[i].slice(0, 4), isBest = !!ev[i].best && ev[i].best.slice(0, 4) === played;
    const gap = ev[i].second === undefined ? 0 : before - wp(ev[i].second);
    const f = nx.last.from, t = nx.last.to, piece = st.board[f.r][f.c], cap = st.board[t.r][t.c], opp = color === 'w' ? 'b' : 'w';
    const defended = R.isSquareAttacked(nx.board, t.r, t.c, color);
    // cheapest enemy piece that can legally take the moved piece
    let low = 99999;
    for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
      const q = nx.board[rr][cc];
      if (q && q.color === opp && R.legalMovesForSquare(nx.board, rr, cc, null, null).some(m => m.r === t.r && m.c === t.c)) low = Math.min(low, VAL[q.type]);
    }
    // material result of the whole exchange: what we win, minus our piece, plus what we win back if it was defended
    const net = (cap ? VAL[cap.type] : 0) - (piece ? VAL[piece.type] : 0) + (defended && low < 99999 ? low : 0);
    const sac = !!piece && VAL[piece.type] >= 300 && low < 99999 && net <= -100;
    // bait: this move newly leaves a big piece en prise (like a queen), yet the engine still likes it
    const exAfter = exposure(nx.board, color), bait = exAfter >= 250 && exAfter > exposure(st.board, color) + 100;
    let cls;
    if (isBest || drop <= 1) {
      cls = 'best';
      if (gap >= 12 && after >= 25) cls = 'great';
      if ((sac || bait) && drop <= 3 && after >= 20 && before < 96 && gap >= 2) cls = 'brilliant';
      if (cls === 'best' && i < 6) cls = 'book';
    } else if (drop <= 2) cls = i < 6 ? 'book' : 'excellent';
    else if (drop <= 5) cls = 'good';
    else if (drop <= 10) cls = 'inaccuracy';
    else if (drop <= 20) cls = 'mistake';
    else cls = 'blunder';
    return { cls, color, acc: accOf(drop), best: ev[i].best && ev[i].best !== '(none)' ? uci(ev[i].best) : null };
  }

  /* ---------- basic fallback (no engine file) ---------- */
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
  const after1 = (board, from, move, promo, color) => {
    const nb = R.applyMove(board, from, { r: move.r, c: move.c }, move, promo || 'q').board;
    return { board: nb, score: search(nb, 1, -Infinity, Infinity, color === 'b', move.doublePush ? { r: (from.r + move.r) / 2, c: from.c } : null) };
  };
  function analyzeBasic(states, i) {
    const st = states[i], nx = states[i + 1], color = st.turn, sign = color === 'w' ? 1 : -1, f = nx.last.from, t = nx.last.to;
    const m = R.legalMovesForSquare(st.board, f.r, f.c, st.ep, null).find(x => x.r === t.r && x.c === t.c);
    if (!m) return null;
    const played = after1(st.board, f, m, m.promotion ? nx.board[t.r][t.c].type : undefined, color);
    const bm = B.findBestMove(st.board, color, st.ep, 2);
    const best = bm ? after1(st.board, bm.from, bm.move, 'q', color) : played;
    const loss = Math.max(0, sign * (best.score - played.score));
    const cls = loss <= 10 ? 'best' : loss <= 30 ? 'excellent' : loss <= 60 ? 'good' : loss <= 120 ? 'inaccuracy' : loss <= 250 ? 'mistake' : 'blunder';
    return { cls, color, acc: 100 * Math.exp(-loss / 160), best: bm ? { from: bm.from, to: { r: bm.move.r, c: bm.move.c } } : null };
  }

  /* ---------- UI ---------- */
  const ctl = document.querySelector('#screen-viewer .controls');
  if (!ctl) return;
  const btn = document.createElement('button');
  btn.id = 'vr-btn'; btn.className = 'review-btn'; btn.textContent = '★ Review';
  ctl.appendChild(btn);
  const spd = document.createElement('select');
  spd.id = 'vr-speed'; spd.style.cssText = 'padding:8px;border-radius:8px';
  spd.innerHTML = '<option value="fast">Fast</option><option value="normal">Normal</option><option value="deep">Deep</option>';
  ctl.appendChild(spd);
  const info = document.createElement('div');
  info.innerHTML = '<p id="vr-prog" class="rv-note"></p><p id="vr-acc" class="rv-note"></p>';
  ctl.parentNode.insertBefore(info, ctl.nextSibling);

  let A = null, busy = false;
  const cur = () => window.LAV && window.LAV.get();

  btn.onclick = async () => {
    const V = cur();
    if (!V || busy) return;
    const g = V.g, states = V.orig, n = states.length - 1;
    if (!n) return;
    busy = true; A = { g, res: [], done: false };
    $('vr-acc').textContent = '';
    const prog = t => { $('vr-prog').textContent = t; };
    const alive = () => cur() && cur().g === g;
    try {
      let pool = null;
      prog('Loading Stockfish…');
      const ms = { fast: 150, normal: 300, deep: 600 }[($('vr-speed') || { value: 'fast' }).value] || 150;
      try { pool = await getPool(Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1))); } catch (e) { pool = null; }
      if (pool) {
        const toks = g.mv.split(' ').filter(Boolean).slice(0, n), ckey = g.mv + '|' + ms;
        let ev = CACHE[ckey];
        if (!ev) {
          ev = []; let next = 0, done = 0, dead = false;
          await Promise.all(pool.map(async w => {
            while (!dead) {
              const i = next++;
              if (i > n) break;
              if (!alive()) { dead = true; break; }
              const r = await evalPos(w, toks.slice(0, i), ms);
              if (r.cp === undefined) r.cp = (r.best === '(none)' && R.isInCheck(states[i].board, states[i].turn)) ? -10000 : 0;
              ev[i] = r; done++; prog(`Stockfish analyzing ${done}/${n + 1}…`);
            }
          }));
          if (dead) { A = null; prog(''); busy = false; return; }
          CACHE[ckey] = ev;
        }
        for (let i = 0; i < n; i++) A.res.push(classifyEngine(states, toks, ev, i));
      } else {
        prog('Stockfish file not found — using the basic review.');
        for (let i = 0; i < n; i++) {
          if (!alive()) { A = null; busy = false; return; }
          let r = null; try { r = analyzeBasic(states, i); } catch (e) {}
          A.res.push(r); prog(`Basic review ${i + 1}/${n}…`);
          await new Promise(x => setTimeout(x, 0));
        }
      }
      finish(!!pool);
    } catch (e) { prog('Review failed: ' + e.message); }
    busy = false;
  };

  function finish(engine) {
    const acc = { w: [], b: [] };
    A.res.forEach(r => { if (r) acc[r.color].push(r.acc); });
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) + '%' : '–';
    $('vr-prog').textContent = engine ? '' : $('vr-prog').textContent;
    $('vr-acc').textContent = `Accuracy — White ${avg(acc.w)} · Black ${avg(acc.b)}${engine ? ' · Stockfish' : ''}`;
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
    const raw = V.g.mv.split(' ')[k] || '', pre = V.orig[k];
    const mv = window.LASan && pre ? window.LASan(pre.board, pre.ep, raw) : raw.slice(0, 4);
    const good = ['best', 'great', 'brilliant', 'book'].includes(r.cls);
    const bu = r.best ? sqn(r.best.from.r, r.best.from.c) + sqn(r.best.to.r, r.best.to.c) : '';
    const bestTxt = bu && window.LASan && pre ? window.LASan(pre.board, pre.ep, bu) : bu;
    $('vw-note').innerHTML = `${badge(r.cls)} <b style="color:${CL[r.cls][0]}">${mv} is ${r.cls === 'best' ? 'the best move' : (/^[aeiou]/i.test(CL[r.cls][2]) ? 'an ' : 'a ') + CL[r.cls][2].toLowerCase()}</b>` +
      (good || !bestTxt ? '' : `<br><small>Best was ${bestTxt} (shown in green)</small>`);
    if (!good && r.best) {
      const kids = $('vw-board').children;
      [r.best.from, r.best.to].forEach(p => {
        const dr = V.flip ? 7 - p.r : p.r, dc = V.flip ? 7 - p.c : p.c;
        if (kids[dr * 8 + dc]) kids[dr * 8 + dc].classList.add('best-sq');
      });
    }
    const dest = V.orig[k + 1] && V.orig[k + 1].last && V.orig[k + 1].last.to;
    if (dest) {
      const sqEl = $('vw-board').children[(V.flip ? 7 - dest.r : dest.r) * 8 + (V.flip ? 7 - dest.c : dest.c)];
      if (sqEl && !sqEl.querySelector('.rv-corner')) {
        sqEl.style.position = 'relative';
        sqEl.insertAdjacentHTML('beforeend', `<div class="rv-corner ${r.cls === 'brilliant' ? 'rv-brill' : ''}">${badge(r.cls)}</div>`);
        if (r.cls === 'brilliant' || r.cls === 'great') sqEl.insertAdjacentHTML('beforeend', `<div class="rv-burst ${r.cls}"></div>`);
      }
    }
    if (window.LAReviewHook) window.LAReviewHook(r, k, V);
  }
  new MutationObserver(decorate).observe($('vw-board'), { childList: true });
})();

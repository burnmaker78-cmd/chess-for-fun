/* LAChess live spectating. Load after challenge.js. */
(function () {
  const R = window.ChessRules, $ = id => document.getElementById(id);
  const G = () => window.getLAGame && window.getLAGame();
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FILES = 'abcdefgh', sq = (r, c) => FILES[c] + (8 - r);
  const myRec = () => { const k = get('lac-session', null); return k ? (get('lac-users', {})[k] || null) : null; };
  const ready = () => window.Cloud && window.Cloud.setLive && window.Cloud.watchLive;
  const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
  const visible = () => { const s = [...document.querySelectorAll('.screen')].find(x => !x.classList.contains('hidden')); return s ? s.id : 'screen-dashboard'; };
  const allowed = () => get('lac-live-ok', true) !== false;

  /* ---------- publish your own games ---------- */
  let lastG = null, lastN = -1, lastOver = false, lastW = 0;
  function publish(g) {
    const me = myRec();
    if (!me || !ready() || !allowed()) return;
    let opp = 'Friend', oppElo = null, color = 'w';
    if (g.type === 'bot') { opp = g.bot.name; oppElo = g.bot.elo; }
    else if (g.type === 'online') {
      color = window.LA.myColor;
      const m = /vs (\S+) \((\d+)\)/.exec($('opponent-line').textContent);
      opp = m ? m[1] : 'Opponent'; oppElo = m ? +m[2] : null;
    }
    const txt = g.gameOver ? $('gameover-text').textContent : '';
    const res = !g.gameOver ? null : /White wins/.test(txt) ? '1-0' : /Black wins/.test(txt) ? '0-1' : '1/2-1/2';
    window.Cloud.setLive(me.key, {
      name: me.name, key: me.key, opp, oppElo: oppElo || null, me: color, over: !!g.gameOver, res,
      tc: g._base === undefined ? 'No clock' : g._base + ' min', t: Date.now(),
      mv: g.moves.map(x => sq(x.from.r, x.from.c) + sq(x.move.r, x.move.c) + (x.promotionType || '')).join(' ')
    });
    lastW = Date.now();
  }
  setInterval(() => {
    const g = G();
    if (!g || g.chaosAssignment) return;              // Chess Beta games are never shared
    if (g !== lastG) { lastG = g; lastN = -1; lastOver = false; }
    const n = g.moves.length, over = !!g.gameOver;
    if (!n) return;
    if (n !== lastN || over !== lastOver || (!over && Date.now() - lastW > 60000)) { lastN = n; lastOver = over; publish(g); }
  }, 700);

  // setting: let others watch
  const list = document.querySelector('#screen-settings .settings-list');
  if (list) {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = `<div><div class="setting-title">Let others watch my games live</div><div class="setting-desc">Turn off to stop sharing your games as you play them.</div></div><label class="switch"><input type="checkbox" ${allowed() ? 'checked' : ''}><span class="slider"></span></label>`;
    row.querySelector('input').onchange = e => put('lac-live-ok', e.target.checked);
    list.appendChild(row);
  }

  /* ---------- watch someone ---------- */
  const scr = document.createElement('div');
  scr.id = 'screen-live'; scr.className = 'screen hidden';
  scr.innerHTML = `<div class="wrap"><button class="back-btn" id="lv-exit">&larr; Back</button><h2 id="lv-title">Live game</h2>
    <p id="lv-status" class="subtitle"></p><div id="lv-board" class="board mini"></div>
    <div class="controls"><button id="lv-first">⏮</button><button id="lv-prev">◀</button><button id="lv-next">▶</button><button id="lv-last">● Live</button><button id="lv-flip">Flip</button></div></div>`;
  document.body.appendChild(scr);

  function replay(mv) {
    let board = R.makeInitialBoard(), ep = null, turn = 'w';
    const states = [{ board, last: null }];
    for (const t of mv.split(' ').filter(Boolean)) {
      const fc = FILES.indexOf(t[0]), fr = 8 - +t[1], tc = FILES.indexOf(t[2]), tr = 8 - +t[3];
      const m = R.legalMovesForSquare(board, fr, fc, ep, null).find(x => x.r === tr && x.c === tc);
      if (!m) break;
      board = R.applyMove(board, { r: fr, c: fc }, { r: tr, c: tc }, m, t[4]).board;
      ep = m.doublePush ? { r: (fr + tr) / 2, c: fc } : null; turn = turn === 'w' ? 'b' : 'w';
      states.push({ board, last: { from: { r: fr, c: fc }, to: { r: tr, c: tc } } });
    }
    return states;
  }

  let L = null, unsub = null;
  function open(key, name) {
    if (!ready()) { alert('Live games need the Firebase setup.'); return; }
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    L = { key, name, states: null, idx: 0, flip: null, data: null, ret: visible() };
    show('screen-live');
    $('lv-title').textContent = '👁 ' + name; $('lv-status').textContent = 'Connecting…'; $('lv-board').innerHTML = '';
    unsub = window.Cloud.watchLive(key, d => {
      if (!d || (d.over === false && Date.now() - d.t > 600000)) {
        L.data = null; L.states = null; $('lv-board').innerHTML = '';
        $('lv-title').textContent = '👁 ' + name; $('lv-status').textContent = `${name} isn’t playing a game right now.`; return;
      }
      const follow = !L.states || L.idx === L.states.length - 1;
      L.data = d; L.states = replay(d.mv || '');
      if (follow) L.idx = L.states.length - 1;
      if (L.flip === null) L.flip = d.me === 'b';
      draw();
    });
  }
  function draw() {
    if (!L || !L.states) return;
    const d = L.data, st = L.states[L.idx], el = $('lv-board'); el.innerHTML = '';
    for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
      const r = L.flip ? 7 - dr : dr, c = L.flip ? 7 - dc : dc, s = document.createElement('div');
      s.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      if (st.last && ((st.last.from.r === r && st.last.from.c === c) || (st.last.to.r === r && st.last.to.c === c))) s.classList.add('last-move');
      const p = st.board[r][c]; if (p) s.appendChild(makePieceEl(p.color, p.type));
      el.appendChild(s);
    }
    const oe = d.oppElo ? ' (' + d.oppElo + ')' : '';
    $('lv-title').textContent = d.me === 'b' ? `⬜ ${d.opp}${oe} vs ⬛ ${d.name}` : `⬜ ${d.name} vs ⬛ ${d.opp}${oe}`;
    const last = L.states.length - 1;
    $('lv-status').textContent = (d.over ? `Game over · ${d.res || ''}` : 'LIVE') + ` · move ${L.idx} of ${last}` + (L.idx < last ? ' (viewing an earlier move)' : '');
  }
  const go = i => { if (L && L.states) { L.idx = Math.max(0, Math.min(L.states.length - 1, i)); draw(); } };
  $('lv-first').onclick = () => go(0);
  $('lv-prev').onclick = () => go(L ? L.idx - 1 : 0);
  $('lv-next').onclick = () => go(L ? L.idx + 1 : 0);
  $('lv-last').onclick = () => go(L && L.states ? L.states.length - 1 : 0);
  $('lv-flip').onclick = () => { if (L) { L.flip = !L.flip; draw(); } };
  $('lv-exit').onclick = () => { if (unsub) { try { unsub(); } catch (e) {} unsub = null; } show(L ? L.ret : 'screen-dashboard'); };

  /* ---------- buttons: friends list + profiles ---------- */
  const mk = (key, name) => { const b = document.createElement('button'); b.className = 'lv-btn'; b.textContent = '👁 Watch live'; b.onclick = () => open(key, name); return b; };
  new MutationObserver(() => {
    document.querySelectorAll('#fr-list .fr-row').forEach(row => {
      if (row.querySelector('.lv-btn')) return;
      const info = row.querySelector('.fr-info'); if (!info) return;
      row.insertBefore(mk(info.dataset.k, info.dataset.k), row.querySelector('button[data-r]'));
    });
  }).observe($('fr-list'), { childList: true });
  new MutationObserver(() => {
    const out = $('fd-result');
    if (!out || !out.querySelector('.pf-head') || out.querySelector('.lv-btn')) return;
    const key = $('fd-input').value.trim().toLowerCase(), me = myRec();
    if (!key || (me && me.key === key)) return;
    const b = mk(key, key); b.className = 'primary-btn lv-btn'; b.style.marginLeft = '8px';
    (out.querySelector('.ch-btn') || out.querySelector('.fr-btn') || out.querySelector('.pf-head')).insertAdjacentElement('afterend', b);
  }).observe($('fd-result'), { childList: true });
})();

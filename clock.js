/* LAChess clocks. Friend games: Untimed / 10 / 5 / 5+1 / Custom. Ranked: 5, 10 or 20 min. */
(function () {
  const $ = id => document.getElementById(id);
  const G = () => window.getLAGame && window.getLAGame();

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .clock-row{display:none;gap:10px;margin:8px 0}
  .clock{flex:1;text-align:center;padding:8px;border-radius:10px;background:rgba(255,255,255,.07);border:2px solid transparent;font-variant-numeric:tabular-nums;transition:all .2s}
  .clock small{display:block;color:#9aa;font-size:.7rem}
  .clock b{font-size:1.6rem}
  .clock.active{border-color:#6c8cff;background:rgba(108,140,255,.18)}
  .clock.low b{color:#ff6b6b;animation:pulse 1s ease-in-out infinite}
  .tc-box{margin:12px 0;padding:12px;border-radius:10px;background:rgba(255,255,255,.05)}
  .tc-box select,.tc-box input{padding:8px;border-radius:8px;border:1px solid #444;background:#15151b;color:#fff}
  .tc-box input{width:70px;margin:0 6px 0 4px} .tc-custom{margin-top:8px;display:none}
  `;
  document.head.appendChild(css);

  /* ---------- clock display ---------- */
  const row = document.createElement('div');
  row.className = 'clock-row'; row.id = 'clock-row';
  row.innerHTML = '<div class="clock" id="clk-w"><small>White</small><b>–</b></div><div class="clock" id="clk-b"><small>Black</small><b>–</b></div>';
  $('board-wrap').parentNode.insertBefore(row, $('board-wrap'));

  /* ---------- time pickers ---------- */
  const lobbyBox = document.createElement('div');
  lobbyBox.className = 'tc-box';
  lobbyBox.innerHTML = `<label>⏱ Time control </label>
    <select id="tc-lobby">
      <option value="none">No clock</option><option value="10|0">10 min</option><option value="5|0">5 min</option>
      <option value="5|1">5 min + 1 sec</option><option value="custom">Custom…</option>
    </select>
    <div class="tc-custom" id="tc-custom">Minutes <input id="tc-min" type="number" min="1" max="180" value="15"> Increment (sec) <input id="tc-inc" type="number" min="0" max="60" value="10"></div>`;
  const tabs = document.querySelector('#screen-lobby .lobby-tabs');
  if (tabs) tabs.parentNode.insertBefore(lobbyBox, tabs);
  $('tc-lobby').addEventListener('change', e => { $('tc-custom').style.display = e.target.value === 'custom' ? 'block' : 'none'; });

  const find = $('rk-find');
  if (find) {
    const rb = document.createElement('div');
    rb.className = 'tc-box';
    rb.innerHTML = '<label>⏱ Time </label><select id="tc-ranked"><option value="5|0">5 min</option><option value="10|0" selected>10 min</option><option value="20|0">20 min</option></select>';
    find.parentNode.insertBefore(rb, find);
  }

  const clamp = (v, lo, hi, d) => { v = parseInt(v, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); };
  function readLobby() {
    const v = $('tc-lobby').value;
    if (v === 'none') return null;
    if (v === 'custom') return { min: clamp($('tc-min').value, 1, 180, 15), inc: clamp($('tc-inc').value, 0, 60, 10) };
    const [m, i] = v.split('|'); return { min: +m, inc: +i };
  }
  function readRanked() { const [m, i] = $('tc-ranked').value.split('|'); return { min: +m, inc: +i }; }

  /* ---------- clock engine ---------- */
  const fmt = ms => {
    ms = Math.max(0, ms);
    if (ms < 10000) return '0:' + (ms / 1000).toFixed(1).padStart(4, '0');
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  function setClock(g, tc) {
    g.clock = { w: tc.min * 60000, b: tc.min * 60000, inc: tc.inc * 1000, t: performance.now(), n: 0 };
  }
  function end(g, msg) {
    if (!g || g.gameOver) return;
    g.gameOver = true;
    $('turn-indicator').textContent = msg; $('check-indicator').textContent = '';
    $('gameover-text').textContent = msg; $('gameover-modal').classList.remove('hidden');
    if (window.LA.onEnd) window.LA.onEnd(msg);
  }
  const timeMsg = loser => `${loser === 'w' ? 'Black' : 'White'} wins — ${loser === 'w' ? 'White' : 'Black'} ran out of time`;

  function flag(g, color) {
    if (g.type === 'online') {
      if (color !== window.LA.myColor) { // opponent's clock: let them declare it, with a fallback
        g._flagAt = g._flagAt || performance.now();
        if (performance.now() - g._flagAt < 3000) return;
      } else if (window.LA.send) window.LA.send({ t: 'timeout' });
    }
    end(g, timeMsg(color));
  }

  let lastG = null;
  function init(g) {
    if (g.clock !== undefined) return;
    g.clock = null;
    let tc = null;
    if (g.type === 'friend') tc = readLobby();
    else if (g.type === 'bot' && g.bot && g.bot.ranked) tc = readRanked();
    else if (g.type === 'online' && window.LA.myColor === 'w') {
      tc = readLobby();
      if (window.LA.send) window.LA.send({ t: 'tc', min: tc ? tc.min : 0, inc: tc ? tc.inc : 0 });
    }
    if (tc) setClock(g, tc);
  }

  setInterval(() => {
    const g = G();
    if (!g) return;
    if (g !== lastG) { lastG = g; init(g); }
    const c = g.clock;
    row.style.display = c ? 'flex' : 'none';
    if (!c) return;
    const now = performance.now(), dt = now - c.t; c.t = now;
    while (c.n < g.moves.length) { c[g.moves[c.n].color] += c.inc; c.n++; } // increment after each move
    if (c.n > g.moves.length) c.n = g.moves.length;                        // undo
    // like lichess, the clock starts after both sides have moved once
    if (!g.gameOver && g.moves.length >= 2) {
      c[g.turn] -= dt;
      if (c[g.turn] <= 0) { c[g.turn] = 0; flag(g, g.turn); }
    }
    ['w', 'b'].forEach(k => {
      const el = $('clk-' + k);
      el.querySelector('b').textContent = fmt(c[k]);
      el.classList.toggle('active', !g.gameOver && g.turn === k && g.moves.length >= 2);
      el.classList.toggle('low', c[k] < 10000 && c[k] > 0 && !g.gameOver);
    });
  }, 100);

  /* ---------- online sync (chain after accounts.js's handler) ---------- */
  const prev = window.LA.onData;
  window.LA.onData = d => {
    const g = G();
    if (d.t === 'tc' && g && d.min > 0) setClock(g, { min: d.min, inc: d.inc });
    if (d.t === 'timeout' && g) end(g, timeMsg(window.LA.myColor === 'w' ? 'b' : 'w'));
    if (prev) prev(d);
  };
})();

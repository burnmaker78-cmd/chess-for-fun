/* LAChess polish: low-time warning beeps + extra preferences. Load last. */
(function () {
  const $ = id => document.getElementById(id);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* ---------- extra preferences (stored separately from the others) ---------- */
  const prefs = Object.assign({ sidebar: true, bars: true, beeps: true }, get('lac-prefs2', {}));
  const css = document.createElement('style');
  css.textContent = `body.p2-nosidebar .lac-side{display:none} body.p2-nosidebar{padding-left:0!important} body.p2-nobars .pbar{display:none!important}`;
  document.head.appendChild(css);
  const apply = () => {
    document.body.classList.toggle('p2-nosidebar', !prefs.sidebar);
    document.body.classList.toggle('p2-nobars', !prefs.bars);
  };
  apply();
  const list = document.querySelector('#screen-settings .settings-list');
  if (list) [
    ['sidebar', 'Show sidebar', 'Turn off for more room on the screen.'],
    ['bars', 'Show player bars', 'The name, rating and picture above and below the board.'],
    ['beeps', 'Low-time beeps', 'A beep each second when a clock is almost out (needs Sound on).']
  ].forEach(([k, t, d]) => {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = `<div><div class="setting-title">${t}</div><div class="setting-desc">${d}</div></div><label class="switch"><input type="checkbox" ${prefs[k] ? 'checked' : ''}><span class="slider"></span></label>`;
    row.querySelector('input').onchange = e => { prefs[k] = e.target.checked; put('lac-prefs2', prefs); apply(); };
    list.appendChild(row);
  });

  /* ---------- low-time beeps ---------- */
  const soundOn = () => !!(get('chess-settings', {}) || {}).sound;
  let ctx = null;
  function beep() {
    if (!soundOn() || !prefs.beeps) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.07;
      o.connect(g); g.connect(ctx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12); o.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }
  const last = { w: null, b: null };
  setInterval(() => {
    ['w', 'b'].forEach(k => {
      const el = $('clk-' + k);
      if (!el || !el.classList.contains('active') || !el.classList.contains('low')) { last[k] = null; return; }
      const sec = Math.floor(parseFloat((el.querySelector('b').textContent.split(':')[1]) || '99'));
      if (sec !== last[k]) { last[k] = sec; if ([9, 5, 4, 3, 2, 1].includes(sec)) beep(); }
    });
  }, 150);
})();

/* LAChess: sidebar, profiles, per-category ratings, player search, preferences. Load after playerbars.js. */
(function () {
  const $ = id => document.getElementById(id);
  const G = () => window.getLAGame && window.getLAGame();
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = [[2600, 'GM', 'GoonMaster'], [2300, 'IM', 'International Master'], [2000, 'FM', 'FIDE Master'], [1800, 'CM', 'Candidate Master']];
  const badge = e => { const t = T.find(x => e >= x[0]); return t ? `<span class="ttl ttl-${t[1]}" title="${t[2]}">${t[1]}</span>` : ''; };
  const FLASH = 'mhflash';
  const myRec = () => { const k = get('lac-session', null); return k ? (get('lac-users', {})[k] || null) : null; };
  const eloOf = u => u.key === FLASH ? 6700 : u.elo;
  const catElo = (u, c) => u.key === FLASH ? 6700 : ((u.ratings || {})[c] || 800);

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .lac-side{position:fixed;left:0;top:0;bottom:0;width:200px;background:#15151d;border-right:1px solid rgba(255,255,255,.08);padding:16px 10px;z-index:40;display:flex;flex-direction:column;gap:4px}
  .lac-side .sb-brand{font-size:1.3rem;font-weight:800;padding:6px 10px 14px}
  .lac-side button{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#cfd3e0;padding:11px 12px;border-radius:9px;font-size:.95rem;cursor:pointer;text-align:left;transition:background .15s,transform .15s}
  .lac-side button:hover{background:rgba(255,255,255,.08);transform:translateX(3px)} .lac-side button.on{background:rgba(108,140,255,.22);color:#fff;font-weight:700}
  @media (min-width:900px){body{padding-left:200px}} @media (max-width:899px){.lac-side{display:none}}
  .pf-head{display:flex;gap:16px;align-items:center;margin:14px 0}
  .pf-av{width:84px;height:84px;border-radius:14px;object-fit:cover;background:#2b2b3a}
  .pf-name{font-size:1.5rem;font-weight:800} .pf-elo{color:#f5c542;font-weight:700}
  .pf-bio{background:rgba(255,255,255,.06);border-radius:10px;padding:12px;margin:10px 0;white-space:pre-wrap;min-height:2em}
  .pf-cats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
  .pf-cat{background:rgba(255,255,255,.06);border-radius:10px;padding:12px;text-align:center}
  .pf-cat b{display:block;font-size:1.4rem;color:#f5c542} .pf-cat small{color:#9aa}
  .pf-edit textarea{width:100%;box-sizing:border-box;min-height:70px;border-radius:8px;border:1px solid #444;background:#15151b;color:#fff;padding:10px}
  .pf-edit button,.pf-find button{margin-top:8px}
  .pf-find input{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #444;background:#15151b;color:#fff}
  body.pref-nocoords .coord-rank,body.pref-nocoords .coord-file{display:none}
  body.pref-noanim *{animation:none!important;transition:none!important}
  body.pref-nodots .move-dot,body.pref-nodots .capture-ring{display:none}
  `;
  document.head.appendChild(css);

  /* ---------- screens + sidebar ---------- */
  const mk = (id, inner) => { const d = document.createElement('div'); d.id = id; d.className = 'screen hidden'; d.innerHTML = `<div class="wrap">${inner}</div>`; document.body.appendChild(d); };
  mk('screen-profile', '<h2>Profile</h2><div id="pf-body"></div>');
  mk('screen-find', '<h2>Find players</h2><div class="pf-find"><input id="fd-input" placeholder="Search a username" maxlength="16"><button class="primary-btn" id="fd-go">Search</button></div><div id="fd-result"></div>');

  const NAV = [['🏠', 'Home', 'screen-dashboard'], ['🤖', 'Play Bots', 'screen-bot-select'], ['🏆', 'Ranked', 'screen-ranked'], ['👥', 'Play a Friend', 'screen-lobby'],
    ['🔍', 'Find Players', 'screen-find'], ['📊', 'Leaderboard', 'screen-leaderboard'], ['👤', 'Profile', 'screen-profile'], ['⚙️', 'Settings', 'screen-settings']];
  const side = document.createElement('div');
  side.className = 'lac-side';
  side.innerHTML = '<div class="sb-brand">♞ LAChess</div>';
  NAV.forEach(([ico, label, id]) => {
    const b = document.createElement('button');
    b.dataset.s = id; b.innerHTML = `<span>${ico}</span>${label}`;
    b.onclick = () => go(id);
    side.appendChild(b);
  });
  document.body.appendChild(side);

  function go(id) {
    if (!$(id)) return;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $(id).classList.remove('hidden');
    if (id === 'screen-profile') renderMine();
    if (id === 'screen-ranked' && window.LA.refresh) window.LA.refresh();
    mark();
  }
  function mark() {
    const cur = [...document.querySelectorAll('.screen')].find(s => !s.classList.contains('hidden'));
    side.querySelectorAll('button').forEach(b => b.classList.toggle('on', !!cur && b.dataset.s === cur.id));
  }
  setInterval(mark, 500); // stays correct when other buttons change the screen

  /* ---------- profile view ---------- */
  function card(u, edit) {
    const cats = ['bullet', 'blitz', 'rapid'].map(c => `<div class="pf-cat"><b>${catElo(u, c)}</b><small>${c[0].toUpperCase() + c.slice(1)}</small></div>`).join('');
    return `<div class="pf-head"><img class="pf-av" src="${u.pfp || 'pfp-default.png'}" alt="" onerror="this.style.visibility='hidden'">
      <div><div class="pf-name">${badge(eloOf(u))}${esc(u.name)}</div><div class="pf-elo">Rating ${eloOf(u)}</div><small>${u.w || 0}W · ${u.l || 0}L · ${u.d || 0}D</small></div></div>
      <div class="pf-cats">${cats}</div>
      <div class="pf-bio">${u.bio ? esc(u.bio) : '<small>No bio yet.</small>'}</div>${edit || ''}`;
  }
  function saveRec(rec) {
    const all = get('lac-users', {}); all[rec.key] = rec; put('lac-users', all);
    if (window.Cloud) window.Cloud.saveElo(rec);
    if (window.LA.refresh) window.LA.refresh();
  }
  function renderMine() {
    const u = myRec(), body = $('pf-body');
    if (!u) { body.innerHTML = '<p>Sign up or log in to get a profile.</p><button class="primary-btn" id="pf-su">Sign up</button>'; $('pf-su').onclick = () => $('lac-corner').click(); return; }
    body.innerHTML = card(u, `<div class="pf-edit"><label>Profile picture <input type="file" id="pf-file" accept="image/*"></label>
      <textarea id="pf-bio" maxlength="160" placeholder="Write a short bio (160 characters)">${esc(u.bio || '')}</textarea>
      <button class="primary-btn" id="pf-save">Save bio</button></div>`);
    $('pf-save').onclick = () => { const r = myRec(); r.bio = $('pf-bio').value.slice(0, 160); saveRec(r); renderMine(); };
    $('pf-file').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = c.height = 128;
          const s = Math.min(img.width, img.height);
          c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
          const r = myRec(); r.pfp = c.toDataURL('image/jpeg', 0.8); saveRec(r); renderMine();
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(f);
    };
  }

  /* ---------- find players ---------- */
  $('fd-go').onclick = async () => {
    const key = $('fd-input').value.trim().toLowerCase(), out = $('fd-result');
    if (!key) return;
    out.textContent = 'Searching…';
    let u = null;
    try { u = window.Cloud && window.Cloud.getUser ? await window.Cloud.getUser(key) : get('lac-users', {})[key]; } catch (e) {}
    out.innerHTML = u ? card(u) : 'No player found with that name.';
  };
  $('fd-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('fd-go').click(); });

  /* ---------- per-category ratings (bullet < 3 min, blitz < 10 min, rapid otherwise) ---------- */
  setInterval(() => { const g = G(); if (g && g.clock && g._base === undefined) g._base = g.clock.w / 60000; }, 150);
  const prevEnd = window.LA.onEnd;
  window.LA.onEnd = msg => {
    const g = G(), first = g && !g.catDone;
    if (prevEnd) prevEnd(msg);
    if (!first) return;
    g.catDone = true;
    try {
      const result = /draw|stalemate/i.test(msg) ? 'd' : /White wins/.test(msg) ? 'w' : /Black wins/.test(msg) ? 'b' : null;
      const u = myRec(); if (!result || !u || u.key === FLASH) return;
      let oppElo = null, myColor = 'w';
      if (g.type === 'bot' && g.bot.ranked) oppElo = g.bot.elo;
      else if (g.type === 'online' && /· Rated/.test($('opponent-line').textContent)) {
        const m = /\((\d+)\)/.exec($('opponent-line').textContent); oppElo = m ? +m[1] : null; myColor = window.LA.myColor;
      }
      if (oppElo == null) return;
      const min = g._base === undefined ? 15 : g._base;
      const cat = min < 3 ? 'bullet' : min < 10 ? 'blitz' : 'rapid';
      u.ratings = u.ratings || { bullet: 800, blitz: 800, rapid: 800 };
      const before = u.ratings[cat] || 800, score = result === 'd' ? 0.5 : result === myColor ? 1 : 0;
      u.ratings[cat] = Math.max(100, Math.round(before + 32 * (score - 1 / (1 + Math.pow(10, (oppElo - before) / 400)))));
      saveRec(u);
    } catch (e) {}
  };

  /* ---------- extra preferences ---------- */
  const prefs = Object.assign({ coords: true, anim: true, dots: true }, get('lac-prefs', {}));
  const apply = () => {
    document.body.classList.toggle('pref-nocoords', !prefs.coords);
    document.body.classList.toggle('pref-noanim', !prefs.anim);
    document.body.classList.toggle('pref-nodots', !prefs.dots);
  };
  apply();
  const list = document.querySelector('#screen-settings .settings-list');
  if (list) [['coords', 'Show board coordinates', 'The a–h and 1–8 labels on the board.'], ['anim', 'Animations', 'Turn off if the game feels slow.'], ['dots', 'Show legal-move dots', 'Dots on squares a piece can move to.']].forEach(([k, t, d]) => {
    const row = document.createElement('div');
    row.className = 'setting-row';
    row.innerHTML = `<div><div class="setting-title">${t}</div><div class="setting-desc">${d}</div></div><label class="switch"><input type="checkbox" ${prefs[k] ? 'checked' : ''}><span class="slider"></span></label>`;
    row.querySelector('input').onchange = e => { prefs[k] = e.target.checked; put('lac-prefs', prefs); apply(); };
    list.appendChild(row);
  });
  mark();
})();

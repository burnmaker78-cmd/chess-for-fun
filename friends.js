/* LAChess friends list. Load after games.js (needs profile.js + Find Players). */
(function () {
  const $ = id => document.getElementById(id);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = [[2600, 'GM', 'GoonMaster'], [2300, 'IM', 'International Master'], [2000, 'FM', 'FIDE Master'], [1800, 'CM', 'Candidate Master']];
  const badge = e => { const t = T.find(x => e >= x[0]); return t ? `<span class="ttl ttl-${t[1]}" title="${t[2]}">${t[1]}</span>` : ''; };
  const eloOf = u => u.key === 'mhflash' ? 6700 : (u.elo || 800);
  const myRec = () => { const k = get('lac-session', null); return k ? (get('lac-users', {})[k] || null) : null; };
  const saveRec = rec => { const all = get('lac-users', {}); all[rec.key] = rec; put('lac-users', all); if (window.Cloud) window.Cloud.saveElo(rec); };
  const getUser = async k => (window.Cloud && window.Cloud.getUser) ? window.Cloud.getUser(k) : get('lac-users', {})[k];
  const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };

  const css = document.createElement('style');
  css.textContent = `.fr-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.06);margin:6px 0;animation:slideIn .3s ease both}
  .fr-row img{width:44px;height:44px;border-radius:9px;object-fit:cover;background:#2b2b3a} .fr-row .fr-info{flex:1;cursor:pointer}
  .fr-row small{display:block;color:#9aa} .fr-row button{border:0;border-radius:8px;padding:7px 10px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer}
  .fr-btn{margin-top:10px}`;
  document.head.appendChild(css);

  const scr = document.createElement('div');
  scr.id = 'screen-friends'; scr.className = 'screen hidden';
  scr.innerHTML = '<div class="wrap"><h2>Friends</h2><p class="subtitle">Add players from Find Players to keep them here.</p><div id="fr-list"></div></div>';
  document.body.appendChild(scr);

  const side = document.querySelector('.lac-side');
  if (side) {
    const b = document.createElement('button');
    b.dataset.s = 'screen-friends'; b.innerHTML = '<span>🤝</span>Friends';
    b.onclick = () => { show('screen-friends'); render(); };
    const prof = [...side.children].find(x => x.dataset && x.dataset.s === 'screen-profile');
    side.insertBefore(b, prof || null);
  }

  async function render() {
    const box = $('fr-list'), me = myRec();
    if (!me) { box.innerHTML = '<p>Log in to use friends.</p>'; return; }
    const keys = me.friends || [];
    if (!keys.length) { box.innerHTML = '<p>No friends yet. Open <b>Find Players</b>, search a username, and press Add friend.</p>'; return; }
    box.textContent = 'Loading…';
    const users = await Promise.all(keys.map(k => getUser(k).catch(() => null)));
    box.innerHTML = keys.map((k, i) => {
      const u = users[i] || { name: k, key: k };
      return `<div class="fr-row"><img src="${u.pfp || 'pfp-default.png'}" alt="" onerror="this.style.visibility='hidden'">
        <div class="fr-info" data-k="${esc(k)}"><b>${badge(eloOf(u))}${esc(u.name || k)}</b><small>Rating ${eloOf(u)}</small></div>
        <button data-r="${esc(k)}">Remove</button></div>`;
    }).join('');
    box.querySelectorAll('.fr-info').forEach(el => el.onclick = () => { show('screen-find'); $('fd-input').value = el.dataset.k; $('fd-go').click(); });
    box.querySelectorAll('button[data-r]').forEach(b => b.onclick = () => {
      const r = myRec(); r.friends = (r.friends || []).filter(x => x !== b.dataset.r); saveRec(r); render();
    });
  }

  // "Add friend" button under a profile in Find Players
  new MutationObserver(() => {
    const out = $('fd-result');
    if (!out || !out.querySelector('.pf-head') || out.querySelector('.fr-btn')) return;
    const key = $('fd-input').value.trim().toLowerCase(), me = myRec();
    if (!key || (me && me.key === key)) return;
    const btn = document.createElement('button');
    btn.className = 'primary-btn fr-btn';
    const label = () => { const m = myRec(); btn.textContent = m && (m.friends || []).includes(key) ? '✓ Friends — click to remove' : '➕ Add friend'; };
    label();
    btn.onclick = () => {
      const m = myRec();
      if (!m) { const c = $('lac-corner'); if (c) c.click(); return; }
      const f = m.friends || [];
      m.friends = f.includes(key) ? f.filter(x => x !== key) : [...f, key].slice(0, 100);
      saveRec(m); label();
    };
    out.insertBefore(btn, out.querySelector('.pf-head').nextSibling);
  }).observe($('fd-result'), { childList: true });
})();

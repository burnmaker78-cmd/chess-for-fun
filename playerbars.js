/* LAChess player bars: avatar, name, title and Elo above (opponent) and below (you) the board. */
(function () {
  const $ = id => document.getElementById(id);
  const G = () => window.getLAGame && window.getLAGame();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = [[2600, 'GM', 'GoonMaster'], [2300, 'IM', 'International Master'], [2000, 'FM', 'FIDE Master'], [1800, 'CM', 'Candidate Master']];
  const badge = e => { const t = e && T.find(x => e >= x[0]); return t ? `<span class="ttl ttl-${t[1]}" title="${t[2]}">${t[1]}</span>` : ''; };

  const css = document.createElement('style');
  css.textContent = `.pbar{display:flex;align-items:center;gap:10px;padding:8px 10px;margin:6px 0;border-radius:10px;background:rgba(255,255,255,.06);animation:slideIn .3s ease both}
  .pav{position:relative;width:42px;height:42px;border-radius:8px;overflow:hidden;background:linear-gradient(135deg,#4a4a66,#2b2b3a);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem}
  .pav img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .pnm{font-weight:700}.pel{color:#9aa;font-size:.85rem;margin-left:6px}`;
  document.head.appendChild(css);

  const top = document.createElement('div'), bot = document.createElement('div');
  top.className = bot.className = 'pbar';
  const wrap = $('board-wrap');
  wrap.parentNode.insertBefore(top, $('clock-row') || wrap);
  wrap.parentNode.insertBefore(bot, wrap.nextSibling);

  function me() {
    try {
      const k = JSON.parse(localStorage.getItem('lac-session'));
      const u = k && JSON.parse(localStorage.getItem('lac-users'))[k];
      return u ? { name: u.name, elo: u.key === 'mhflash' ? 6700 : u.elo, pfp: u.pfp } : null;
    } catch (e) { return null; }
  }
  function info(g) {
    const m = me() || { name: 'You', elo: null };
    if (g.type === 'bot') return { me: m, opp: { name: g.bot.name, elo: g.bot.elo, emoji: g.bot.avatar } };
    if (g.type === 'online') {
      const x = /vs (\S+) \((\d+)\)/.exec($('opponent-line').textContent);
      return { me: m, opp: x ? { name: x[1], elo: +x[2] } : { name: 'Opponent', elo: null } };
    }
    return { me: { name: 'White', elo: null }, opp: { name: 'Black', elo: null } };
  }
  const html = p => `<div class="pav">${esc(p.emoji || p.name[0].toUpperCase())}<img src="${p.pfp || 'pfp-default.png'}" alt="" onerror="this.remove()"></div>
    <div><span class="pnm">${badge(p.elo)}${esc(p.name)}</span>${p.elo ? `<span class="pel">(${p.elo})</span>` : ''}</div>`;

  let sig = '';
  setInterval(() => {
    const g = G();
    const on = !!g && !$('screen-game').classList.contains('hidden');
    top.style.display = bot.style.display = on ? '' : 'none';
    if (!on) return;
    const i = info(g), s = JSON.stringify(i);
    if (s !== sig) { sig = s; top.innerHTML = html(i.opp); bot.innerHTML = html(i.me); }
  }, 400);
})();

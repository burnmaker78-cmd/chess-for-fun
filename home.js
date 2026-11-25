/* LAChess home screen upgrade: animated hero, profile card, quick-play tiles, recent games. Load last. */
(function () {
  const $ = id => document.getElementById(id);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = [[2600, 'GM', 'GoonMaster'], [2300, 'IM', 'International Master'], [2000, 'FM', 'FIDE Master'], [1800, 'CM', 'Candidate Master']];
  const badge = e => { const t = T.find(x => e >= x[0]); return t ? `<span class="ttl ttl-${t[1]}" title="${t[2]}">${t[1]}</span>` : ''; };
  const myRec = () => { const k = get('lac-session', null); return k ? (get('lac-users', {})[k] || null) : null; };
  const go = id => { if (!$(id)) return; document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
  const wrap = document.querySelector('#screen-dashboard .wrap');
  if (!wrap) return;

  const css = document.createElement('style');
  css.textContent = `
  #screen-dashboard .hero{padding:34px 10px 22px;overflow:hidden;border-radius:18px;margin-bottom:14px;background:linear-gradient(135deg,rgba(108,140,255,.18),rgba(196,77,255,.14))}
  #screen-dashboard .hero::before{content:"";position:absolute;inset:-50%;opacity:.07;z-index:0;background:conic-gradient(#fff 25%,transparent 0 50%,#fff 0 75%,transparent 0) 0 0/60px 60px;animation:hmPan 22s linear infinite}
  @keyframes hmPan{to{transform:translate(60px,60px)}} #screen-dashboard .hero>*{position:relative;z-index:1}
  .hm-cta{display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap}
  .hm-cta button{border:0;border-radius:12px;padding:14px 26px;font-size:1.05rem;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(90deg,#6c8cff,#c44dff);box-shadow:0 8px 24px rgba(108,140,255,.4);transition:transform .15s}
  .hm-cta button.alt{background:rgba(255,255,255,.12);box-shadow:none} .hm-cta button:hover{transform:translateY(-3px) scale(1.03)}
  .hm-profile{display:flex;align-items:center;gap:14px;padding:14px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);margin-bottom:14px}
  .hm-profile img{width:62px;height:62px;border-radius:12px;object-fit:cover;background:#2b2b3a}
  .hm-profile b{font-size:1.15rem} .hm-profile small{display:block;color:#9aa} .hm-profile .hm-elo{margin-left:auto;text-align:center;color:#f5c542;font-size:1.6rem;font-weight:800}
  .hm-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
  .hm-tile{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;border-radius:14px;padding:18px 8px;cursor:pointer;font-weight:700;transition:transform .18s,box-shadow .18s,background .18s;animation:slideIn .5s ease both}
  .hm-tile span{display:block;font-size:1.9rem;margin-bottom:6px;transition:transform .25s} .hm-tile:hover{transform:translateY(-5px);background:rgba(108,140,255,.2);box-shadow:0 10px 26px rgba(108,140,255,.28)} .hm-tile:hover span{transform:scale(1.25) rotate(-8deg)}
  .hm-recent h3{margin:6px 0} #screen-dashboard .card-grid,#screen-dashboard .stats{display:none}`;
  document.head.appendChild(css);

  const hero = wrap.querySelector('.hero');
  const cta = document.createElement('div'); cta.className = 'hm-cta';
  cta.innerHTML = '<button id="hm-play">♟ Play now</button><button class="alt" id="hm-coach">🎓 Learn with a coach</button>';
  if (hero) hero.appendChild(cta);
  $('hm-play').onclick = () => go('screen-bot-select');
  $('hm-coach').onclick = () => go('screen-coach');

  const prof = document.createElement('div'); prof.className = 'hm-profile';
  const tiles = document.createElement('div'); tiles.className = 'hm-tiles';
  [['🤖', 'Play a Bot', 'screen-bot-select'], ['🏆', 'Ranked', 'screen-ranked'], ['👥', 'Play a Friend', 'screen-lobby'],
   ['🧠', 'Analysis', 'screen-analysis'], ['⬇️', 'Import Games', 'screen-import'], ['📊', 'Leaderboard', 'screen-leaderboard']].forEach(([i, t, id], n) => {
    const b = document.createElement('button');
    b.className = 'hm-tile'; b.style.animationDelay = n * 0.05 + 's'; b.innerHTML = `<span>${i}</span>${t}`;
    b.onclick = () => go(id); tiles.appendChild(b);
  });
  const recent = document.createElement('div'); recent.className = 'hm-recent';
  (hero ? hero.nextSibling : wrap.firstChild);
  wrap.insertBefore(prof, hero ? hero.nextSibling : wrap.firstChild);
  wrap.insertBefore(tiles, prof.nextSibling);
  wrap.insertBefore(recent, tiles.nextSibling);

  let sig = '';
  function render() {
    const u = myRec(), s = JSON.stringify([u && u.key, u && u.elo, u && (u.games || []).length, u && u.pfp && u.pfp.length]);
    if (s === sig) return;
    sig = s;
    if (!u) {
      prof.innerHTML = '<div><b>Welcome to LAChess</b><small>Sign up to track your rating and save your games.</small></div><button class="hm-tile" style="margin-left:auto;padding:10px 16px" id="hm-su">Sign up</button>';
      $('hm-su').onclick = () => { const c = $('lac-corner'); if (c) c.click(); };
      recent.innerHTML = ''; return;
    }
    const e = u.key === 'mhflash' ? 6700 : u.elo;
    prof.innerHTML = `<img src="${u.pfp || 'pfp-default.png'}" alt="" onerror="this.style.visibility='hidden'"><div><b>${badge(e)}${esc(u.name)}</b><small>${u.w || 0}W · ${u.l || 0}L · ${u.d || 0}D</small></div><div class="hm-elo">${e}<small>rating</small></div>`;
    const games = (u.games || []).slice(0, 3);
    recent.innerHTML = games.length ? '<h3>Recent games</h3>' + games.map((g, i) => `<div class="gm-row" data-i="${i}"><span class="gm-res ${g.res === '1/2-1/2' ? 'D' : ((g.res === '1-0' && g.me === 'w') || (g.res === '0-1' && g.me === 'b')) ? 'W' : 'L'}">${g.res === '1/2-1/2' ? 'D' : ((g.res === '1-0' && g.me === 'w') || (g.res === '0-1' && g.me === 'b')) ? 'W' : 'L'}</span><div><b>vs ${esc(g.opp)}${g.oppElo ? ' (' + g.oppElo + ')' : ''}</b><small>${esc(g.tc)} · ${g.res}</small></div></div>`).join('') : '';
    recent.querySelectorAll('.gm-row').forEach(r => r.onclick = () => { if (window.LAOpen) window.LAOpen(games[+r.dataset.i], ''); });
  }
  setInterval(() => { if (!$('screen-dashboard').classList.contains('hidden')) render(); }, 700);
  render();
})();

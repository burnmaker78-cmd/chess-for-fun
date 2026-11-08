/* LAChess: accounts, Elo, titles, Ranked, resign/draw, human-like ranked bots. */
(function () {
  const R = window.ChessRules, B = window.ChessBot, $ = id => document.getElementById(id);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const FLASH = 'mhflash';

  /* ---------- titles ---------- */
  const TITLES = [[2600, 'GM', 'GoonMaster'], [2300, 'IM', 'International Master'], [2000, 'FM', 'FIDE Master'], [1800, 'CM', 'Candidate Master']];
  const titleOf = e => TITLES.find(t => e >= t[0]) || null;
  const badge = e => { const t = titleOf(e); return t ? `<span class="ttl ttl-${t[1]}" title="${t[2]}">${t[1]}</span>` : ''; };

  /* ---------- accounts (stored in this browser only) ---------- */
  const users = () => get('lac-users', {});
  const me = () => { const k = get('lac-session', null); return (k && users()[k]) || null; };
  const eloOf = u => u.key === FLASH ? 6700 : u.elo;
  async function hash(pw, salt) {
    const data = new TextEncoder().encode(salt + pw);
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    return btoa(salt + pw);
  }
  async function signup(name, pw) {
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return 'Username: 3-16 letters, numbers or _';
    if (pw.length < 4) return 'Password must be at least 4 characters';
    const all = users(), key = name.toLowerCase();
    if (all[key]) return 'That username is already taken';
    const salt = Math.random().toString(36).slice(2);
    all[key] = { name, key, salt, h: await hash(pw, salt), elo: key === FLASH ? 6700 : 800, w: 0, l: 0, d: 0 };
    put('lac-users', all); put('lac-session', key);
    return null;
  }
  async function login(name, pw) {
    const u = users()[name.toLowerCase()];
    if (!u || u.h !== await hash(pw, u.salt)) return 'Wrong username or password';
    put('lac-session', u.key);
    return null;
  }

  /* ---------- styles + UI shell ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .lac-corner{position:fixed;top:12px;right:12px;z-index:50;border:0;border-radius:999px;padding:9px 16px;font-weight:700;cursor:pointer;color:#fff;background:linear-gradient(90deg,#6c8cff,#c44dff);box-shadow:0 4px 18px rgba(108,140,255,.4);transition:transform .15s}
  .lac-corner:hover{transform:translateY(-2px)} .lac-corner.in{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2)}
  .lac-corner span{color:#f5c542;margin-left:4px}
  .ttl{display:inline-block;padding:1px 6px;margin-right:4px;border-radius:5px;font-size:.7rem;font-weight:800;color:#fff;cursor:help;background:#b8860b}
  .ttl-GM{background:linear-gradient(90deg,#d4af37,#ff8c00)} .ttl-IM{background:#8a4dff} .ttl-FM{background:#2f8f6f} .ttl-CM{background:#3a78c9}
  .lac-modal{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
  .lac-box{background:#23232e;border-radius:14px;padding:22px;width:min(340px,92vw);box-shadow:0 20px 60px rgba(0,0,0,.5);animation:pop .25s ease}
  .lac-box h3{margin:0 0 12px} .lac-box input{width:100%;box-sizing:border-box;margin:5px 0;padding:10px;border-radius:8px;border:1px solid #444;background:#15151b;color:#fff}
  .lac-box button{margin-top:8px;width:100%;padding:10px;border:0;border-radius:8px;font-weight:700;cursor:pointer;color:#fff;background:#6c8cff}
  .lac-box .alt{background:transparent;color:#9aa;font-weight:400} .lac-err{color:#ff6b6b;font-size:.85rem;min-height:1.1em}
  .lac-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:200;background:#2b2b3a;border:1px solid #6c8cff;border-radius:10px;padding:12px 18px;animation:slideIn .3s ease}
  .rk-card{background:rgba(255,255,255,.06);border-radius:12px;padding:16px;text-align:center;margin:12px 0}
  .rk-card b{font-size:2rem;color:#f5c542;display:block}
  .rk-toggle{display:flex;gap:8px;margin:12px 0} .rk-toggle button{flex:1;padding:10px;border-radius:8px;border:1px solid #444;background:#1d1d27;color:#fff;cursor:pointer}
  .rk-toggle button.on{background:#6c8cff;border-color:#6c8cff} .rk-toggle button:disabled{opacity:.5;cursor:not-allowed}
  `;
  document.head.appendChild(css);

  function toast(t) { const d = document.createElement('div'); d.className = 'lac-toast'; d.innerHTML = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3800); }
  function goto(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); }

  const corner = document.createElement('button');
  corner.id = 'lac-corner'; document.body.appendChild(corner);
  function renderCorner() {
    const u = me();
    if (!u) { corner.className = 'lac-corner'; corner.innerHTML = 'Sign up!'; return; }
    const e = eloOf(u);
    corner.className = 'lac-corner in'; corner.innerHTML = `${badge(e)}<b>${u.name}</b><span>${e}</span>`;
    const rk = $('rk-elo'); if (rk) rk.innerHTML = `${badge(e)}${e}<small style="display:block;font-size:.8rem;color:#9aa">${u.name} · ${u.w}W ${u.l}L ${u.d}D</small>`;
  }

  function modal(mode) {
    const u = me(), m = document.createElement('div'); m.className = 'lac-modal';
    const close = () => m.remove();
    m.addEventListener('click', e => { if (e.target === m) close(); });
    if (u) {
      m.innerHTML = `<div class="lac-box"><h3>${badge(eloOf(u))}${u.name}</h3><p>Elo <b>${eloOf(u)}</b><br>${u.w} wins · ${u.l} losses · ${u.d} draws</p><button id="lo">Log out</button><button class="alt" id="cl">Close</button></div>`;
      m.querySelector('#lo').onclick = () => { put('lac-session', null); renderCorner(); close(); };
      m.querySelector('#cl').onclick = close;
    } else {
      const su = mode === 'signup';
      m.innerHTML = `<div class="lac-box"><h3>${su ? 'Sign up' : 'Log in'}</h3><input id="un" placeholder="Username" maxlength="16" autocomplete="username"><input id="pw" type="password" placeholder="Password" autocomplete="${su ? 'new-password' : 'current-password'}"><div class="lac-err" id="er"></div><button id="go">${su ? 'Create account' : 'Log in'}</button><button class="alt" id="sw">${su ? 'Already have an account? Log in' : 'New here? Sign up'}</button></div>`;
      m.querySelector('#sw').onclick = () => { close(); modal(su ? 'login' : 'signup'); };
      const go = async () => {
        const err = await (su ? signup : login)(m.querySelector('#un').value.trim(), m.querySelector('#pw').value);
        if (err) { m.querySelector('#er').textContent = err; return; }
        close(); renderCorner(); toast(su ? 'Welcome! You’re signed in.' : 'Logged in.');
      };
      m.querySelector('#go').onclick = go;
      m.querySelector('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    }
    document.body.appendChild(m);
  }
  corner.onclick = () => modal('signup');

  /* ---------- Elo ---------- */
  function applyElo(result, myColor, oppElo) {
    const u = me(); if (!u) return;
    const all = users(), rec = all[u.key], before = eloOf(rec);
    const score = result === 'd' ? 0.5 : result === myColor ? 1 : 0;
    if (score === 1) rec.w++; else if (score === 0) rec.l++; else rec.d++;
    if (rec.key !== FLASH) {
      const exp = 1 / (1 + Math.pow(10, (oppElo - before) / 400));
      rec.elo = Math.max(100, Math.round(before + (before >= 2400 ? 16 : 32) * (score - exp)));
    }
    put('lac-users', all); renderCorner();
    const after = eloOf(rec), d = after - before;
    toast(`Rating: <b>${after}</b> (${d >= 0 ? '+' : ''}${d})`);
  }

  /* ---------- game end hook ---------- */
  const G = () => window.getLAGame && window.getLAGame();
  let opp = null; // online opponent info
  function rate(msg) {
    const g = G(); if (!g || g.ratedDone) return;
    const result = /draw|stalemate/i.test(msg) ? 'd' : /White wins/.test(msg) ? 'w' : /Black wins/.test(msg) ? 'b' : null;
    if (!result) return;
    g.ratedDone = true;
    if (g.type === 'bot' && g.bot.ranked && me()) applyElo(result, 'w', g.bot.elo);
    else if (g.type === 'online' && g.rated && opp && opp.user && me()) applyElo(result, window.LA.myColor, opp.elo);
  }
  window.LA.onEnd = rate;

  function endNow(msg) {
    const g = G(); if (!g || g.gameOver) return;
    g.gameOver = true;
    $('turn-indicator').textContent = msg; $('check-indicator').textContent = '';
    $('gameover-text').textContent = msg; $('gameover-modal').classList.remove('hidden');
    rate(msg);
  }
  const name = c => c === 'w' ? 'White' : 'Black';

  /* ---------- resign / draw ---------- */
  const rs = document.createElement('button'); rs.id = 'resign-btn'; rs.textContent = '🏳 Resign';
  const dr = document.createElement('button'); dr.id = 'draw-btn'; dr.textContent = '½ Draw';
  const ctl = document.querySelector('#screen-game .controls'); ctl.appendChild(rs); ctl.appendChild(dr);

  rs.onclick = () => {
    const g = G(); if (!g || g.gameOver || !confirm('Resign this game?')) return;
    const loser = g.type === 'bot' ? 'w' : g.type === 'online' ? window.LA.myColor : g.turn;
    if (g.type === 'online' && window.LA.send) window.LA.send({ t: 'resign' });
    endNow(`${name(loser === 'w' ? 'b' : 'w')} wins — ${name(loser)} resigned`);
  };
  dr.onclick = () => {
    const g = G(); if (!g || g.gameOver) return;
    if (g.type === 'online') { if (window.LA.send) window.LA.send({ t: 'drawOffer' }); toast('Draw offer sent.'); }
    else if (confirm('Both players agree to a draw?')) endNow('Draw — agreed');
  };

  /* ---------- online messages: hello (rating info), resign, draw ---------- */
  window.LA.onData = d => {
    if (d.t === 'hello') {
      opp = d;
      const g = G(); if (g && g.type === 'online') { if (window.LA.myColor === 'b') g.rated = !!d.rated; tagRated(g); }
    }
    if (d.t === 'resign') { const g = G(); if (g) endNow(`${name(window.LA.myColor)} wins — ${name(window.LA.myColor === 'w' ? 'b' : 'w')} resigned`); }
    if (d.t === 'drawOffer') {
      if (confirm('Your opponent offers a draw. Accept?')) { window.LA.send({ t: 'drawAccept' }); endNow('Draw — agreed'); }
      else window.LA.send({ t: 'drawDecline' });
    }
    if (d.t === 'drawAccept') endNow('Draw — agreed');
    if (d.t === 'drawDecline') toast('Draw declined.');
  };
  function tagRated(g) {
    const ol = $('opponent-line'), base = ol.textContent.replace(/ · (Rated|Unrated).*$/, '');
    const o = opp && opp.user ? ` · vs ${opp.user} (${opp.elo})` : '';
    ol.textContent = base + (g.rated && me() && opp && opp.user ? ' · Rated' : ' · Unrated') + o;
  }

  // rated/unrated choice in the online panel
  const hostBtn = $('online-host-btn');
  if (hostBtn) {
    const sel = document.createElement('select'); sel.id = 'online-rated';
    sel.innerHTML = '<option value="0">Unrated</option><option value="1">Rated</option>';
    sel.style.cssText = 'margin:0 8px 8px 0;padding:8px;border-radius:8px';
    hostBtn.parentNode.insertBefore(sel, hostBtn);
    sel.addEventListener('change', () => { if (sel.value === '1' && !me()) { sel.value = '0'; modal('signup'); } });
  }

  /* ---------- poll: button visibility + hello ---------- */
  let lastG = null;
  setInterval(() => {
    const g = G();
    if (!g) return;
    const live = !g.gameOver;
    rs.style.display = live && (g.type === 'bot' || g.type === 'friend' || g.type === 'online') ? '' : 'none';
    dr.style.display = live && (g.type === 'friend' || g.type === 'online') ? '' : 'none';
    if (g !== lastG) {
      lastG = g;
      if (g.type === 'online') {
        const host = window.LA.myColor === 'w', s = $('online-rated');
        if (host) g.rated = !!(s && s.value === '1' && me());
        const u = me();
        if (window.LA.send) window.LA.send({ t: 'hello', user: u ? u.name : null, elo: u ? eloOf(u) : 0, rated: g.rated ? 1 : 0 });
        tagRated(g);
      }
    }
  }, 400);

  /* ---------- human-like ranked bots ---------- */
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
  const origPick = B.pickBotMove;
  B.pickBotMove = function (board, color, ep, cfg) {
    if (!cfg.human) return origPick(board, color, ep, cfg);
    const legal = R.allLegalMoves(board, color, ep, null);
    if (!legal.length) return null;
    const sign = color === 'w' ? 1 : -1;
    const scored = legal.map(m => {
      const nb = R.applyMove(board, m.from, { r: m.move.r, c: m.move.c }, m.move, 'q').board;
      const nep = m.move.doublePush ? { r: (m.from.r + m.move.r) / 2, c: m.from.c } : null;
      return { m, s: sign * search(nb, Math.max(cfg.depth - 1, 0), -Infinity, Infinity, color === 'b', nep) + (Math.random() * 2 - 1) * cfg.noise };
    }).sort((a, b) => b.s - a.s);
    let i = 0;
    // people slip with decent-looking moves far more often than random ones
    if (Math.random() < cfg.blunder * 1.8) i = Math.min(scored.length - 1, 1 + Math.floor(Math.random() * Math.min(4, scored.length - 1)));
    if (Math.random() < cfg.blunder * 0.35) i = Math.floor(Math.random() * scored.length);
    return scored[i].m;
  };

  const NAMES = ['Marco_88', 'ChessKid2012', 'sophie.plays', 'NightRook', 'DanTheMan', 'Pawnstar', 'luna_gambit', 'KnightOwl7', 'Tariq_C', 'BlitzBob', 'queenside_qt', 'MrEndgame'];
  const AVATARS = ['🙂', '😎', '🤓', '🧑‍💻', '👩‍🎓', '🧔', '👩‍🦰', '🧑‍🎤'];
  function rankedBot(elo) {
    const e = Math.max(300, Math.min(2900, elo + Math.round((Math.random() * 2 - 1) * 100)));
    return {
      id: 'ranked', ranked: true, human: true, elo: e,
      name: NAMES[Math.floor(Math.random() * NAMES.length)],
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], tagline: 'Ranked opponent',
      depth: e < 900 ? 1 : e < 1500 ? 2 : e < 2100 ? 3 : 4,
      blunder: Math.min(0.5, 0.5 * Math.exp(-(e - 300) / 450)),
      noise: Math.round(130 * Math.exp(-(e - 300) / 500))
    };
  }

  /* ---------- Ranked screen ---------- */
  const grid = document.querySelector('#screen-dashboard .card-grid');
  const card = document.createElement('button');
  card.className = 'big-card c1';
  card.innerHTML = '<span class="card-icon">🏆</span><span class="card-title">Ranked</span><span class="card-desc">Play rated games, climb the ladder, earn CM, FM, IM and GM titles.</span>';
  grid.insertBefore(card, grid.firstChild);

  const scr = document.createElement('div');
  scr.id = 'screen-ranked'; scr.className = 'screen hidden';
  scr.innerHTML = `<div class="wrap"><button class="back-btn" id="rk-back">&larr; Back</button><h2>Ranked</h2>
    <div class="rk-card"><b id="rk-elo">–</b></div>
    <div class="rk-toggle"><button class="on" id="rk-bots">🤖 Bots</button><button id="rk-online" disabled>🌐 Players (Coming soon)</button></div>
    <p class="subtitle">You’ll be matched with an opponent near your rating.</p>
    <button class="primary-btn" id="rk-find">Find match</button></div>`;
  document.body.appendChild(scr);

  card.onclick = () => { renderCorner(); goto('screen-ranked'); };
  $('rk-back').onclick = () => goto('screen-dashboard');
  $('rk-find').onclick = () => {
    const u = me();
    if (!u) { modal('signup'); return; }
    window.LA.startGame({ mode: 'bot', bot: rankedBot(eloOf(u)) });
  };

  renderCorner();
})();

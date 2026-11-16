/* LAChess: import games from chess.com and lichess by username. Load after games.js. */
(function () {
  const R = window.ChessRules, $ = id => document.getElementById(id);
  const FILES = 'abcdefgh', sq = (r, c) => FILES[c] + (8 - r);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- screen + sidebar entry ---------- */
  const scr = document.createElement('div');
  scr.id = 'screen-import'; scr.className = 'screen hidden';
  scr.innerHTML = `<div class="wrap"><h2>Import games</h2>
    <p class="subtitle">Load a player’s recent games, then step through them or explore moves.</p>
    <div class="pf-find"><select id="im-src" style="padding:10px;border-radius:8px;margin-bottom:8px"><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option></select>
    <input id="im-user" placeholder="Username" maxlength="40"><button class="primary-btn" id="im-go">Load games</button></div>
    <p class="hint-text">ChessKid doesn’t offer a public game list, so it can’t be imported.</p>
    <div id="im-list"></div></div>`;
  document.body.appendChild(scr);
  const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
  const side = document.querySelector('.lac-side');
  if (side) {
    const b = document.createElement('button');
    b.dataset.s = 'screen-import'; b.innerHTML = '<span>⬇️</span>Import Games';
    b.onclick = () => show('screen-import');
    const prof = [...side.children].find(x => x.dataset && x.dataset.s === 'screen-profile');
    side.insertBefore(b, prof || null);
  }

  /* ---------- PGN / SAN -> coordinate moves ---------- */
  function pgnMoves(pgn) {
    const t = pgn.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\$\d+/g, ' ').replace(/\d+\.(\.\.)?/g, ' ');
    return t.split(/\s+/).filter(x => x && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(x));
  }
  function resolve(board, ep, turn, san) {
    const s = san.replace(/[+#!?]/g, '');
    if (s === 'O-O' || s === 'O-O-O' || s === '0-0' || s === '0-0-0') {
      const want = s.length === 3 ? 'king' : 'queen', k = R.findKing(board, turn);
      const m = k && R.legalMovesForSquare(board, k.r, k.c, ep, null).find(x => x.castle === want);
      return m ? { from: k, m } : null;
    }
    const x = /^([KQRBN])?([a-h])?([1-8])?x?([a-h])([1-8])(?:=?([QRBN]))?$/.exec(s);
    if (!x) return null;
    const type = (x[1] || 'P').toLowerCase(), dc = FILES.indexOf(x[4]), dr = 8 - +x[5];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== turn || p.type !== type) continue;
      if (x[2] && FILES.indexOf(x[2]) !== c) continue;
      if (x[3] && 8 - +x[3] !== r) continue;
      const m = R.legalMovesForSquare(board, r, c, ep, null).find(y => y.r === dr && y.c === dc);
      if (m) return { from: { r, c }, m, promo: x[6] ? x[6].toLowerCase() : undefined };
    }
    return null;
  }
  function toMv(sans) {
    let board = R.makeInitialBoard(), ep = null, turn = 'w';
    const out = [];
    for (const s of sans) {
      const r = resolve(board, ep, turn, s);
      if (!r) break;
      board = R.applyMove(board, r.from, { r: r.m.r, c: r.m.c }, r.m, r.promo).board;
      ep = r.m.doublePush ? { r: (r.from.r + r.m.r) / 2, c: r.from.c } : null;
      turn = turn === 'w' ? 'b' : 'w';
      out.push(sq(r.from.r, r.from.c) + sq(r.m.r, r.m.c) + (r.promo || ''));
    }
    return out.join(' ');
  }

  /* ---------- fetch from the sites ---------- */
  async function fromChesscom(u) {
    const a = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`);
    if (a.status === 404) throw new Error('nf');
    if (!a.ok) throw new Error('net');
    const arch = (await a.json()).archives || [];
    let games = [];
    for (const url of arch.slice(-2).reverse()) {
      const r = await fetch(url);
      if (r.ok) games = games.concat((await r.json()).games || []);
      if (games.length >= 25) break;
    }
    games = games.filter(g => g.rules === 'chess' && g.pgn).sort((x, y) => y.end_time - x.end_time).slice(0, 25);
    return games.map(g => {
      const w = g.white, b = g.black, me = w.username.toLowerCase() === u ? 'w' : 'b', o = me === 'w' ? b : w;
      return { id: g.end_time * 1000, res: w.result === 'win' ? '1-0' : b.result === 'win' ? '0-1' : '1/2-1/2', me, opp: o.username, oppElo: o.rating, tc: g.time_class, sans: pgnMoves(g.pgn) };
    });
  }
  async function fromLichess(u) {
    const r = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(u)}?max=25&moves=true`, { headers: { Accept: 'application/x-ndjson' } });
    if (r.status === 404) throw new Error('nf');
    if (!r.ok) throw new Error('net');
    const list = (await r.text()).split('\n').filter(Boolean).map(l => JSON.parse(l));
    return list.filter(g => g.variant === 'standard' && !g.initialFen && g.moves).map(g => {
      const wn = ((g.players.white.user || {}).name || 'Anonymous'), me = wn.toLowerCase() === u ? 'w' : 'b';
      const o = g.players[me === 'w' ? 'black' : 'white'];
      return { id: g.createdAt, res: g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '1/2-1/2', me, opp: (o.user || {}).name || 'Anonymous', oppElo: o.rating, tc: g.speed, sans: g.moves.split(' ') };
    });
  }

  /* ---------- UI ---------- */
  const verdict = g => g.res === '1/2-1/2' ? 'D' : ((g.res === '1-0' && g.me === 'w') || (g.res === '0-1' && g.me === 'b')) ? 'W' : 'L';
  async function load() {
    const u = $('im-user').value.trim().toLowerCase(), list = $('im-list');
    if (!u) return;
    list.textContent = 'Loading…';
    try {
      const games = await ($('im-src').value === 'lichess' ? fromLichess : fromChesscom)(u);
      if (!games.length) { list.textContent = 'No standard games found for that player.'; return; }
      list.innerHTML = games.map((g, i) => `<div class="gm-row" data-i="${i}"><span class="gm-res ${verdict(g)}">${verdict(g)}</span>
        <div><b>${g.me === 'b' ? '⬛' : '⬜'} ${esc(u)} vs ${g.me === 'b' ? '⬜' : '⬛'} ${esc(g.opp)}${g.oppElo ? ' (' + g.oppElo + ')' : ''}</b><small>${g.me === 'b' ? 'Black' : 'White'} · ${esc(g.tc)} · ${g.res} · ${new Date(g.id).toLocaleDateString()}</small></div></div>`).join('');
      list.querySelectorAll('.gm-row').forEach(row => row.onclick = () => {
        const g = games[+row.dataset.i];
        if (!window.LAOpen) { alert('The game viewer isn’t loaded (games.js is missing the LAOpen line).'); return; }
        window.LAOpen({ id: g.id, res: g.res, me: g.me, opp: g.opp, oppElo: g.oppElo, tc: g.tc, mv: toMv(g.sans) }, u);
      });
    } catch (e) {
      list.textContent = e.message === 'nf' ? 'No player found with that username.' : 'Couldn’t load games. Check the spelling, or the site may be blocking the request.';
    }
  }
  $('im-go').onclick = load;
  $('im-user').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
})();

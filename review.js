/* LAChess: the end-of-game review now opens the Stockfish viewer. Also plays the review-only sounds. */
(function () {
  const $ = id => document.getElementById(id);
  const G = () => window.getLAGame && window.getLAGame();
  const FILES = 'abcdefgh', sq = (r, c) => FILES[c] + (8 - r);

  /* ---------- open the current game in the viewer and start the review ---------- */
  function start() {
    const g = G();
    if (!g || !g.moves || !g.moves.length) { alert('Play a few moves first, then review.'); return; }
    if (g.chaosAssignment) { alert('Review isn’t available for this game.'); return; }
    if (!window.LAOpen) { alert('The game viewer isn’t loaded (check that games.js is in index.html).'); return; }
    const txt = g.gameOver ? $('gameover-text').textContent : '';
    const res = /White wins/.test(txt) ? '1-0' : /Black wins/.test(txt) ? '0-1' : /draw|stalemate/i.test(txt) ? '1/2-1/2' : '*';
    let opp = 'Friend', oppElo = null, me = 'w';
    if (g.type === 'bot') { opp = g.bot.name; oppElo = g.bot.elo; }
    else if (g.type === 'online') {
      me = window.LA.myColor;
      const m = /vs (\S+) \((\d+)\)/.exec($('opponent-line').textContent);
      opp = m ? m[1] : 'Opponent'; oppElo = m ? +m[2] : null;
    }
    const rec = {
      id: Date.now(), res, me, opp, oppElo,
      tc: g._base === undefined ? 'No clock' : g._base + ' min',
      mv: g.moves.map(x => sq(x.from.r, x.from.c) + sq(x.move.r, x.move.c) + (x.promotionType || '')).join(' ')
    };
    $('gameover-modal').classList.add('hidden');
    window.LAOpen(rec, 'You');
    setTimeout(() => { const b = $('vr-btn'); if (b) b.click(); }, 100);
  }
  $('review-btn').addEventListener('click', start);
  $('gameover-review').addEventListener('click', start);

  /* ---------- review-only sounds: brilliant.mp3, rook.mp3, queen.mp3 ---------- */
  const SOUNDS = { brilliant: 'sounds/brilliant.mp3', rook: 'sounds/rook.mp3', queen: 'sounds/queen.mp3' };
  const audio = {};
  let lastAudio = null, lastKey = '';
  const soundOn = () => { try { return !!JSON.parse(localStorage.getItem('chess-settings') || '{}').sound; } catch (e) { return false; } };
  function play(k) {
    if (!soundOn()) return;
    try {
      if (lastAudio) { lastAudio.pause(); lastAudio.currentTime = 0; }
      const a = audio[k] || (audio[k] = new Audio(SOUNDS[k]));
      a.currentTime = 0; lastAudio = a; a.play().catch(() => {});
    } catch (e) {}
  }
  window.LAReviewHook = (r, k, V) => {
    const key = V.g.id + ':' + V.idx;
    if (key === lastKey) return;       // only when you move to a different move
    lastKey = key;
    if (r.cls === 'brilliant') return play('brilliant');
    const st = V.orig[k], nx = V.orig[k + 1];
    if (!st || !nx || !nx.last) return;
    const cap = st.board[nx.last.to.r][nx.last.to.c];
    if (cap && cap.color === V.g.me) { if (cap.type === 'q') play('queen'); else if (cap.type === 'r') play('rook'); }
  };
})();

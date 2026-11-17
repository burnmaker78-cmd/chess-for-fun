/* LAChess: converts a coordinate move (like g1f3) into standard notation (Nf3). Load right after rules.js. */
(function () {
  const R = window.ChessRules, F = 'abcdefgh';
  window.LASan = function (board, ep, uci) {
    try {
      const fc = F.indexOf(uci[0]), fr = 8 - +uci[1], tc = F.indexOf(uci[2]), tr = 8 - +uci[3];
      const p = board[fr][fc];
      if (!p) return uci;
      const m = R.legalMovesForSquare(board, fr, fc, ep, null).find(x => x.r === tr && x.c === tc);
      if (!m) return uci;
      let s;
      if (m.castle === 'king') s = 'O-O';
      else if (m.castle === 'queen') s = 'O-O-O';
      else {
        const dest = F[tc] + (8 - tr), cap = m.capture || m.enPassant;
        if (p.type === 'p') s = (cap ? F[fc] + 'x' : '') + dest + (m.promotion ? '=' + (uci[4] || 'q').toUpperCase() : '');
        else {
          let other = false, sameFile = false, sameRank = false;
          for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const q = board[r][c];
            if (!q || q.color !== p.color || q.type !== p.type || (r === fr && c === fc)) continue;
            if (R.legalMovesForSquare(board, r, c, ep, null).some(x => x.r === tr && x.c === tc)) {
              other = true; if (c === fc) sameFile = true; if (r === fr) sameRank = true;
            }
          }
          let dis = '';
          if (other) dis = !sameFile ? F[fc] : !sameRank ? String(8 - fr) : F[fc] + (8 - fr);
          s = p.type.toUpperCase() + dis + (cap ? 'x' : '') + dest;
        }
      }
      const nb = R.applyMove(board, { r: fr, c: fc }, { r: tr, c: tc }, m, uci[4] || 'q').board;
      const opp = p.color === 'w' ? 'b' : 'w', nep = m.doublePush ? { r: (fr + tr) / 2, c: fc } : null;
      if (R.isInCheck(nb, opp)) s += R.allLegalMoves(nb, opp, nep, null).length ? '+' : '#';
      return s;
    } catch (e) { return uci; }
  };
})();

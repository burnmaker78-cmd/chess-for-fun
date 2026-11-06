/* ---------- Bot opponents ---------- */
/* Original bot roster with ELO-style ratings (not affiliated with chess.com).
   Strength is approximated via search depth, blunder chance, and eval noise -
   not a real rating, just tuned to feel roughly like the labeled range. */

(function () {
  const R = window.ChessRules;

  const BOT_ROSTER = [
    { id: 'pebble',    name: 'Pebble',       elo: 400,  depth: 1, blunder: 0.45, noise: 120 },
    { id: 'rookie',    name: 'Rookie Rhea',  elo: 700,  depth: 1, blunder: 0.30, noise: 90  },
    { id: 'hopper',    name: 'Hopper',       elo: 1000, depth: 2, blunder: 0.20, noise: 70  },
    { id: 'challenger',name: 'Challenger Cal',elo:1300, depth: 2, blunder: 0.12, noise: 50  },
    { id: 'strategist',name: 'Strategist Nia',elo:1600, depth: 2, blunder: 0.06, noise: 30  },
    { id: 'vanguard',  name: 'Vanguard',     elo: 1900, depth: 3, blunder: 0.03, noise: 18  },
    { id: 'grandbot',  name: 'GrandBot',     elo: 2200, depth: 3, blunder: 0.01, noise: 8   },
    { id: 'apex',      name: 'Apex',         elo: 2500, depth: 4, blunder: 0,    noise: 3   },
    { id: 'overlord',  name: 'Overlord',     elo: 2800, depth: 4, blunder: 0,    noise: 0   }
  ];

  const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  // Simplified piece-square tables (white's perspective; row 0 = rank 8)
  const PST_PAWN = [
    [0,0,0,0,0,0,0,0],
    [50,50,50,50,50,50,50,50],
    [10,10,20,30,30,20,10,10],
    [5,5,10,25,25,10,5,5],
    [0,0,0,20,20,0,0,0],
    [5,-5,-10,0,0,-10,-5,5],
    [5,10,10,-20,-20,10,10,5],
    [0,0,0,0,0,0,0,0]
  ];
  const PST_KNIGHT = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,0,0,0,0,-20,-40],
    [-30,0,10,15,15,10,0,-30],
    [-30,5,15,20,20,15,5,-30],
    [-30,0,15,20,20,15,0,-30],
    [-30,5,10,15,15,10,5,-30],
    [-40,-20,0,5,5,0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ];
  const PST_CENTER = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,0,0,0,0,0,0,-10],
    [-10,0,5,10,10,5,0,-10],
    [-10,5,5,10,10,5,5,-10],
    [-10,0,10,10,10,10,0,-10],
    [-10,10,10,10,10,10,10,-10],
    [-10,5,0,0,0,0,5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ];

  function pstValue(type, r, c, color) {
    const row = color === 'w' ? r : 7 - r;
    if (type === 'p') return PST_PAWN[row][c];
    if (type === 'n') return PST_KNIGHT[row][c];
    if (type === 'b' || type === 'q') return PST_CENTER[row][c];
    return 0;
  }

  function evaluate(board) {
    let score = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const val = PIECE_VALUE[p.type] + pstValue(p.type, r, c, p.color);
        score += p.color === 'w' ? val : -val;
      }
    return score;
  }

  function orderMoves(moves) {
    return moves.slice().sort((a, b) => (b.move.capture ? 1 : 0) - (a.move.capture ? 1 : 0));
  }

  function minimax(board, depth, alpha, beta, maximizing, enPassantTarget) {
    if (depth === 0) return { score: evaluate(board) };

    const color = maximizing ? 'w' : 'b';
    const moves = orderMoves(R.allLegalMoves(board, color, enPassantTarget, null));

    if (moves.length === 0) {
      if (R.isInCheck(board, color)) return { score: maximizing ? -100000 - depth : 100000 + depth };
      return { score: 0 };
    }

    let best = null;
    for (const { from, move } of moves) {
      const { board: after } = R.applyMove(board, from, { r: move.r, c: move.c }, move, 'q');
      const nextEP = move.doublePush ? { r: (from.r + move.r) / 2, c: from.c } : null;
      const result = minimax(after, depth - 1, alpha, beta, !maximizing, nextEP);
      const score = result.score;

      if (maximizing) {
        if (best === null || score > best.score) best = { score, from, move };
        alpha = Math.max(alpha, score);
      } else {
        if (best === null || score < best.score) best = { score, from, move };
        beta = Math.min(beta, score);
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  /* Picks a move for `color` using the given bot config. Returns {from, move} or null. */
  function pickBotMove(board, color, enPassantTarget, botConfig) {
    const legal = R.allLegalMoves(board, color, enPassantTarget, null);
    if (legal.length === 0) return null;

    // Blunder chance: just play a random legal move
    if (Math.random() < botConfig.blunder) {
      return legal[Math.floor(Math.random() * legal.length)];
    }

    const maximizing = color === 'w';
    let best = null;
    const ordered = orderMoves(legal);
    let alpha = -Infinity, beta = Infinity;
    for (const { from, move } of ordered) {
      const { board: after } = R.applyMove(board, from, { r: move.r, c: move.c }, move, 'q');
      const nextEP = move.doublePush ? { r: (from.r + move.r) / 2, c: from.c } : null;
      const result = minimax(after, Math.max(botConfig.depth - 1, 0), alpha, beta, !maximizing, nextEP);
      let score = result.score + (Math.random() * 2 - 1) * botConfig.noise;
      if (maximizing) {
        if (best === null || score > best.score) best = { score, from, move };
        alpha = Math.max(alpha, score);
      } else {
        if (best === null || score < best.score) best = { score, from, move };
        beta = Math.min(beta, score);
      }
    }
    return best ? { from: best.from, move: best.move } : ordered[0];
  }

  /* Best-move hint: full-strength search regardless of bot difficulty. */
  function findBestMove(board, color, enPassantTarget, depth) {
    return pickBotMove(board, color, enPassantTarget, { depth: depth || 3, blunder: 0, noise: 0 });
  }

  window.ChessBot = { BOT_ROSTER, evaluate, pickBotMove, findBestMove };
})();

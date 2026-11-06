/* ---------- Core chess rules engine ---------- */
/* Exposed as window.ChessRules. Supports a "chaos" variant per color:
   a chaos-mode player can move any of their pieces to any empty/enemy
   square (ignores check, pins, normal piece movement, castling rules),
   can promote pawns to king, and capturing a normal player's king ends
   the game instantly. A normal-mode player plays standard chess. */

(function () {
  const PIECE_GLYPHS = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
  };

  function makeInitialBoard() {
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      board[0][c] = { type: back[c], color: 'b', hasMoved: false };
      board[1][c] = { type: 'p', color: 'b', hasMoved: false };
      board[6][c] = { type: 'p', color: 'w', hasMoved: false };
      board[7][c] = { type: back[c], color: 'w', hasMoved: false };
    }
    return board;
  }

  function cloneBoard(board) {
    return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
  }

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function findKing(board, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === color) return { r, c };
      }
    return null;
  }

  function isSquareAttacked(board, r, c, byColor) {
    const dir = byColor === 'w' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const pr = r + dir, pc = c + dc;
      if (inBounds(pr, pc)) {
        const p = board[pr][pc];
        if (p && p.type === 'p' && p.color === byColor) return true;
      }
    }
    const knightDeltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightDeltas) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p && p.type === 'n' && p.color === byColor) return true;
      }
    }
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc)) {
          const p = board[nr][nc];
          if (p && p.type === 'k' && p.color === byColor) return true;
        }
      }
    const rookDirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of rookDirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) { if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true; break; }
        nr += dr; nc += dc;
      }
    }
    const bishopDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of bishopDirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) { if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true; break; }
        nr += dr; nc += dc;
      }
    }
    return false;
  }

  function isInCheck(board, color) {
    const king = findKing(board, color);
    if (!king) return false;
    const enemy = color === 'w' ? 'b' : 'w';
    return isSquareAttacked(board, king.r, king.c, enemy);
  }

  function pseudoMoves(board, r, c, enPassantTarget) {
    const piece = board[r][c];
    if (!piece) return [];
    const moves = [];
    const color = piece.color;

    const pushIfValid = (nr, nc) => {
      if (!inBounds(nr, nc)) return;
      const target = board[nr][nc];
      if (target && target.color === color) return;
      moves.push({ r: nr, c: nc, capture: !!target });
    };

    if (piece.type === 'p') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const promoRow = color === 'w' ? 0 : 7;
      if (inBounds(r + dir, c) && !board[r + dir][c]) {
        moves.push({ r: r + dir, c, capture: false, promotion: (r + dir === promoRow) });
        if (r === startRow && !board[r + 2 * dir][c]) {
          moves.push({ r: r + 2 * dir, c, capture: false, doublePush: true });
        }
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr][nc];
        if (target && target.color !== color) {
          moves.push({ r: nr, c: nc, capture: true, promotion: (nr === promoRow) });
        } else if (enPassantTarget && enPassantTarget.r === nr && enPassantTarget.c === nc) {
          moves.push({ r: nr, c: nc, capture: true, enPassant: true });
        }
      }
    } else if (piece.type === 'n') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
        pushIfValid(r + dr, c + dc);
    } else if (piece.type === 'k') {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          pushIfValid(r + dr, c + dc);
        }
      if (!piece.hasMoved) {
        const row = color === 'w' ? 7 : 0;
        const enemy = color === 'w' ? 'b' : 'w';
        const kRook = board[row][7];
        if (kRook && kRook.type === 'r' && !kRook.hasMoved && !board[row][5] && !board[row][6] &&
            !isSquareAttacked(board, row, 4, enemy) && !isSquareAttacked(board, row, 5, enemy) && !isSquareAttacked(board, row, 6, enemy)) {
          moves.push({ r: row, c: 6, capture: false, castle: 'king' });
        }
        const qRook = board[row][0];
        if (qRook && qRook.type === 'r' && !qRook.hasMoved && !board[row][1] && !board[row][2] && !board[row][3] &&
            !isSquareAttacked(board, row, 4, enemy) && !isSquareAttacked(board, row, 3, enemy) && !isSquareAttacked(board, row, 2, enemy)) {
          moves.push({ r: row, c: 2, capture: false, castle: 'queen' });
        }
      }
    } else {
      const dirsByType = {
        b: [[-1,-1],[-1,1],[1,-1],[1,1]],
        r: [[-1,0],[1,0],[0,-1],[0,1]],
        q: [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
      };
      for (const [dr, dc] of dirsByType[piece.type]) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
          const target = board[nr][nc];
          if (target) { if (target.color !== color) moves.push({ r: nr, c: nc, capture: true }); break; }
          moves.push({ r: nr, c: nc, capture: false });
          nr += dr; nc += dc;
        }
      }
    }
    return moves;
  }

  /* Chaos: move any owned piece to any square not occupied by own color. */
  function chaosMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const promoRow = piece.color === 'w' ? 0 : 7;
    const moves = [];
    for (let nr = 0; nr < 8; nr++)
      for (let nc = 0; nc < 8; nc++) {
        if (nr === r && nc === c) continue;
        const target = board[nr][nc];
        if (target && target.color === piece.color) continue;
        const promotion = piece.type === 'p' && nr === promoRow;
        moves.push({ r: nr, c: nc, capture: !!target, promotion, chaos: true });
      }
    return moves;
  }

  function applyMove(board, from, to, move, promotionType) {
    const b = cloneBoard(board);
    const piece = b[from.r][from.c];
    const captured = b[to.r][to.c];

    if (move.enPassant) b[from.r][to.c] = null;

    b[to.r][to.c] = { ...piece, hasMoved: true };
    b[from.r][from.c] = null;

    if (move.promotion) b[to.r][to.c].type = promotionType || 'q';

    if (move.castle === 'king') {
      const row = from.r;
      b[row][5] = b[row][7]; b[row][5].hasMoved = true; b[row][7] = null;
    } else if (move.castle === 'queen') {
      const row = from.r;
      b[row][3] = b[row][0]; b[row][3].hasMoved = true; b[row][0] = null;
    }

    const capturedPiece = move.enPassant ? { type: 'p', color: piece.color === 'w' ? 'b' : 'w' } : captured;
    return { board: b, captured: capturedPiece };
  }

  /* isChaos: function(color) => bool */
  function legalMovesForSquare(board, r, c, enPassantTarget, isChaos) {
    const piece = board[r][c];
    if (!piece) return [];
    if (isChaos && isChaos(piece.color)) return chaosMoves(board, r, c);
    const pseudos = pseudoMoves(board, r, c, enPassantTarget);
    return pseudos.filter(m => {
      const { board: after } = applyMove(board, { r, c }, { r: m.r, c: m.c }, m, 'q');
      return !isInCheck(after, piece.color);
    });
  }

  function allLegalMoves(board, color, enPassantTarget, isChaos) {
    const results = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color) {
          for (const m of legalMovesForSquare(board, r, c, enPassantTarget, isChaos)) {
            results.push({ from: { r, c }, move: m });
          }
        }
      }
    return results;
  }

  function isCheckmate(board, color, enPassantTarget, isChaos) {
    if (isChaos && isChaos(color)) return false; // chaos players can't be checkmated
    return isInCheck(board, color) && allLegalMoves(board, color, enPassantTarget, isChaos).length === 0;
  }

  function isStalemate(board, color, enPassantTarget, isChaos) {
    if (isChaos && isChaos(color)) return false;
    return !isInCheck(board, color) && allLegalMoves(board, color, enPassantTarget, isChaos).length === 0;
  }

  window.ChessRules = {
    PIECE_GLYPHS, makeInitialBoard, cloneBoard, inBounds, findKing,
    isSquareAttacked, isInCheck, pseudoMoves, chaosMoves, applyMove,
    legalMovesForSquare, allLegalMoves, isCheckmate, isStalemate
  };
})();

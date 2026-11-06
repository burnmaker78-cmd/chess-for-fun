/* ---------- App shell: navigation, settings, lobby, game wiring ---------- */
(function () {
  const R = window.ChessRules;
  const B = window.ChessBot;

  /* ---------- Settings (persisted) ---------- */
  const DEFAULT_SETTINGS = { premove: false, hints: false, autoflip: false, theme: 'classic' };
  function loadSettings() {
    try {
      const raw = localStorage.getItem('chess-settings');
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings(s) {
    try { localStorage.setItem('chess-settings', JSON.stringify(s)); } catch (e) {}
  }
  const settings = loadSettings();

  function applySettingsToUI() {
    document.getElementById('setting-premove').checked = settings.premove;
    document.getElementById('setting-hints').checked = settings.hints;
    document.getElementById('setting-autoflip').checked = settings.autoflip;
    document.getElementById('setting-theme').value = settings.theme;
    document.body.setAttribute('data-theme', settings.theme);
  }

  document.getElementById('setting-premove').addEventListener('change', e => {
    settings.premove = e.target.checked; saveSettings(settings);
  });
  document.getElementById('setting-hints').addEventListener('change', e => {
    settings.hints = e.target.checked; saveSettings(settings);
    if (game) { computeHint(); renderHint(); }
  });
  document.getElementById('setting-autoflip').addEventListener('change', e => {
    settings.autoflip = e.target.checked; saveSettings(settings);
  });
  document.getElementById('setting-theme').addEventListener('change', e => {
    settings.theme = e.target.value; saveSettings(settings);
    document.body.setAttribute('data-theme', settings.theme);
  });

  /* ---------- Navigation ---------- */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  }
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.nav));
  });

  /* ---------- Bot select screen ---------- */
  const botListEl = document.getElementById('bot-list');
  B.BOT_ROSTER.forEach(bot => {
    const row = document.createElement('div');
    row.className = 'bot-row';
    row.innerHTML = `<span class="bot-name">${bot.name}</span><span class="bot-elo">${bot.elo} ELO</span>`;
    row.addEventListener('click', () => startGame({ mode: 'bot', bot }));
    botListEl.appendChild(row);
  });

  /* ---------- Lobby screen ---------- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-create').classList.toggle('hidden', btn.dataset.tab !== 'create');
      document.getElementById('tab-join').classList.toggle('hidden', btn.dataset.tab !== 'join');
    });
  });

  let selectedLobbyMode = 'normal';
  let chaosUnlocked = false;
  let chaosAssignment = null; // 'w' | 'b' | 'both' | null

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === 'chaos-locked') {
        if (!chaosUnlocked) {
          document.getElementById('chaos-unlock-modal').classList.remove('hidden');
          return;
        }
        document.getElementById('chaos-assign-modal').classList.remove('hidden');
        return;
      }
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLobbyMode = 'normal';
      chaosAssignment = null;
      document.getElementById('chaos-note').classList.add('hidden');
    });
  });

  document.getElementById('chaos-unlock-cancel').addEventListener('click', () => {
    document.getElementById('chaos-unlock-modal').classList.add('hidden');
  });
  document.getElementById('chaos-unlock-submit').addEventListener('click', () => {
    const code = document.getElementById('chaos-code-input').value.trim();
    if (code === '3105') {
      chaosUnlocked = true;
      document.getElementById('chaos-unlock-modal').classList.add('hidden');
      document.getElementById('chaos-code-input').value = '';
      document.getElementById('chaos-unlock-error').classList.add('hidden');
      document.getElementById('chaos-assign-modal').classList.remove('hidden');
    } else {
      document.getElementById('chaos-unlock-error').classList.remove('hidden');
    }
  });

  function finishChaosAssign(which) {
    chaosAssignment = which; // 'w' | 'b' | 'both'
    selectedLobbyMode = 'chaos';
    document.getElementById('chaos-assign-modal').classList.add('hidden');
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-mode="chaos-locked"]').classList.add('active');
    const note = document.getElementById('chaos-note');
    note.textContent = `Chaos Mode is ON for ${which === 'both' ? 'both players' : which === 'w' ? 'White' : 'Black'} — it'll show as a banner in-game so no one's surprised.`;
    note.classList.remove('hidden');
  }
  document.getElementById('chaos-assign-white').addEventListener('click', () => finishChaosAssign('w'));
  document.getElementById('chaos-assign-black').addEventListener('click', () => finishChaosAssign('b'));
  document.getElementById('chaos-assign-both').addEventListener('click', () => finishChaosAssign('both'));

  function randomPin() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  document.getElementById('create-lobby-btn').addEventListener('click', () => {
    const pin = randomPin();
    const lobbies = JSON.parse(localStorage.getItem('chess-lobbies') || '{}');
    lobbies[pin] = { mode: selectedLobbyMode, chaosAssignment, createdAt: Date.now() };
    localStorage.setItem('chess-lobbies', JSON.stringify(lobbies));
    const disp = document.getElementById('lobby-pin-display');
    disp.innerHTML = `<div>Give this PIN to your friend</div><div class="pin-value">${pin}</div>
      <div style="margin-top:8px;color:var(--muted);font-size:0.8rem">
        This is a same-network, two-device pass setup — each of you opens this page on your own device and plays the board as it's shown to you.
      </div>`;
    disp.classList.remove('hidden');
    setTimeout(() => startGame({ mode: 'friend', chaos: selectedLobbyMode === 'chaos' ? chaosAssignment : null }), 300);
  });

  document.getElementById('join-lobby-btn').addEventListener('click', () => {
    const pin = document.getElementById('join-pin-input').value.trim();
    const lobbies = JSON.parse(localStorage.getItem('chess-lobbies') || '{}');
    const lobby = lobbies[pin];
    if (!lobby) {
      alert("That PIN wasn't found on this device. If your friend is on a different device, you'll both need to enter the same mode manually — there's no live internet sync in this version.");
      return;
    }
    startGame({ mode: 'friend', chaos: lobby.mode === 'chaos' ? lobby.chaosAssignment : null });
  });

  /* ---------- Game state ---------- */
  let game = null; // current game session object

  function newGameState(opts) {
    return {
      type: opts.mode,                 // 'bot' | 'friend'
      bot: opts.bot || null,
      chaosAssignment: opts.chaos || null, // 'w' | 'b' | 'both' | null
      board: R.makeInitialBoard(),
      turn: 'w',
      selected: null,
      legalTargets: [],
      lastMove: null,
      enPassantTarget: null,
      history: [],
      captured: { w: [], b: [] },
      moveLog: [],
      gameOver: false,
      pendingPromotion: null,
      premoveQueued: null, // {from, to}
      hintMove: null
    };
  }

  function isChaosColor(color) {
    if (!game || !game.chaosAssignment) return false;
    return game.chaosAssignment === 'both' || game.chaosAssignment === color;
  }

  function startGame(opts) {
    game = newGameState(opts);
    document.getElementById('lobby-pin-display').classList.add('hidden');
    showScreen('screen-game');
    const banner = document.getElementById('chaos-banner');
    if (game.chaosAssignment) {
      banner.textContent = `⚡ CHAOS MODE ACTIVE — ${game.chaosAssignment === 'both' ? 'both sides' : game.chaosAssignment === 'w' ? 'White' : 'Black'} can move anywhere, ignore check, and promote to king.`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
    render();
    maybeBotMove();
  }

  /* ---------- Rendering ---------- */
  const boardEl = document.getElementById('board');
  const turnIndicator = document.getElementById('turn-indicator');
  const checkIndicator = document.getElementById('check-indicator');
  const capturedByWhiteEl = document.getElementById('captured-by-white');
  const capturedByBlackEl = document.getElementById('captured-by-black');
  const moveListEl = document.getElementById('move-list');
  const promotionModal = document.getElementById('promotion-modal');
  const promotionChoices = document.getElementById('promotion-choices');
  const hintOverlay = document.getElementById('hint-overlay');

  function squareColor(r, c) { return (r + c) % 2 === 0 ? 'light' : 'dark'; }
  function fileLabel(c) { return 'abcdefgh'[c]; }
  function rankLabel(r) { return 8 - r; }

  function boardIsFlipped() {
    if (game.type === 'bot') return false;
    if (settings.autoflip) return game.turn === 'b';
    return false;
  }

  function render() {
    boardEl.innerHTML = '';
    const flipped = boardIsFlipped();

    for (let dr = 0; dr < 8; dr++) {
      for (let dc = 0; dc < 8; dc++) {
        const r = flipped ? 7 - dr : dr;
        const c = flipped ? 7 - dc : dc;

        const sq = document.createElement('div');
        sq.className = `square ${squareColor(r, c)}`;

        if (game.selected && game.selected.r === r && game.selected.c === c) sq.classList.add('selected');
        if (game.lastMove && ((game.lastMove.from.r === r && game.lastMove.from.c === c) || (game.lastMove.to.r === r && game.lastMove.to.c === c))) sq.classList.add('last-move');
        if (game.premoveQueued && game.premoveQueued.to.r === r && game.premoveQueued.to.c === c) sq.classList.add('premove');

        const piece = game.board[r][c];
        if (piece && piece.type === 'k' && piece.color === game.turn && !isChaosColor(piece.color) && R.isInCheck(game.board, piece.color)) {
          sq.classList.add('in-check');
        }

        if (piece) {
          const span = document.createElement('span');
          span.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
          span.textContent = R.PIECE_GLYPHS[piece.color][piece.type];
          sq.appendChild(span);
        }

        const target = game.legalTargets.find(t => t.r === r && t.c === c);
        if (target) {
          const marker = document.createElement('div');
          marker.className = target.capture ? 'capture-ring' : 'move-dot';
          sq.appendChild(marker);
        }

        if (dc === 0) {
          const rl = document.createElement('span'); rl.className = 'coord-rank'; rl.textContent = rankLabel(r); sq.appendChild(rl);
        }
        if (dr === 7) {
          const fl = document.createElement('span'); fl.className = 'coord-file'; fl.textContent = fileLabel(c); sq.appendChild(fl);
        }

        sq.addEventListener('click', () => onSquareClick(r, c));
        boardEl.appendChild(sq);
      }
    }

    turnIndicator.textContent = game.gameOver ? turnIndicator.textContent : `${game.turn === 'w' ? 'White' : 'Black'} to move`;
    checkIndicator.textContent = (!game.gameOver && !isChaosColor(game.turn) && R.isInCheck(game.board, game.turn)) ? 'Check!' : '';
    capturedByWhiteEl.textContent = game.captured.w.map(p => R.PIECE_GLYPHS.b[p.type]).join(' ');
    capturedByBlackEl.textContent = game.captured.b.map(p => R.PIECE_GLYPHS.w[p.type]).join(' ');

    renderHint();
  }

  function renderHint() {
    hintOverlay.innerHTML = '';
    if (!settings.hints || game.gameOver || !game.hintMove) return;
    const flipped = boardIsFlipped();
    const sq = 100;
    const toDisplay = (r, c) => {
      const dr = flipped ? 7 - r : r, dc = flipped ? 7 - c : c;
      return { x: dc * sq + sq / 2, y: dr * sq + sq / 2 };
    };
    const from = toDisplay(game.hintMove.from.r, game.hintMove.from.c);
    const to = toDisplay(game.hintMove.move.r, game.hintMove.move.c);

    const ns = 'http://www.w3.org/2000/svg';
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '5');
    marker.setAttribute('orient', 'auto');
    marker.innerHTML = '<polygon points="0,0 10,5 0,10" fill="#2ecc71"/>';
    const defs = document.createElementNS(ns, 'defs');
    defs.appendChild(marker);
    hintOverlay.appendChild(defs);

    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
    line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
    line.setAttribute('stroke', '#2ecc71');
    line.setAttribute('stroke-width', '14');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', '0.75');
    line.setAttribute('marker-end', 'url(#arrowhead)');
    hintOverlay.appendChild(line);
  }

  function computeHint() {
    if (!settings.hints || game.gameOver) { game.hintMove = null; return; }
    const best = B.findBestMove(game.board, game.turn, game.enPassantTarget, 3);
    game.hintMove = best || null;
  }

  /* ---------- Interaction ---------- */
  function onSquareClick(r, c) {
    if (game.gameOver || game.pendingPromotion) return;
    if (game.type === 'bot' && game.turn !== 'w') {
      handlePremoveClick(r, c);
      return;
    }

    const piece = game.board[r][c];
    const target = game.legalTargets.find(t => t.r === r && t.c === c);
    if (game.selected && target) {
      makeMove(game.selected, target);
      return;
    }
    if (piece && piece.color === game.turn) {
      game.selected = { r, c };
      game.legalTargets = R.legalMovesForSquare(game.board, r, c, game.enPassantTarget, isChaosColor);
    } else {
      game.selected = null;
      game.legalTargets = [];
    }
    render();
  }

  function handlePremoveClick(r, c) {
    if (!settings.premove) return;
    const piece = game.board[r][c];
    if (game.selected) {
      const targets = R.legalMovesForSquare(game.board, game.selected.r, game.selected.c, game.enPassantTarget, isChaosColor);
      const t = targets.find(t => t.r === r && t.c === c);
      if (t) {
        game.premoveQueued = { from: game.selected, to: { r, c }, move: t };
        game.selected = null;
        game.legalTargets = [];
        render();
        return;
      }
    }
    if (piece && piece.color === 'w') {
      game.selected = { r, c };
      game.legalTargets = R.legalMovesForSquare(game.board, r, c, game.enPassantTarget, isChaosColor);
    } else {
      game.selected = null;
      game.legalTargets = [];
    }
    render();
  }

  function pushHistory() {
    game.history.push({
      board: R.cloneBoard(game.board), turn: game.turn, enPassantTarget: game.enPassantTarget,
      lastMove: game.lastMove, captured: { w: [...game.captured.w], b: [...game.captured.b] }
    });
  }

  function makeMove(from, move, promotionType) {
    const piece = game.board[from.r][from.c];
    const chaos = isChaosColor(piece.color);

    if (move.promotion && !promotionType) {
      game.pendingPromotion = { from, move };
      showPromotionModal(piece.color, chaos);
      return;
    }

    pushHistory();
    const { board: newBoard, captured } = R.applyMove(game.board, from, { r: move.r, c: move.c }, move, promotionType);

    if (captured) {
      if (captured.type === 'k') {
        const capturedColorChaos = isChaosColor(captured.color);
        if (!capturedColorChaos) {
          // Normal player's king captured outright: game ends immediately.
          game.captured[piece.color].push(captured);
          game.board = newBoard;
          game.lastMove = { from, to: { r: move.r, c: move.c } };
          endGame(`${piece.color === 'w' ? 'White' : 'Black'} wins — king captured!`);
          render();
          return;
        }
        // Chaos player's king captured: remove it, game continues.
        game.captured[piece.color].push(captured);
      } else {
        game.captured[piece.color].push(captured);
      }
    }

    game.board = newBoard;
    game.lastMove = { from, to: { r: move.r, c: move.c } };
    game.enPassantTarget = move.doublePush ? { r: (from.r + move.r) / 2, c: from.c } : null;

    logMove(piece, from, move, captured, promotionType);

    game.turn = game.turn === 'w' ? 'b' : 'w';
    game.selected = null;
    game.legalTargets = [];
    game.pendingPromotion = null;

    checkGameEnd();
    computeHint();
    render();

    if (!game.gameOver) {
      resolvePremove();
      maybeBotMove();
    }
  }

  function resolvePremove() {
    if (!settings.premove || !game.premoveQueued || game.type !== 'bot' || game.turn !== 'w') return;
    const { from, to } = game.premoveQueued;
    game.premoveQueued = null;
    const legal = R.legalMovesForSquare(game.board, from.r, from.c, game.enPassantTarget, isChaosColor);
    const m = legal.find(t => t.r === to.r && t.c === to.c);
    if (m) setTimeout(() => makeMove(from, m), 150);
  }

  function maybeBotMove() {
    if (game.type !== 'bot' || game.gameOver || game.turn !== 'b') return;
    setTimeout(() => {
      const picked = B.pickBotMove(game.board, 'b', game.enPassantTarget, game.bot);
      if (!picked) return;
      let promo = null;
      if (picked.move.promotion) promo = 'q';
      makeMove(picked.from, picked.move, promo);
    }, 350);
  }

  function logMove(piece, from, move, captured, promotionType) {
    const files = 'abcdefgh';
    let notation;
    if (move.castle === 'king') notation = 'O-O';
    else if (move.castle === 'queen') notation = 'O-O-O';
    else {
      const pieceLetter = piece.type === 'p' ? '' : piece.type.toUpperCase();
      const capture = (move.capture || move.enPassant) ? 'x' : '';
      const fromSq = piece.type === 'p' && capture ? files[from.c] : '';
      notation = `${pieceLetter}${fromSq}${capture}${files[move.c]}${rankLabel(move.r)}`;
      if (promotionType) notation += `=${promotionType.toUpperCase()}`;
      if (move.chaos) notation += '†';
    }
    game.moveLog.push({ color: piece.color, notation });
    renderMoveLog();
  }

  function renderMoveLog() {
    moveListEl.innerHTML = '';
    for (let i = 0; i < game.moveLog.length; i += 2) {
      const li = document.createElement('li');
      const white = game.moveLog[i], black = game.moveLog[i + 1];
      li.textContent = `${white ? white.notation : ''}${black ? '  ' + black.notation : ''}`;
      moveListEl.appendChild(li);
    }
  }

  function checkGameEnd() {
    const color = game.turn;
    if (R.isCheckmate(game.board, color, game.enPassantTarget, isChaosColor)) {
      const winner = color === 'w' ? 'Black' : 'White';
      endGame(`Checkmate — ${winner} wins`);
      if (game.moveLog.length) { game.moveLog[game.moveLog.length - 1].notation += '#'; renderMoveLog(); }
    } else if (R.isStalemate(game.board, color, game.enPassantTarget, isChaosColor)) {
      endGame('Stalemate — draw');
    } else if (!isChaosColor(color) && R.isInCheck(game.board, color) && game.moveLog.length) {
      game.moveLog[game.moveLog.length - 1].notation += '+';
      renderMoveLog();
    }
  }

  function endGame(message) {
    game.gameOver = true;
    turnIndicator.textContent = message;
    checkIndicator.textContent = '';
    document.getElementById('gameover-text').textContent = message;
    document.getElementById('gameover-modal').classList.remove('hidden');
  }

  function showPromotionModal(color, chaos) {
    promotionChoices.innerHTML = '';
    const options = chaos ? ['q', 'r', 'b', 'n', 'k'] : ['q', 'r', 'b', 'n'];
    for (const type of options) {
      const btn = document.createElement('button');
      btn.textContent = R.PIECE_GLYPHS[color][type];
      btn.addEventListener('click', () => {
        promotionModal.classList.add('hidden');
        const { from, move } = game.pendingPromotion;
        makeMove(from, move, type);
      });
      promotionChoices.appendChild(btn);
    }
    promotionModal.classList.remove('hidden');
  }

  function undo() {
    if (!game || game.history.length === 0 || game.pendingPromotion) return;
    const prev = game.history.pop();
    game.board = prev.board; game.turn = prev.turn; game.enPassantTarget = prev.enPassantTarget;
    game.lastMove = prev.lastMove; game.captured = prev.captured;
    game.moveLog.pop();
    game.gameOver = false;
    game.selected = null; game.legalTargets = []; game.premoveQueued = null;
    renderMoveLog();
    computeHint();
    render();
  }

  document.getElementById('undo-btn').addEventListener('click', undo);
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!game) return;
    startGame({ mode: game.type, bot: game.bot, chaos: game.chaosAssignment });
  });
  document.getElementById('gameover-rematch').addEventListener('click', () => {
    document.getElementById('gameover-modal').classList.add('hidden');
    startGame({ mode: game.type, bot: game.bot, chaos: game.chaosAssignment });
  });
  document.getElementById('gameover-dashboard').addEventListener('click', () => {
    document.getElementById('gameover-modal').classList.add('hidden');
    showScreen('screen-dashboard');
  });

  applySettingsToUI();
  showScreen('screen-dashboard');
})();

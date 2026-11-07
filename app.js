/* ---------- SVG piece helper ---------- */
const PIECE_NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const pieceImgCache = {};

function makePieceEl(color, type) {
  const name = PIECE_NAMES[String(type).toLowerCase()];
  const side = String(color).toLowerCase().startsWith('w') ? 'w' : 'b';
  const key = `${name}-${side}`;

  if (!pieceImgCache[key]) {
    const base = new Image();
    base.src = `pieces/${key}.svg`;
    base.alt = `${side === 'w' ? 'white' : 'black'} ${name}`;
    base.className = 'piece-img';
    base.draggable = false;
    pieceImgCache[key] = base;
  }
  return pieceImgCache[key].cloneNode();
}

/* ---------- App shell: navigation, settings, lobby, game wiring ---------- */
(function () {
  const R = window.ChessRules;
  const B = window.ChessBot;

  /* ---------- Safe storage wrapper ---------- */
  /* Some browsers (Safari private mode, certain managed Chromebook policies,
     some file:// contexts) throw on localStorage access instead of just being
     unavailable. Every call goes through this so a storage failure degrades
     to an in-memory fallback instead of silently breaking a button. */
  const memoryStore = {};
  const Storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw !== null ? raw : (fallback !== undefined ? fallback : null);
      } catch (e) {
        return key in memoryStore ? memoryStore[key] : (fallback !== undefined ? fallback : null);
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch (e) { memoryStore[key] = value; return false; }
    }
  };

  /* ---------- Settings (persisted) ---------- */
  const DEFAULT_SETTINGS = { premove: false, hints: false, autoflip: false, sound: false, theme: 'classic' };
  function loadSettings() {
    try {
      const raw = Storage.get('chess-settings', null);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings(s) { Storage.set('chess-settings', JSON.stringify(s)); }
  const settings = loadSettings();

  /* ---------- Sound (Web Audio, no asset files) ---------- */
  let audioCtx = null;
  function beep(freq, duration, type) {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* audio unavailable; fail silently */ }
  }
  const Sound = {
    move: () => beep(440, 0.1, 'triangle'),
    capture: () => beep(260, 0.15, 'square'),
    check: () => beep(620, 0.18, 'sawtooth'),
    gameover: () => beep(180, 0.4, 'sine')
  };

  function applySettingsToUI() {
    document.getElementById('setting-premove').checked = settings.premove;
    document.getElementById('setting-hints').checked = settings.hints;
    document.getElementById('setting-autoflip').checked = settings.autoflip;
    document.getElementById('setting-sound').checked = settings.sound;
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
    if (game) render();
  });
  document.getElementById('setting-sound').addEventListener('change', e => {
    settings.sound = e.target.checked; saveSettings(settings);
    if (settings.sound) Sound.move();
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
    row.innerHTML = `
      <span class="bot-avatar">${bot.avatar}</span>
      <span class="bot-info">
        <span class="bot-name">${bot.name}</span>
        <span class="bot-tagline">${bot.tagline}</span>
      </span>
      <span class="bot-elo">${bot.elo}<span class="bot-elo-label">ELO</span></span>`;
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

  function readLobbies() {
    try { return JSON.parse(Storage.get('chess-lobbies', '{}')); }
    catch (e) { return {}; }
  }
  function writeLobbies(lobbies) { Storage.set('chess-lobbies', JSON.stringify(lobbies)); }

  document.getElementById('create-lobby-btn').addEventListener('click', () => {
    const pin = randomPin();
    const lobbies = readLobbies();
    lobbies[pin] = { mode: selectedLobbyMode, chaosAssignment, createdAt: Date.now() };
    writeLobbies(lobbies);
    const disp = document.getElementById('lobby-pin-display');
    disp.innerHTML = `<div>Give this PIN to your friend</div><div class="pin-value">${pin}</div>
      <button id="copy-pin-btn" class="secondary-btn" style="margin-top:8px">Copy PIN</button>
      <div style="margin-top:8px;color:var(--muted);font-size:0.8rem">
        This is a same-network, two-device pass setup — each of you opens this page on your own device and plays the board as it's shown to you. No live internet sync yet.
      </div>`;
    disp.classList.remove('hidden');
    const copyBtn = document.getElementById('copy-pin-btn');
    copyBtn.addEventListener('click', () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pin).then(() => { copyBtn.textContent = 'Copied!'; });
      } else {
        copyBtn.textContent = pin;
      }
    });
    setTimeout(() => startGame({ mode: 'friend', chaos: selectedLobbyMode === 'chaos' ? chaosAssignment : null }), 400);
  });

  document.getElementById('join-lobby-btn').addEventListener('click', () => {
    const pin = document.getElementById('join-pin-input').value.trim();
    if (!pin) return;
    const lobbies = readLobbies();
    const lobby = lobbies[pin];
    if (!lobby) {
      alert("That PIN wasn't found on this device. If your friend is on a different device, you'll both need to pick the same mode manually — there's no live internet sync in this version.");
      return;
    }
    startGame({ mode: 'friend', chaos: lobby.mode === 'chaos' ? lobby.chaosAssignment : null });
  });

  /* ---------- Game state ---------- */
  let game = null; window.getLAGame = () => game;
  window.LA = { myColor: 'w', remote: false, onMove: null, startGame: o => startGame(o), makeMove: (f, m, p) => makeMove(f, m, p), getChaos: () => (selectedLobbyMode === 'chaos' ? chaosAssignment : null) };

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
      hintMove: null,
      moves: []
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
    banner.classList.add('hidden');

    const oppLine = document.getElementById('opponent-line');
    if (game.type === 'bot') {
      oppLine.innerHTML = `<span class="opp-avatar">${game.bot.avatar}</span> You (White) vs <strong>${game.bot.name}</strong> <span class="opp-elo">${game.bot.elo} ELO</span>`;
      oppLine.classList.remove('hidden');
    } else {
      oppLine.textContent = '👥 Local friend game — pass the device each turn.';
      oppLine.classList.remove('hidden');
    }

    computeHint();
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
    if (game.type === 'online') return window.LA.myColor === 'b';
    if (game.type === 'bot') return false;
    if (settings.autoflip) return game.turn === 'b';
    return false;
  }

  /* Material advantage readout, e.g. "White +3" */
  function materialDiffLabel() {
    const val = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const sum = list => list.reduce((s, p) => s + (val[p.type] || 0), 0);
    const diff = sum(game.captured.w) - sum(game.captured.b);
    if (diff === 0) return 'Even material';
    return `${diff > 0 ? 'White' : 'Black'} +${Math.abs(diff)}`;
  }

  function fillCapturedTray(trayEl, pieces, color) {
    trayEl.innerHTML = '';
    pieces.forEach(p => {
      const img = makePieceEl(color, p.type);
      img.classList.add('small');
      trayEl.appendChild(img);
    });
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
          sq.appendChild(makePieceEl(piece.color, piece.type));
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

    if (!game.gameOver) {
      turnIndicator.textContent = game.botThinking
        ? `${game.bot.name} is thinking…`
        : `${game.turn === 'w' ? 'White' : 'Black'} to move`;
    }
    checkIndicator.textContent = (!game.gameOver && !isChaosColor(game.turn) && R.isInCheck(game.board, game.turn)) ? 'Check!' : '';

    /* White captured black pieces, Black captured white pieces */
    fillCapturedTray(capturedByWhiteEl, game.captured.w, 'b');
    fillCapturedTray(capturedByBlackEl, game.captured.b, 'w');

    document.getElementById('material-indicator').textContent = materialDiffLabel();

    renderHint();
  }

      function renderHint() {
    hintOverlay.innerHTML = '';
    if (!settings.hints || game.gameOver || !game.hintMove) return;
    const flipped = boardIsFlipped();
    const toDisplay = (r, c) => {
      const dr = flipped ? 7 - r : r, dc = flipped ? 7 - c : c;
      return { x: dc * 100 + 50, y: dr * 100 + 50 };
    };
    const from = toDisplay(game.hintMove.from.r, game.hintMove.from.c);
    const to = toDisplay(game.hintMove.move.r, game.hintMove.move.c);
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
    const head = 26, half = 14;
    const tip = { x: to.x - ux * 8, y: to.y - uy * 8 };
    const base = { x: tip.x - ux * head, y: tip.y - uy * head };

    const ns = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
    line.setAttribute('x2', base.x); line.setAttribute('y2', base.y);
    line.setAttribute('stroke', '#2ecc71');
    line.setAttribute('stroke-width', '8');
    line.setAttribute('opacity', '0.75');
    hintOverlay.appendChild(line);

    const tri = document.createElementNS(ns, 'polygon');
    tri.setAttribute('points',
      `${tip.x},${tip.y} ${base.x - uy * half},${base.y + ux * half} ${base.x + uy * half},${base.y - ux * half}`);
    tri.setAttribute('fill', '#2ecc71');
    tri.setAttribute('opacity', '0.75');
    hintOverlay.appendChild(tri);
  }

  function computeHint() {
    if (!settings.hints || game.gameOver) { game.hintMove = null; return; }
    const best = B.findBestMove(game.board, game.turn, game.enPassantTarget, 3);
    game.hintMove = best || null;
  }

  /* ---------- Interaction ---------- */
  function onSquareClick(r, c) {
    if (game.gameOver || game.pendingPromotion) return;
    const myTurnColor = game.type === 'online' ? window.LA.myColor : (game.type === 'bot' ? 'w' : null);
    if (myTurnColor && game.turn !== myTurnColor) {
     handlePremoveClick(r, c, myTurnColor);
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
    game.moves.push({ from, move, promotionType, color: piece.color, before: R.cloneBoard(game.board), ep: game.enPassantTarget });
    if (window.LA.onMove && !window.LA.remote) window.LA.onMove(from, move, promotionType);
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
    }, settings.premove ? 900 + Math.random() * 900 : 400);
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
      btn.appendChild(makePieceEl(color, type));
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
    game.moveLog.pop(); game.moves.pop();
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

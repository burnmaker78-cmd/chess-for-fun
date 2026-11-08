/* LAChess online play (2 devices) using PeerJS peer-to-peer. Supports Chaos Mode (host decides). */
(function () {
  const $ = id => document.getElementById(id);
  const st = t => { $('online-status').textContent = t; };
  let peer = null, conn = null;

  // hide buttons that would desync an online game
  const css = document.createElement('style');
  css.textContent = 'body.online #undo-btn,body.online #reset-btn,body.online #gameover-rematch{display:none!important}';
  document.head.appendChild(css);
  setInterval(() => {
    const g = window.getLAGame && window.getLAGame();
    document.body.classList.toggle('online', !!g && g.type === 'online');
  }, 400);

  function cleanup() {
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    conn = null; peer = null;
  }

  const who = c => c === 'both' ? 'both players' : c === 'w' ? 'White' : 'Black';

  function begin(color, chaos) {
    window.LA.myColor = color;
    window.LA.startGame({ mode: 'online', chaos: chaos || null });
    $('opponent-line').textContent = '🌐 Online game — you are ' + (color === 'w' ? 'White' : 'Black');
    st('Connected!');
  }

  function wire(c) {
    conn = c;
    window.LA.send = o => { if (c.open) c.send(o); };
    c.on('data', d => {
      if (!d) return;
      if (window.LA.onData) window.LA.onData(d);
      if (d.t === 'start') begin('b', d.chaos);          // joiner: host decides the rules
      if (d.t === 'move') {
        window.LA.remote = true;
        try { window.LA.makeMove(d.from, d.move, d.promo); } finally { window.LA.remote = false; }
      }
    });
    c.on('close', () => { st('Opponent disconnected.'); alert('Your opponent left the game.'); });
    window.LA.onMove = (from, move, promo) => {
      if (conn && conn.open) conn.send({ t: 'move', from, move, promo });
    };
  }

  function host(tries) {
    cleanup();
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    peer = new Peer('lachess-' + pin);
    peer.on('open', () => st('Waiting for your opponent… PIN: ' + pin));
    peer.on('connection', c => c.on('open', () => {
      wire(c);
      const chaos = window.LA.getChaos ? window.LA.getChaos() : null; // set in the Create Lobby tab
      c.send({ t: 'start', chaos });
      begin('w', chaos);
    }));
    peer.on('error', e => {
      if (e.type === 'unavailable-id' && tries < 5) host(tries + 1);
      else st('Error: ' + e.type);
    });
  }

  function join() {
    const pin = $('online-pin-input').value.trim();
    if (!/^\d{4}$/.test(pin)) return st('Enter the 4-digit PIN.');
    cleanup();
    st('Connecting…');
    peer = new Peer();
    peer.on('open', () => {
      const c = peer.connect('lachess-' + pin, { reliable: true });
      c.on('open', () => wire(c));
      setTimeout(() => { if (!c.open) st('Could not connect. Check the PIN (a strict network can also block this).'); }, 10000);
    });
    peer.on('error', e => st(e.type === 'peer-unavailable' ? 'No game found with that PIN.' : 'Error: ' + e.type));
  }

  $('online-host-btn').addEventListener('click', () => host(0));
  $('online-join-btn').addEventListener('click', join);
})();

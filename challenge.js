/* LAChess challenges: invite a player to an online game. Load after friends.js and online.js/accounts.js. */
(function () {
  const $ = id => document.getElementById(id);
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const myRec = () => { const k = get('lac-session', null); return k ? (get('lac-users', {})[k] || null) : null; };
  const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
  const ready = () => window.Cloud && window.Cloud.sendChallenge;

  function toast(t) {
    const d = document.createElement('div'); d.className = 'lac-toast'; d.textContent = t;
    document.body.appendChild(d); setTimeout(() => d.remove(), 4000);
  }

  /* ---------- sending ---------- */
  async function challenge(key, name) {
    const me = myRec();
    if (!me) { const c = $('lac-corner'); if (c) c.click(); return; }
    if (!ready()) { toast('Challenges need the Firebase setup.'); return; }
    if (key === me.key) return;
    show('screen-lobby');
    $('online-host-btn').click();                       // start hosting; the PIN appears in the status line
    let pin = null;
    for (let i = 0; i < 30 && !pin; i++) {
      await new Promise(r => setTimeout(r, 200));
      const m = /PIN: (\d{4})/.exec($('online-status').textContent);
      if (m) pin = m[1];
    }
    if (!pin) { toast('Couldn’t start a game. Check your connection and try again.'); return; }
    const rated = !!($('online-rated') && $('online-rated').value === '1');
    try { await window.Cloud.sendChallenge(key, { from: me.name, fromKey: me.key, pin, rated, ts: Date.now() }); }
    catch (e) { toast('Couldn’t send the challenge.'); return; }
    toast(`Challenge sent to ${name || key}. Waiting for them to accept…`);
  }

  /* ---------- receiving ---------- */
  let watching = null, unsub = null, shown = 0;
  function popup(d) {
    const m = document.createElement('div'); m.className = 'lac-modal';
    m.innerHTML = `<div class="lac-box"><h3>⚔️ Challenge!</h3><p><b>${esc(d.from)}</b> wants to play you (${d.rated ? 'rated' : 'unrated'}).</p>
      <button id="ch-yes">Accept</button><button class="alt" id="ch-no">Decline</button></div>`;
    document.body.appendChild(m);
    const done = () => { m.remove(); window.Cloud.clearChallenge(watching); };
    m.querySelector('#ch-no').onclick = done;
    m.querySelector('#ch-yes').onclick = () => {
      m.remove(); window.Cloud.clearChallenge(watching);
      show('screen-lobby');
      $('online-pin-input').value = d.pin;
      $('online-join-btn').click();
    };
  }
  setInterval(() => {
    const me = myRec(), key = me ? me.key : null;
    if (key === watching || !ready()) return;
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    watching = key;
    if (!key) return;
    unsub = window.Cloud.watchChallenges(key, d => {
      if (!d || !d.pin || !d.ts || d.ts === shown) return;
      if (Date.now() - d.ts > 120000) { window.Cloud.clearChallenge(key); return; } // old invite
      shown = d.ts; popup(d);
    });
  }, 3000);

  /* ---------- buttons ---------- */
  const mk = (key, name) => {
    const b = document.createElement('button');
    b.className = 'ch-btn'; b.textContent = '⚔️ Challenge';
    b.onclick = () => challenge(key, name);
    return b;
  };
  new MutationObserver(() => {                                  // friends list rows
    document.querySelectorAll('#fr-list .fr-row').forEach(row => {
      if (row.querySelector('.ch-btn')) return;
      const info = row.querySelector('.fr-info'); if (!info) return;
      row.insertBefore(mk(info.dataset.k, info.textContent.trim()), row.querySelector('button[data-r]'));
    });
  }).observe($('fr-list'), { childList: true });

  new MutationObserver(() => {                                  // profile in Find Players
    const out = $('fd-result');
    if (!out || !out.querySelector('.pf-head') || out.querySelector('.ch-btn')) return;
    const key = $('fd-input').value.trim().toLowerCase(), me = myRec();
    if (!key || (me && me.key === key)) return;
    const b = mk(key, key); b.className = 'primary-btn ch-btn'; b.style.marginLeft = '8px';
    const anchor = out.querySelector('.fr-btn') || out.querySelector('.pf-head');
    anchor.insertAdjacentElement('afterend', b);
  }).observe($('fd-result'), { childList: true });
})();

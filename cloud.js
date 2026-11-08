/* LAChess shared accounts via Firebase (Auth + Firestore). Paste your firebaseConfig below. */
(function () {
  const firebaseConfig = {
    apiKey: 'AIzaSyBfMBb1bAXxrtCbDdnzmvU4E7Xv3CB8gx4',
    authDomain: 'la-chess.firebaseapp.com',
    projectId: 'la-chess',
    appId: '1:133539397387:web:0e25a8f20fd6e1a34fec0e'
  };
  if (!window.firebase || firebaseConfig.apiKey === 'PASTE_HERE') return; // not set up yet: local accounts keep working

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth(), db = firebase.firestore();
  const em = n => n.toLowerCase() + '@lachess.invalid';
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const cache = rec => { const all = get('lac-users', {}); all[rec.key] = rec; put('lac-users', all); put('lac-session', rec.key); };
  const load = async key => { const s = await db.collection('users').doc(key).get(); return s.exists ? s.data() : null; };

  window.Cloud = {
    async signup(name, pw) {
      if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return 'Username: 3-16 letters, numbers or _';
      if (pw.length < 6) return 'Password must be at least 6 characters';
      const key = name.toLowerCase();
      try { await auth.createUserWithEmailAndPassword(em(name), pw); }
      catch (e) { return e.code === 'auth/email-already-in-use' ? 'Account already made' : 'Sign-up failed (' + e.code + ')'; }
      const rec = { name, key, elo: key === 'mhflash' ? 6700 : 800, w: 0, l: 0, d: 0 };
      try { await db.collection('users').doc(key).set(rec); } catch (e) {}
      cache(rec);
      return null;
    },
    async login(name, pw) {
      try { await auth.signInWithEmailAndPassword(em(name), pw); }
      catch (e) { return 'Wrong username or password'; }
      const rec = await load(name.toLowerCase());
      if (!rec) return 'Account data not found';
      cache(rec);
      return null;
    },
    logout() { auth.signOut(); },
    saveElo(rec) {
      if (!auth.currentUser) return;
      db.collection('users').doc(rec.key).set({ name: rec.name, key: rec.key, elo: rec.elo, w: rec.w, l: rec.l, d: rec.d }).catch(() => {});
    }
  };

  // restore the session on page load / keep it in sync
  auth.onAuthStateChanged(async u => {
    if (!u) { put('lac-session', null); if (window.LA && window.LA.refresh) window.LA.refresh(); return; }
    const rec = await load(u.email.split('@')[0]);
    if (rec) { cache(rec); if (window.LA && window.LA.refresh) window.LA.refresh(); }
  });
})();

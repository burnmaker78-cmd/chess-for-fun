/* LAChess effects: sliding pieces, checkmate celebration, review badge styles. Load last. */
(function () {
  const $ = id => document.getElementById(id), G = () => window.getLAGame && window.getLAGame();

  const css = document.createElement('style');
  css.textContent = `
  .fx-mate{position:fixed;inset:0;z-index:300;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
  .fx-mate h1{font-size:clamp(2.4rem,9vw,5.5rem);margin:0;letter-spacing:.08em;color:#fff;text-shadow:0 0 30px #6c8cff,0 0 60px #c44dff;animation:mateIn .7s cubic-bezier(.2,1.4,.4,1) both,mateOut .6s ease 2.6s forwards}
  .fx-mate p{font-size:1.4rem;margin:6px 0 0;color:#f5c542;animation:mateIn .7s ease .15s both,mateOut .6s ease 2.6s forwards}
  @keyframes mateIn{from{transform:scale(.2) rotate(-8deg);opacity:0}to{transform:none;opacity:1}} @keyframes mateOut{to{opacity:0;transform:scale(1.4)}}
  .fx-c{position:absolute;top:-20px;width:10px;height:16px;border-radius:2px;animation:conf linear forwards}
  @keyframes conf{to{transform:translateY(110vh) rotate(720deg)}}
  .fx-shake{animation:shk .5s ease}
  @keyframes shk{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
  .rv-corner{position:absolute;top:-5px;right:-5px;width:36%;max-width:32px;z-index:4;pointer-events:none;filter:drop-shadow(0 1px 3px rgba(0,0,0,.7))}
  .rv-corner .bdg{width:100%;height:auto;display:block}
  .rv-brill{animation:brillPop .7s cubic-bezier(.2,1.6,.4,1)} @keyframes brillPop{from{transform:scale(0) rotate(-40deg)}to{transform:none}}
  .rv-burst{position:absolute;inset:-25%;border-radius:50%;border:3px solid #1baca6;box-shadow:0 0 18px #1baca6;pointer-events:none;z-index:3;animation:burst .9s ease-out forwards}
  .rv-burst.great{border-color:#5b8def;box-shadow:0 0 18px #5b8def}
  @keyframes burst{from{transform:scale(.3);opacity:1}to{transform:scale(1.9);opacity:0}}`;
  document.head.appendChild(css);

  /* ---------- sliding pieces ---------- */
  let lastKey = '';
  new MutationObserver(() => {
    const g = G();
    if (!g || !g.lastMove) return;
    const key = g.moves.length + ':' + g.lastMove.to.r + g.lastMove.to.c;
    if (key === lastKey) return;
    lastKey = key;
    if (window.__noSlide) { window.__noSlide = false; return; }   // piece was dragged: already in place
    const kids = $('board').children;
    if (kids.length < 64) return;
    const lab = kids[0].querySelector('.coord-rank'), flip = !!lab && lab.textContent === '1';
    const idx = (r, c) => (flip ? 7 - r : r) * 8 + (flip ? 7 - c : c);
    const to = kids[idx(g.lastMove.to.r, g.lastMove.to.c)], from = kids[idx(g.lastMove.from.r, g.lastMove.from.c)];
    const img = to && to.querySelector('.piece-img');
    if (!img || !from) return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    img.style.animation = 'none'; img.style.transition = 'none';
    img.style.position = 'relative'; img.style.zIndex = 6;
    img.style.transform = `translate(${a.left - b.left}px,${a.top - b.top}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { img.style.transition = 'transform .2s ease'; img.style.transform = 'none'; }));
  }).observe($('board'), { childList: true });

  /* ---------- checkmate celebration ---------- */
  setInterval(() => {
    const g = G();
    if (!g || !g.gameOver || g._fx) return;
    g._fx = true;
    const txt = $('gameover-text').textContent;
    if (!/Checkmate/i.test(txt)) return;
    const box = document.createElement('div');
    box.className = 'fx-mate';
    box.innerHTML = `<h1>CHECKMATE</h1><p>${txt.replace(/^Checkmate\s*—\s*/i, '')}</p>`;
    for (let i = 0; i < 46; i++) {
      const c = document.createElement('span');
      c.className = 'fx-c';
      c.style.cssText = `left:${Math.random() * 100}%;background:hsl(${Math.random() * 360},85%,60%);animation-duration:${1.8 + Math.random() * 1.6}s;animation-delay:${Math.random() * 0.6}s`;
      box.appendChild(c);
    }
    document.body.appendChild(box);
    $('board').classList.add('fx-shake');
    setTimeout(() => { box.remove(); $('board').classList.remove('fx-shake'); }, 3400);
  }, 300);
})();

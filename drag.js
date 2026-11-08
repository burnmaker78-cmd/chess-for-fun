/* LAChess: drag and drop pieces (click-to-move still works). */
(function () {
  const board = document.getElementById('board');
  if (!board) return;
  let src = null, ghost = null, dragging = false, startX = 0, startY = 0;

  const cell = e => {
    const b = board.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left) / b.width * 8), r = Math.floor((e.clientY - b.top) / b.height * 8);
    return (c < 0 || c > 7 || r < 0 || r > 7) ? -1 : r * 8 + c; // display index
  };
  const sq = i => board.children[i];
  const click = i => { const el = sq(i); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };

  board.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const i = cell(e), el = sq(i);
    if (i < 0 || !el || !el.querySelector('.piece-img')) return;
    src = i; startX = e.clientX; startY = e.clientY; dragging = false;
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (src === null) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
      dragging = true;
      click(src); // select the piece so legal-move dots appear
      const img = sq(src) && sq(src).querySelector('.piece-img');
      if (!img) { src = null; dragging = false; return; }
      const size = board.getBoundingClientRect().width / 8;
      ghost = img.cloneNode();
      ghost.style.cssText = `position:fixed;width:${size * 0.95}px;height:${size * 0.95}px;pointer-events:none;z-index:1000;transform:translate(-50%,-50%) scale(1.1);filter:drop-shadow(0 6px 8px rgba(0,0,0,.5));animation:none`;
      document.body.appendChild(ghost);
      img.style.visibility = 'hidden';
    }
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
  });

  window.addEventListener('mouseup', e => {
    if (src === null) return;
    const from = src, wasDragging = dragging;
    src = null; dragging = false;
    if (ghost) { ghost.remove(); ghost = null; }
    if (!wasDragging) return; // plain click: normal click handler runs
    const to = cell(e);
    if (to >= 0 && to !== from) click(to);       // drop on another square = attempt the move
    else { const el = sq(from), img = el && el.querySelector('.piece-img'); if (img) img.style.visibility = ''; }
  });
})();

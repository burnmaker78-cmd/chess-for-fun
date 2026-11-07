/* LAChess: right-click + drag to draw orange arrows, right-click a square for a circle. */
(function () {
  const board = document.getElementById('board');
  const wrap = document.getElementById('board-wrap');
  if (!board || !wrap) return;

  const NS = 'http://www.w3.org/2000/svg';
  const COLOR = '#f5a623';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 800 800');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5';
  wrap.style.position = 'relative';
  wrap.appendChild(svg);

  let arrows = [], start = null;
  const same = (a, b) => a.r === b.r && a.c === b.c;
  const ctr = s => ({ x: s.c * 100 + 50, y: s.r * 100 + 50 });

  function sqAt(e) {
    const b = board.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left) / b.width * 8);
    const r = Math.floor((e.clientY - b.top) / b.height * 8);
    return (c < 0 || c > 7 || r < 0 || r > 7) ? null : { r, c };
  }

  function add(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    svg.appendChild(el);
  }

  function drawArrow(from, to) {
    const p0 = ctr(from), p1 = ctr(to);
    const dr = Math.abs(to.r - from.r), dc = Math.abs(to.c - from.c);
    const knight = (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
    // knight moves bend in an L; everything else is straight
    const corner = knight ? (dc === 2 ? { x: p1.x, y: p0.y } : { x: p0.x, y: p1.y }) : p0;
    const from2 = knight ? corner : p0;
    const len = Math.hypot(p1.x - from2.x, p1.y - from2.y) || 1;
    const ux = (p1.x - from2.x) / len, uy = (p1.y - from2.y) / len;
    const head = 34, half = 20;
    const tip = { x: p1.x - ux * 6, y: p1.y - uy * 6 };
    const base = { x: tip.x - ux * head, y: tip.y - uy * head };
    const pts = knight ? `${p0.x},${p0.y} ${corner.x},${corner.y} ${base.x},${base.y}` : `${p0.x},${p0.y} ${base.x},${base.y}`;
    add('polyline', { points: pts, fill: 'none', stroke: COLOR, 'stroke-width': 14, 'stroke-linejoin': 'round', opacity: 0.85 });
    add('polygon', {
      points: `${tip.x},${tip.y} ${base.x - uy * half},${base.y + ux * half} ${base.x + uy * half},${base.y - ux * half}`,
      fill: COLOR, opacity: 0.85
    });
  }

  function draw() {
    svg.innerHTML = '';
    arrows.forEach(a => {
      if (same(a.from, a.to)) {
        const p = ctr(a.from);
        add('circle', { cx: p.x, cy: p.y, r: 44, fill: 'none', stroke: COLOR, 'stroke-width': 8, opacity: 0.85 });
      } else drawArrow(a.from, a.to);
    });
  }

  board.addEventListener('contextmenu', e => e.preventDefault());
  board.addEventListener('mousedown', e => {
    if (e.button === 2) { start = sqAt(e); e.preventDefault(); }
    else if (arrows.length) { arrows = []; draw(); }
  });
  window.addEventListener('mouseup', e => {
    if (e.button !== 2 || !start) return;
    const end = sqAt(e);
    if (end) {
      const i = arrows.findIndex(a => same(a.from, start) && same(a.to, end));
      if (i >= 0) arrows.splice(i, 1); else arrows.push({ from: start, to: end });
      draw();
    }
    start = null;
  });
  // clicking any button (new game, leave, etc.) wipes the arrows
  document.addEventListener('click', e => {
    if (!board.contains(e.target) && arrows.length) { arrows = []; draw(); }
  });
})();

(function () {
  'use strict';

  const tools = JSON.parse(document.getElementById('tools-data').textContent);

  // --- Jigsaw geometry ---
  function hEdge(x1, x2, y, outward, depth, a, normalSign) {
    if (outward === null) return `L ${x2} ${y}`;
    const dir = Math.sign(x2 - x1);
    const L = Math.abs(x2 - x1);
    const nx1 = x1 + dir * a * L;
    const nx2 = x1 + dir * (1 - a) * L;
    const rx = (L * (1 - 2 * a)) / 2;
    const ry = depth;
    const bulgeSign = outward ? normalSign : -normalSign;
    const sweep = (dir * bulgeSign) > 0 ? 1 : 0;
    return `L ${nx1} ${y} A ${rx} ${ry} 0 0 ${sweep} ${nx2} ${y} L ${x2} ${y}`;
  }

  function vEdge(y1, y2, x, outward, depth, a, normalSign) {
    if (outward === null) return `L ${x} ${y2}`;
    const dir = Math.sign(y2 - y1);
    const L = Math.abs(y2 - y1);
    const ny1 = y1 + dir * a * L;
    const ny2 = y1 + dir * (1 - a) * L;
    const rx = depth;
    const ry = (L * (1 - 2 * a)) / 2;
    const bulgeSign = outward ? normalSign : -normalSign;
    const sweep = (dir * bulgeSign) > 0 ? 0 : 1;
    return `L ${x} ${ny1} A ${rx} ${ry} 0 0 ${sweep} ${x} ${ny2} L ${x} ${y2}`;
  }

  function piecePath(x, y, w, h, sides, depth, a) {
    const top = hEdge(x, x + w, y, sides.top, depth, a, -1);
    const right = vEdge(y, y + h, x + w, sides.right, depth, a, 1);
    const bottom = hEdge(x + w, x, y + h, sides.bottom, depth, a, 1);
    const left = vEdge(y + h, y, x, sides.left, depth, a, -1);
    return `M ${x} ${y} ${top} ${right} ${bottom} ${left} Z`;
  }

  function cardPath(w, h, depth, a) {
    const sides = { top: true, right: false, bottom: true, left: false };
    return piecePath(0, 0, w, h, sides, depth * 0.6, a);
  }

  // --- Piece fills ---
  const brownsA = ['#5a3a2c', '#6b4636', '#7d5340', '#4a2f24'];
  const brownsB = ['#4a4034', '#5c5142', '#6d6250'];

  // --- Board build ---
  function buildBoard() {
    const cols = 4, rows = 3;
    const w = 220, h = 170, depth = 22, a = 0.34;
    const ox = 40, oy = 90;
    const groupGap = 44;

    const signH = [
      [1, -1, 1],
      [-1, 1, -1],
      [1, -1, 1],
    ];
    const signV = [
      [1, -1, 1, -1],
      [-1, 1, -1, 1],
    ];

    const isHeroCell = (rr, cc) => false;

    const svg = document.querySelector('[data-board-svg]');
    if (!svg) return;

    const boardW = ox * 2 + cols * w;
    const boardH = oy + rows * h + groupGap + 30;
    svg.setAttribute('viewBox', `0 0 ${boardW} ${boardH}`);

    // Group A (rows 0-1)
    const gA = svg.querySelector('[data-group="A"]');
    gA.setAttribute('x', ox - 14);
    gA.setAttribute('y', oy - 30);
    gA.setAttribute('width', cols * w + 28);
    gA.setAttribute('height', 2 * h + 16);
    const gAL = svg.querySelector('[data-group-label="A"]');
    gAL.setAttribute('x', ox - 14);
    gAL.setAttribute('y', oy - 40);

    // Group B (row 2, cols 0-2) — shifted down by groupGap
    const gB = svg.querySelector('[data-group="B"]');
    gB.setAttribute('x', ox - 14);
    gB.setAttribute('y', oy + 2 * h - 2 + groupGap);
    gB.setAttribute('width', 4 * w + 28);
    gB.setAttribute('height', h + 16);
    const gBL = svg.querySelector('[data-group-label="B"]');
    gBL.setAttribute('x', ox - 14);
    gBL.setAttribute('y', oy + 2 * h - 12 + groupGap);

    // Pieces
    const pieceNodes = svg.querySelectorAll('.piece');
    let idx = 0, idxA = 0, idxB = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (isHeroCell(r, c)) continue;
        const g = pieceNodes[idx];
        if (!g) { idx++; continue; }
        const tool = tools[idx];
        const x = ox + c * w;
        const y = oy + r * h + (r === 2 ? groupGap : 0);

        // Break interlock at the group A/B boundary (between row 1 and row 2).
        const atGroupBoundaryTop    = r === 2;
        const atGroupBoundaryBottom = r === 1;

        const sides = {
          top:    (r === 0        || isHeroCell(r - 1, c) || atGroupBoundaryTop)    ? null : (signV[r - 1] ? signV[r - 1][c] === -1 : null),
          bottom: (r === rows - 1 || isHeroCell(r + 1, c) || atGroupBoundaryBottom) ? null : (signV[r]     ? signV[r][c]     === 1  : null),
          left:   (c === 0        || isHeroCell(r, c - 1)) ? null : (signH[r][c - 1] === -1),
          right:  (c === cols - 1 || isHeroCell(r, c + 1)) ? null : (signH[r][c]     === 1),
        };

        const d = piecePath(x, y, w, h, sides, depth, a);
        const path = g.querySelector('[data-piece-path]');
        path.setAttribute('d', d);
        const fill = tool.group === 'A' ? brownsA[idxA++ % brownsA.length] : brownsB[idxB++ % brownsB.length];
        path.setAttribute('fill', fill);

        const label = g.querySelector('[data-piece-label]');
        label.setAttribute('x', x + w / 2 - 90);
        label.setAttribute('y', y + h / 2 - 12);

        // Entrance offsets
        const offX = (idx % 2 === 0 ? -1 : 1) * (40 + (idx % 3) * 14);
        const offY = (idx % 3 === 0 ? -1 : 1) * (30 + (idx % 4) * 10);
        g.style.transform = `translate(${offX}px, ${offY}px)`;
        g.style.opacity = '0';
        g.style.transitionDelay = `${idx * 60}ms`;
        g.setAttribute('data-mount', 'pending');

        idx++;
      }
    }

    // Trigger entrance stagger
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pieceNodes.forEach((g) => {
          g.style.transform = 'translate(0, 0)';
          g.style.opacity = '1';
          g.setAttribute('data-mount', 'ready');
        });
      });
    });
  }

  // --- Mobile cards ---
  function buildMobileCards() {
    const cards = document.querySelectorAll('[data-card-svg]');
    let idxA = 0, idxB = 0;
    const d = cardPath(150, 130, 22, 0.34);
    cards.forEach((svg) => {
      const idx = parseInt(svg.getAttribute('data-card-svg'), 10);
      const tool = tools[idx];
      const path = svg.querySelector('[data-card-path]');
      path.setAttribute('d', d);
      const fill = tool.group === 'A' ? brownsA[idxA++ % brownsA.length] : brownsB[idxB++ % brownsB.length];
      path.setAttribute('fill', fill);
    });
  }

  // --- Hero art ---
  function buildHero() {
    const a = 0.34, depth = 16;
    const base = piecePath(20, 20, 160, 150, { top: null, right: true, bottom: null, left: null }, depth, a);
    const floatA = piecePath(150, 10, 130, 110, { top: null, right: null, bottom: null, left: false }, depth, a);
    const floatB = piecePath(230, 190, 150, 130, { top: null, right: null, bottom: null, left: null }, depth, a);
    document.getElementById('hero-base').setAttribute('d', base);
    document.getElementById('hero-floatA').setAttribute('d', floatA);
    document.getElementById('hero-floatB').setAttribute('d', floatB);
  }

  // --- Modal ---
  const modal = document.querySelector('[data-modal]');
  const modalPanel = document.querySelector('[data-modal-panel]');
  const modalBadge = document.querySelector('[data-modal-badge]');
  const modalName = document.querySelector('[data-modal-name]');
  const modalDesc = document.querySelector('[data-modal-desc]');
  const modalGithub = document.querySelector('[data-modal-github]');
  const modalSite = document.querySelector('[data-modal-site]');

  function openModal(index) {
    const tool = tools[index];
    if (!tool) return;
    modalBadge.textContent = tool.group === 'A' ? 'Our tool' : 'External contribution';
    modalName.textContent = tool.name;
    modalDesc.textContent = tool.longDesc;
    modalGithub.href = tool.url;
    modalSite.href = tool.site;
    modalSite.innerHTML = `${tool.siteLabel} &rarr;`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  function wireModal() {
    document.querySelectorAll('[data-piece-index], [data-tool-slug]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const idx = parseInt(el.getAttribute('data-piece-index'), 10);
        if (!Number.isNaN(idx)) openModal(idx);
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    modalPanel.addEventListener('click', (e) => e.stopPropagation());
    document.querySelectorAll('[data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  // --- Init ---
  function init() {
    buildHero();
    buildMobileCards();
    buildBoard();
    wireModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

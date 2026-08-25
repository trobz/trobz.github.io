(function () {
  'use strict';

  const tools = JSON.parse(document.getElementById('tools-data').textContent);

  // A tool with no dedicated docs/site page yet falls back to the site
  // root as its `site` link — not worth its own "Website" button in the
  // modal, since it just points back to the page the visitor is already on.
  function hasRealSite(tool) {
    return Boolean(tool.site) && tool.site !== 'https://trobz.github.io/';
  }

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
    const cols = 4;
    const w = 220, h = 170, depth = 22, a = 0.34;
    const ox = 40, oy = 90;
    const groupGap = 74;

    const groupATools = tools.filter((t) => t.group === 'A');
    const groupBTools = tools.filter((t) => t.group === 'B');
    const rowsA = Math.max(1, Math.ceil(groupATools.length / cols));
    const rowsB = Math.max(1, Math.ceil(groupBTools.length / cols));
    const rows = rowsA + rowsB;

    // Alternating bump direction, checkerboarded across the whole grid so
    // adjoining pieces always interlock (this reproduces the previous
    // hand-written signH/signV tables for any grid size).
    const sign = (r, c) => ((r + c) % 2 === 0 ? 1 : -1);

    const svg = document.querySelector('[data-board-svg]');
    if (!svg) return;

    const boardW = ox * 2 + cols * w;
    const boardH = oy + rows * h + groupGap + 30;
    svg.setAttribute('viewBox', `0 0 ${boardW} ${boardH}`);

    // Group A. Height must clear the actual bottom of its last row (rowsA *
    // h below the box top, which sits 30 above the first row) plus a 14
    // bottom pad matching the 14 side pads (cols * w + 28) — using a flat
    // "+16" here (as if the box top had no extra headroom above row 0)
    // left the box 14 short, so the last row's pieces poked out past the
    // dashed line.
    const gA = svg.querySelector('[data-group="A"]');
    gA.setAttribute('x', ox - 14);
    gA.setAttribute('y', oy - 14);
    gA.setAttribute('width', cols * w + 28);
    gA.setAttribute('height', rowsA * h + 28);
    const gAL = svg.querySelector('[data-group-label="A"]');
    gAL.setAttribute('x', ox - 14);
    gAL.setAttribute('y', oy - 24);

    // Group B — shifted down by groupGap. Same 14-unit pad on all four
    // sides as group A.
    const gB = svg.querySelector('[data-group="B"]');
    gB.setAttribute('x', ox - 14);
    gB.setAttribute('y', oy + rowsA * h - 14 + groupGap);
    gB.setAttribute('width', cols * w + 28);
    gB.setAttribute('height', rowsB * h + 28);
    const gBL = svg.querySelector('[data-group-label="B"]');
    gBL.setAttribute('x', ox - 14);
    gBL.setAttribute('y', oy + rowsA * h - 24 + groupGap);

    const pieceNodes = svg.querySelectorAll('.piece');
    const browns = { A: brownsA, B: brownsB };
    const brownIdx = { A: 0, B: 0 };

    // Places one tool's piece at grid cell (r, c). rightExists/bottomExists
    // tell it whether a same-group neighbor actually sits there, so a
    // partial last row (group size not a multiple of `cols`) doesn't grow a
    // bump pointing into empty space.
    function place(tool, globalIndex, r, c, rightExists, bottomExists) {
      const g = pieceNodes[globalIndex];
      if (!g) return;
      const x = ox + c * w;
      const y = oy + r * h + (r >= rowsA ? groupGap : 0);

      // Break interlock at the group A/B boundary.
      const atGroupBoundaryTop    = r === rowsA;
      const atGroupBoundaryBottom = r === rowsA - 1;

      const sides = {
        top:    (r === 0        || atGroupBoundaryTop)    ? null : sign(r - 1, c) === -1,
        bottom: (r === rows - 1 || atGroupBoundaryBottom || !bottomExists) ? null : sign(r, c) === 1,
        left:   (c === 0) ? null : sign(r, c - 1) === -1,
        right:  (c === cols - 1 || !rightExists) ? null : sign(r, c) === 1,
      };

      const d = piecePath(x, y, w, h, sides, depth, a);
      const path = g.querySelector('[data-piece-path]');
      path.setAttribute('d', d);
      path.setAttribute('fill', browns[tool.group][brownIdx[tool.group]++ % browns[tool.group].length]);

      const label = g.querySelector('[data-piece-label]');
      label.setAttribute('x', x + w / 2 - 90);
      label.setAttribute('y', y + h / 2 - 12);
    }

    groupATools.forEach((tool, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      place(tool, i, r, c, c < cols - 1 && i + 1 < groupATools.length, i + cols < groupATools.length);
    });

    groupBTools.forEach((tool, i) => {
      const r = rowsA + Math.floor(i / cols);
      const c = i % cols;
      place(tool, groupATools.length + i, r, c, c < cols - 1 && i + 1 < groupBTools.length, i + cols < groupBTools.length);
    });

    watchScrollAssembly(pieceNodes);
  }

  // Ties each piece's position/opacity directly to scroll progress through the
  // board section, so the puzzle assembles and disassembles as the user scrolls
  // (rather than playing a one-shot entrance animation).
  function watchScrollAssembly(pieceNodes) {
    const target = document.querySelector('.board__desktop') || document.getElementById('board');
    if (!target) return;

    const total = pieceNodes.length;
    const offsets = Array.from(pieceNodes).map((g, i) => {
      const idx = parseInt(g.getAttribute('data-piece-index'), 10);
      const n = Number.isNaN(idx) ? i : idx;
      return {
        offX: (n % 2 === 0 ? -1 : 1) * (40 + (n % 3) * 14),
        offY: (n % 3 === 0 ? -1 : 1) * (30 + (n % 4) * 10),
      };
    });

    let ticking = false;

    function update() {
      ticking = false;
      const rect = target.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;

      // 0 when the piece grid's top is at the bottom of the viewport, 1 once
      // the grid's own center reaches the viewport's center (fully
      // assembled/stable). Stays at 1 once scrolled past that point.
      const targetCenter = rect.top + rect.height / 2;
      const viewportCenter = vh / 2;
      const maxDistance = vh / 2 + rect.height / 2;
      const distance = targetCenter - viewportCenter;
      const raw = 1 - distance / maxDistance;
      const progress = Math.min(Math.max(raw, 0), 1);

      pieceNodes.forEach((g, i) => {
        // Stagger: each piece needs a slightly later slice of the scroll
        // range to assemble, so pieces settle in a wave rather than at once.
        const start = (i / total) * 0.5;
        const p = Math.min(Math.max((progress - start) / (1 - start), 0), 1);
        const { offX, offY } = offsets[i];
        g.style.transform = `translate(${offX * (1 - p)}px, ${offY * (1 - p)}px)`;
        g.style.opacity = String(0.15 + 0.85 * p);
      });
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
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
  const modalShot = document.querySelector('[data-modal-shot]');

  function openModal(index) {
    const tool = tools[index];
    if (!tool) return;
    modalBadge.textContent = tool.group === 'A' ? 'Our tool' : 'External contribution';
    modalName.textContent = tool.name;
    modalDesc.innerHTML = '';
    const descP = document.createElement('p');
    descP.textContent = tool.longDesc;
    modalDesc.appendChild(descP);
    if (Array.isArray(tool.features) && tool.features.length) {
      const ul = document.createElement('ul');
      ul.className = 'modal__features';
      tool.features.forEach((feature) => {
        const li = document.createElement('li');
        li.textContent = feature;
        ul.appendChild(li);
      });
      modalDesc.appendChild(ul);
    }
    modalGithub.href = tool.url;
    modalGithub.innerHTML = `View on ${tool.repoLabel || 'GitHub'} &rarr;`;
    if (hasRealSite(tool)) {
      modalSite.href = tool.site;
      modalSite.innerHTML = `${tool.siteLabel} &rarr;`;
      modalSite.style.display = '';
    } else {
      modalSite.style.display = 'none';
    }
    if (tool.shot) {
      modalShot.innerHTML = `<img class="modal__shot-img" src="/${tool.shot}" alt="${tool.name} screenshot">`;
      modalShot.hidden = false;
    } else {
      modalShot.innerHTML = '';
      modalShot.hidden = true;
    }
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

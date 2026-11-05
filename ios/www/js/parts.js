// Workshop Navigator: part images (Bolt Depot catalog thumbnails, one per fastener type).
// Rules are checked against the item NAME first, then its CATEGORY. First match wins.
// An item can override with its own `img` field (a file name in img/fasteners/).
(function () {
  const DIR = 'img/fasteners/';
  // Items Bolt Depot does not sell: no image rather than a wrong one.
  const NOT_SOLD = /faucet|o-ring|wire nut|lever connector|butt connector|terminal|heat[- ]?shrink|\bsprings?\b(?! pin)|bumper|vacuum cap|push retainer|e-clip|retaining ring|clevis|hitch pin/i;
  const RULES = [
    [/self[- ]?drilling drywall anchor/i, 'self-drilling-drywall-anchor.png', 'Self drilling drywall anchor'],
    [/plastic anchor|conical anchor|drywall anchor/i, 'conical-anchors.gif', 'Conical plastic anchor'],
    [/toggle/i, 'toggle-wing.png', 'Spring toggle wing'],
    [/sleeve anchor/i, 'sleeve-anchors.gif', 'Sleeve anchor'],
    [/concrete screw|tapcon/i, 'concrete-screws.gif', 'Concrete screw'],
    [/\btek\b|self[- ]?drill/i, 'sheet-metal-screw-hex-washer-self-drilling.png', 'Self drilling sheet metal screw, hex washer'],
    [/sheet metal|self[- ]?tap/i, 'sheet-metal-screw-phillips-pan.png', 'Sheet metal screw, Phillips pan (self tapping)'],
    [/grease fitting|zerk/i, 'grease-fitting-straight.png', 'Grease fitting'],
    [/flange bolt/i, 'hex-flange-bolt-smooth-indented-partial-thread-din6921.gif', 'Flange bolt'],
    [/flange nut/i, 'hex-flange-nut-din6923.gif', 'Flange nut'],
    [/acorn nut|cap nut/i, 'acorn-nut.png', 'Acorn nut'],
    [/jam nut/i, 'hex-jam-nut.png', 'Hex jam nut'],
    [/nyloc|nylon[- ]insert|lock ?nut/i, 'hex-nylock-nut.png', 'Nylon insert lock nut'],
    [/cotter pin/i, 'cotter-pin.png', 'Cotter pin'],
    [/roll pin|spring pin/i, 'slotted-spring-pin.png', 'Slotted spring (roll) pin'],
    [/thumb screw/i, 'thumb-screw-spade.png', 'Thumb screw, spade'],
    [/rivet/i, 'rivet-dome-head.png', 'Blind rivet, dome head'],
    [/threaded rod|all[- ]?thread/i, 'threaded-rod.png', 'Threaded rod'],
    [/socket[- ]head|cap screw/i, 'socket-head-smooth.png', 'Socket head cap screw'],
    [/structural|timber screw/i, 'timber-screw-simpson-sdws-star-flat.png', 'Structural timber screw'],
    [/wood screw/i, 'wood-screw-phillips-flat.png', 'Wood screw, Phillips flat'],
    [/lock washer/i, 'lock-washer.png', 'Split lock washer'],
    [/washer/i, 'flat-washer.png', 'Flat washer'],
    [/hex nut/i, (t) => /nylon/i.test(t) || !/#\d/.test(t) ? 'hex-nut.png' : 'hex-machine-screw-nut.png', 'Hex nut'],
    [/machine screw/i, (t) => /\bM\d/.test(t) ? 'machine-screw-phillips-pan-metric.png' : 'machine-screw-phillips-pan.png', 'Machine screw, Phillips pan'],
    [/hex bolt/i, 'hex-bolts-standard.png', 'Hex bolt'],
  ];
  function find(text) {
    for (const [rx, file, label] of RULES) if (rx.test(text)) return { file: typeof file === 'function' ? file(text) : file, label };
    return null;
  }
  function lookup(item) {
    if (!item) return null;
    const name = String(item.name || item.n || item.item || ''), cat = String(item.category || item.c || item.fam || '');
    if (item.img) return { src: DIR + item.img, label: 'Custom image' };
    if (NOT_SOLD.test(name)) return null;
    const hit = find(name) || (NOT_SOLD.test(cat) ? null : find(cat));
    return hit ? { src: DIR + hit.file, label: hit.label } : null;
  }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // HTML for a thumbnail tile. Missing images get a neutral placeholder so rows stay aligned.
  function thumb(item, cls) {
    const hit = lookup(item);
    if (!hit) return `<span class="pthumb none ${cls || ''}" title="Bolt Depot doesn't sell this part" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M9 12h6"/></svg></span>`;
    const name = String(item.name || item.n || item.item || '');
    return `<span class="pthumb ${cls || ''}"><img src="${esc(hit.src)}" alt="${esc(hit.label)}" title="Click to enlarge" data-name="${esc(name)}" data-label="${esc(hit.label)}" loading="lazy" decoding="async"></span>`;
  }

  // ---------- click a thumbnail to see it large; zoom up to 100x (wheel, pinch, +/- or double-click), drag to pan.
  // Opens instantly (no animation). Clicking anywhere except the picture or its controls closes it.
  const MAXZ = 100;
  const css = document.createElement('style');
  css.textContent = `.pthumb img{cursor:zoom-in}
.pzoom{position:fixed;inset:0;z-index:9999;background:rgba(18,45,75,.6);display:none;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
.pzoom.on{display:flex}
.pzoom-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;max-width:96vw}
.pzoom-view{position:relative;width:min(900px,92vw);height:min(560px,62vh);background:#fff;border-radius:12px;overflow:hidden;touch-action:none;cursor:grab;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.pzoom-view.drag{cursor:grabbing}
.pzoom-view img{position:absolute;left:0;top:0;transform-origin:0 0;max-width:none;user-select:none;-webkit-user-drag:none;pointer-events:none}
.pzoom-view img.px{image-rendering:pixelated}
.pzoom-bar{display:flex;align-items:center;gap:8px;background:#fff;border-radius:999px;padding:5px 6px 5px 14px;box-shadow:0 8px 30px rgba(0,0,0,.25);color:#15243a;max-width:92vw}
.pzoom-text{min-width:0;display:flex;flex-direction:column;line-height:1.2;margin-right:6px}
.pzoom-name{font-weight:700;font-size:14px;color:#14375c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}
.pzoom-label{font-size:11px;color:#708196;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}
.pzoom-bar button{height:34px;min-width:34px;border-radius:999px;border:1px solid #dce4ee;background:#fff;color:#14375c;font:600 16px/1 Inter,system-ui,sans-serif;cursor:pointer;padding:0 10px}
.pzoom-bar button:hover{background:#f3f6fa}
.pzoom-pct{font:600 13px Inter,system-ui,sans-serif;color:#465d74;min-width:52px;text-align:center}`;
  document.head.appendChild(css);
  let box = null, view = null, im = null, lastFocus = null;
  const Z = { fit: 1, z: 1, x: 0, y: 0, nw: 0, nh: 0 };
  function apply() {
    const sc = Z.fit * Z.z;
    im.style.transform = `translate(${Z.x}px,${Z.y}px) scale(${sc})`;
    im.classList.toggle('px', Z.z >= 2);
    box.querySelector('.pzoom-pct').textContent = (Z.z < 10 ? Z.z.toFixed(1).replace(/\.0$/, '') : Math.round(Z.z)) + '×';
  }
  function clampPan() {
    const vw = view.clientWidth, vh = view.clientHeight, w = Z.nw * Z.fit * Z.z, h = Z.nh * Z.fit * Z.z;
    Z.x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, Z.x));
    Z.y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, Z.y));
  }
  function zoomAt(nz, cx, cy) {
    nz = Math.max(1, Math.min(MAXZ, nz));
    const r = nz / Z.z; Z.x = cx - (cx - Z.x) * r; Z.y = cy - (cy - Z.y) * r; Z.z = nz; clampPan(); apply();
  }
  function reset() {
    const vw = view.clientWidth, vh = view.clientHeight;
    Z.nw = im.naturalWidth || 175; Z.nh = im.naturalHeight || 60;
    Z.fit = Math.min((vw * 0.86) / Z.nw, (vh * 0.86) / Z.nh); Z.z = 1; clampPan(); apply();
  }
  function ensureBox() {
    if (box) return box;
    box = document.createElement('div');
    box.className = 'pzoom'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Part image');
    box.innerHTML = '<div class="pzoom-card"><div class="pzoom-view"><img alt=""></div><div class="pzoom-bar"><div class="pzoom-text"><span class="pzoom-name"></span><span class="pzoom-label"></span></div><button type="button" data-z="out" aria-label="Zoom out">&minus;</button><span class="pzoom-pct">1×</span><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="fit" aria-label="Fit to window">Fit</button><button type="button" data-z="close" aria-label="Close">&times;</button></div></div>';
    view = box.querySelector('.pzoom-view'); im = view.querySelector('img');
    im.addEventListener('load', reset);
    // close on any click that isn't on the picture area or the control bar
    box.addEventListener('click', (e) => { if (!e.target.closest('.pzoom-view') && !e.target.closest('.pzoom-bar')) close(); });
    box.querySelector('.pzoom-bar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      const cx = view.clientWidth / 2, cy = view.clientHeight / 2, k = b.dataset.z;
      if (k === 'in') zoomAt(Z.z * 2, cx, cy); else if (k === 'out') zoomAt(Z.z / 2, cx, cy); else if (k === 'fit') reset(); else close();
    });
    view.addEventListener('wheel', (e) => {
      e.preventDefault(); const r = view.getBoundingClientRect();
      zoomAt(Z.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    view.addEventListener('dblclick', (e) => { const r = view.getBoundingClientRect(); zoomAt(Z.z < 2 ? 4 : 1, e.clientX - r.left, e.clientY - r.top); });
    // drag to pan, two fingers to pinch-zoom
    const pts = new Map(); let pinch = null, lastTap = 0;
    view.addEventListener('pointerdown', (e) => {
      view.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); view.classList.add('drag');
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: Z.z }; }
      if (e.pointerType === 'touch' && pts.size === 1) { const t = Date.now(); if (t - lastTap < 300) { const r = view.getBoundingClientRect(); zoomAt(Z.z < 2 ? 4 : 1, e.clientX - r.left, e.clientY - r.top); } lastTap = t; }
    });
    view.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = { x: e.clientX, y: e.clientY }; pts.set(e.pointerId, cur);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()], r = view.getBoundingClientRect();
        zoomAt(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      } else if (pts.size === 1) { Z.x += cur.x - prev.x; Z.y += cur.y - prev.y; clampPan(); apply(); }
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) view.classList.remove('drag'); };
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    window.addEventListener('resize', () => { if (box.classList.contains('on')) reset(); });
    document.body.appendChild(box);
    return box;
  }
  function open(img) {
    const b = ensureBox();
    lastFocus = document.activeElement;
    b.classList.add('on');
    b.querySelector('.pzoom-name').textContent = img.dataset.name || '';
    b.querySelector('.pzoom-label').textContent = (img.dataset.label || '') + ' · Bolt Depot';
    im.alt = img.dataset.label || '';
    const src = img.getAttribute('src');
    if (im.getAttribute('src') !== src) { im.style.transform = 'scale(0)'; im.src = src; if (im.complete && im.naturalWidth) reset(); } else reset();
    b.querySelector('[data-z="close"]').focus({ preventScroll: true });
  }
  function close() { if (!box) return; box.classList.remove('on'); if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch { } }
  // pointerdown (capture) opens it at once and stops the row underneath from reacting to the click
  let opening = false;
  window.addEventListener('pointerdown', (e) => {
    const img = e.target.closest && e.target.closest('.pthumb img');
    if (!img || (box && box.contains(img)) || e.button > 0 || img.closest('.pbtn')) return; // Checklist photo button handles its own taps
    e.preventDefault(); e.stopPropagation(); opening = true; open(img);
  }, true);
  window.addEventListener('click', (e) => {
    const img = e.target.closest && e.target.closest('.pthumb img');
    if (img && img.closest('.pbtn') && !opening) return;
    if (opening || (img && !(box && box.contains(img)))) { e.preventDefault(); e.stopPropagation(); if (!opening && img) open(img); opening = false; }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!box || !box.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') zoomAt(Z.z * 2, view.clientWidth / 2, view.clientHeight / 2);
    else if (e.key === '-') zoomAt(Z.z / 2, view.clientWidth / 2, view.clientHeight / 2);
    else if (e.key === '0') reset();
  });
  // warm the cache so a picture opens with no delay
  window.addEventListener('load', () => { setTimeout(() => { new Set([...document.querySelectorAll('.pthumb img')].map(i => i.getAttribute('src'))).forEach(src => { const p = new Image(); p.src = src; }); }, 800); });

  window.WNParts = { lookup, thumb, RULES, NOT_SOLD, open, close, zoom: Z };
})();

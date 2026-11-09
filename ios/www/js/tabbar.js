// 10.21: the bottom bar for both pages (Workshop and Checklist).
// A navy bar docked to the bottom of the screen with Home · Parts · Storage · Tools · Checklist. The tab you're on lifts into a
// small round "bubble" sitting in a hole cut out of the top edge; changing tabs slides the bubble and the notch across with a little spring.
// A round + floating above the bar, bottom right: the bar's blue rises into a panel of actions (Scan, Add part, Alerts, labels, Settings, Theme).
// The theme (Light / Dark / Same as phone) is saved on this device and applied before the page paints (see the <head> script).
(function () {
  const SVG = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h5v-5h3v5h5V10"/>',
    parts: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    storage: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-.6-.6-2.3z"/>',
    checklist: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 11.5l1.5 1.5 3-3M8.5 16.5h7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    add: '<path d="M12 5v14M5 12h14"/>', label: '<path d="M3 7.5V4.5A1.5 1.5 0 0 1 4.5 3h3L20 15.5 15.5 20 3 7.5z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h17M12 3.5v17"/>', scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>', low: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17v.01"/>', cube: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>', wand: '<path d="M4 20 15 9M14 4v3M12.5 5.5h3M19 9v2M18 10h2M18.5 3.5v1.5M17.75 4.25h1.5"/><path d="m13.5 7.5 3 3"/>', print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>', list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>', lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/>', pen: '<path d="M12 20h8"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.9a.5.5 0 0 1-.6-.6l.9-2.9a2 2 0 0 1 .5-.9z"/>', sort: '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/>', logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'
  };
  const ic = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${SVG[k] || ''}</svg>`;
  // ---- theme
  const TKEY = 'wn-theme';
  const getTheme = () => { try { return localStorage.getItem(TKEY) || 'light'; } catch (e) { return 'light'; } };
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme(t) {
    t = t || getTheme();
    const dark = t === 'dark' || (t === 'system' && mq && mq.matches);
    document.documentElement.classList.toggle('dark', dark);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? '#0d0f12' : '#ffffff';
    try { const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wn; if (window.WNNative && h) { const r = h.postMessage({ cmd: 'chrome', dark }); if (r && r.catch) r.catch(() => { }); } } catch (e) { }   // iPhone app: status bar + background
  }
  function setTheme(t) { try { localStorage.setItem(TKEY, t); } catch (e) { } applyTheme(t); paintTheme(); }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => applyTheme());
  window.addEventListener('storage', (e) => { if (e.key === TKEY) { applyTheme(); paintTheme(); } });
  applyTheme();

  let nav, bub, menu, plus, page;
  const CSS = `
.wnbar,.wnbar *,.wnbub,.wnplus{touch-action:none}
/* motion — measured from the reference videos: the bubble glides ~0.34s (fast start, smooth stop, no bounce);
   the + panel springs up fast with a tiny settle (~3%) and drops back quickly. Everything runs as CSS transitions on transform/opacity,
   which the phone animates on its own (GPU) — so it stays smooth even while the page underneath is busy redrawing.
   (older curves kept below) motion: real spring curves, like iOS (the bar: soft, almost no bounce; the + panel: a touch livelier). Phones without linear() get a close curve. */
:root{--wnspr:cubic-bezier(.25,1,.35,1);--wnpop:cubic-bezier(.3,1.15,.4,1);--wnglide:cubic-bezier(.2,.75,.3,1);--wnopen:cubic-bezier(.25,1.1,.4,1);--wnclose:cubic-bezier(.45,0,.2,1)}
@supports (transition-timing-function:linear(0,1)){:root{--wnopen:linear(0.0,0.0446,0.1506,0.2854,0.4266,0.5601,0.6779,0.7763,0.8549,0.9148,0.9584,0.9885,1.0078,1.0189,1.0242,1.0254,1.024,1.0212,1.0177,1.0142,1.0108,1.0079,1.0054,1.0035,1.002,1.001,1.0002,0.9998,0.9995,0.9994,0.9994,0.9994,0.9995,0.9996,0.9997,0.9997,0.9998,0.9999,0.9999,1.0,1)}}
@supports (transition-timing-function:linear(0,1)){:root{--wnspr:linear(0,0.0288,0.1,0.1951,0.3008,0.4077,0.5096,0.6028,0.6853,0.7563,0.816,0.865,0.9044,0.9353,0.9591,0.9769,0.9898,0.9988,1.0048,1.0084,1.0103,1.0111,1.0109,1.0103,1.0093,1.0081,1.0069,1.0058,1.0047,1.0038,1.0029,1.0022,1.0017,1.0012,1.0008,1.0005,1);--wnpop:linear(0,0.0329,0.1136,0.2204,0.3378,0.4548,0.5643,0.6623,0.7467,0.8172,0.8743,0.9191,0.9533,0.9783,0.996,1.0077,1.0148,1.0186,1.0199,1.0195,1.0181,1.016,1.0137,1.0114,1.0091,1.0071,1.0054,1.0039,1.0027,1.0018,1.0011,1.0005,1.0001,0.9999,0.9997,0.9996,1)}}
/* no grey/dark flash when anything is tapped (iOS draws one by default) */
html{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}input,textarea,select,[contenteditable],[contenteditable] *{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}img{-webkit-user-drag:none;-webkit-touch-callout:none}:focus:not(:focus-visible){outline:none}
/* docked to the very bottom of the screen, full width, rounded top corners (the home-bar area is part of it) */
.wnbar .tabbar{transform:translateZ(0);-webkit-backface-visibility:hidden;backface-visibility:hidden;background:none!important;border:0!important;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;position:fixed;z-index:910;left:0;right:0;bottom:0;height:calc(60px + env(safe-area-inset-bottom));padding:0 max(6px,env(safe-area-inset-right)) env(safe-area-inset-bottom) max(6px,env(safe-area-inset-left));display:flex;justify-content:center;align-items:stretch;overflow:hidden;border-radius:22px 22px 0 0;isolation:isolate}
/* the navy fill is a wide strip with a round hole cut at its centre (soft rounded corners where it meets the top edge) — a real cut-out, the page shows through.
   Sliding the strip (transform only — done by the GPU) moves the hole, so it never stutters. The hole's shape is drawn by the script (an SVG mask). */
.wnbar .tabbar .wbg{position:absolute;top:0;left:0;height:100%;width:calc(200vw + 80px);background:var(--brand,#173a5c);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:0 0;mask-position:0 0;transform:translate3d(0px,0,0);transition:transform .34s var(--wnglide);will-change:transform;pointer-events:none;z-index:0}
.wnbar .tabbar a{-webkit-user-drag:none;-webkit-touch-callout:none;position:relative;z-index:1;flex:1;max-width:120px;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#a9bfd4;text-decoration:none;font-size:10.5px;font-weight:700;letter-spacing:.1px;touch-action:manipulation}
.wnbar .tabbar a svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;transition:opacity .15s,transform .34s var(--wnglide)}
.wnbar .tabbar a.on{color:#fff}.wnbar .tabbar a.on svg{opacity:0;transform:translateY(-14px)}
.wnbar .tabbar a.on span{transform:translateY(7px)}.wnbar .tabbar a span{transition:transform .34s var(--wnglide)}
.wnbar .tabbar a span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
/* the bubble: sits in the hole with a thin gap all round */
.wnbub{position:fixed;z-index:911;width:46px;height:46px;border-radius:50%;background:var(--brand,#173a5c);color:#fff;display:grid;place-items:center;pointer-events:none;
  bottom:calc(env(safe-area-inset-bottom) + 60px - 23px);left:0;transform:translate3d(-200px,0,0);transition:transform .34s var(--wnglide),opacity .2s;will-change:transform}
.wnbub svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;animation:wnpop .32s ease-out}
@keyframes wnblink{0%{transform:scale(1);opacity:1}35%{transform:scale(.72);opacity:.35}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}.wnbub svg.wnblink{animation:wnblink .3s cubic-bezier(.3,.7,.4,1)}
@keyframes wnpop{0%{transform:scale(.6);opacity:.2}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
/* the +, floating above the bar at the right. When it opens, the bar's blue grows up into a panel and the + rides up with it, turning into × */
.wnplus{position:fixed;z-index:912;right:max(16px,env(safe-area-inset-right));bottom:calc(env(safe-area-inset-bottom) + 60px + 32px);width:58px;height:58px;border-radius:50%;border:0;padding:0;background:var(--brand,#173a5c);color:#fff;display:grid;place-items:center;box-shadow:0 10px 24px -10px rgba(0,0,0,.55);touch-action:manipulation;will-change:transform;transition:background-color .25s,box-shadow .25s}
.wnplus svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
.wnplus.open{background:rgba(255,255,255,.14);box-shadow:none}
.wnplus.press{background:#fff!important;color:var(--brand,#173a5c)!important;transition:background-color .05s,color .05s}
/* the panel: same navy as the bar, rises from behind it */
.wnmenu{position:fixed;z-index:909;left:0;right:0;bottom:0;overflow:hidden;background:var(--brand,#173a5c);color:#fff;border-radius:28px 28px 0 0;padding:18px max(16px,env(safe-area-inset-right)) calc(60px + env(safe-area-inset-bottom) + 18px) max(16px,env(safe-area-inset-left));transform:translate3d(0,110%,0);visibility:hidden;will-change:transform;touch-action:none;box-shadow:0 -18px 50px -20px rgba(0,0,0,.55)}
.wnmenu .in{max-width:520px;margin:0 auto;opacity:0;filter:blur(10px);transition:opacity .12s ease-in,filter .14s ease-in;will-change:transform,opacity}
.wnmenu.show .in{opacity:1;filter:none;transition:opacity .18s ease-out .04s,filter .24s ease-out .04s}
.wnbar .tabbar a{transition:opacity .16s,filter .2s}.wnbar.merge .tabbar a{opacity:0;filter:blur(6px);pointer-events:none}.wnbub.merge{opacity:0!important}
.wnbar.merge .tabbar{border-radius:0}.wnbar.merge .tabbar .wbg{-webkit-mask-image:none!important;mask-image:none!important}
.wnmenu .hd{display:flex;align-items:center;height:58px;margin:-2px 0 12px}.wnmenu .hd b{font-size:20px;font-weight:800;letter-spacing:-.3px}
.wnmenu .grab{position:absolute;top:7px;left:50%;width:38px;height:5px;margin-left:-19px;border-radius:3px;background:rgba(255,255,255,.28)}
.wnmenu .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 10px}
.wnmenu .mi{display:flex;flex-direction:column;align-items:center;gap:7px;padding:0;border:0;background:none;font:inherit;font-size:12px;font-weight:650;line-height:1.2;color:#c9d9ea;text-decoration:none;text-align:center;touch-action:manipulation}
.wnmenu .mi i{display:grid;place-items:center;width:100%;max-width:84px;aspect-ratio:1;border-radius:20px;background:rgba(255,255,255,.1);transition:transform .14s,background-color .14s}
.wnmenu .mi i{transition:transform .18s cubic-bezier(.3,1.4,.5,1),background-color .22s ease-out}.wnmenu .mi svg{transition:stroke .22s ease-out}
.wnmenu .mi.hl i{background:rgba(255,255,255,.92);transform:scale(.94);transition:transform .1s ease-out,background-color .06s}.wnmenu .mi.hl svg{stroke:var(--brand,#173a5c);transition:stroke .06s}
@media (hover:hover){.wnmenu .mi:hover i{background:rgba(255,255,255,.16)}}
.wnmenu .mi svg{width:27px;height:27px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}

.wnmenu .th{display:flex;align-items:center;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.12)}.wnmenu .th b{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;flex:none}.wnmenu .th b svg{width:20px;height:20px;fill:none;stroke:#c9d9ea;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.wnmenu .seg{flex:1;display:flex;background:rgba(255,255,255,.1);border-radius:12px;padding:3px}.wnmenu .seg button{flex:1;border:0;background:none;border-radius:9px;padding:8px 2px;font:inherit;font-size:13px;font-weight:700;color:#c9d9ea}
.wnmenu .seg button.on{background:#fff;color:var(--brand,#173a5c)}
.wnmenu .mi.app-only{display:none!important}.native .wnmenu .mi.app-only,.webcam .wnmenu .mi.app-only,.wn-canscan .wnmenu .mi.app-only{display:flex!important}.native .wnmenu .mi.web-only{display:none!important}.wnmenu .mi.nat-only{display:none!important}.native .wnmenu .mi.nat-only{display:flex!important}
.wnscrim{position:fixed;inset:0;z-index:908;background:rgba(6,12,20,.45);opacity:0;will-change:opacity}.wnscrim[hidden]{display:none}
@media (prefers-reduced-motion:reduce){.wnbar .tabbar a svg,.wnbar .tabbar a span,.wnmenu,.wnmenu .in,.wnscrim,.wnplus,.wnplus svg,.wnbar .tabbar .wbg,.wnbub{transition:none!important}.wnbub svg{animation:none!important}}
@media print{.wnbar,.wnbub,.wnplus,.wnmenu{display:none!important}}`;

  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let half = 0, g = null, placed = false;
  // put the bubble + hole on a tab. CSS animates the move (GPU); `instant` skips the animation (first paint, resize)
  function place(x, navL, instant) {
    if (instant) { g.style.transition = bub.style.transition = 'none'; }
    g.style.transform = `translate3d(${(x - half).toFixed(1)}px,0,0)`;
    bub.style.transform = `translate3d(${(navL + x - 23).toFixed(1)}px,0,0)`;
    if (instant) { void bub.offsetWidth; g.style.transition = bub.style.transition = ''; }
  }
  // the hole: a circle (radius 26.5 → a thin 3.5px gap round the 46px bubble) with small rounded corners where it meets the bar's top edge
  function holeMask(el, W) {
    const R = 26.5, f = 9, cx = W / 2, d = Math.sqrt((R + f) ** 2 - f ** 2), k = R / (R + f), tx = d * k, ty = f * k;
    const path = `M0 0H${(cx - d).toFixed(2)}A${f} ${f} 0 0 1 ${(cx - tx).toFixed(2)} ${ty.toFixed(2)}A${R} ${R} 0 0 0 ${(cx + tx).toFixed(2)} ${ty.toFixed(2)}A${f} ${f} 0 0 1 ${(cx + d).toFixed(2)} 0H${W}V400H0Z`;
    const url = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='400'><path d='${path}'/></svg>`)}")`;
    el.style.webkitMaskImage = url; el.style.maskImage = url; el.style.webkitMaskSize = el.style.maskSize = `${W}px 400px`;
  }
  function setIcon(k) { if (bub.dataset.k !== k) { bub.dataset.k = k; bub.innerHTML = ic(k); } }
  function sync(instant) {
    if (!nav) return;
    if (!g) g = nav.querySelector('.wbg');
    if (!half) { half = g.offsetWidth / 2; holeMask(g, half * 2); }
    const a = nav.querySelector('a.on'), nr = nav.getBoundingClientRect();
    if (!a) { bub.style.opacity = '0'; g.style.transform = 'translate3d(0px,0,0)'; placed = false; return; }
    const ar = a.getBoundingClientRect();
    bub.style.opacity = '1'; setIcon(a.dataset.tab);
    place(ar.left - nr.left + ar.width / 2, nr.left, instant === true || !placed); placed = true;
  }
  function paintTheme() {
    if (!menu) return; const t = getTheme();
    menu.querySelectorAll('[data-theme]').forEach(b => { const on = b.dataset.theme === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  // ---- the + panel: the bar's blue rises into a panel (the + rides up with it, turning into ×). Opening/closing are CSS
  // transitions (GPU); while your finger drags the panel it follows the finger exactly, and on release it springs open or drops closed.
  const sh = { y: null, drag: false, H: 1, lift: 0 }; let inEl = null, hideT = 0;
  const TR = { open: '.62s var(--wnopen)', close: '.24s var(--wnclose)', none: '0s' };
  function shSet(y, mode) {
    sh.y = y; const p = Math.max(0, 1 - y / sh.H), t = TR[mode] || TR.none;
    if (!inEl) inEl = menu.querySelector('.in');
    menu.style.transition = inEl.style.transition = plus.style.transition = `transform ${t}`;
    plus.firstElementChild.style.transition = `transform ${t}`;
    scrim.style.transition = `opacity ${mode === 'close' ? '.22s ease-out' : mode === 'open' ? '.3s ease-out' : '0s'}`;
    menu.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
    inEl.style.transform = `translate3d(0,${(-y * 0.55).toFixed(1)}px,0) scale(${(0.94 + 0.06 * Math.min(1, p)).toFixed(4)})`;
    scrim.style.opacity = Math.min(1, p).toFixed(3);
    plus.style.transform = `translate3d(0,${(-sh.lift * p).toFixed(1)}px,0)`;
    plus.firstElementChild.style.transform = `rotate(${(135 * Math.min(p, 1.1)).toFixed(1)}deg)`;
  }
  function merge(on) { menu.classList.toggle('show', on); nav.parentNode.classList.toggle('merge', on); bub.classList.toggle('merge', on); }
  function shGo(open) {
    clearTimeout(hideT);
    shSet(open ? 0 : sh.H, RM() ? 'none' : open ? 'open' : 'close');
    if (!open) hideT = setTimeout(() => { if (!isOpen()) { menu.style.visibility = 'hidden'; scrim.hidden = true; } }, RM() ? 0 : 260);
  }
  const isOpen = () => plus.getAttribute('aria-expanded') === 'true';
  function openMenu(open) {
    const o = open == null ? !isOpen() : !!open;
    if (o === isOpen()) return;
    plus.setAttribute('aria-expanded', o); plus.classList.toggle('open', o);
    if (o) {
      clearTimeout(hideT); menu.style.visibility = 'visible'; scrim.hidden = false; paintTheme();
      const was = sh.H; sh.H = menu.offsetHeight; sh.lift = sh.H - nav.offsetHeight - 106;
      if (sh.y == null || sh.y >= was) shSet(sh.H, 'none');   // start tucked behind the bar
      void menu.offsetWidth; merge(true); shGo(true);
    } else { merge(false); shGo(false); }
  }
  let scrim;
  // opts: { page: 'workshop'|'checklist', items: [{label, icon, href}|{label, icon, act}|{label, icon, fn}|'-'] }
  function mount(opts) {
    page = opts.page;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const W = page === 'workshop' ? '' : 'workshop.html';
    const tabs = [['home', 'Home', W + '#/'], ['parts', 'Parts', W + '#/parts'], ['storage', 'Storage', W + '#/storage'], ['tools', 'Tools', W + '#/tools'], ['checklist', 'Checklist', 'index.html?checklist']];
    const wrap = document.createElement('div'); wrap.className = 'wnbar';
    wrap.innerHTML = `<nav class="tabbar" aria-label="Sections"><i class="wbg" aria-hidden="true"></i>${tabs.map(([k, l, h]) => `<a href="${h}" data-tab="${k}" draggable="false" aria-label="${l}"${page === 'checklist' && k === 'checklist' ? ' class="on" aria-current="page"' : ''}>${ic(k)}<span>${l}</span></a>`).join('')}</nav>`;
    document.body.appendChild(wrap);
    nav = wrap.querySelector('nav');
    if (page === 'workshop') { const v = (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'home', map = { home: 'home', attention: 'home', parts: 'parts', storage: 'storage', unplaced: 'storage', tools: 'tools' }, a = nav.querySelector(`a[data-tab="${map[v] || 'home'}"]`); if (a) a.classList.add('on'); }
    bub = document.createElement('span'); bub.className = 'wnbub'; bub.setAttribute('aria-hidden', 'true'); document.body.appendChild(bub);
    scrim = document.createElement('div'); scrim.className = 'wnscrim'; scrim.hidden = true; document.body.appendChild(scrim);
    plus = document.createElement('button'); plus.type = 'button'; plus.className = 'wnplus'; plus.setAttribute('aria-label', 'More'); plus.setAttribute('aria-haspopup', 'true'); plus.setAttribute('aria-expanded', 'false'); plus.innerHTML = ic('plus'); document.body.appendChild(plus);
    menu = document.createElement('div'); menu.className = 'wnmenu'; menu.setAttribute('role', 'menu');
    // the same actions on every tab and both pages; each page says how to do them (opts.run)
    // 10.22: Scan sits bottom-right under Settings (one-handed, right thumb); Log out bottom-left, out of the thumb's way
    const ITEMS = [['add', 'Add item', 'add'], ['alerts', 'Alerts', 'bell'], ['low', 'Running low', 'low'], ['labels', 'Labels', 'print'],
      ['custom', 'Custom label', 'pen'], ['organize', 'Organize', 'sort'], ['viewer', '3D viewer', 'cube', 'web-only'], ['settings', 'Settings', 'gear'],
      ['logout', 'Log out', 'logout'], ['scan', 'Scan', 'scan', 'app-only']];
    let n = 0;
    menu.innerHTML = '<span class="grab" aria-hidden="true"></span><div class="in"><div class="hd"><b>Quick actions</b></div><div class="grid">'
      + ITEMS.map(([k, label, icon, cls]) => `<button type="button" class="mi${cls ? ' ' + cls : ''}" role="menuitem" data-k="${k}" style="--i:${n++}"><i>${ic(icon)}</i><span>${label}</span></button>`).join('') + '</div>'
      + `<div class="th"><b>${ic('moon')}Theme</b><div class="seg" role="group" aria-label="Theme"><button type="button" data-theme="light">Light</button><button type="button" data-theme="dark">Dark</button><button type="button" data-theme="system">Auto</button></div></div></div>`;
    document.body.appendChild(menu);
    let plusAt = 0;   // the + can be pressed at most once every 0.1 s
    // press and hold the + (finger still): straight to the scanner, no panel
    let holdT = 0, holdFired = false, hx = 0, hy = 0;
    const canScan = () => { const c = document.documentElement.classList; return !!(window.WNNative || c.contains('wn-canscan') || c.contains('webcam')) && typeof opts.run === 'function'; };
    plus.addEventListener('pointerdown', (e) => { holdFired = false; clearTimeout(holdT); hx = e.clientX; hy = e.clientY; if (plus.classList.contains('open') || !canScan()) return;
      holdT = setTimeout(() => { holdFired = true; plus.classList.remove('press'); try { const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wn; if (h) { const r = h.postMessage({ cmd: 'haptic', style: 'medium' }); if (r && r.catch) r.catch(() => { }); } } catch (x) { } opts.run('scan'); }, 450); });
    plus.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - hx, e.clientY - hy) > 10) clearTimeout(holdT); });
    ['pointerup', 'pointercancel'].forEach(ev => plus.addEventListener(ev, () => clearTimeout(holdT)));
    plus.addEventListener('contextmenu', (e) => e.preventDefault());
    plus.addEventListener('click', () => { if (holdFired) { holdFired = false; return; } const t = Date.now(); if (t - plusAt < 100) return; plusAt = t; openMenu(); });
    scrim.addEventListener('pointerdown', (e) => { e.preventDefault(); openMenu(false); });
    let md = null, mSkip = 0;
    menu.addEventListener('dragstart', (e) => e.preventDefault());
    // touch on the panel: the tile under your finger lights up and the light follows your finger across the tiles (let go to pick it);
    // a mostly-vertical drag moves the whole panel instead (pull down to close)
    const tileAt = (x, y) => { const el = document.elementFromPoint(x, y); const t = el && el.closest && el.closest('.wnmenu .mi'); return t && t.offsetParent ? t : null; };
    let lit = null;
    const light = (t) => { if (t === lit) return; if (lit) lit.classList.remove('hl'); lit = t; if (t) t.classList.add('hl'); };
    menu.addEventListener('pointerdown', (e) => { if (e.button > 0 || !isOpen()) return; md = { x: e.clientX, y: e.clientY, y0: sh.y, id: e.pointerId, s: [], mode: '' }; light(tileAt(e.clientX, e.clientY)); });
    menu.addEventListener('pointermove', (e) => {
      if (!md || e.pointerId !== md.id) return;
      const dx = e.clientX - md.x, dy = e.clientY - md.y;
      if (!md.mode) {
        if (Math.hypot(dx, dy) < 6) return;
        md.mode = (Math.abs(dy) > Math.abs(dx) * 1.3 && !(lit && dy < 0)) ? 'drag' : (lit ? 'scrub' : 'drag');
        try { menu.setPointerCapture(e.pointerId); } catch (er) { }
        if (md.mode === 'drag') { light(null); sh.drag = true; md.y0 = menu.getBoundingClientRect().top - (innerHeight - sh.H) - dy; }
      }
      if (md.mode === 'scrub') { light(tileAt(e.clientX, e.clientY)); return; }
      let y = md.y0 + dy; if (y < 0) y = -(1 - 1 / (-y * 0.55 / 40 + 1)) * 40;   // pulling up past open resists
      const now = performance.now(); md.s.push([now, y]); while (md.s.length > 2 && now - md.s[0][0] > 90) md.s.shift();
      shSet(y, 'none');
    });
    const mUp = (e, cancel) => {
      if (!md || (e && e.pointerId !== md.id)) return;
      if (md.mode === 'drag' && sh.drag) {
        const a = md.s[0], b = md.s[md.s.length - 1], v = a && b && b[0] > a[0] ? (b[1] - a[1]) / ((b[0] - a[0]) / 1000) : 0;
        sh.drag = false; mSkip = performance.now();
        const close = sh.y + v * 0.15 > sh.H * 0.4;
        if (close) { plus.setAttribute('aria-expanded', false); plus.classList.remove('open'); merge(false); }
        shGo(!close);
      } else if (md.mode === 'scrub') {
        const t = lit; mSkip = performance.now();
        if (t && !cancel) setTimeout(() => t.click(), 90);   // let the light show for a beat, like iOS
      }
      const t = lit; md = null;
      setTimeout(() => { if (lit === t) light(null); }, 150);
    };
    menu.addEventListener('pointerup', (e) => mUp(e, false)); menu.addEventListener('pointercancel', (e) => mUp(e, true));
    // the + / ×: bright while your finger is on it
    plus.addEventListener('pointerdown', () => plus.classList.add('press'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => plus.addEventListener(ev, () => setTimeout(() => plus.classList.remove('press'), 90)));
    menu.addEventListener('click', (e) => { if (e.isTrusted && mSkip && performance.now() - mSkip < 450) { e.preventDefault(); e.stopImmediatePropagation(); } mSkip = 0; }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) openMenu(false); });
    menu.addEventListener('click', (e) => {
      const th = e.target.closest('[data-theme]'); if (th) { setTheme(th.dataset.theme); return; }
      const b = e.target.closest('.mi'); if (!b) return;
      light(b); setTimeout(() => light(null), 160);
      openMenu(false);
      if (b.dataset.k && opts.run) opts.run(b.dataset.k);
    });
    // ---- touch: a tab lights up — and the bubble starts gliding — the moment a finger touches it
    const tabsEl = () => [...nav.querySelectorAll('a')];
    const mark = (a) => tabsEl().forEach(x => x.classList.toggle('on', x === a));
    let prev = null, lastNav = 0;
    // tapping the tab you're already on: the icon in the bubble blinks, so the tap is felt even though nothing changes
    const blink = () => { const svg = bub.querySelector('svg'); if (!svg) return; svg.classList.remove('wnblink'); void svg.getBoundingClientRect(); svg.classList.add('wnblink'); };
    nav.addEventListener('dragstart', (e) => e.preventDefault());
    // a tab lights up only on a real tap (a swipe that brushes over the bar doesn't flash it)
    // finger held still on a tab for a moment: switch right then (no waiting for you to let go);
    // a quick tap switches on release as usual; a finger that moves (a swipe) switches nothing
    let pend = null, eatNext = false;
    const drop = () => { if (pend) { clearTimeout(pend.t); pend = null; } };
    nav.addEventListener('pointerdown', (e) => {
      const a = e.target.closest('a'); if (!a || e.button > 0) return;
      prev = nav.querySelector('a.on'); eatNext = false; drop();
      const p = pend = { a, x: e.clientX, y: e.clientY, id: e.pointerId };
      p.t = setTimeout(() => { if (pend !== p) return; pend = null; eatNext = true; a.click(); }, 5);
    });
    nav.addEventListener('pointermove', (e) => { if (pend && e.pointerId === pend.id && Math.hypot(e.clientX - pend.x, e.clientY - pend.y) > 8) drop(); });
    // lifting the finger switches at once (doesn't wait for the browser's click)
    nav.addEventListener('pointerup', (e) => { const p = pend; if (!p || e.pointerId !== p.id) return drop(); drop(); eatNext = true; p.a.click(); });
    // a touch that starts on the bar never scrolls the page, even if the finger slides up over it
    [nav, bub, plus].forEach(el => el.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
    nav.addEventListener('pointercancel', () => { drop(); prev = null; });
    // tapping the tab you're already on does nothing (no reload, no flicker) — unless you're deeper inside it
    // (e.g. a storage unit), then it takes you back to that tab's main page. Rapid repeat taps are ignored too.
    const here = (a) => { const h = a.getAttribute('href') || ''; if (a.dataset.tab === 'checklist') return page === 'checklist';
      if (page !== 'workshop') return false; const cur = (location.hash || '#/').replace(/\/+$/, '') || '#'; const want = h.replace(/^workshop\.html/, '').replace(/\/+$/, '') || '#';
      return cur === want || (want === '#' && (cur === '#' || cur === '')); };
    nav.addEventListener('click', (e) => {
      if (e.isTrusted && eatNext) { eatNext = false; e.preventDefault(); e.stopImmediatePropagation(); return; }   // the hold already switched
      const a = e.target.closest('a'), before = prev || nav.querySelector('a.on'), wasOn = before === a || (!before && a && a.classList.contains('on')); prev = null;
      if (!a) return;
      const now = Date.now();
      // the Checklist lives inside the Workshop screen (WNShell): show / hide it — no page load
      const S = page === 'workshop' && window.WNShell;
      if (S && (a.dataset.tab === 'checklist' || S.on())) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (a.dataset.tab === 'checklist') {
          if (S.on()) { if (!S.back()) { mark(a); blink(); } return; }
          if (now - lastNav < 280) { if (before) mark(before); return; }
          lastNav = now; S.show(''); return;
        }
        if (now - lastNav < 280) { if (before) mark(before); return; }
        lastNav = now; mark(a); S.goW(a.getAttribute('href') || '#/'); return;
      }
      if (wasOn && here(a)) { e.preventDefault(); e.stopImmediatePropagation(); mark(a); blink(); return; }
      if (now - lastNav < 280) { e.preventDefault(); e.stopImmediatePropagation(); if (before) mark(before); return; }
      lastNav = now; mark(a);
    }, true);
    // whatever marks a tab "on" (the Workshop's router, a tap) moves the bubble
    new MutationObserver(() => sync()).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', () => { half = 0; sync(true); if (isOpen()) { sh.H = menu.offsetHeight; shSet(0, 'none'); } });
    rubber();
    // first placement: no movement, before the first paint (so a page change can glide it)
    sync(true);
    requestAnimationFrame(() => sync(true));
    return { nav, plus, menu };
  }
  const EMBED = window.parent !== window && /[?&]embed/.test(location.search);
  // ---- rubber band (iPhone app): the page stretches at the top and bottom and springs back, like iOS —
  // but only the page content moves; the bar, the + and the panel never do. (The iPhone's own bounce is off in the
  // app: it dragged the fixed bar along and made it vanish.) Pull past an edge = stretch; a fast scroll that hits an
  // edge = a small bounce.
  function rubber() {
    if (!window.WNNative || !('ontouchstart' in window) || rubber.on) return; rubber.on = true;
    const css = document.createElement('style'); css.textContent = 'html,body{overscroll-behavior-y:none}'; document.head.appendChild(css);
    const SKIP = 'script,style,link,dialog,.wnbar,.wnbub,.wnplus,.wnmenu,.wnscrim,#wnCL,.wl,.pzoom,#toast';
    const de = document.documentElement, se = () => document.scrollingElement || de;
    let els = [], g = null, anim = [], clearT = 0;
    const busy = () => !!(document.querySelector('dialog[open]') || de.classList.contains('wl-open') || de.classList.contains('wn-cl') || document.body.classList.contains('dragging-on') || document.querySelector('.pdragging,.pdrag') || (plus && plus.classList.contains('open')));
    const targets = () => [...document.body.children].filter(el => { if (el.matches(SKIP)) return false; const cs = getComputedStyle(el); return cs.position !== 'fixed' && cs.display !== 'none'; });
    const max = () => Math.max(0, se().scrollHeight - innerHeight);
    const R = (d) => { const H = innerHeight; return (1 - 1 / (d * 0.55 / H + 1)) * H; };   // iOS's stretch curve
    // the gap a top stretch opens above the page takes the header's colour (like the header stretching)
    let topBg = '';
    const fillTop = (y) => { const want = y > 0 && els[0] ? getComputedStyle(els[0]).backgroundColor : ''; const c = want && !/rgba\(0, 0, 0, 0\)|transparent/.test(want) ? want : ''; if (c !== topBg) { topBg = c; de.style.backgroundColor = c; } };
    const set = (y, how) => { if (y > 0 || !how) fillTop(y); els.forEach(el => { el.style.transition = how || 'none'; el.style.transform = y ? `translate3d(0,${y.toFixed(2)}px,0)` : ''; }); };
    const prep = () => { clearTimeout(clearT); anim.forEach(a => a.cancel()); anim = []; els = targets(); els.forEach(el => { el.style.willChange = 'transform'; }); };
    const tidy = (ms) => { clearTimeout(clearT); clearT = setTimeout(() => { els.forEach(el => { el.style.transition = ''; el.style.willChange = ''; if (!g) el.style.transform = ''; }); if (!g) fillTop(0); }, ms); };
    const inScroller = (t) => { for (let el = t; el && el !== document.body && el !== de; el = el.parentElement) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return true; } return false; };
    document.addEventListener('touchstart', (e) => {
      g = null;
      if (e.touches.length !== 1 || busy() || !e.target.closest || e.target.closest(SKIP) || inScroller(e.target)) return;
      const t = e.touches[0]; g = { x: t.clientX, y: t.clientY, ly: t.clientY, first: true, own: false, off: 0, p: 0, on: false };
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!g) return;
      if (e.touches.length !== 1 || busy()) { end(); return; }
      const t = e.touches[0], dy = t.clientY - g.ly; g.ly = t.clientY;
      if (!g.on && Math.abs(t.clientX - g.x) > 10 && Math.abs(t.clientX - g.x) > Math.abs(t.clientY - g.y)) { g = null; return; }   // sideways swipe
      const y = se().scrollTop, m = max();
      if (g.first) {
        g.first = false;
        // the drag starts by pulling past an edge: this drag is ours (we scroll and stretch the page ourselves)
        if (e.cancelable && ((dy > 0 && y <= 0) || (dy < 0 && y >= m - 1))) { g.own = true; g.p = y; prep(); g.on = true; }
      }
      if (g.own) {
        e.preventDefault();
        g.p -= dy;
        if (g.p < 0) { if (y !== 0) se().scrollTop = 0; set(R(-g.p)); }
        else if (g.p > m) { if (y < m) se().scrollTop = m; set(-R(g.p - m)); }
        else { se().scrollTop = g.p; set(0); }
        return;
      }
      // a normal scroll that runs into an edge while your finger is still down: stretch from there
      if (!g.on) { if ((dy > 0 && y <= 0) || (dy < 0 && y >= m - 1)) { g.on = true; g.off = 0; g.dir = dy > 0 ? 1 : -1; prep(); } else return; }
      g.off = g.dir > 0 ? Math.max(0, g.off + dy) : Math.min(0, g.off + dy);
      if (g.off && e.cancelable) e.preventDefault();
      set(g.dir * R(Math.abs(g.off)));
      if (!g.off) { g.on = false; tidy(0); }
    }, { passive: false });
    function end() { if (!g) return; const was = g.on; g = null; if (!was) return; set(0, 'transform .52s cubic-bezier(.22,.9,.28,1)'); tidy(560); }
    document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', end, { passive: true });
    // a flick that reaches the top or bottom bounces a little, like the iPhone
    let ly = se().scrollTop, lt = performance.now(), v = 0;
    window.addEventListener('scroll', () => {
      const now = performance.now(), y = se().scrollTop, dt = now - lt, py = ly;
      if (dt > 0 && dt < 120) v = v * 0.4 + ((y - py) / dt) * 0.6; else v = 0;
      ly = y; lt = now;
      if (g || busy()) return;
      const m = max();
      if ((y <= 0 && py > 0 && v < -0.3) || (m > 0 && y >= m - 1 && py < m - 1 && v > 0.3)) {
        const A = Math.max(-56, Math.min(56, -v * 20)); prep(); if (A > 0) fillTop(A);
        anim = els.map(el => el.animate([{ transform: 'translate3d(0,0,0)', easing: 'cubic-bezier(.15,.75,.3,1)' }, { transform: `translate3d(0,${A.toFixed(1)}px,0)`, offset: 0.32, easing: 'cubic-bezier(.45,0,.25,1)' }, { transform: 'translate3d(0,0,0)' }], { duration: 560 }));
        tidy(600);
      }
    }, { passive: true });
  }
  function markTab(k) { if (EMBED) { try { if (window.parent.WNShell && window.parent.WNShell.on()) window.parent.WNBar.mark(k); } catch (e) { } return; } if (!nav) return; nav.querySelectorAll('a').forEach(a => { const on = !!k && a.dataset.tab === k; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
  window.WNBar = { mount, sync, setTheme, getTheme, applyTheme, open: openMenu, mark: markTab };
})();

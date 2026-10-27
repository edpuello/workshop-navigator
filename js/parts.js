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
    return `<span class="pthumb ${cls || ''}"><img src="${esc(hit.src)}" alt="${esc(hit.label)}" title="${esc(hit.label)}" loading="lazy" decoding="async"></span>`;
  }
  window.WNParts = { lookup, thumb, RULES, NOT_SOLD };
})();

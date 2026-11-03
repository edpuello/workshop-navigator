// Organize by size: where every part goes in the Akro-Mils cabinets (A1–A4), worked out from its name and category.
// Agreed with the owner 2026-11-03. One row = one size. Left → right: screws/bolts short → long · hex nut · nyloc ·
// flat washer · lock washer · spare (columns 01–03, 04, 05, 06, 07, 08 whenever a row fits that pattern).
// Nylon sits in the row under its steel size. A1 = #4–#10, A2 = 1/4″–3/8″ + sheet-metal, wood, structural, toggles,
// rivets. A3 = metric + anchors, pins, specialty. A4 = electrical, automotive, springs + everything else.
// Threaded rod and assortment boxes stay out of the drawers. Pure logic — no page code; works in Node for tests.
(function () {
  const ROWS = 'ABCDEFGH', p2 = (n) => String(n).padStart(2, '0');
  const TYPE_RANK = { screw: 0, hex: 1, nyloc: 2, flat: 3, lock: 4 };
  const FIXED = { hex: 4, nyloc: 5, flat: 6, lock: 7 };
  const WORDS = { small: 1, short: 1, light: 1, 'light-duty': 1, mini: 1, medium: 2, 'medium-duty': 2, regular: 2, standard: 2, large: 3, long: 3, heavy: 3, 'heavy-duty': 3 };

  function num(s) { // "1-1/2" → 1.5, "3/4" → .75, "8" → 8
    s = String(s || ''); let m;
    if ((m = s.match(/(\d+)\s*-\s*(\d+)\/(\d+)/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/(\d+)\/(\d+)/))) return m[1] / m[2];
    if ((m = s.match(/(\d+(?:\.\d+)?)/))) return +m[1];
    return null;
  }
  function famOf(n) {
    let m;
    if ((m = n.match(/\bM(\d+(?:\.\d+)?)\b/))) return { fam: 'M' + m[1], val: 100 + +m[1] };
    if ((m = n.match(/#\s?(\d+)/))) return { fam: '#' + m[1], val: .06 + .013 * +m[1] };
    if ((m = n.match(/^\s*(\d+\/\d+)/)) || (m = n.match(/\b(\d+\/\d+)\s*(?:"|″|in)?\s*-\s*\d+/))) return { fam: m[1], val: num(m[1]) };
    return { fam: '', val: null };
  }
  // What a part is: kind (which cabinet/row family), size family, thread, type, material, length.
  function classify(x) {
    const name = String(x.name || ''), n = name.toLowerCase(), c = String(x.category || '').toLowerCase();
    const f = famOf(name);
    let m, thr = null;
    if ((m = name.match(/#\s?\d+\s*-\s*(\d+)/)) || (m = name.match(/\d+\/\d+\s*(?:"|″|in)?\s*-\s*(\d+)/))) thr = +m[1];
    const type = /nyloc|nylon[- ]insert|lock\s?nut/.test(n) ? 'nyloc' : /\bnuts?\b/.test(n) ? 'hex' : /lock washer|split lock|split washer/.test(n) ? 'lock' : /washer/.test(n) ? 'flat' : 'screw';
    const mat = /nylon fasteners/.test(c) || (/\bnylon\b/.test(n) && !/nylon[- ]insert/.test(n)) ? 'nylon' : 'steel';
    const seg = name.split(/\s[×x✕]\s/); const len = seg.length > 1 ? num(seg[seg.length - 1]) : null;
    let word = null; if ((m = n.match(/(\d+)-port/))) word = +m[1]; else for (const w of n.split(/[^a-z-]+/)) if (w in WORDS) { word = WORDS[w]; break; }
    let kind;
    if (/threaded rod/.test(c + ' ' + n)) kind = 'rod';
    else if (/assortment|assorted|\bkit\b/.test(n)) kind = 'assort';
    else if (/nylon fasteners/.test(c) || /sae (machine screws|hex bolts|nuts)/.test(c)) kind = 'mach';
    else if (/anchor/.test(c)) kind = /concrete/.test(n) ? 'concrete' : /toggle/.test(n) ? 'toggle' : 'anchor';
    else if (/rivet/.test(c) || /\brivets?\b/.test(n)) kind = 'rivet';
    else if (/sheet metal|tek/.test(c) || /sheet metal|\btek\b/.test(n)) kind = 'sheet';
    else if (/construction|wood/.test(c)) kind = /structural|\blag\b/.test(n) ? 'struct' : 'wood';
    else if (/metric/.test(c)) kind = 'metric';
    else if (/specialty/.test(c)) kind = /\bpins?\b|clips?\b|rings?\b/.test(n) ? 'pin' : 'special';
    else if (/electrical/.test(c)) kind = 'elec';
    else if (/automotive|mechanical/.test(c)) kind = 'auto';
    else if (/plumbing/.test(c)) kind = 'plumb';
    else if (/spring/.test(c)) kind = 'spring';
    else if (/^M\d/.test(f.fam)) kind = 'metric';
    else if (thr != null) kind = 'mach';
    else if (/wood screw|deck screw/.test(n)) kind = 'wood';
    else kind = 'other';
    return { x, kind, fam: f.fam, val: f.val, thr, type, mat, len, word, tek: /\btek\b/.test(n) ? 1 : 0 };
  }

  // The rows. match(c) → part belongs here. sort = order inside the row. std = use the fixed columns when they fit.
  const is = (k) => (c) => c.kind === k, mach = (fam, more) => (c) => c.kind === 'mach' && c.fam === fam && (!more || more(c));
  const washer = (c) => c.type === 'flat' || c.type === 'lock';
  const MS = ['mat', 'thr', 'type', 'len', 'name'];
  const PLAN = [
    { id: 'A1', title: '#4 – #10 machine screws, nuts & washers', rows: [
      { tag: '#4', sub: '', label: '#4 (steel + nylon)', color: '#fde2e4', near: .112, std: 1, match: mach('#4') },
      { tag: '#6', sub: 'steel', label: '#6 steel', color: '#fff1c1', near: .138, std: 1, match: mach('#6', c => c.mat === 'steel') },
      { tag: '#6', sub: 'nylon', label: '#6 nylon', color: '#fff1c1', near: .138, std: 1, match: mach('#6', c => c.mat === 'nylon') },
      { tag: '#8', sub: 'steel', label: '#8 steel', color: '#d9f2d9', near: .164, std: 1, match: mach('#8', c => c.mat === 'steel') },
      { tag: '#8', sub: 'nylon', label: '#8 nylon', color: '#d9f2d9', near: .164, std: 1, match: mach('#8', c => c.mat === 'nylon') },
      { tag: '#10', sub: '-24', label: '#10-24 steel + #10 washers', color: '#d6e9fb', near: .19, std: 1, match: mach('#10', c => c.mat === 'steel' && (c.thr === 24 || (c.thr == null && washer(c)))) },
      { tag: '#10', sub: '-32', label: '#10-32 steel + #10 nylon washer', color: '#d6e9fb', near: .19, std: 1, match: mach('#10', c => (c.mat === 'steel' && c.thr === 32) || (c.mat === 'nylon' && washer(c))) },
      { tag: '#10', sub: 'nylon', label: '#10 nylon screws & nuts', color: '#d6e9fb', near: .19, std: 1, match: mach('#10', c => c.mat === 'nylon' && !washer(c)) },
    ], takes: (c) => c.kind === 'mach' && /^#/.test(c.fam) },
    { id: 'A2', title: '1/4″ – 3/8″ bolts · sheet metal, wood & structural · toggles & rivets', rows: [
      { tag: '1/4', sub: 'bolts', label: '1/4″ bolts & nuts', color: '#ffe2c6', near: .25, std: 1, match: mach('1/4', c => c.mat === 'steel' && !washer(c)) },
      { tag: '1/4', sub: 'wash·nyl', label: '1/4″ washers + 1/4″ nylon', color: '#ffe2c6', near: .25, std: 1, match: mach('1/4') },
      { tag: '5/16', sub: '', label: '5/16″', color: '#e6e1fb', near: .3125, std: 1, match: mach('5/16') },
      { tag: '3/8', sub: '', label: '3/8″', color: '#d8f1ef', near: .375, std: 1, match: mach('3/8') },
      { tag: 'Sheet', sub: 'metal·TEK', label: 'Sheet metal & TEK (by size)', color: '#eef0f3', match: is('sheet'), sort: ['val', 'tek', 'len', 'name'] },
      { tag: 'Wood', sub: '', label: 'Wood screws (by size)', color: '#f1ead9', match: is('wood'), sort: ['val', 'len', 'name'] },
      { tag: 'Struct', sub: '+concr', label: 'Structural + concrete screws', color: '#e9e4dc', match: (c) => c.kind === 'struct' || c.kind === 'concrete', kinds: ['struct', 'concrete'], sort: ['kind', 'val', 'len', 'name'] },
      { tag: 'Toggle', sub: '+rivet', label: 'Toggle bolts + rivets', color: '#f3e8f3', match: (c) => c.kind === 'toggle' || c.kind === 'rivet', kinds: ['toggle', 'rivet'], sort: ['kind', 'val', 'word', 'name'] },
    ], takes: (c) => (c.kind === 'mach' && !/^#/.test(c.fam)) || ['sheet', 'wood', 'struct', 'concrete', 'toggle', 'rivet'].includes(c.kind) },
    { id: 'A3', title: 'Metric · anchors · pins & clips · specialty', rows: [
      ...['M3', 'M4', 'M5', 'M6', 'M8'].map((m, i) => ({ tag: m, sub: '', label: m + ' screws, nuts & washers', color: ['#fde2e4', '#fff1c1', '#d9f2d9', '#d6e9fb', '#ffe2c6'][i], near: 100 + +m.slice(1), std: 1, match: (c) => c.kind === 'metric' && c.fam === m })),
      { tag: 'Anchor', sub: '', label: 'Wall anchors', color: '#eef0f3', match: is('anchor'), sort: ['word', 'name'] },
      { tag: 'Pins', sub: 'clips', label: 'Pins, clips & rings', color: '#f1ead9', match: is('pin'), sort: ['name'] },
      { tag: 'Special', sub: '', label: 'Specialty nuts & screws', color: '#f3e8f3', match: is('special'), sort: ['name'] },
    ], takes: (c) => ['metric', 'anchor', 'pin', 'special'].includes(c.kind) },
    { id: 'A4', title: 'Electrical · automotive · springs · everything else', rows: [
      { tag: 'Elec', sub: '', label: 'Electrical', span: 2, color: '#fff1c1', match: is('elec'), grp: [/lever/, /wire nut/, /butt/, /tubing/], sort: ['grp', 'word', 'name'] },
      { tag: 'Auto', sub: '', label: 'Automotive & mechanical', color: '#d6e9fb', match: is('auto'), sort: ['name'] },
      { tag: 'Spring', sub: 'plumb', label: 'Springs, bumpers & plumbing', color: '#d9f2d9', match: (c) => c.kind === 'spring' || c.kind === 'plumb', kinds: ['spring', 'plumb'], sort: ['kind', 'name'] },
      { tag: 'Other', sub: '', label: 'Everything else + overflow', span: 4, color: '#eef0f3', match: is('other'), sort: ['name'] },
    ], takes: () => true },
  ];
  const OUT = { rod: 'Threaded rod — too long for a drawer (rack or shed)', assort: 'Assortment box — too big for a drawer (a Husky drawer)' };

  function key(c, k, row) {
    if (k === 'mat') return c.mat === 'nylon' ? 1 : 0;
    if (k === 'type') return TYPE_RANK[c.type] ?? 9;
    if (k === 'kind') return (row.kinds || []).indexOf(c.kind);
    if (k === 'grp') { const i = (row.grp || []).findIndex(r => r.test(String(c.x.name).toLowerCase())); return i < 0 ? 99 : i; }
    if (k === 'name') return 0;
    const v = c[k]; return v == null ? 1e9 : v;
  }
  const sorter = (row) => (a, b) => { for (const k of row.sort || MS) { if (k === 'name') { const d = String(a.x.name).localeCompare(String(b.x.name), undefined, { numeric: true }); if (d) return d; continue; } const d = key(a, k, row) - key(b, k, row); if (d) return d; } return 0; };

  // Lay out one row: the fixed columns when the row fits them, otherwise left → right in order. Returns [[col, c]], extra[]
  function layRow(row, list, width) {
    const l = list.slice().sort(sorter(row)), cap = width * (row.span || 1);
    if (row.std && (row.span || 1) === 1 && width >= 8) {
      const sc = l.filter(c => c.type === 'screw'), cnt = {}; l.forEach(c => cnt[c.type] = (cnt[c.type] || 0) + 1);
      if (sc.length <= 3 && ['hex', 'nyloc', 'flat', 'lock'].every(t => (cnt[t] || 0) <= 1)) return { at: [...sc.map((c, i) => [i, c]), ...l.filter(c => c.type !== 'screw').map(c => [FIXED[c.type] - 1, c])], extra: [] };
    }
    return { at: l.slice(0, cap).map((c, i) => [i, c]), extra: l.slice(cap) };
  }
  // The whole plan for the given parts. Same parts → same spots, every time.
  // → { cabs: [{id, title, rows:[{r, tag, sub, label, color, span}], cells: {code: c}}], home: Map(partId → code), out: [{c, why}], noRoom: [c] }
  function plan(parts, width) {
    width = width || 8;
    const cs = parts.map(classify), used = new Set(), home = new Map(), out = [], noRoom = [];
    cs.forEach(c => { if (OUT[c.kind]) { out.push({ c, why: OUT[c.kind] }); used.add(c); } });
    const cabs = PLAN.map(cab => ({ id: cab.id, title: cab.title, rows: [], cells: {}, spill: [] }));
    PLAN.forEach((cab, ci) => {
      const C = cabs[ci]; let r = 0;
      cab.rows.forEach(row => {
        const span = row.span || 1, mine = cs.filter(c => !used.has(c) && row.match(c)); mine.forEach(c => used.add(c));
        C.rows.push({ r: ROWS[r], tag: row.tag, sub: row.sub, label: row.label, color: row.color, span, near: row.near });
        const { at, extra } = layRow(row, mine, width);
        at.forEach(([i, c]) => { const rr = r + Math.floor(i / width), col = i % width; C.cells[`${cab.id}-${ROWS[rr]}${p2(col + 1)}`] = c; c.row = ROWS[r]; });
        extra.forEach(c => C.spill.push({ c, near: r }));
        r += span;
      });
    });
    // parts that matched no row go to their cabinet's spare drawers, next to the closest size
    cs.filter(c => !used.has(c)).forEach(c => { const ci = PLAN.findIndex(cab => cab.takes(c)), cab = PLAN[ci]; let r = 0, best = 1e9, near = null; const starts = [];
      cab.rows.forEach(row => { starts.push(r); if (row.near != null && c.val != null && Math.abs(row.near - c.val) < best) { best = Math.abs(row.near - c.val); near = r; } r += row.span || 1; });
      if (near == null) near = starts[starts.length - 1]; // no size to go by → the last rows
      cabs[ci].spill.push({ c, near }); used.add(c); });
    cabs.forEach(C => { const rowsN = 8;
      C.spill.forEach(({ c, near }) => {
        const order = [near]; for (let d = 1; d < rowsN; d++) { if (near + d < rowsN) order.push(near + d); if (near - d >= 0) order.push(near - d); }
        for (const rr of order) for (let col = width - 1; col >= 0; col--) { const code = `${C.id}-${ROWS[rr]}${p2(col + 1)}`; if (!C.cells[code]) { C.cells[code] = c; c.row = ROWS[rr]; c.spill = true; return; } }
        noRoom.push(c);
      }); delete C.spill; });
    cabs.forEach(C => Object.entries(C.cells).forEach(([code, c]) => home.set(c.x.id, code)));
    return { cabs, home, out, noRoom };
  }
  // Worth a look before it goes in: long screws and toggle wings may not fit a small drawer.
  const checkFit = (c) => c.kind === 'toggle' || (c.len != null && c.len >= 3 && c.kind !== 'metric') || (c.kind === 'struct' && c.len >= 3);
  const rowTags = (cab) => Object.fromEntries(cab.rows.flatMap(r => Array.from({ length: r.span || 1 }, (_, k) => [ROWS[ROWS.indexOf(r.r) + k], { t: r.tag, s: r.sub, c: r.color, l: r.label }])));
  const api = { classify, plan, checkFit, rowTags, PLAN, OUT, CABS: PLAN.map(c => c.id) };
  if (typeof window !== 'undefined') window.WNOrganize = api;
  if (typeof module !== 'undefined') module.exports = api;
})();

// Storage units and location codes. Units are saved in the shared list (doc.locations, kind:'unit') so every device has them.
// A code is UNIT-SLOT, e.g. A2-C05 (Akro #2, row C, drawer 5), T1-D07, MOB1-2-07, S1-B12. Letters I and O are never used in one-letter codes.
(function () {
  const ROWS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, no O (they look like 1 and 0)
  const p2 = (n) => String(n).padStart(2, '0');
  const TYPES = {
    grid: 'Drawer cabinet (rows × columns)',
    stack: 'Drawers, top to bottom',
    modules: 'Stacked modules / organizers',
    bins: 'Numbered bins',
    sections: 'Chest / cabinet with columns',
    shelves: 'Shelves (shelf unit, closet, cabinet)',
    box: 'One container (tote, case, bag, box)',
  };
  // 10.22: kinds of single containers, and the rooms storage can be in (any other room name can be typed)
  const BOXES = ['Tote', 'Case', 'Bag', 'Box', 'Crate', 'Bucket'];
  const ROOMS = ['Garage', 'Shed', 'Office', 'House', 'Basement', 'Attic'];
  const roomOf = (u) => String((u && u.room) || '').trim() || (u && (u.id === 'S1' || /\bshed\b/i.test(u.name || '')) ? 'Shed' : 'Garage');
  // Husky 52″ chest + cabinet, from the owner's photo (2026-11-02). Numbered like reading a page: left → right, top → bottom.
  const T1_LAYOUT = { type: 'sections', extras: [{ key: 'T', name: 'Lid tray' }], sections: [
    { name: 'Top chest', blocks: [{ cols: [{ w: 28, hs: [1, 1, 2] }, { w: 72, hs: [1, 1, 2] }] }] },
    { name: 'Cabinet', blocks: [{ full: 1.6 }, { cols: [{ w: 40, hs: [1, 1, 1, 2.6] }, { w: 60, hs: [1, 1, 1, 2.6] }] }] }] };
  // 10.26: the Husky Connect rolling cart is "Mobius 1" (MOB1), from the owner's photos (2026-11-12): six sections, top → bottom.
  // The top organizer holds two trays: the top tray (12 bins around an open centre = spot 13) and the lower tray (10 bins).
  // Then two identical 10-bin organizers, and two open boxes. Bins are numbered like reading a page, back row first.
  const MOB1_MODEL = 'Husky Connect rolling system · #1002 091 132';
  const MOB1_MODS = [{ name: 'Top tray', bins: 13, cols: 6 }, { name: 'Lower tray', bins: 10, cols: 6 }, { name: 'Organizer 3', bins: 10, cols: 6 }, { name: 'Organizer 4', bins: 10, cols: 6 }, { name: 'Tool box', bins: 0, cols: 6 }, { name: 'Rolling bin', bins: 0, cols: 6 }];
  // the old M1 drawing (5 boxes) → the new sections: box 1 = top tray, boxes 2 and 3 = organizers 3 and 4, boxes 4 and 5 = the two open boxes
  const M1_TO_MOB1 = (code) => { const m = String(code || '').toUpperCase().match(/^M1-([1-5])(?:-(\d\d))?$/); if (!m) return ''; const k = { 1: 1, 2: 3, 3: 4, 4: 5, 5: 6 }[m[1]]; return 'MOB1-' + k + (m[2] ? '-' + m[2] : ''); };
  // The owner's storage (2026-11-02). Order = how they're listed on the Storage page.
  const MY_UNITS = [
    ...[1, 2, 3, 4].map(n => ({ id: 'A' + n, type: 'grid', rows: 8, cols: 8, name: 'Akro-Mils Cabinet #' + n, model: 'Akro-Mils 10164 · wall mounted' })),
    { id: 'T1', ...T1_LAYOUT, name: 'Husky 52″ chest + cabinet', model: 'Husky 15-drawer combo · #1007 590 888' },
    { id: 'C1', type: 'stack', count: 15, name: 'Husky 61″ rolling cabinet', model: 'Husky 61″ · 15 drawers' },
    { id: 'MOB1', type: 'modules', name: 'Mobius 1', model: MOB1_MODEL, modules: MOB1_MODS.map(m => ({ ...m })) },
    { id: 'W1', type: 'stack', count: 2, name: 'Husky 52″ work desk', model: 'Husky adjustable desk · 2 drawers' },
    { id: 'S1', type: 'bins', count: 6, cols: 6, name: 'Outdoor shed bins', model: 'Numbered bins' },
  ];

  function units(doc) {
    return ((doc && doc.locations) || []).filter(l => l && l.kind === 'unit').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  }
  // Every slot of a unit, in order: {code, label (short), where (long), r, c, m}
  function slots(u) {
    const out = [];
    if (!u) return out;
    if (u.type === 'grid') {
      for (let r = 0; r < (u.rows || 0); r++) for (let c = 0; c < (u.cols || 0); c++)
        out.push({ code: `${u.id}-${ROWS[r]}${p2(c + 1)}`, label: ROWS[r] + p2(c + 1), where: `row ${ROWS[r]}, drawer ${c + 1}`, r, c });
    } else if (u.type === 'stack') {
      for (let n = 1; n <= (u.count || 0); n++) out.push({ code: `${u.id}-D${p2(n)}`, label: 'D' + p2(n), where: `drawer ${n} from the top`, n });
    } else if (u.type === 'bins') {
      for (let n = 1; n <= (u.count || 0); n++) out.push({ code: `${u.id}-B${p2(n)}`, label: 'B' + p2(n), where: `bin ${n}`, n });
    } else if (u.type === 'sections') {
      (u.extras || []).forEach(x => out.push({ code: `${u.id}-${x.key}`, label: x.key, where: x.name, extra: true, h: 1 }));
      let n = 0; const side = (ci, nc) => nc === 1 ? '' : nc === 2 ? ['left', 'right'][ci] : ci === 0 ? 'left' : ci === nc - 1 ? 'right' : 'middle';
      (u.sections || []).forEach((sec, si) => (sec.blocks || []).forEach((bl, bi) => {
        const nm = (sec.name || 'section ' + (si + 1)).toLowerCase();
        if (bl.cols) { const rows = Math.max(...bl.cols.map(c => (c.hs || []).length)); for (let r = 0; r < rows; r++) bl.cols.forEach((c, ci) => { if (r < (c.hs || []).length) { n++; out.push({ code: `${u.id}-D${p2(n)}`, label: 'D' + p2(n), where: `${nm} · ${side(ci, bl.cols.length)} column, drawer ${r + 1}`.replace(' ·  column', ' ·'), s: si, b: bi, col: ci, row: r, h: c.hs[r] }); } }); }
        else { n++; out.push({ code: `${u.id}-D${p2(n)}`, label: 'D' + p2(n), where: `${nm} · full-width drawer`, s: si, b: bi, h: bl.full || 1 }); }
      }));
    } else if (u.type === 'shelves') {
      // one spot per shelf (K1-S01 = top shelf), or several spots on each shelf, left → right (K1-A01 = top shelf, first spot)
      const per = Math.max(1, Math.floor(u.per || 1));
      for (let n = 1; n <= (u.count || 0); n++) {
        if (per === 1) out.push({ code: `${u.id}-S${p2(n)}`, label: 'S' + p2(n), where: `shelf ${n} from the top`, n, r: n - 1 });
        else for (let k = 1; k <= per; k++) out.push({ code: `${u.id}-${ROWS[n - 1]}${p2(k)}`, label: ROWS[n - 1] + p2(k), where: `shelf ${n} from the top, spot ${k} from the left`, n, k, r: n - 1, c: k - 1 });
      }
    } else if (u.type === 'box') {
      out.push({ code: u.id, label: u.id, where: 'inside', box: true });   // a tote / case is one spot: its code is just its own (e.g. B3)
    } else if (u.type === 'modules') {
      (u.modules || []).forEach((m, i) => {
        const k = i + 1;
        if (!(m.bins > 0)) out.push({ code: `${u.id}-${k}`, label: String(k), where: `${m.name || 'module ' + k} (module ${k})`, m: k });
        else { const nm = (MODLOOKS[u.id] && MODLOOKS[u.id].binNames && MODLOOKS[u.id].binNames[k]) || {};
          for (let b = 1; b <= m.bins; b++) out.push({ code: `${u.id}-${k}-${p2(b)}`, label: p2(b), where: `${m.name || 'module ' + k} (module ${k}), ${nm[b] && m.bins === nm.n ? nm[b] : 'bin ' + b}`, m: k, b }); }
      });
    }
    return out;
  }
  const norm = (code) => String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  // Find a code: {unit, slot} or null. Accepts lower case and missing zero padding ("a2-c5").
  function find(doc, code) {
    const c = norm(code); if (!c) return null;
    const id = c.split('-')[0], u = units(doc).find(x => String(x.id).toUpperCase() === id); if (!u) return null;
    const all = slots(u), padded = c.replace(/-([A-Z]?)(\d)$/, '-$10$2');
    const s = all.find(x => x.code === c) || all.find(x => x.code === padded);
    return s ? { unit: u, slot: s } : null;
  }
  function describe(doc, code) { const f = find(doc, code); return f ? `${f.unit.name} · ${f.slot.where}` : ''; }
  // Older location names typed before the map existed → the matching new code (only clear-cut cases).
  function suggest(code) {
    const c = norm(code); let m;
    if ((m = c.match(/^SHED-?BIN-?(\d{1,3})$/))) return 'S1-B' + p2(+m[1]);
    if ((m = c.match(/^HUSKY-?D(\d{1,2})$/))) return 'T1-D' + p2(+m[1]);
    return '';
  }
  function detail(u) {
    const s = slots(u), first = s[0], last = s[s.length - 1];
    if (u.type === 'box') return `${u.model ? u.model + ' · ' : ''}${u.box || 'Container'} · code ${u.id}`;
    const size = u.type === 'shelves' ? `${u.count} shelves${(u.per || 1) > 1 ? ' × ' + u.per + ' spots' : ''}` : u.type === 'grid' ? `${u.rows} rows × ${u.cols}` : u.type === 'modules' ? `${(u.modules || []).length} modules` : u.type === 'sections' ? `${(u.sections || []).map(x => x.name).join(' + ')}` : `${u.count}`;
    return `${u.model ? u.model + ' · ' : ''}${s.length} spots (${size})${first ? ` · codes ${first.code} … ${last.code}` : ''}`;
  }
  const UPDATES = [
    { id: 'T1', text: 'Husky 52″: chest + cabinet columns from your photo, plus the lid tray (T1-T)', when: u => u.type === 'stack' && u.count === 15, to: u => ({ ...u, ...T1_LAYOUT, count: undefined }) },
    { id: 'S1', text: 'Shed: 6 bins instead of 12', when: u => u.type === 'bins' && u.count === 12, to: u => ({ ...u, count: 6 }) },
    // 10.26: a new code for the whole unit, so everything filed in it moves with it (map: old spot → new spot, '' = no match)
    { id: 'M1', rename: 'MOB1', text: 'Husky Connect cart becomes Mobius 1 (MOB1): six sections with a photo of each tray', when: u => u.type === 'modules', to: u => ({ ...u, id: 'MOB1', name: 'Mobius 1', model: u.model || MOB1_MODEL, spots: undefined, modules: MOB1_MODS.map(m => ({ ...m })) }), map: M1_TO_MOB1 },
  ];
  function pendingUpdates(doc) { const us = units(doc); return UPDATES.map(x => ({ ...x, unit: us.find(u => u.id === x.id) })).filter(x => x.unit && x.when(x.unit) && !(x.rename && us.some(u => u.id === x.rename))); }
  // one letter (not I or O) and a digit (A5, T2), or a short name and a digit (MOB1)
  const validId = (id) => /^([A-HJ-NP-Z]|[A-Z]{2,4})[1-9]$/.test(String(id || ''));
  // Photo maps: a real picture of the unit, with each drawer's spot measured on it (left/right and top/bottom
  // edges in % of the picture). Akro-Mils 10164 (64 drawers, 8 × 8), from the owner's photo (2026-11-04).
  const LOOKS = {
    akro10164: { img: 'img/akro-10164.jpg', w: 944, h: 836,
      xs: [[4.24, 14.62], [15.57, 26.38], [27.22, 37.92], [38.77, 49.58], [50.42, 61.12], [62.08, 72.78], [73.73, 84.43], [85.38, 95.76]],
      ys: [[4.07, 14.0], [15.31, 25.6], [27.03, 37.08], [38.52, 48.56], [50.12, 60.05], [61.6, 71.41], [73.09, 82.89], [84.57, 94.02]] },
  };
  const PHOTO_UNITS = { A1: 'akro10164' };   // which units show their photo map (more Akro-Mils can be added here)
  function look(u) { const L = u && u.type === 'grid' && LOOKS[PHOTO_UNITS[u.id]]; return L && u.rows === L.ys.length && u.cols === L.xs.length ? L : null; }
  // 10.26: photo maps for stacked organizers. front = the whole unit with each section's box; trays = one picture per section
  // (null = an open box, no picture) with every bin's box [left, top, width, height] in % of the picture, in bin order.
  const TRAY10 = { img: 'img/mob1-tray10.jpg', w: 900, h: 600, rects: [[0.6, 1, 48.4, 27.6], [50.6, 1, 48.8, 27.6],
    [0.6, 29.6, 24, 32.2], [25.4, 29.6, 24.2, 32.2], [50.2, 29.6, 24.3, 32.2], [75, 29.6, 24.4, 32.2],
    [0.6, 63.4, 24, 35.6], [25.4, 63.4, 24.2, 35.6], [50.2, 63.4, 24.3, 35.6], [75, 63.4, 24.4, 35.6]] };
  const TRAY13 = { img: 'img/mob1-top.jpg', w: 900, h: 600, rects: [[0.4, 1, 19.2, 23.5], [20.6, 1, 19, 23.5], [40.4, 1, 19.6, 23.5], [60.6, 1, 18.6, 23.5], [80, 1, 19.6, 23.5],
    [0.4, 26.8, 19.6, 44], [80.6, 25.2, 19, 44],
    [0.4, 73, 19.6, 26], [20.6, 73, 19, 26], [40.4, 73, 19.6, 26], [60.6, 73, 19, 26], [80.6, 73, 19, 26], [21.6, 26.8, 57.4, 44]] };
  const MODLOOKS = { MOB1: { front: { img: 'img/mob1-front.jpg', w: 560, h: 655, secs: [[6.7, 7.6, 86.6, 11.8], [6.7, 19.8, 86.6, 11.2], [14.4, 32.3, 73.4, 11.4], [16.7, 44.3, 68.9, 10.6], [20, 55.3, 62.2, 15.4], [23.3, 71.1, 56.7, 23.6]] },
    trays: [TRAY13, TRAY10, TRAY10, TRAY10, null, null], binNames: { 1: { n: 13, 13: 'open centre (spot 13)' } } } };
  // the photo map of a modules unit, only while its sections still match the pictures (same count; a tray shows when its bin count matches)
  function modLook(u) { const L = u && u.type === 'modules' && MODLOOKS[u.id]; if (!L || (u.modules || []).length !== L.trays.length) return null;
    return { front: L.front, tray: (k) => { const t = L.trays[k - 1], m = u.modules[k - 1]; return t && m && t.rects.length === m.bins ? t : null; } }; }
  window.WNStore = { modLook, BOXES, ROOMS, roomOf, ROWS, TYPES, MY_UNITS, T1_LAYOUT, units, slots, find, describe, suggest, detail, norm, validId, pendingUpdates, look };
})();

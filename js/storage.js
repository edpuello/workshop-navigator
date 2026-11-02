// Storage units and location codes. Units are saved in the shared list (doc.locations, kind:'unit') so every device has them.
// A code is UNIT-SLOT, e.g. A2-C05 (Akro #2, row C, drawer 5), T1-D07, M1-2-07, S1-B12. Letters I and O are never used.
(function () {
  const ROWS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, no O (they look like 1 and 0)
  const p2 = (n) => String(n).padStart(2, '0');
  const TYPES = {
    grid: 'Drawer cabinet (rows × columns)',
    stack: 'Drawers, top to bottom',
    modules: 'Stacked modules / organizers',
    bins: 'Numbered bins',
  };
  // The owner's storage (2026-11-02). Order = how they're listed on the Storage page.
  const MY_UNITS = [
    ...[1, 2, 3, 4].map(n => ({ id: 'A' + n, type: 'grid', rows: 8, cols: 8, name: 'Akro-Mils 64-drawer #' + n, model: 'Akro-Mils 10164 · wall mounted' })),
    { id: 'T1', type: 'stack', count: 15, name: 'Husky 52″ chest + cabinet', model: 'Husky 15-drawer combo · #1007 590 888' },
    { id: 'C1', type: 'stack', count: 15, name: 'Husky 61″ rolling cabinet', model: 'Husky 61″ · 15 drawers' },
    { id: 'M1', type: 'modules', name: 'Husky Connect rolling system', model: 'Husky Connect · #1002 091 132', modules: [
      { name: '12-bin organizer', bins: 12, cols: 6 }, { name: '12-bin organizer', bins: 12, cols: 6 },
      { name: 'Deep pro organizer', bins: 12, cols: 6 }, { name: 'Mid tool box', bins: 0 }, { name: 'Rolling cart tool box', bins: 0 }] },
    { id: 'W1', type: 'stack', count: 2, name: 'Husky 52″ work desk', model: 'Husky adjustable desk · 2 drawers' },
    { id: 'S1', type: 'bins', count: 12, cols: 6, name: 'Outdoor shed bins', model: 'Numbered bins' },
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
    } else if (u.type === 'modules') {
      (u.modules || []).forEach((m, i) => {
        const k = i + 1;
        if (!(m.bins > 0)) out.push({ code: `${u.id}-${k}`, label: String(k), where: `${m.name || 'module ' + k} (module ${k})`, m: k });
        else for (let b = 1; b <= m.bins; b++) out.push({ code: `${u.id}-${k}-${p2(b)}`, label: p2(b), where: `${m.name || 'module ' + k} (module ${k}), bin ${b}`, m: k, b });
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
    const size = u.type === 'grid' ? `${u.rows} rows × ${u.cols}` : u.type === 'modules' ? `${(u.modules || []).length} modules` : `${u.count}`;
    return `${u.model ? u.model + ' · ' : ''}${s.length} spots (${size})${first ? ` · codes ${first.code} … ${last.code}` : ''}`;
  }
  const validId = (id) => /^[A-HJ-NP-Z][1-9]$/.test(String(id || ''));
  window.WNStore = { ROWS, TYPES, MY_UNITS, units, slots, find, describe, suggest, detail, norm, validId };
})();

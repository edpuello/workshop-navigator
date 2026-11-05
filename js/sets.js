// "Goes with": the nuts and washers that go with a bolt or machine screw (and the bolts and washers that go with a nut).
// Read straight from the part names — "1/4-20 × 3/4 in", "1/4-20 Hex Nuts", "1/4 in Flat Washers", "M6 × 1.0 A2 stainless hex nut".
// Rules: nuts must match the thread exactly (1/4-20 never 1/4-28, inch never metric); washers match the size (1/4 fits 1/4-20 and 1/4-28);
// a nyloc nut replaces hex nut + lock washer; same material first (nylon with nylon, stainless with stainless).
// Only real fasteners take part: concrete screws, toggle bolts, drill bits, wire nuts etc. never match.
(function () {
  const clean = (s) => String(s || '').replace(/["″”]/g, '').replace(/\s+/g, ' ').trim();
  const num = (v) => String(parseFloat(v));                       // "1.0" → "1", "1.25" → "1.25"
  function material(x) {
    const t = (x.name + ' ' + x.category).toLowerCase();
    if (/\bnylon\b/.test(t) && !/nylon-insert|nylon insert|nyloc/.test(t)) return 'nylon';
    if (/stainless|\ba2\b|18-8/.test(t)) return 'stainless';
    if (/brass/.test(t)) return 'brass';
    return 'steel';
  }
  // What a part is, for matching: {role: 'bolt'|'rod'|'nut'|'nyloc'|'flat'|'lock', dia, thread, len, mat} — null when it isn't one of these.
  function spec(x) {
    if (!x || !x.name) return null;
    const n = clean(x.name), c = String(x.category || ''), all = n + ' ' + c;
    if (/concrete|toggle|anchor|drywall|wood|structural|sheet metal|tek|wire nut|faucet|o-ring|rivet|assortment/i.test(all)) return null;
    let dia = '', thread = '', rest = '';
    let m = n.match(/^M(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/i);       // metric with pitch: M6 × 1.0
    if (m) { dia = 'M' + num(m[1]); thread = dia + 'x' + num(m[2]); }
    else if ((m = n.match(/^(#\d+|\d+\/\d+|\d+)\s*-\s*(\d+)\b/))) { dia = m[1]; thread = m[1] + '-' + m[2]; }   // inch: 1/4-20, #10-24
    else if ((m = n.match(/^M(\d+(?:\.\d+)?)\b/i))) dia = 'M' + num(m[1]); // metric washer: M6
    else if ((m = n.match(/^(#\d+|\d+\/\d+)(?:\s*in)?\b/))) dia = m[1];   // inch washer: 1/4 in, #10
    if (!dia) return null;
    rest = n.slice(m[0].length);
    // the part's kind comes from its name ("1/4-20 Hex Nuts" sits in "SAE Nuts & Washers"); the category only fills in when the name says nothing
    const nm = n.toLowerCase(), lower = /washer|\bnuts?\b|locknut|nyloc|screw|bolt|rod/.test(nm) ? nm : all.toLowerCase();
    const mat = material(x), lenM = rest.match(/^\s*[×x]\s*([\d\/\-. ]+(?:in|mm)?)/);
    let role = '';
    if (/washer/.test(lower)) role = /lock|split/.test(lower) ? 'lock' : 'flat';
    else if (!thread) role = '';
    else if (/threaded rod/.test(lower)) role = 'rod';
    else if (lenM) role = 'bolt';                                          // a thread then "× length": bolt or machine screw
    else if (/nyloc|nylon-insert|nylon insert|locknut|lock nut/.test(lower)) role = 'nyloc';
    else if (/\bnuts?\b/.test(lower)) role = 'nut';
    if (!role) return null;
    return { role, dia, thread, len: lenM ? lenM[1].trim() : '', mat };
  }
  // Pick the best of several candidates: same material first, then parts in stock, then the list order.
  function best(list, mat) {
    return list.slice().sort((a, b) => (a.s.mat === mat ? 0 : 1) - (b.s.mat === mat ? 0 : 1) || (b.x.store ? 1 : 0) - (a.x.store ? 1 : 0))[0] || null;
  }
  // → { me, nut, nyloc, flat, lock, bolts: [other bolts/screws of this thread], set: [{x, role, on}] } or null
  function goesWith(x, items) {
    const me = spec(x); if (!me) return null;
    const pool = (items || []).filter(y => y && !y.archived && y.id !== x.id).map(y => ({ x: y, s: spec(y) })).filter(o => o.s);
    const sameThread = (o) => o.s.thread && o.s.thread === me.thread, sameDia = (o) => o.s.dia === me.dia;
    const pick = (role, test) => { const l = pool.filter(o => o.s.role === role && test(o)); return best(l, me.mat); };
    const out = { me, nut: null, nyloc: null, flat: null, lock: null, bolts: [], set: [] };
    if (me.thread) { out.nut = me.role === 'nut' ? null : pick('nut', sameThread); out.nyloc = me.role === 'nyloc' ? null : pick('nyloc', sameThread); }
    out.flat = me.role === 'flat' ? null : pick('flat', sameDia);
    out.lock = me.role === 'lock' ? null : pick('lock', sameDia);
    // bolts/screws of the same thread (for a nut: what it fits; for a bolt: its other lengths, same material first)
    out.bolts = pool.filter(o => (o.s.role === 'bolt') && (me.thread ? sameThread(o) : sameDia(o))).sort((a, b) => (a.s.mat === me.mat ? 0 : 1) - (b.s.mat === me.mat ? 0 : 1)).map(o => o.x);
    // The set to take along. With a bolt/screw/rod: flat washer + lock washer + hex nut ticked; nyloc offered instead of nut + lock washer.
    if (me.role === 'bolt' || me.role === 'rod') {
      const nyOnly = !out.nut && out.nyloc;
      if (out.flat) out.set.push({ x: out.flat.x, role: 'flat', on: true });
      if (out.lock) out.set.push({ x: out.lock.x, role: 'lock', on: !nyOnly });
      if (out.nut) out.set.push({ x: out.nut.x, role: 'nut', on: true });
      if (out.nyloc) out.set.push({ x: out.nyloc.x, role: 'nyloc', on: nyOnly, instead: !nyOnly });
    } else {
      for (const k of ['flat', 'lock', 'nut', 'nyloc']) if (out[k]) out.set.push({ x: out[k].x, role: k, on: false });
    }
    out.set.forEach(e => { e.otherMat = spec(e.x).mat !== me.mat; if (e.otherMat) e.on = false; });   // a different material is shown, never pre-ticked
    return out;
  }
  // The word a count is in: the part's own unit, else from its kind (nuts, washers, bolts, screws…), else "pcs".
  function unitWord(x, n) {
    const u = String((x && x.unit) || '').trim(); if (u) return u;
    const s = spec(x), r = s && s.role;
    const w = r === 'nut' || r === 'nyloc' ? 'nuts' : r === 'flat' || r === 'lock' ? 'washers' : r === 'rod' ? 'rods'
      : r === 'bolt' ? (/screw/i.test((x.name || '') + ' ' + (x.category || '')) ? 'screws' : 'bolts')
      : /tape/i.test(x.name || '') ? 'rolls' : /tubing|\bwire\b/i.test(x.name || '') && !/nuts?\b|connector|terminal|stripper/i.test(x.name || '') ? 'ft' : 'pcs';
    return n === 1 && w !== 'pcs' && w !== 'ft' ? w.replace(/s$/, '') : w;
  }
  const api = { spec, goesWith, unitWord, material };
  if (typeof module !== 'undefined') module.exports = api; else window.WNSets = api;
})();

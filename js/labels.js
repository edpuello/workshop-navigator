// Drawer labels for the Zebra ZD421 (300 dpi, direct thermal).
//   front: 1.5″ × 0.5″ (450 × 150 dots) · side: 1″ × 1″ (300 × 300 dots)
//   Each roll prints Text, Data Matrix or QR code (setStyle). Defaults: front = text, side = Data Matrix only.
// The printer draws the codes itself (ZPL ^BX / ^BQ); js/datamatrix.js and js/qrcode.js draw the same symbols for the on-screen preview.
// Printing from a computer goes through Zebra Browser Print (free app for Mac/Windows, printer on USB).
(function () {
  const DPI = 300;
  const ROLLS = { front: { w: 1.5, h: 0.5, name: 'Front labels · 1.5″ × 0.5″' }, side: { w: 1, h: 1, name: 'Side labels · 1″ × 1″' } };
  const clean = (t) => String(t || '').replace(/[″”“]/g, '"').replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/[\^~]/g, '').replace(/\s+/g, ' ').trim();
  // Width of text in the printer's font (ZPL ^A0, bold condensed), in printer dots.
  // Character widths measured from real ZD421 prints (the printer draws - " × · wider than you'd expect), plus 4% to stay on the safe side.
  const CW = (ch) => ch === ' ' ? 0.27 : /[iIlj!|.,:;']/.test(ch) ? 0.24 : /[frt()\/]/.test(ch) ? 0.33 : /[0-9]/.test(ch) ? 0.52
    : ch === '-' ? 0.75 : ch === '"' ? 0.6 : ch === '×' ? 0.9 : ch === '·' ? 0.6 : /[mwMW]/.test(ch) ? 0.8 : /[A-Z]/.test(ch) ? 0.58 : /[a-z]/.test(ch) ? 0.47 : 0.62;
  // 10.22: the words are drawn by the app with a bundled font (img/label-font.ttf, DejaVu Sans Condensed Bold) and sent as a picture,
  // so the printed label looks exactly like the preview: tight hyphens, real inch marks (″), same font on every device.
  const FAM = 'WNLabel', STACK = `${FAM}, 'DejaVu Sans Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`;
  const fnt = (h) => `700 ${h}px ${STACK}`, MC = document.createElement('canvas').getContext('2d');
  function textW(t, h) { MC.font = fnt(h); return MC.measureText(String(t)).width; }
  const IMGS = new Map();
  try {
    const ff = new FontFace(FAM, `url(${new URL('img/label-font.ttf', location.href).href})`, { weight: '700' });
    ff.load().then(f => { document.fonts.add(f); LAYOUTS.clear(); IMGS.clear(); window.dispatchEvent(new Event('wn-labelfont')); }).catch(() => { });
  } catch (e) { }
  function fit(t, maxW, hMax, hMin) { let h = hMax; while (h > hMin && textW(t, h) > maxW) h--; return h; }
  // Still too long at the smallest size → cut it and end with "..." (plain dots: every printer font has them).
  function cut(t, maxW, h) { if (textW(t, h) <= maxW) return t; let s = t; while (s.length > 1 && textW(s.trimEnd() + '...', h) > maxW) s = s.slice(0, -1); return s.trimEnd() + '...'; }
  // Where a name can break onto a second line: at a space, or after a hyphen between letters ("pan-|head").
  function breaks(t) { const out = []; for (let i = 1; i < t.length - 1; i++) { if (t[i] === ' ') out.push([t.slice(0, i), t.slice(i + 1)]); else if (t[i] === '-' && /[a-z]/i.test(t[i - 1]) && /[a-z]/i.test(t[i + 1])) out.push([t.slice(0, i + 1), t.slice(i + 1)]); } return out; }
  // The part name as 1 or 2 lines, as big as it can be. Two lines only when that makes the text bigger.
  // The app splits the lines itself, so the printer never wraps (its own wrapping printed lines on top of each other).
  function nameLines(t, tw, maxOne, maxTwo, minH) {
    const h1 = fit(t, tw, maxOne, minH), oneFits = textW(t, h1) <= tw;
    if (oneFits && h1 >= maxTwo) return { lines: [t], h: h1 }; // one line is already as big as two could be
    let best = null; for (const [a, b] of breaks(t)) { const awk = /^(in|mm|ft|x|×|-|#)\b|^(in|mm|ft)$/i.test(b.trim()) || /(×|x|-)$/i.test(a.trim()); const w = Math.max(textW(a, 1), textW(b, 1)) * (awk ? 1.18 : 1); if (!best || w < best.w) best = { a, b, w }; } // keep a size with its unit ("1-1/2 in"), never end a line on "×"
    if (best) best.w = Math.max(textW(best.a, 1), textW(best.b, 1));
    if (!best) return { lines: [cut(t, tw, h1)], h: h1 };
    const h2 = Math.min(maxTwo, Math.floor(tw / best.w));
    if (oneFits && h1 >= h2) return { lines: [t], h: h1 };
    if (h2 >= minH) return { lines: [best.a, best.b], h: h2 };
    // Very long: fill the first line with whole words at the smallest size, the rest goes on line 2 (ends with "..." if it still doesn't fit).
    const words = t.split(' '); let a = words.shift(); while (words.length && textW(a + ' ' + words[0], minH) <= tw) a += ' ' + words.shift();
    return { lines: [cut(a, tw, minH), cut(words.join(' '), tw, minH)].filter(Boolean), h: minH };
  }
  // ---------- 10.22: what a label says — the main name big, the rest small.
  // Inch marks and ×: "1/4-20 x 1 in" → "1/4-20 × 1″"; starting caps on words ("4″ Zip Ties"), units stay lower case.
  const pretty = (t) => String(t || '').replace(/[“”]/g, '"').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
    .replace(/(\d)\s*(?:in\.?|inch(?:es)?)(?=$|[\s,·)—–-])/gi, '$1″').replace(/(\d)"/g, '$1″').replace(/(\d)″-(\d)/g, '$1-$2')
    .replace(/(\d)\s*[xX]\s*(?=[\d#M])/g, '$1 × ').replace(/\s*×\s*/g, ' × ').replace(/[\^~]/g, '');
  const SMALLW = new Set(['of', 'and', 'for', 'the', 'with', 'per', 'or', 'to', 'a', 'an']), UNITS = /^(mm|cm|in|ft|lb|lbs|oz|ml|x|×)$/;
  const title = (t) => String(t || '').split(' ').map((w, i) => w.split('-').map((q, j) => { const m = q.match(/^([(]?)([a-z][a-z']*)([,.;:)!?]*)$/); return m && !UNITS.test(m[2]) && !(i > 0 && j === 0 && SMALLW.has(m[2])) ? m[1] + m[2][0].toUpperCase() + m[2].slice(1) + m[3] : q; }).join('-')).join(' ');
  const MATS = [[/\bA2 stainless( steel)?\b/i, 'A2 Stainless'], [/\b18-8 stainless( steel)?\b/i, '18-8 Stainless'], [/\b316 stainless( steel)?\b/i, '316 Stainless'], [/\bstainless steel\b/i, 'Stainless'], [/\bstainless\b/i, 'Stainless'],
    [/\bzinc[- ]plated\b/i, 'Zinc Plated'], [/\bgalvanized\b/i, 'Galvanized'], [/\bblack oxide\b/i, 'Black Oxide'], [/\bnylon\b/i, 'Nylon'], [/\baluminum\b/i, 'Aluminum'], [/\bbrass\b/i, 'Brass']];
  const TYPES = [[/socket[- ]head cap screws?/i, 'Socket Cap Screw'], [/nylon[- ]insert lock ?nuts?/i, 'Nyloc Nut'], [/phillips pan[- ]head machine screws?/i, 'Phillips Pan-Head'], [/slotted round[- ]head machine screws?/i, 'Slotted Round-Head'], [/pan[- ]head machine screws?/i, 'Pan-Head Screw'], [/\(standard series\)/i, '']];
  const CAT_TYPE = { 'SAE Machine Screws': 'Machine Screw', 'SAE Hex Bolts': 'Hex Bolt', 'Construction & Wood Screws': 'Wood Screw' };
  const SIZE_TOK = /^(#\d[\d\-\/]*|M\d+(\.\d+)?|\d[\d.\/\-]*″?|×|mm|″)$/;
  // one thing → {main, desc}: "1/4-20 × 1″" + "Hex Bolt · 18-8 Stainless"
  function words(x) {
    let name = pretty(x.name); const extra = [];
    { const bits = name.split(/\s+·\s+/); name = bits.shift(); extra.push(...bits); }
    { const bits = name.split(/\s+[—–]\s+/); name = bits.shift(); extra.push(...bits); }
    let mat = '';
    for (const [re, v] of MATS) { if (re.test(name) || extra.some(e => re.test(e))) { mat = v; name = name.replace(re, ' '); for (let i = 0; i < extra.length; i++) extra[i] = extra[i].replace(re, ' '); break; } }
    const ex = extra.map(e => e.replace(/\s+/g, ' ').trim()).filter(Boolean);
    name = name.replace(/\s+/g, ' ').trim();
    const toks = name.split(' '); let k = 0; while (k < toks.length && SIZE_TOK.test(toks[k])) k++;
    const size = toks.slice(0, k).join(' '); let rest = toks.slice(k).join(' ');
    for (const [re, v] of TYPES) rest = rest.replace(re, v); rest = rest.replace(/\s+/g, ' ').trim();
    if (/^(sheet metal|structural|tek|self[- ]drilling|deck|drywall)$/i.test(rest)) rest += ' screw';
    let main, type = '';
    if (!size || !/\d/.test(size)) main = name;
    else if (/×/.test(size)) { main = size; type = rest || CAT_TYPE[x.category] || ''; }   // has a length: just the size big, what it is goes small
    else { main = size + (rest ? ' ' + rest : ''); if (!rest) type = CAT_TYPE[x.category] || ''; }   // no length: "#10 Flat Washers"
    let desc = [type, ...ex, mat].filter(Boolean).map(title);
    if (!desc.length && x.category && !/^reserved$/i.test(x.category)) desc = [title(pretty(x.category))];
    return { main: title(main || pretty(x.name)), desc: desc.join(' · ') };
  }
  function content(code, parts, where) {
    const ps = parts || [], f = ps.length ? words(ps[0]) : null;
    const name = ps.length ? clean(ps[0].name) + (ps.length > 1 ? ` +${ps.length - 1}` : '') : '';
    const cat = ps.length ? clean(ps[0].category || '') : clean(where || '');
    const desc = f ? [f.desc, ps.length > 1 ? `+${ps.length - 1} more` : ''].filter(Boolean).join(' · ') : '';
    return { code: clean(code), name, cat, main: f ? f.main : '', desc, reserved: !!(ps.length && /^reserved$/i.test(ps[0].category || '')) };
  }
  // A storage location's own label (cabinet, drawer, organizer, tote…): QR code + its code + its name.
  function location(code, name) { return { code: clean(code), name: clean(name), cat: '', main: clean(code), desc: pretty(name), loc: true }; }
  // A custom label: your text printed as big as it fits, with an optional smaller second line.
  const asciiOK = (s) => /^[\x20-\x7E]*$/.test(String(s));
  function custom(data, caption, line2) { return { code: String(data || ''), name: clean(caption), cat: clean(line2), main: pretty(caption) || String(data || ''), desc: pretty(line2), custom: true }; }
  // Can it be drawn on a small label? → {ok, size, chars, why}
  function check(data) {
    const d = String(data || '').trim();
    if (!d) return { ok: false, why: 'Type the text for the label.' };
    if (d.length > 60) return { ok: false, why: `That's ${d.length} characters — keep it to 60 so it stays readable.` };
    return { ok: true, chars: d.length };
  }
  const awk = (a, b) => /^(in|mm|ft|x|×|-|″)(\s|$)/i.test(b.trim()) || /-$/.test(a.trim());

  // ---------- what goes on a label: 'text' (words only), 'dm' (Data Matrix) or 'qr' (QR code), chosen per roll.
  // A drawer's QR code is a link to that drawer: …/app/?loc=CODE — the same kind of link as the NFC tags, so the iPhone Camera opens the app (universal link) and a computer opens the website; its Data Matrix holds just the code (the app's scanner reads both).
  // A custom label's code holds exactly the text you typed. A location label is always a QR code.
  const STYLES = ['text', 'dm', 'qr'], STYLE = { front: 'text', side: 'dm' };
  const SITE = 'https://edpuello.github.io/workshop-navigator/';
  const rk = (roll) => roll === 'side' ? 'side' : 'front';
  const setStyle = (roll, st) => { if (STYLES.includes(st)) STYLE[rk(roll)] = st; };
  const styleOf = (roll, c) => c && c.loc ? 'qr' : STYLES.includes(c && c.style) ? c.style : STYLE[rk(roll)];
  const symData = (kind, c) => kind === 'qr' ? (c.custom ? String(c.code).trim() : SITE + 'app/?loc=' + encodeURIComponent(c.code)) : clean(c.code).replace(/×/g, 'x');
  const SYMS = new Map();
  function symbolFor(kind, c) {
    const data = symData(kind, c), key = kind + '|' + data; if (SYMS.has(key)) return SYMS.get(key); let M = null;
    try { M = !data ? null : kind === 'qr' ? window.WNQR.matrix(data) : /^[\x20-\x7E]+$/.test(data) ? window.WNDataMatrix.matrix(data) : null; } catch (e) { M = null; }
    const out = M ? { kind, data, M, n: M.length } : null;
    if (SYMS.size > 600) SYMS.clear(); SYMS.set(key, out); return out;
  }

  // ---------- layout, in printer dots (300 dpi). rows = [{t, x, y (baseline), h (font size)}]
  const CAPH = 0.73, LINE = 1.06;   // the font's capital height, and line spacing, as a share of its size
  // Sizes stay the same on every label of a roll: the main name is shown at `main` unless it doesn't fit; the bottom row at `small`.
  const SZ = {
    front: { main: 62, min1: 44, two: 44, min2: 22, small: 24, smin: 15 },
    side: { main: 66, min1: 40, two: 50, min2: 22, small: 26, smin: 16 },
    frontSym: { main: 46, min1: 30, two: 34, min2: 18, small: 20, smin: 14 },
  };
  const MX = 14;
  function fitOne(t, w, hi, lo) { let h = hi; while (h > lo && textW(t, h) > w) h--; return h; }
  function ell(t, w, h) { if (textW(t, h) <= w) return t; let x = t; while (x.length > 1 && textW(x.trimEnd() + '…', h) > w) x = x.slice(0, -1); return x.trimEnd() + '…'; }
  // the main name: one line at the standard size (shrinks only if it must), else two lines a bit smaller
  function mainLines(t, w, area, o) {
    const cap1 = Math.min(o.main, Math.floor(area / CAPH)), h1 = fitOne(t, w, cap1, o.min1);
    if (textW(t, h1) <= w) return { ls: [t], h: h1 };
    let best = null; for (const [a, b] of breaks(t)) { if (awk(a, b)) continue; const ww = Math.max(textW(a, 100), textW(b, 100)); if (!best || ww < best.ww) best = { a, b, ww }; }
    if (best) { const cap2 = Math.min(o.two, Math.floor(area / (CAPH + LINE))); let h = cap2; while (h > o.min2 && (textW(best.a, h) > w || textW(best.b, h) > w)) h--; return { ls: [ell(best.a, w, h), ell(best.b, w, h)], h }; }
    return { ls: [ell(t, w, o.min1)], h: o.min1 };
  }
  // main lines centered in a box (top..bottom), each line centered across x..x+w
  function placeMain(ls, h, x, w, top, bottom) {
    const block = CAPH * h + (ls.length - 1) * LINE * h; let y = Math.round(top + (bottom - top - block) / 2 + CAPH * h);
    return ls.map(t => { const r = { t, h, y, x: Math.round(x + (w - textW(t, h)) / 2) }; y += Math.round(LINE * h); return r; });
  }
  // the bottom row: description on the left (shrinks, then "…"), location on the right
  function bottomRow(left, right, x, w, y, o) {
    const rows = [], rw = right ? textW(right, o.small) : 0;
    if (right) rows.push({ t: right, h: o.small, y, x: Math.round(x + w - rw) });
    if (left) { const room = w - (right ? rw + 22 : 0), hl = fitOne(left, room, o.small, o.smin), t = ell(left, room, hl); rows.push({ t, h: hl, y, x: right ? x : Math.round(x + (w - textW(t, hl)) / 2) }); }
    return rows;
  }
  const LAYOUTS = new Map();
  function layout(roll, c) {
    const key = [rk(roll), styleOf(roll, c), c.code, c.main, c.desc, c.custom ? 1 : 0, c.loc ? 1 : 0, c.reserved ? 1 : 0].join('\u0001');
    if (LAYOUTS.has(key)) return LAYOUTS.get(key);
    if (LAYOUTS.size > 600) LAYOUTS.clear();
    const L = layout0(roll, c); LAYOUTS.set(key, L); return L;
  }
  function layout0(roll, c) {
    const side = rk(roll) === 'side', W = side ? 300 : 450, H = side ? 300 : 150, st = styleOf(roll, c);
    const has = !!c.main, main = c.main || c.code;
    const sym = st === 'text' ? null : symbolFor(st, c);
    if (!sym) {
      const o = SZ[side ? 'side' : 'front'], w = W - 2 * MX;
      if (!has && !c.custom) { const h = fitOne(c.code, w, side ? 90 : 80, 20); return { W, H, style: 'text', rows: placeMain([c.code], h, MX, w, 0, H) }; }   // an empty spot: just its code, big
      const sub = c.custom ? '' : (c.reserved ? '' : c.desc), right = c.custom ? '' : c.code, left = c.custom ? c.desc : sub;
      if (side) {   // square: main name in the middle, then the description, then the location
        const small = [left, right].filter(Boolean), base = H - 16, rows = [];
        small.slice().reverse().forEach((t, i) => { const h = fitOne(t, w, o.small, o.smin); rows.push({ t: ell(t, w, h), h, y: base - i * Math.round(o.small * 1.25), x: 0 }); });
        rows.forEach(r => { r.x = Math.round(MX + (w - textW(r.t, r.h)) / 2); });
        const bottom = (small.length ? base - small.length * Math.round(o.small * 1.25) : H - 16) - 6;
        const m = mainLines(main, w, bottom - 14, o); return { W, H, style: 'text', rows: [...placeMain(m.ls, m.h, MX, w, 14, bottom), ...rows] };
      }
      const base = H - 12, bottom = (left || right) ? base - Math.round(o.small * CAPH) - 10 : H - 8;
      const m = mainLines(main, w, bottom - 8, c.custom ? { ...o, main: 70 } : o);
      return { W, H, style: 'text', rows: [...placeMain(m.ls, m.h, MX, w, 8, bottom), ...bottomRow(left, right, MX, w, base, o)] };
    }
    const qz = sym.kind === 'qr' ? 2 : 1, mmax = sym.kind === 'qr' ? 10 : 24;
    if (side) {
      if (c.loc) {   // location: QR on top, its code and name underneath
        const nameH = c.desc ? 22 : 0, codeH = 40, room = H - 2 * 12 - codeH - (nameH ? nameH + 8 : 0) - 10;
        const m = Math.max(2, Math.min(mmax, Math.floor(Math.min(W - 2 * MX, room) / (sym.n + 2 * qz)))), sz = sym.n * m, y0 = 12 + qz * m;
        const rows = [], cy = y0 + sz + qz * m + Math.round(codeH * CAPH) + 2, ch = fitOne(c.code, W - 2 * MX, codeH, 20);
        rows.push({ t: c.code, h: ch, y: cy, x: Math.round((W - textW(c.code, ch)) / 2) });
        if (c.desc) { const nh = fitOne(c.desc, W - 2 * MX, nameH, 14), t = ell(c.desc, W - 2 * MX, nh); rows.push({ t, h: nh, y: cy + nameH + 8, x: Math.round((W - textW(t, nh)) / 2) }); }
        return { W, H, style: 'qr', sym: { ...sym, m, s: sz, x: Math.round((W - sz) / 2), y: y0 }, rows };
      }
      const m = Math.max(2, Math.min(mmax, Math.floor((W - 2 * MX) / (sym.n + 2 * qz)))), sz = sym.n * m;
      return { W, H, style: sym.kind, sym: { ...sym, m, s: sz, x: Math.round((W - sz) / 2), y: Math.round((H - sz) / 2) }, rows: [] };
    }
    // 1.5″ × 0.5″ with a code: the code on the left, the words beside it
    const m = Math.max(2, Math.min(mmax, Math.floor((H - 2 * 10) / sym.n))), sz = sym.n * m, tx = MX + sz + 16, w = W - MX - tx, o = SZ.frontSym;
    const symO = { ...sym, m, s: sz, x: MX, y: Math.round((H - sz) / 2) };
    if (c.loc) { const ch = fitOne(c.code, w, 56, 24), rows = placeMain([c.code], ch, tx, w, 10, c.desc ? 92 : H - 10); if (c.desc) { const nh = fitOne(c.desc, w, 24, 14), t = ell(c.desc, w, nh); rows.push({ t, h: nh, y: 124, x: Math.round(tx + (w - textW(t, nh)) / 2) }); } return { W, H, style: 'qr', sym: symO, rows }; }
    if (!has && !c.custom) { const h = fitOne(c.code, w, 56, 18); return { W, H, style: sym.kind, sym: symO, rows: placeMain([c.code], h, tx, w, 0, H) }; }
    const left = c.custom ? c.desc : (c.reserved ? '' : c.desc), right = c.custom ? '' : c.code, base = H - 14, bottom = (left || right) ? base - Math.round(o.small * CAPH) - 10 : H - 10;
    const mm = mainLines(main, w, bottom - 10, o);
    return { W, H, style: sym.kind, sym: symO, rows: [...placeMain(mm.ls, mm.h, tx, w, 10, bottom), ...bottomRow(left, right, tx, w, base, o)] };
  }
  const frontLayout = (c) => layout('front', c), sideLayout = (c) => layout('side', c);

  // ---------- drawing: the label as a picture (canvas, 1 pixel = 1 printer dot)
  function paint(L, withSym) {
    const cv = document.createElement('canvas'); cv.width = L.W; cv.height = L.H; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, L.W, L.H); g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
    for (const r of L.rows) { g.font = fnt(r.h); g.fillText(r.t, r.x, r.y); }
    const S = L.sym; if (withSym && S) S.M.forEach((row, r) => row.forEach((v, k) => { if (v) g.fillRect(S.x + k * S.m, S.y + r * S.m, S.m, S.m); }));
    return cv;
  }
  function imageOf(roll, c) { const L = layout(roll, c), key = rk(roll) + '|' + [styleOf(roll, c), c.code, c.main, c.desc, c.custom, c.loc, c.reserved].join('\u0001'); if (IMGS.has(key)) return IMGS.get(key); if (IMGS.size > 400) IMGS.clear(); const u = paint(L, true).toDataURL('image/png'); IMGS.set(key, u); return u; }

  // ---------- ZPL: the words go as one picture (^GF, compressed), the printer draws the code itself (^BX Data Matrix / ^BQ QR)
  let MEDIA = 'continuous'; // 'continuous' (no gaps: label + 1″ to tear, then stop) or 'gap' (die-cut labels)
  const setMedia = (m) => { MEDIA = m === 'gap' ? 'gap' : 'continuous'; };
  const head = (w, h) => MEDIA === 'gap' ? `^XA^CI28^MNY^MMT^PW${w}^LL${h}^LH0,0` : `^XA^CI28^MNN^MMT^PW${w}^LL${h + DPI}^LH0,0`;
  const fdv = (v) => String(v).replace(/_/g, '_5F').replace(/\^/g, '_5E').replace(/~/g, '_7E');
  const fd = (v) => '^FH_^FD' + fdv(v) + '^FS';
  // Zebra's compressed hex: G–Y repeat 1–19, g–z repeat 20–400; "," = rest of the row blank, ":" = same row as above
  const rep1 = (n) => { let o = ''; while (n >= 400) { o += 'z'; n -= 400; } if (n >= 20) { o += String.fromCharCode(102 + Math.floor(n / 20)); n %= 20; } if (n) o += String.fromCharCode(70 + n); return o; };
  function packRow(hex, prev) {
    if (hex === prev) return ':'; if (/^0+$/.test(hex)) return ',';
    let t = hex, tail = ''; const z = t.match(/0+$/); if (z && z[0].length > 1) { t = t.slice(0, -z[0].length); tail = ','; }
    let o = ''; for (let i = 0; i < t.length;) { let j = i; while (j < t.length && t[j] === t[i]) j++; o += (j - i > 1 ? rep1(j - i) : '') + t[i]; i = j; } return o + tail;
  }
  function textGraphic(L) {
    if (!L.rows.length) return '';
    const cv = paint(L, false), d = cv.getContext('2d').getImageData(0, 0, L.W, L.H).data, bpr = Math.ceil(L.W / 8); let out = '', prev = null;
    for (let y = 0; y < L.H; y++) { let hex = ''; for (let b = 0; b < bpr; b++) { let v = 0; for (let k = 0; k < 8; k++) { const x = b * 8 + k; if (x < L.W) { const i = (y * L.W + x) * 4; if (d[i + 3] > 0 && (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 < 140) v |= 128 >> k; } } hex += (v < 16 ? '0' : '') + v.toString(16).toUpperCase(); } out += packRow(hex, prev); prev = hex; }
    return `^FO0,0^GFA,${bpr * L.H},${bpr * L.H},${bpr},${out}^FS\n`;
  }
  function zpl(roll, c, copies) {
    const q = Math.max(1, Math.min(9, copies | 0 || 1)), L = layout(roll, c), S = L.sym;
    const sym = !S ? '' : S.kind === 'qr' ? `^FO${S.x},${S.y}^BQN,2,${S.m}^FH_^FDMA,${fdv(S.data)}^FS\n` : `^FO${S.x},${S.y}^BXN,${S.m},200${fd(S.data)}\n`;
    return `${head(L.W, L.H)}\n` + textGraphic(L) + sym + `^PQ${q}^XZ\n`;
  }
  // ---------- on-screen preview: the same picture that gets printed. px = screen pixels per inch.
  function preview(roll, c, px) {
    const L = layout(roll, c);
    return `<div class="zlabel" style="position:relative;width:${L.W / DPI * px}px;height:${L.H / DPI * px}px;background:#fff;border-radius:${px * 0.03}px;box-shadow:0 1px 2px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.08);overflow:hidden;color:#000;flex:none"><img src="${imageOf(roll, c)}" alt="" draggable="false" style="display:block;width:100%;height:100%;pointer-events:none"></div>`;
  }
  // ---------- the label as one SVG at real size (for DYMO and AirPrint / print dialog): the same picture inside
  function svgLabel(roll, c) { const L = layout(roll, c); return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${L.W / DPI}in" height="${L.H / DPI}in" viewBox="0 0 ${L.W} ${L.H}"><image width="${L.W}" height="${L.H}" href="${imageOf(roll, c)}" xlink:href="${imageOf(roll, c)}" style="image-rendering:pixelated"/></svg>`; }
  // Same picture as a PNG (base64, no prefix) at 300 dpi, for printers that take an image (DYMO, AirPrint from the app).
  function png(roll, c) { try { return Promise.resolve(imageOf(roll, c).split(',')[1]); } catch (e) { return Promise.reject(e); } }
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // ---------- Zebra Browser Print (computer with the printer on USB)
  const BP = () => (location.protocol === 'https:' ? 'https://localhost:9101/' : 'http://localhost:9100/');
  function timed(p, ms) { return Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]); }
  let printer = null, lastLook = 0;
  const isDev = (d) => !!(d && (d.uid || d.name));
  async function listed() { try { const r = await timed(fetch(BP() + 'available', { method: 'GET' }), 3000); if (!r.ok) return null; const j = JSON.parse((await r.text()) || '{}'); return (j.printer || []).find(isDev) || null; } catch (e) { return null; } }
  async function findPrinter(force) {
    if (!force && Date.now() - lastLook < 20000) return printer;
    lastLook = Date.now();
    try { const r = await timed(fetch(BP() + 'default?type=printer', { method: 'GET' }), 2500); const t = r.ok ? (await r.text()).trim() : ''; let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { } printer = isDev(d) ? d : await listed(); }
    catch (e) { printer = null; }
    return printer;
  }
  // Full check: is Browser Print running, does it have a printer, and what does the printer itself say (~HQES)?
  const ERR = [[0x1, 'out of labels'], [0x2, 'ribbon out'], [0x4, 'print head open'], [0x8, 'cutter fault'], [0x10, 'print head too hot'], [0x20, 'motor too hot'], [0x40, 'bad print head element'], [0x80, 'print head not detected']];
  async function status() {
    let txt;
    try { const r = await timed(fetch(BP() + 'default?type=printer', { method: 'GET' }), 3000); txt = r.ok ? (await r.text()).trim() : null; if (!r.ok) return { state: 'refused', why: (await r.text().catch(() => '')) || 'Browser Print refused this site' }; }
    catch (e) { return { state: 'nobp' }; }
    let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) { }
    printer = isDev(d) ? d : await listed();
    if (!printer) return { state: 'noprinter' };
    lastLook = Date.now();
    try {
      await timed(fetch(BP() + 'write', { method: 'POST', body: JSON.stringify({ device: printer, data: '~HQES' }) }), 5000);
      const r = await timed(fetch(BP() + 'read', { method: 'POST', body: JSON.stringify({ device: printer }) }), 5000); const t = r.ok ? await r.text() : '';
      const m = t.match(/ERRORS:\s*(\d)\s+([0-9A-Fa-f]{8})\s+([0-9A-Fa-f]{8})/);
      if (!m) return { state: 'ready', printer, note: 'Connected (the printer didn’t report its status).' };
      const flags = parseInt(m[3], 16), probs = ERR.filter(([b]) => flags & b).map(([, w]) => w);
      const model = await askModel(printer);
      return m[1] === '0' || !flags ? { state: 'ready', printer, model } : { state: 'problem', printer, model, probs: probs.length ? probs : ['an error code ' + m[2] + ' ' + m[3]] };
    } catch (e) { return { state: 'ready', printer, note: 'Connected, but the printer didn’t answer a status check — is it switched on?' }; }
  }
  // The printer's own model name (e.g. "ZD421-300dpi"), asked once and remembered on this device. Never fails the check.
  async function askModel(dev) {
    const key = 'wn-zmodel:' + (dev.uid || dev.name); try { const v = localStorage.getItem(key); if (v) return v; } catch (e) { }
    try {
      await timed(fetch(BP() + 'write', { method: 'POST', body: JSON.stringify({ device: dev, data: '! U1 getvar "device.product_name"\r\n' }) }), 4000);
      const r = await timed(fetch(BP() + 'read', { method: 'POST', body: JSON.stringify({ device: dev }) }), 4000), t = r.ok ? await r.text() : '';
      const m = t.match(/"([^"]{2,40})"/); const v = m ? m[1].trim() : '';
      if (v && /[a-z0-9]/i.test(v) && !/\?/.test(v)) { try { localStorage.setItem(key, v); } catch (e) { } return v; }
    } catch (e) { }
    return '';
  }
  async function send(data, to) {
    const dev = to || printer || await findPrinter(true); if (!dev) throw new Error('No Zebra printer found. Is Zebra Browser Print running on this computer?');
    const r = await timed(fetch(BP() + 'write', { method: 'POST', body: JSON.stringify({ device: dev, data }) }), 15000);
    if (!r.ok) throw new Error((await r.text()) || 'The printer refused the job');
  }
  window.WNLabels = { location, words, pretty, title, svgLabel, setStyle, style: (roll) => STYLE[rk(roll)], STYLES, layout, png, BP, timed, setMedia, get media() { return MEDIA; }, ROLLS, content, custom, check, zpl, preview, textW, findPrinter, status, send, get printer() { return printer; }, frontLayout, sideLayout, clean };
})();

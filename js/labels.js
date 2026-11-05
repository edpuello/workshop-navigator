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
  function textW(t, h) { let w = 0; for (const ch of String(t)) w += CW(ch); return w * h * 1.04; }
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
  // What a label says. parts = the parts in that spot (may be empty).
  function content(code, parts, where) {
    const ps = parts || [];
    const name = ps.length ? clean(ps[0].name) + (ps.length > 1 ? ` +${ps.length - 1}` : '') : ''; // more than one part: first name + "+1" keeps the text big enough to read
    const cat = ps.length ? clean(ps[0].category || '') : clean(where || '');
    return { code: clean(code), name, cat };
  }
  // A custom label: your text printed as big as it fits, with an optional smaller second line.
  const asciiOK = (s) => /^[\x20-\x7E]*$/.test(String(s));
  function custom(data, caption, line2) { return { code: String(data || ''), name: clean(caption), cat: clean(line2), custom: true }; }
  // Can it be drawn on a small label? → {ok, size, chars, why}
  function check(data) {
    const d = String(data || '').trim();
    if (!d) return { ok: false, why: 'Type the text for the label.' };
    if (d.length > 60) return { ok: false, why: `That's ${d.length} characters — keep it to 60 so it stays readable.` };
    return { ok: true, chars: d.length };
  }

  // ---------- layout (shared by ZPL and preview, in printer dots)
  // Text only, centered, all bold (10.12). The size is the biggest that lets
  // every line fit the label's width and height; the part name may use 1–2 lines (front) or 1–3 (side),
  // whichever gives the biggest text. Sizes stay with their units ("1-1/2 in"), lines never end on "×".
  const MX = 12, MY = 10;
  // A bad place to break: the next line would start with a unit or "×" ("in", "× 1 in"), or this line ends on "-". Breaking right after "×" is fine ("1/4-20 ×" / "1-1/2 in").
  const awk = (a, b) => /^(in|mm|ft|x|×|-)(\s|$)/i.test(b.trim()) || /-$/.test(a.trim());
  function splits(t, k) {
    if (k === 1) return [{ ls: [t], bad: false }];
    const out = [];
    for (const [a, b] of breaks(t)) {
      const soft = (x) => /(×|x)$/i.test(x.trim()) ? 1 : 0;   // breaking after "×" is allowed but only wins when it makes the text bigger
      if (k === 2) out.push({ ls: [a, b], bad: awk(a, b), soft: soft(a) });
      else for (const [b1, b2] of breaks(b)) out.push({ ls: [a, b1, b2], bad: awk(a, b) || awk(b1, b2), soft: soft(a) + soft(b1) });
    }
    return out;
  }
  // ---------- what goes on a label: 'text' (words only), 'dm' (Data Matrix) or 'qr' (QR code), chosen per roll.
  // A drawer's QR code is a link to that drawer (any phone camera opens it); its Data Matrix holds just the code (the app's scanner reads both).
  // A custom label's code holds exactly the text you typed.
  const STYLES = ['text', 'dm', 'qr'], STYLE = { front: 'text', side: 'dm' };
  const SITE = 'https://edpuello.github.io/workshop-navigator/';
  const rk = (roll) => roll === 'side' ? 'side' : 'front';
  const setStyle = (roll, st) => { if (STYLES.includes(st)) STYLE[rk(roll)] = st; };
  const styleOf = (roll, c) => STYLES.includes(c && c.style) ? c.style : STYLE[rk(roll)];
  // Data Matrix: plain keyboard characters only (curly quotes → straight, × → x), so the printed code and the preview hold the same thing.
  const symData = (kind, c) => kind === 'qr' ? (c.custom ? String(c.code).trim() : SITE + '#loc=' + c.code) : clean(c.code).replace(/×/g, 'x');
  const SYMS = new Map();   // the same code is drawn once, then reused (QR codes take a few ms each)
  function symbolFor(kind, c) {
    const data = symData(kind, c), key = kind + '|' + data; if (SYMS.has(key)) return SYMS.get(key); let M = null;
    try { M = !data ? null : kind === 'qr' ? window.WNQR.matrix(data) : /^[\x20-\x7E]+$/.test(data) ? window.WNDataMatrix.matrix(data) : null; } catch (e) { M = null; }
    const out = M ? { kind, data, M, n: M.length } : null;   // too long for a small symbol → the label falls back to text
    if (SYMS.size > 600) SYMS.clear(); SYMS.set(key, out); return out;
  }

  // ---------- text layout. box = the area to fill {x, y, w, h}, margins already taken off.
  // o.maxK = most lines for the main text; o.cap = its biggest size (so labels match each other);
  // o.sub = the code line's size (default: about half the main text). Fewer lines win unless more lines make the text clearly bigger.
  const PREFER = 1.45, LEAD = 6, SUB = 0.55;
  function layoutText(main, sub, box, o) {
    const tw = box.w, th = box.h, maxK = o.maxK || 1, prefer = o.prefer || PREFER, cap = o.cap || 999; let best = null;
    const want = (h) => o.sub ? Math.min(o.sub, h) : Math.max(Math.min(26, Math.floor(h * 0.8)), Math.min(38, Math.round(h * SUB)));
    for (let k = 1; k <= maxK; k++) {
      for (const sp of splits(main, k)) {
        if (sp.bad) continue;   // never split a size from its unit or start a line with "×"
        const ls = sp.ls; let h = Math.min(cap, Math.floor(th / ls.length)), hs = 0;
        for (; h >= 14; h--) {
          hs = sub ? fit(sub, tw, want(h), 14) : 0;
          const tot = ls.length * h + (ls.length - 1) * LEAD + (sub ? LEAD + 2 + hs : 0);
          if (tot <= th && ls.every(l => textW(l, h) <= tw)) break;
        }
        if (h < 14) continue;
        const score = h / Math.pow(prefer, k - 1) - (sp.soft || 0) * 0.3;
        if (!best || score > best.score) best = { ls, h, hs, score };
      }
    }
    if (!best) { best = { ls: [cut(main, tw, 14)], h: 14, hs: 0 }; sub = ''; }
    const rows = best.ls.map(t => ({ t, h: best.h }));
    if (sub) rows.push({ t: cut(sub, tw, best.hs), h: best.hs, gap: 2 });
    const block = rows.reduce((a, r, i) => a + r.h + (i ? LEAD + (r.gap || 0) : 0), 0);
    let y = box.y + Math.round((th - block) / 2);
    return { tw, rows: rows.map((r, i) => { if (i) y += LEAD + (r.gap || 0); const o2 = { t: r.t, h: r.h, y, x: box.x + Math.max(0, Math.round((tw - Math.min(textW(r.t, r.h), tw)) / 2)), bold: true }; y += r.h; return o2; }) };
  }
  // Text sizes that stay the same on every drawer label (smaller only when a long name needs it).
  const SIZE = { front: { cap: 42, sub: 28, maxK: 2, prefer: 1.15 }, side: { cap: 56, sub: 34, maxK: 3, prefer: 1.1 }, frontSym: { cap: 36, sub: 26, maxK: 3, prefer: 1.15 } };
  // The whole label in printer dots: {W, H, style, sym?, rows}.
  //   1.5″ × 0.5″ (450 × 150): text centered · or the code on the left with the text beside it.
  //   1″ × 1″ (300 × 300): text centered · or just the code, as big as it fits.
  const LAYOUTS = new Map();
  function layout(roll, c) {
    const key = [rk(roll), styleOf(roll, c), c.code, c.name, c.cat, c.custom ? 1 : 0].join('\u0001');
    if (LAYOUTS.has(key)) return LAYOUTS.get(key);
    if (LAYOUTS.size > 600) LAYOUTS.clear();
    const L = layout0(roll, c); LAYOUTS.set(key, L); return L;
  }
  function layout0(roll, c) {
    const side = rk(roll) === 'side', W = side ? 300 : 450, H = side ? 300 : 150, st = styleOf(roll, c);
    const part = !c.custom && !!c.name, main = c.custom ? (c.name || c.code) : (c.name || c.code), sub = c.custom ? (c.cat || '') : (c.name ? c.code : '');
    const sym = st === 'text' ? null : symbolFor(st, c);
    if (!sym) {
      const box = { x: MX, y: MY, w: W - 2 * MX, h: H - 2 * MY };
      const o = part ? SIZE[side ? 'side' : 'front'] : c.custom ? { maxK: side ? 3 : 2, prefer: side ? 1.15 : PREFER } : { maxK: 1 };   // an empty drawer's label is just its code, big
      return { W, H, style: 'text', ...layoutText(main, sub, box, o) };
    }
    const qz = sym.kind === 'qr' ? 2 : 1, mmax = sym.kind === 'qr' ? 10 : 24;   // QR: the printer allows up to 10 dots per square
    if (side) {
      const m = Math.max(2, Math.min(mmax, Math.floor((W - 2 * MX) / (sym.n + 2 * qz)))), s = sym.n * m;
      return { W, H, style: sym.kind, sym: { ...sym, m, s, x: Math.round((W - s) / 2), y: Math.round((H - s) / 2) }, rows: [], tw: 0 };
    }
    const m = Math.max(2, Math.min(mmax, Math.floor((H - 2 * MY) / sym.n))), s = sym.n * m, sx = MX, tx = sx + s + 16;
    const box = { x: tx, y: MY, w: W - MX - tx, h: H - 2 * MY };
    const T = part ? layoutText(main, sub, box, SIZE.frontSym) : layoutText(main, sub, box, { maxK: c.custom ? 3 : 1, prefer: 1.25 });
    return { W, H, style: sym.kind, sym: { ...sym, m, s, x: sx, y: Math.round((H - s) / 2) }, ...T };
  }
  const frontLayout = (c) => layout('front', c), sideLayout = (c) => layout('side', c);
  // ---------- ZPL
  let MEDIA = 'continuous'; // 'continuous' (no gaps: label + 1″ to tear, then stop) or 'gap' (die-cut labels)
  const setMedia = (m) => { MEDIA = m === 'gap' ? 'gap' : 'continuous'; };
  const head = (w, h) => MEDIA === 'gap' ? `^XA^CI28^MNY^MMT^PW${w}^LL${h}^LH0,0` : `^XA^CI28^MNN^MMT^PW${w}^LL${h + DPI}^LH0,0`;
  const fdv = (v) => String(v).replace(/_/g, '_5F').replace(/\^/g, '_5E').replace(/~/g, '_7E');
  const fd = (v) => '^FH_^FD' + fdv(v) + '^FS';
  function zpl(roll, c, copies) {
    const q = Math.max(1, Math.min(9, copies | 0 || 1)), L = layout(roll, c), S = L.sym;
    // The printer draws the code itself: ^BX = Data Matrix, ^BQ = QR (model 2, error correction M). No ^FB text blocks: each line is placed on its own.
    const sym = !S ? '' : S.kind === 'qr' ? `^FO${S.x},${S.y}^BQN,2,${S.m}^FH_^FDMA,${fdv(S.data)}^FS\n` : `^FO${S.x},${S.y}^BXN,${S.m},200${fd(S.data)}\n`;
    return `${head(L.W, L.H)}\n` + sym + L.rows.map(r => `^FO${r.x},${r.y}^A0N,${r.h},${r.h}${fd(r.t)}\n`).join('') + `^PQ${q}^XZ\n`;
  }
  const symPath = (S, ox, oy, m) => { let d = ''; S.M.forEach((row, r) => row.forEach((v, k) => { if (v) d += `M${ox + k * m} ${oy + r * m}h${m}v${m}h-${m}z`; })); return d; };
  // ---------- on-screen preview (same layout, drawn in HTML). px = screen pixels per inch.
  function preview(roll, c, px) {
    const k = px / DPI, P = (v) => (v * k).toFixed(1) + 'px', L = layout(roll, c), S = L.sym;
    const line = (t, x, y, h) => { const w = Math.min(textW(t, h), L.tw);
      return `<svg style="position:absolute;left:${P(x)};top:${P(y)};overflow:visible" width="${(w * k).toFixed(1)}" height="${(h * k).toFixed(1)}"><text x="0" y="${(h * 0.8 * k).toFixed(1)}" font-size="${(h * k).toFixed(1)}" font-weight="700" font-family="'DejaVu Sans Condensed','Arial Narrow','Helvetica Neue',system-ui,sans-serif" textLength="${(w * k).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(t)}</text></svg>`; };
    const sym = S ? `<svg class="zsym" style="position:absolute;left:${P(S.x)};top:${P(S.y)}" width="${(S.s * k).toFixed(1)}" height="${(S.s * k).toFixed(1)}" viewBox="0 0 ${S.n} ${S.n}" shape-rendering="crispEdges"><path d="${symPath(S, 0, 0, 1)}" fill="#000"/></svg>` : '';
    return `<div class="zlabel" style="position:relative;width:${L.W / DPI * px}px;height:${L.H / DPI * px}px;background:#fff;border-radius:${px * 0.03}px;box-shadow:0 1px 2px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.08);overflow:hidden;color:#000;flex:none">${sym}${L.rows.map(r => line(r.t, r.x, r.y, r.h)).join('')}</div>`;
  }
  // ---------- the label as one SVG at real size (1 unit = 1 printer dot at 300 dpi). Used for DYMO and AirPrint / print dialog.
  const FONT = "'DejaVu Sans Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  const xe = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function svgLabel(roll, c) {
    const L = layout(roll, c), S = L.sym;
    const tx = (t, x, y, h) => { const w = Math.min(textW(t, h), L.tw); return `<text x="${x.toFixed(1)}" y="${(y + h * 0.8).toFixed(1)}" font-size="${h}" font-weight="700" font-family="${FONT}" textLength="${w.toFixed(1)}" lengthAdjust="spacingAndGlyphs" fill="#000">${xe(t)}</text>`; };
    const sym = S ? `<path d="${symPath(S, S.x, S.y, S.m)}" fill="#000" shape-rendering="crispEdges"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${L.W / DPI}in" height="${L.H / DPI}in" viewBox="0 0 ${L.W} ${L.H}"><rect width="${L.W}" height="${L.H}" fill="#fff"/>${sym}${L.rows.map(r => tx(r.t, r.x, r.y, r.h)).join('')}</svg>`;
  }
  // Same picture as a PNG (base64, no prefix) at 300 dpi, for printers that take an image (DYMO).
  function png(roll, c) {
    const L = layout(roll, c), W = L.W, H = L.H, svg = svgLabel(roll, c).replace(/width="[^"]+in" height="[^"]+in"/, `width="${W}" height="${H}"`);
    return new Promise((ok, no) => { const img = new Image(); img.onload = () => { try { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, W, H); ok(cv.toDataURL('image/png').split(',')[1]); } catch (e) { no(e); } }; img.onerror = () => no(new Error('Could not draw the label')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  }
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
  window.WNLabels = { svgLabel, setStyle, style: (roll) => STYLE[rk(roll)], STYLES, layout, png, BP, timed, setMedia, get media() { return MEDIA; }, ROLLS, content, custom, check, zpl, preview, textW, findPrinter, status, send, get printer() { return printer; }, frontLayout, sideLayout, clean };
})();

// Drawer labels for the Zebra ZD421 (300 dpi, direct thermal).
//   front: 1.5″ × 0.5″ (450 × 150 dots) — layout C: 0.4″ Data Matrix · part name · code + category
//   side:  0.75″ × 0.75″ (225 × 225 dots) — Data Matrix + code
// The printer draws the Data Matrix itself (ZPL ^BX); js/datamatrix.js draws the same symbol for the on-screen preview.
// Printing from a computer goes through Zebra Browser Print (free app for Mac/Windows, printer on USB).
(function () {
  const DPI = 300;
  const ROLLS = { front: { w: 1.5, h: 0.5, name: 'Front labels · 1.5″ × 0.5″' }, side: { w: 0.75, h: 0.75, name: 'Side labels · 0.75″ × 0.75″' } };
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
    if (oneFits && h1 >= 30) return { lines: [t], h: h1 };
    let best = null; for (const [a, b] of breaks(t)) { const w = Math.max(textW(a, 1), textW(b, 1)); if (!best || w < best.w) best = { a, b, w }; }
    if (!best) return { lines: [cut(t, tw, h1)], h: h1 };
    const h2 = Math.min(maxTwo, Math.floor(tw / best.w));
    if (oneFits && h1 >= h2) return { lines: [t], h: h1 };
    if (h2 >= minH) return { lines: [best.a, best.b], h: h2 };
    // Very long: fill the first line with whole words at the smallest size, the rest goes on line 2 (ends with "..." if it still doesn't fit).
    const words = t.split(' '); let a = words.shift(); while (words.length && textW(a + ' ' + words[0], minH) <= tw) a += ' ' + words.shift();
    return { lines: [cut(a, tw, minH), cut(words.join(' '), tw, minH)].filter(Boolean), h: minH };
  }
  const dmSize = (code) => WNDataMatrix.matrix(code).length;
  // What a label says. parts = the parts in that spot (may be empty).
  function content(code, parts, where) {
    const ps = parts || [];
    const name = ps.length ? clean(ps[0].name) + (ps.length > 1 ? ` +${ps.length - 1}` : '') : ''; // more than one part: first name + "+1" keeps the text big enough to read
    const cat = ps.length ? clean(ps[0].category || '') : clean(where || '');
    return { code: clean(code), name, cat };
  }
  // A custom label: any text goes into the Data Matrix exactly as typed (plain keyboard characters), with optional printed lines.
  const asciiOK = (s) => /^[\x20-\x7E]*$/.test(String(s));
  function custom(data, caption, line2) { return { code: String(data || ''), name: clean(caption), cat: clean(line2), custom: true }; }
  // Can it be drawn on a small label? → {ok, size, chars, why}
  function check(data) {
    const d = String(data || '');
    if (!d) return { ok: false, why: 'Type something to put in the code.' };
    if (!asciiOK(d)) return { ok: false, why: 'Only plain keyboard characters (A–Z, a–z, 0–9, spaces and symbols like - / : . #). Letters like é or emoji aren’t supported.' };
    if (d.includes('~')) return { ok: false, why: 'The ~ character can’t go in the code (the printer uses it for special commands).' };
    try { const n = WNDataMatrix.matrix(d).length; return { ok: true, size: n, chars: d.length }; }
    catch (e) { return { ok: false, why: `Too long for a small label (${d.length} characters). Keep it to about 40 characters — or 80 digits.` }; }
  }
  // ---------- layout (shared by ZPL and preview, in printer dots)
  function frontLayout(c) {
    const N = dmSize(c.code), m = Math.max(4, Math.floor(118 / N)), dm = N * m, x0 = 14, tx = x0 + dm + 12, tw = 450 - tx - 12;
    const line2 = c.custom ? c.cat : c.name ? `${c.code} · ${c.cat}` : c.cat;
    const t1 = c.custom ? c.name : (c.name || c.code);
    const N1 = t1 ? nameLines(t1, tw, 46, 44, 20) : { lines: [], h: 0 }, two = N1.lines.length > 1, h1 = N1.h;
    const h2 = line2 ? fit(line2, tw, two ? 24 : 27, 14) : 0, l2 = line2 ? cut(line2, tw, h2) : '';
    const gap = N1.lines.length && l2 ? (two ? 8 : 14) : 0, pitch = h1 + 2;
    const block = N1.lines.length * pitch - (N1.lines.length ? 2 : 0) + gap + h2, top = Math.round((150 - block) / 2);
    const lines = N1.lines.map((t, i) => ({ t, y: top + i * pitch, h: h1 }));
    const y2 = top + N1.lines.length * pitch - (N1.lines.length ? 2 : 0) + gap;
    return { m, dm, dmX: x0, dmY: Math.round((150 - dm) / 2), tx, tw, lines, l1: lines.map(l => l.t).join(' '), h1, y1: top, l2, h2, y2 };
  }
  function sideLayout(c) {
    const N = dmSize(c.code), m = Math.max(4, Math.floor(146 / N)), dm = N * m, text0 = c.custom ? c.name : c.code, h = fit(text0, 205, 34, 18), text = cut(text0, 205, h);
    return { m, dm, dmX: Math.round((225 - dm) / 2), dmY: 12, h, ty: 12 + dm + 12, text, tx: Math.max(0, Math.round((225 - textW(text, h)) / 2)) };
  }
  // ---------- ZPL
  let MEDIA = 'continuous'; // 'continuous' (no gaps: label + 1″ to tear, then stop) or 'gap' (die-cut labels)
  const setMedia = (m) => { MEDIA = m === 'gap' ? 'gap' : 'continuous'; };
  const head = (w, h) => MEDIA === 'gap' ? `^XA^CI28^MNY^MMT^PW${w}^LL${h}^LH0,0` : `^XA^CI28^MNN^MMT^PW${w}^LL${h + DPI}^LH0,0`;
  const fd = (v) => '^FH_^FD' + String(v).replace(/_/g, '_5F').replace(/\^/g, '_5E').replace(/~/g, '_7E') + '^FS';
  function zpl(roll, c, copies) {
    const q = Math.max(1, Math.min(9, copies | 0 || 1));
    if (roll === 'side') { const L = sideLayout(c);
      return `${head(225, 225)}\n^FO${L.dmX},${L.dmY}^BXN,${L.m},200${fd(c.code)}\n` + (L.text ? `^FO${L.tx},${L.ty}^A0N,${L.h},${L.h}${fd(L.text)}\n` : '') + `^PQ${q}^XZ\n`; }
    // No ^FB text blocks: each line is placed on its own, so the printer can't wrap text on top of itself.
    const L = frontLayout(c);
    return `${head(450, 150)}\n^FO${L.dmX},${L.dmY}^BXN,${L.m},200${fd(c.code)}\n` + L.lines.map(l => `^FO${L.tx},${l.y}^A0N,${l.h},${l.h}${fd(l.t)}\n`).join('') + (L.l2 ? `^FO${L.tx},${L.y2}^A0N,${L.h2},${L.h2}${fd(L.l2)}\n` : '') + `^PQ${q}^XZ\n`;
  }
  // ---------- on-screen preview (same layout, drawn in HTML). px = screen pixels per inch.
  function preview(roll, c, px) {
    const k = px / DPI, P = (v) => (v * k).toFixed(1) + 'px', dm = (L) => `<div style="position:absolute;left:${P(L.dmX)};top:${P(L.dmY)}">${WNDataMatrix.svg(c.code, L.dm * k)}</div>`;
    const line = (t, x, y, h, bold, center, boxW) => { const w = Math.min(textW(t, h), boxW), left = center ? x + (boxW - w) / 2 : x;
      return `<svg style="position:absolute;left:${P(left)};top:${P(y)};overflow:visible" width="${(w * k).toFixed(1)}" height="${(h * k).toFixed(1)}"><text x="0" y="${(h * 0.8 * k).toFixed(1)}" font-size="${(h * k).toFixed(1)}" font-weight="${bold ? 700 : 400}" font-family="'DejaVu Sans Condensed','Arial Narrow','Helvetica Neue',system-ui,sans-serif" textLength="${(w * k).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(t)}</text></svg>`; };
    const box = (w, h, inner) => `<div class="zlabel" style="position:relative;width:${w * px}px;height:${h * px}px;background:#fff;border-radius:${px * 0.03}px;box-shadow:0 1px 2px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.08);overflow:hidden;color:#000;flex:none">${inner}</div>`;
    if (roll === 'side') { const L = sideLayout(c); return box(0.75, 0.75, dm(L) + (L.text ? line(L.text, 0, L.ty, L.h, true, true, 225) : '')); }
    const L = frontLayout(c);
    return box(1.5, 0.5, dm(L) + L.lines.map(l => line(l.t, L.tx, l.y, l.h, true, false, L.tw)).join('') + (L.l2 ? line(L.l2, L.tx, L.y2, L.h2, false, false, L.tw) : ''));
  }
  // ---------- the label as one SVG at real size (1 unit = 1 printer dot at 300 dpi). Used for DYMO and AirPrint / print dialog.
  const FONT = "'DejaVu Sans Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  const xe = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function svgLabel(roll, c) {
    const side = roll === 'side', W = side ? 225 : 450, H = side ? 225 : 150, L = side ? sideLayout(c) : frontLayout(c), M = WNDataMatrix.matrix(c.code);
    let d = ''; M.forEach((row, r) => row.forEach((v, k) => { if (v) d += `M${L.dmX + k * L.m} ${L.dmY + r * L.m}h${L.m}v${L.m}h-${L.m}z`; }));
    const tx = (t, x, y, h, bold, boxW, center) => { const w = Math.min(textW(t, h), boxW), left = center ? x + (boxW - w) / 2 : x; return `<text x="${left.toFixed(1)}" y="${(y + h * 0.8).toFixed(1)}" font-size="${h}" font-weight="${bold ? 700 : 400}" font-family="${FONT}" textLength="${w.toFixed(1)}" lengthAdjust="spacingAndGlyphs" fill="#000">${xe(t)}</text>`; };
    const texts = side ? (L.text ? tx(L.text, 0, L.ty, L.h, true, 225, true) : '') : L.lines.map(l => tx(l.t, L.tx, l.y, l.h, true, L.tw)).join('') + (L.l2 ? tx(L.l2, L.tx, L.y2, L.h2, false, L.tw) : '');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W / DPI}in" height="${H / DPI}in" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/><path d="${d}" fill="#000" shape-rendering="crispEdges"/>${texts}</svg>`;
  }
  // Same picture as a PNG (base64, no prefix) at 300 dpi, for printers that take an image (DYMO).
  function png(roll, c) {
    const side = roll === 'side', W = side ? 225 : 450, H = side ? 225 : 150, svg = svgLabel(roll, c).replace(/width="[^"]+in" height="[^"]+in"/, `width="${W}" height="${H}"`);
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
  window.WNLabels = { svgLabel, png, BP, timed, setMedia, get media() { return MEDIA; }, ROLLS, content, custom, check, zpl, preview, textW, findPrinter, status, send, get printer() { return printer; }, frontLayout, sideLayout, clean };
})();

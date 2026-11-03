// Drawer labels for the Zebra ZD421 (300 dpi, direct thermal).
//   front: 1.5″ × 0.5″ (450 × 150 dots) — layout C: 0.4″ Data Matrix · part name · code + category
//   side:  0.75″ × 0.75″ (225 × 225 dots) — Data Matrix + code
// The printer draws the Data Matrix itself (ZPL ^BX); js/datamatrix.js draws the same symbol for the on-screen preview.
// Printing from a computer goes through Zebra Browser Print (free app for Mac/Windows, printer on USB).
(function () {
  const DPI = 300;
  const ROLLS = { front: { w: 1.5, h: 0.5, name: 'Front labels · 1.5″ × 0.5″' }, side: { w: 0.75, h: 0.75, name: 'Side labels · 0.75″ × 0.75″' } };
  const clean = (t) => String(t || '').replace(/[″”“]/g, '"').replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/[\^~]/g, '').replace(/\s+/g, ' ').trim();
  // Rough width of text in the printer's bold condensed font, in units of the font height (kept on the safe side).
  function textW(t, h) { let w = 0; for (const ch of t) w += /[1iIl.,:;'|!\/ \-"]/.test(ch) ? 0.34 : /[mwMW]/.test(ch) ? 0.9 : /[A-Z0-9#×+]/.test(ch) ? 0.66 : 0.57; return w * h; }
  function fit(t, maxW, hMax, hMin) { let h = hMax; while (h > hMin && textW(t, h) > maxW) h--; return h; }
  // Still too long at the smallest size → cut it and end with "…".
  function cut(t, maxW, h) { if (textW(t, h) <= maxW) return t; let s = t; while (s.length > 1 && textW(s + '…', h) > maxW) s = s.slice(0, -1); return s.trimEnd() + '…'; }
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
    const N = dmSize(c.code), m = Math.max(4, Math.floor(118 / N)), dm = N * m, x0 = 14, tx = x0 + dm + 16, tw = 450 - tx - 12;
    const line2 = c.custom ? c.cat : c.name ? `${c.code} · ${c.cat}` : c.cat;
    const t1 = c.custom ? c.name : (c.name || c.code), h1 = fit(t1, tw, 46, 22), h2 = fit(line2, tw, 27, 16);
    return { m, dm, dmX: x0, dmY: Math.round((150 - dm) / 2), tx, tw, l1: cut(t1, tw, h1), h1, y1: Math.round((150 - (h1 + 14 + h2)) / 2), l2: cut(line2, tw, h2), h2, y2: Math.round((150 - (h1 + 14 + h2)) / 2) + h1 + 14 };
  }
  function sideLayout(c) {
    const N = dmSize(c.code), m = Math.max(4, Math.floor(146 / N)), dm = N * m, text = c.custom ? c.name : c.code, h = fit(text, 205, 34, 18);
    return { m, dm, dmX: Math.round((225 - dm) / 2), dmY: 12, h, ty: 12 + dm + 12, text: cut(text, 205, h) };
  }
  // ---------- ZPL
  let MEDIA = 'continuous'; // 'continuous' (no gaps: label + 1″ to tear, then stop) or 'gap' (die-cut labels)
  const setMedia = (m) => { MEDIA = m === 'gap' ? 'gap' : 'continuous'; };
  const head = (w, h) => MEDIA === 'gap' ? `^XA^CI28^MNY^MMT^PW${w}^LL${h}^LH0,0` : `^XA^CI28^MNN^MMT^PW${w}^LL${h + DPI}^LH0,0`;
  const fd = (v) => '^FH_^FD' + String(v).replace(/_/g, '_5F').replace(/\^/g, '_5E').replace(/~/g, '_7E') + '^FS';
  function zpl(roll, c, copies) {
    const q = Math.max(1, Math.min(9, copies | 0 || 1));
    if (roll === 'side') { const L = sideLayout(c);
      return `${head(225, 225)}\n^FO${L.dmX},${L.dmY}^BXN,${L.m},200${fd(c.code)}\n` + (L.text ? `^FO0,${L.ty}^A0N,${L.h},${L.h}^FB225,1,0,C${fd(L.text)}\n` : '') + `^PQ${q}^XZ\n`; }
    const L = frontLayout(c);
    return `${head(450, 150)}\n^FO${L.dmX},${L.dmY}^BXN,${L.m},200${fd(c.code)}\n` + (L.l1 ? `^FO${L.tx},${L.y1}^A0N,${L.h1},${L.h1}^FB${L.tw},1,0,L${fd(L.l1)}\n` : '') + (L.l2 ? `^FO${L.tx},${L.y2}^A0N,${L.h2},${L.h2}^FB${L.tw},1,0,L${fd(L.l2)}\n` : '') + `^PQ${q}^XZ\n`;
  }
  // ---------- on-screen preview (same layout, drawn in HTML). px = screen pixels per inch.
  function preview(roll, c, px) {
    const k = px / DPI, P = (v) => (v * k).toFixed(1) + 'px', dm = (L) => `<div style="position:absolute;left:${P(L.dmX)};top:${P(L.dmY)}">${WNDataMatrix.svg(c.code, L.dm * k)}</div>`;
    const line = (t, x, y, h, bold, center, boxW) => { const w = Math.min(textW(t, h), boxW), left = center ? x + (boxW - w) / 2 : x;
      return `<svg style="position:absolute;left:${P(left)};top:${P(y)};overflow:visible" width="${(w * k).toFixed(1)}" height="${(h * k).toFixed(1)}"><text x="0" y="${(h * 0.8 * k).toFixed(1)}" font-size="${(h * k).toFixed(1)}" font-weight="${bold ? 700 : 400}" font-family="'DejaVu Sans Condensed','Arial Narrow','Helvetica Neue',system-ui,sans-serif" textLength="${(w * k).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(t)}</text></svg>`; };
    const box = (w, h, inner) => `<div class="zlabel" style="position:relative;width:${w * px}px;height:${h * px}px;background:#fff;border-radius:${px * 0.03}px;box-shadow:0 1px 2px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.08);overflow:hidden;color:#000;flex:none">${inner}</div>`;
    if (roll === 'side') { const L = sideLayout(c); return box(0.75, 0.75, dm(L) + (L.text ? line(L.text, 0, L.ty, L.h, true, true, 225) : '')); }
    const L = frontLayout(c);
    return box(1.5, 0.5, dm(L) + (L.l1 ? line(L.l1, L.tx, L.y1, L.h1, true, false, L.tw) : '') + (L.l2 ? line(L.l2, L.tx, L.y2, L.h2, false, false, L.tw) : ''));
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
      return m[1] === '0' || !flags ? { state: 'ready', printer } : { state: 'problem', printer, probs: probs.length ? probs : ['an error code ' + m[2] + ' ' + m[3]] };
    } catch (e) { return { state: 'ready', printer, note: 'Connected, but the printer didn’t answer a status check — is it switched on?' }; }
  }
  async function send(data) {
    const dev = printer || await findPrinter(true); if (!dev) throw new Error('No Zebra printer found. Is Zebra Browser Print running on this computer?');
    const r = await timed(fetch(BP() + 'write', { method: 'POST', body: JSON.stringify({ device: dev, data }) }), 15000);
    if (!r.ok) throw new Error((await r.text()) || 'The printer refused the job');
  }
  window.WNLabels = { setMedia, get media() { return MEDIA; }, ROLLS, content, custom, check, zpl, preview, textW, findPrinter, status, send, get printer() { return printer; }, frontLayout, sideLayout, clean };
})();

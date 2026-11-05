// Every printer Workshop can reach from this device, by name, tagged Zebra / DYMO / Other — and one print() that sends
// a batch of labels to whichever one is chosen.
//   Zebra  → Zebra Browser Print on this computer (USB, network or Bluetooth printers it knows). Labels go as ZPL.
//   DYMO   → DYMO Connect on this computer (its local web service, https://127.0.0.1:41951–41960/DYMO/DLS/Printing,
//            same calls as DYMO's own dymo.connect.framework). Labels go as a picture in a DYMO label file.
//   Other  → this device's print dialog: AirPrint printers on iPhone/iPad, every installed printer on a computer.
//   Computer → no printer here: the job is saved and the computer running Workshop prints it (see workshop.html drain).
//   iPhone app → Zebra printers straight from the phone: network (port 9100) and Bluetooth LE, through the app's native
//            bridge (window.webkit.messageHandlers.wn, see the iOS project's NativeBridge.swift). "Any printer" = AirPrint.
// Needs: WNLabels (js/labels.js), WNDataMatrix.
(function () {
  const L = () => window.WNLabels;
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } } };
  const timed = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
  const apple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const phone = () => /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  // ---------------- inside the iPhone app
  const NB = () => (window.WNNative && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.wn) || null;
  const native = () => !!NB();
  const nat = (cmd, args) => { const b = NB(); if (!b) return Promise.reject(new Error('Only in the iPhone app')); return Promise.resolve(b.postMessage(Object.assign({ cmd }, args || {}))); };
  const fromNative = (d) => ({ id: d.id, brand: 'zebra', name: d.name || d.id, model: d.model || '', conn: d.conn || (d.kind === 'ble' ? 'Bluetooth LE' : 'Network'), via: (d.kind === 'ble' ? 'Bluetooth LE' : 'Network') + ' from this ' + ((window.WNNative && window.WNNative.device) || 'iPhone'), native: true, kind: d.kind, likely: d.likely !== false });
  async function nativeList() { try { const l = await nat('printers', { seconds: 3, bluetooth: true }); return (Array.isArray(l) ? l : []).map(fromNative); } catch (e) { return []; } }
  // ~HQES answer → problems in plain words (same flags as the computer check in labels.js)
  const HQ = [[0x1, 'out of labels'], [0x2, 'ribbon out'], [0x4, 'print head open'], [0x8, 'cutter fault'], [0x10, 'print head too hot'], [0x20, 'motor too hot'], [0x40, 'bad print head element'], [0x80, 'print head not detected']];
  function parseHQES(t) { const m = String(t || '').match(/ERRORS:\s*(\d)\s+([0-9A-Fa-f]{8})\s+([0-9A-Fa-f]{8})/); if (!m) return { known: false, probs: [] }; const f = parseInt(m[3], 16), probs = HQ.filter(([b]) => f & b).map(([, w]) => w); return { known: true, probs: m[1] === '0' || !f ? [] : (probs.length ? probs : ['error code ' + m[2] + ' ' + m[3]]) }; }
  const CONN = { usb: 'USB', network: 'Network', bluetooth: 'Bluetooth', driver: 'Installed printer', serial: 'Serial' };
  const brandOf = (name, maker) => /dymo|labelwriter|labelmanager/i.test(name + ' ' + (maker || '')) ? 'dymo' : /zebra/i.test(maker || '') || /\bz[dtqg][0-9]|^d[0-9a-z]{9,}$|zebra/i.test(name) ? 'zebra' : 'other';

  // ---------------- Zebra Browser Print
  async function zebraList() {
    const get = async (path) => { try { const r = await timed(fetch(L().BP() + path, { method: 'GET' }), 3000); if (r.status === 403) return { blocked: true }; if (!r.ok) return null; const t = (await r.text()).trim(); try { return { j: t ? JSON.parse(t) : {} }; } catch (e) { return { j: {} }; } } catch (e) { return null; } };
    const [def, av] = await Promise.all([get('default?type=printer'), get('available')]);
    if (!def && !av) return { app: 'off', list: [] };
    if ((def && def.blocked) && (!av || av.blocked)) return { app: 'blocked', list: [] };
    const devs = [], add = (d) => { if (d && (d.uid || d.name) && !devs.some(x => (x.uid || x.name) === (d.uid || d.name))) devs.push(d); };
    add(def && def.j); ((av && av.j && av.j.printer) || []).forEach(add); // default first, then every other printer Browser Print knows
    return { app: 'on', list: devs.map(d => {
      const name = d.name || d.uid, b = brandOf(name, d.manufacturer || 'Zebra'), model = LS.get('wn-zmodel:' + (d.uid || d.name), '');
      return { id: 'zebra:' + (d.uid || d.name), brand: b === 'dymo' ? 'dymo-bp' : 'zebra', name, model, conn: CONN[d.connection] || d.connection || '', via: 'Zebra Browser Print', dev: d };
    }).filter(p => p.brand === 'zebra') };
  }
  // ---------------- DYMO Connect
  const DY_PORTS = [41951, 41952, 41953, 41954, 41955, 41956, 41957, 41958, 41959, 41960];
  let dyBase = LS.get('wn-dymo-base', '') || null;
  const unwrap = (t) => { try { const v = JSON.parse(t); return typeof v === 'string' ? v : t; } catch (e) { return t; } };
  async function dyOk(base) { try { const r = await timed(fetch(base + 'StatusConnected', { method: 'GET' }), 2500); return r.ok && /true/i.test(await r.text()); } catch (e) { return false; } }
  async function dymoFind() {
    if (dyBase && await dyOk(dyBase)) return dyBase;
    const bases = DY_PORTS.flatMap(p => [`https://127.0.0.1:${p}/DYMO/DLS/Printing/`, `https://localhost:${p}/DYMO/DLS/Printing/`]);
    const found = await new Promise(res => { let left = bases.length; bases.forEach(b => dyOk(b).then(ok => { if (ok) res(b); else if (--left === 0) res(null); })); });
    dyBase = found; LS.set('wn-dymo-base', found); return found;
  }
  async function dymoList() {
    const base = await dymoFind(); if (!base) return { app: 'off', list: [] };
    try {
      const r = await timed(fetch(base + 'GetPrinters', { method: 'GET' }), 5000), xml = unwrap(await r.text());
      const d = new DOMParser().parseFromString(xml, 'text/xml'), list = [];
      [['LabelWriterPrinter', 'LabelWriter'], ['DZPrinter', 'LabelWriter'], ['TapePrinter', 'Tape']].forEach(([tag, kind]) => [...d.getElementsByTagName(tag)].forEach(el => {
        const g = (k) => (el.getElementsByTagName(k)[0] || {}).textContent || '', name = g('Name').trim(); if (!name) return;
        list.push({ id: 'dymo:' + name, brand: 'dymo', name, model: g('ModelName').trim(), conn: g('IsConnected') === 'True' ? (g('IsLocal') === 'False' ? 'Network' : 'Connected') : 'Not connected', ready: g('IsConnected') === 'True', kind, via: 'DYMO Connect' });
      }));
      return { app: 'on', list };
    } catch (e) { return { app: 'on', list: [], err: e.message }; }
  }
  // DYMO label file with the label as a picture. Front → 30330 Return Address (¾″ × 2″), side → 30332 (1″ × 1″). 1 in = 1440 twips.
  const DY_PAPER = { front: { name: '30330 Return Address', id: 'ReturnAddress', w: 1080, h: 2880, b: [130, 70, 2620, 940] }, side: { name: '30332 1 in x 1 in', id: 'Small30332', w: 1440, h: 1440, b: [90, 90, 1260, 1260] } };
  const C = (a, r, g, b) => `Alpha="${a}" Red="${r}" Green="${g}" Blue="${b}"`;
  function dymoXml(roll, pngB64) {
    const P = DY_PAPER[roll === 'side' ? 'side' : 'front'];
    return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>${P.id}</Id>
  <PaperName>${P.name}</PaperName>
  <DrawCommands><RoundRectangle X="0" Y="0" Width="${P.w}" Height="${P.h}" Rx="180" Ry="180" /></DrawCommands>
  <ObjectInfo>
    <ImageObject>
      <Name>LABEL</Name>
      <ForeColor ${C(255, 0, 0, 0)} />
      <BackColor ${C(0, 255, 255, 255)} />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <Image>${pngB64}</Image>
      <ScaleMode>Uniform</ScaleMode>
      <BorderWidth>0</BorderWidth>
      <BorderColor ${C(255, 0, 0, 0)} />
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Center</VerticalAlignment>
    </ImageObject>
    <Bounds X="${P.b[0]}" Y="${P.b[1]}" Width="${P.b[2]}" Height="${P.b[3]}" />
  </ObjectInfo>
</DieCutLabel>`;
  }
  async function dymoPrint(p, roll, labels, copies) {
    if (p.kind === 'Tape') throw new Error(`${p.name} is a tape printer — Workshop prints to DYMO LabelWriter printers only for now.`);
    const base = await dymoFind(); if (!base) throw new Error('DYMO Connect isn’t answering on this computer. Open DYMO Connect, then try again.');
    for (const c of labels) {
      const body = new URLSearchParams({ printerName: p.name, printParamsXml: `<LabelWriterPrintParams><Copies>${Math.max(1, copies | 0)}</Copies></LabelWriterPrintParams>`, labelXml: dymoXml(roll, await L().png(roll, c)), labelSetXml: '' });
      const r = await timed(fetch(base + 'PrintLabel', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body }), 15000);
      const t = unwrap(await r.text().catch(() => ''));
      if (!r.ok || /false|error|exception/i.test(t)) throw new Error('DYMO didn’t take the label' + (t && t.length < 160 ? ': ' + t : ''));
    }
  }
  // ---------------- print dialog (AirPrint / any installed printer)
  const OTHER = { id: 'other:dialog', brand: 'other', name: 'Any printer — print dialog', conn: '', via: 'This device', always: true };
  const COMPUTER = { id: 'computer', brand: 'computer', name: 'My computer’s printer', conn: '', via: 'Sends the labels to Workshop on your computer', always: true };
  function dialogPrint(roll, labels, copies, sheet) {
    const side = roll === 'side', w = side ? 1 : 1.5, h = side ? 1 : 0.5, svgs = [];
    labels.forEach(c => { const s = L().svgLabel(roll, c); for (let i = 0; i < Math.max(1, copies | 0); i++) svgs.push(s); });
    let area = document.getElementById('printArea'); if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
    let st = document.getElementById('printPage'); if (!st) { st = document.createElement('style'); st.id = 'printPage'; document.head.appendChild(st); }
    st.textContent = `#printArea{display:none}@media print{body>*:not(#printArea){display:none!important}html,body{background:#fff!important;margin:0!important;padding:0!important}#printArea{display:block!important}` +
      (sheet ? `@page{size:letter;margin:0.4in}#printArea{display:flex!important;flex-wrap:wrap;gap:0.12in}#printArea .pl{outline:0.5pt dashed #999;break-inside:avoid}`
        : `@page{size:${w}in ${h}in;margin:0}#printArea .pl{width:${w}in;height:${h}in;overflow:hidden;break-after:page;page-break-after:always}#printArea .pl:last-child{break-after:auto;page-break-after:auto}`) +
      `#printArea .pl svg{display:block;width:${w}in;height:${h}in}}`;
    area.innerHTML = svgs.map(s => `<div class="pl">${s}</div>`).join('');
    const done = () => { window.removeEventListener('afterprint', done); setTimeout(() => { area.innerHTML = ''; }, 300); };
    window.addEventListener('afterprint', done);
    window.print();
    return svgs.length;
  }
  // AirPrint from the iPhone app: each label as a 300-dpi picture; the app makes the exact-size PDF and opens the print panel.
  async function nativeAirPrint(roll, labels, copies, sheet) {
    const side = roll === 'side', pages = [];
    for (const c of labels) { const png = await L().png(roll, c); for (let i = 0; i < copies; i++) pages.push(png); }
    const done = await nat('airprint', { pages, w: side ? 1 : 1.5, h: side ? 1 : 0.5, sheet: !!sheet });
    return { n: pages.length, where: 'AirPrint', cancelled: done === false };
  }
  // Add a network printer by IP address (iPhone app). → the printer entry, now in the list and picked.
  async function addNetwork(host) { const d = fromNative(await nat('addNetwork', { host })); found = [d, ...found.filter(p => p.id !== d.id)]; choose(d.id); return d; }
  async function forget(id) { if (native()) await nat('forget', { id }).catch(() => { }); found = found.filter(p => p.id !== id); if (chosenId() === id) choose(null); }
  // Is the iPhone-app printer ready? → {state:'ready'|'problem', printer, model, probs, note}
  async function nativeStatus(p) {
    const r = await nat('status', { id: p.id }), q = parseHQES(r && r.text);
    if (!q.known) return { state: 'ready', printer: { name: p.name }, model: p.model, note: p.kind === 'ble' ? 'Connected over Bluetooth.' : 'Connected (the printer didn’t report its status).' };
    return q.probs.length ? { state: 'problem', printer: { name: p.name }, model: p.model, probs: q.probs } : { state: 'ready', printer: { name: p.name }, model: p.model };
  }
  const scanCode = () => nat('scan');
  // ---------------- what's here
  let found = [OTHER, COMPUTER], apps = { zebra: '', dymo: '' }, scanned = 0, scanning = null;
  async function scan(force) {
    if (scanning) return scanning;
    if (!force && Date.now() - scanned < 20000) return found;
    scanning = (async () => {
      if (native()) { const n = await nativeList(); apps = { zebra: n.length ? 'on' : 'off', dymo: 'off', native: 'on' }; found = [...n.filter(p => p.likely), ...n.filter(p => !p.likely), OTHER, COMPUTER]; scanned = Date.now(); return found; }
      const [z, d] = await Promise.all([zebraList(), dymoList()]);
      apps = { zebra: z.app, dymo: d.app };
      found = [...z.list, ...d.list, OTHER, COMPUTER]; scanned = Date.now(); return found;
    })();
    try { return await scanning; } finally { scanning = null; }
  }
  const chosenId = () => LS.get('wn-printer', '');
  // The picked printer is remembered with its details, so a printer that's asleep during a look-around stays picked.
  function choose(id) { LS.set('wn-printer', id || null); const p = found.find(x => x.id === id); LS.set('wn-printer-info', p && !p.always ? JSON.stringify(p) : null); }
  const remembered = (id) => { try { const p = JSON.parse(LS.get('wn-printer-info', '') || 'null'); return p && p.id === id ? Object.assign(p, { missing: true }) : null; } catch (e) { return null; } };
  // The printer jobs go to: the one picked on this device if it's still here; else the first Zebra, then a connected DYMO; else the computer.
  function current() {
    const id = chosenId(), pick = found.find(p => p.id === id) || (scanned ? remembered(id) : null);
    if (pick) return pick;
    if (id && /^(zebra|dymo):/.test(id) && !scanned) return null; // not looked yet
    return found.find(p => p.brand === 'zebra' && p.likely !== false) || found.find(p => p.brand === 'dymo' && p.ready && p.kind !== 'Tape') || COMPUTER;
  }
  const label = (p) => p ? (p.brand === 'zebra' && p.likely !== false ? 'Zebra' : p.brand === 'dymo' ? 'DYMO' : p.brand === 'computer' ? 'Computer' : 'Other') : '';
  // Print a batch: labels = [WNLabels.content…]. → {n, where}. Throws with a plain message. brand 'computer' is the caller's job.
  async function print(p, roll, labels, copies, opts) {
    copies = Math.max(1, copies | 0); const n = labels.length * copies;
    if (!p) throw new Error('No printer picked');
    if (p.brand === 'other' && native()) return nativeAirPrint(roll, labels, copies, opts && opts.sheet);
    if (p.brand === 'other') return { n: dialogPrint(roll, labels, copies, opts && opts.sheet), where: 'the print dialog' };
    if (p.native) { await nat('send', { id: p.id, data: labels.map(c => L().zpl(roll, c, copies)).join('') }); return { n, where: p.name }; }
    if (p.brand === 'zebra') { await L().send(labels.map(c => L().zpl(roll, c, copies)).join(''), p.dev); return { n, where: p.name }; }
    if (p.brand === 'dymo') { await dymoPrint(p, roll, labels, copies); return { n, where: p.name }; }
    throw new Error('That printer can’t print from here');
  }
  window.WNPrinters = { native, addNetwork, forget, nativeStatus, scanCode, parseHQES, scan, current, choose, chosenId, print, dialogPrint, dymoXml, label, get found() { return found; }, get apps() { return apps; }, get scanned() { return scanned; }, OTHER, COMPUTER, apple, phone, DY_PAPER };
})();

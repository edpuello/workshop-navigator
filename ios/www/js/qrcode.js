// QR code (model 2, error correction M) for short texts like "A2-C05" — for showing labels on screen.
// The Zebra printer makes the real printed symbol itself (ZPL ^BQ), so this is only the on-screen picture.
// Versions 1–6 (21×21 to 41×41 modules, up to 106 bytes), alphanumeric mode when it fits, otherwise bytes.
(function () {
  // [data codewords per block..., ecc codewords per block] for level M, versions 1–6
  const BLOCKS = [null, [[16], 10], [[28], 16], [[44], 26], [[32, 32], 18], [[43, 43], 24], [[27, 27, 27, 27], 16]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
  const AN = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  const EXP = new Array(512), LOG = new Array(256);
  (() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function rs(data, n) {
    let g = [1];
    for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= mul(c, EXP[i]); }); g = ng; }
    const r = new Array(n).fill(0);
    for (const d of data) { const f = d ^ r[0]; r.shift(); r.push(0); for (let j = 0; j < n; j++) r[j] ^= mul(g[j + 1], f); }
    return r;
  }
  const utf8 = (s) => Array.from(unescape(encodeURIComponent(s)), ch => ch.charCodeAt(0));
  function bitsFor(text, v) {
    const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    if ([...text].every(ch => AN.includes(ch))) {
      put(2, 4); put(text.length, 9);
      for (let i = 0; i < text.length; i += 2) { const a = AN.indexOf(text[i]); if (i + 1 < text.length) put(a * 45 + AN.indexOf(text[i + 1]), 11); else put(a, 6); }
    } else { const b = utf8(text); put(4, 4); put(b.length, 8); b.forEach(x => put(x, 8)); }
    const cap = BLOCKS[v][0].reduce((a, b) => a + b, 0) * 8;
    if (bits.length > cap) return null;
    put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
    const bytes = []; for (let i = 0; i < bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0; bytes.length < cap / 8; p++) bytes.push(p % 2 ? 0x11 : 0xec);
    return bytes;
  }
  function codewords(bytes, v) {
    const [sizes, ne] = BLOCKS[v], data = [], ecc = []; let o = 0;
    for (const n of sizes) { const d = bytes.slice(o, o + n); o += n; data.push(d); ecc.push(rs(d, ne)); }
    const out = [], mx = Math.max(...sizes);
    for (let i = 0; i < mx; i++) data.forEach(d => { if (i < d.length) out.push(d[i]); });
    for (let i = 0; i < ne; i++) ecc.forEach(e => out.push(e[i]));
    return out;
  }
  const MASKS = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];
  function formatBits(mask) { // level M = 00
    const d = (0 << 3) | mask; let v = d << 10;
    for (let i = 14; i >= 10; i--) if ((v >> i) & 1) v ^= 0x537 << (i - 10);
    return ((d << 10) | v) ^ 0x5412;
  }
  function build(v, cw, mask) {
    const N = 17 + 4 * v, M = Array.from({ length: N }, () => new Array(N).fill(0)), F = Array.from({ length: N }, () => new Array(N).fill(false));
    const set = (r, c, val) => { M[r][c] = val ? 1 : 0; F[r][c] = true; };
    const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) { const rr = r0 + r, cc = c0 + c; if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      set(rr, cc, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))); } };
    finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
    for (let i = 8; i < N - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const A = ALIGN[v]; for (const r of A) for (const c of A) { if (F[r][c]) continue; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1); }
    set(N - 8, 8, 1); // dark module
    // reserve format areas
    for (let i = 0; i < 9; i++) { if (!F[8][i]) F[8][i] = true; if (!F[i][8]) F[i][8] = true; }
    for (let i = 0; i < 8; i++) { F[8][N - 1 - i] = true; F[N - 1 - i][8] = true; }
    // data, zigzag from the bottom-right
    const bits = []; cw.forEach(b => { for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1); });
    let k = 0, up = true;
    for (let c = N - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (let i = 0; i < N; i++) { const r = up ? N - 1 - i : i;
        for (const cc of [c, c - 1]) { if (F[r][cc]) continue; let b = k < bits.length ? bits[k] : 0; k++; if (MASKS[mask](r, cc)) b ^= 1; M[r][cc] = b; } }
      up = !up;
    }
    const fb = formatBits(mask), bit = (i) => (fb >> i) & 1;
    for (let i = 0; i <= 5; i++) M[i][8] = bit(i);
    M[7][8] = bit(6); M[8][8] = bit(7); M[8][7] = bit(8);
    for (let i = 9; i <= 14; i++) M[8][14 - i] = bit(i);
    for (let i = 0; i <= 7; i++) M[8][N - 1 - i] = bit(i);
    for (let i = 8; i <= 14; i++) M[N - 15 + i][8] = bit(i);
    M[N - 8][8] = 1;
    return M;
  }
  function penalty(M) {
    const N = M.length; let p = 0;
    const runs = (get) => { for (let i = 0; i < N; i++) { let run = 1; for (let j = 1; j <= N; j++) { if (j < N && get(i, j) === get(i, j - 1)) run++; else { if (run >= 5) p += run - 2; run = 1; } } } };
    runs((i, j) => M[i][j]); runs((i, j) => M[j][i]);
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) { const v = M[r][c]; if (v === M[r][c + 1] && v === M[r + 1][c] && v === M[r + 1][c + 1]) p += 3; }
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], tap = pat.slice().reverse();
    for (let i = 0; i < N; i++) for (let j = 0; j <= N - 11; j++) { let a = true, b = true, a2 = true, b2 = true;
      for (let k = 0; k < 11; k++) { if (M[i][j + k] !== pat[k]) a = false; if (M[i][j + k] !== tap[k]) b = false; if (M[j + k][i] !== pat[k]) a2 = false; if (M[j + k][i] !== tap[k]) b2 = false; }
      p += 40 * (a + b + a2 + b2); }
    let dark = 0; M.forEach(r => r.forEach(v => dark += v)); p += Math.floor(Math.abs(dark * 100 / (N * N) - 50) / 5) * 10;
    return p;
  }
  // The symbol as rows of 0/1 (1 = dark), without the quiet zone. null if the text is too long.
  function matrix(text) {
    const t = String(text || '');
    for (let v = 1; v <= 6; v++) { const bytes = bitsFor(t, v); if (!bytes) continue;
      const cw = codewords(bytes, v); let best = null;
      for (let m = 0; m < 8; m++) { const M = build(v, cw, m), s = penalty(M); if (!best || s < best.s) best = { M, s }; }
      return best.M; }
    return null;
  }
  function svg(text, px) {
    const M = matrix(text); if (!M) return '';
    const n = M.length; let d = ''; M.forEach((row, r) => row.forEach((v, c) => { if (v) d += `M${c} ${r}h1v1h-1z`; }));
    return `<svg width="${px}" height="${px}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" style="display:block"><path d="${d}" fill="#000"/></svg>`;
  }
  const api = { matrix, svg };
  if (typeof module !== 'undefined') module.exports = api; else window.WNQR = api;
})();

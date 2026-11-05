// Data Matrix (ECC 200) for short codes like "A2-C05" — for showing labels on screen.
// The Zebra printer makes the real printed symbol itself (ZPL ^BX), so this is only the on-screen picture.
// Square sizes up to 26×26 (up to 44 data codewords = ~40 characters), ASCII encoding with digit pairs.
(function () {
  const SIZES = [[10, 3, 5], [12, 5, 7], [14, 8, 10], [16, 12, 12], [18, 18, 14], [20, 22, 18], [22, 30, 20], [24, 36, 24], [26, 44, 28]]; // [size, data, ecc]
  const EXP = new Array(512), LOG = new Array(256);
  (() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x12d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function encodeAscii(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i), d = s.charCodeAt(i + 1);
      if (c >= 48 && c <= 57 && d >= 48 && d <= 57) { out.push(130 + (c - 48) * 10 + (d - 48)); i++; }
      else if (c < 128) out.push(c + 1);
      else { out.push(235, c - 127); } // upper shift
    }
    return out;
  }
  function rs(data, n) {
    let g = [1];
    for (let i = 1; i <= n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; }
    const ecc = new Array(n).fill(0);
    for (const d of data) { const t = d ^ ecc[0]; ecc.shift(); ecc.push(0); for (let j = 0; j < n; j++) ecc[j] ^= mul(g[j + 1], t); }
    return ecc;
  }
  function place(nrow, ncol) {
    const a = new Array(nrow * ncol).fill(0);
    const mod = (r, c, ch, bit) => { if (r < 0) { r += nrow; c += 4 - ((nrow + 4) % 8); } if (c < 0) { c += ncol; r += 4 - ((ncol + 4) % 8); } a[r * ncol + c] = 10 * ch + bit; };
    const utah = (r, c, ch) => { mod(r - 2, c - 2, ch, 1); mod(r - 2, c - 1, ch, 2); mod(r - 1, c - 2, ch, 3); mod(r - 1, c - 1, ch, 4); mod(r - 1, c, ch, 5); mod(r, c - 2, ch, 6); mod(r, c - 1, ch, 7); mod(r, c, ch, 8); };
    const corner = (ch, pts) => pts.forEach(([r, c], k) => mod(r, c, ch, k + 1));
    let ch = 1, r = 4, c = 0;
    do {
      if (r === nrow && c === 0) corner(ch++, [[nrow - 1, 0], [nrow - 1, 1], [nrow - 1, 2], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1], [2, ncol - 1], [3, ncol - 1]]);
      if (r === nrow - 2 && c === 0 && ncol % 4) corner(ch++, [[nrow - 3, 0], [nrow - 2, 0], [nrow - 1, 0], [0, ncol - 4], [0, ncol - 3], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1]]);
      if (r === nrow - 2 && c === 0 && ncol % 8 === 4) corner(ch++, [[nrow - 3, 0], [nrow - 2, 0], [nrow - 1, 0], [0, ncol - 2], [0, ncol - 1], [1, ncol - 1], [2, ncol - 1], [3, ncol - 1]]);
      if (r === nrow + 4 && c === 2 && !(ncol % 8)) corner(ch++, [[nrow - 1, 0], [nrow - 1, ncol - 1], [0, ncol - 3], [0, ncol - 2], [0, ncol - 1], [1, ncol - 3], [1, ncol - 2], [1, ncol - 1]]);
      do { if (r < nrow && c >= 0 && !a[r * ncol + c]) utah(r, c, ch++); r -= 2; c += 2; } while (r >= 0 && c < ncol);
      r += 1; c += 3;
      do { if (r >= 0 && c < ncol && !a[r * ncol + c]) utah(r, c, ch++); r += 2; c -= 2; } while (r < nrow && c >= 0);
      r += 3; c += 1;
    } while (r < nrow || c < ncol);
    if (!a[nrow * ncol - 1]) { a[nrow * ncol - 1] = 1; a[nrow * ncol - ncol - 2] = 1; }
    return a;
  }
  // → array of rows of 0/1, including the finder pattern
  function matrix(text) {
    const data = encodeAscii(String(text));
    const sz = SIZES.find(s => s[1] >= data.length); if (!sz) throw new Error('Too long for a small Data Matrix');
    const [N, cap, n] = sz, cw = data.slice();
    if (cw.length < cap) cw.push(129);
    while (cw.length < cap) { const p = cw.length + 1; let v = 129 + ((149 * p) % 253) + 1; if (v > 254) v -= 254; cw.push(v); }
    const all = cw.concat(rs(cw, n)), R = N - 2, map = place(R, R);
    const m = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let r = 0; r < R; r++) for (let c = 0; c < R; c++) { const v = map[r * R + c]; m[r + 1][c + 1] = v === 1 ? 1 : v > 1 ? ((all[Math.floor(v / 10) - 1] >> (8 - (v % 10))) & 1) : 0; }
    for (let i = 0; i < N; i++) { m[i][0] = 1; m[N - 1][i] = 1; m[0][i] = i % 2 === 0 ? 1 : 0; m[i][N - 1] = (N - 1 - i) % 2 === 0 ? 1 : 0; }
    return m;
  }
  function svg(text, px) {
    const m = matrix(text), N = m.length, q = 1, W = N + 2 * q; let d = '';
    m.forEach((row, r) => row.forEach((v, c) => { if (v) d += `M${c + q} ${r + q}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${px || W * 8}" height="${px || W * 8}" shape-rendering="crispEdges"><rect width="${W}" height="${W}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  const api = { matrix, svg, encodeAscii };
  if (typeof module !== 'undefined') module.exports = api; else window.WNDataMatrix = api;
})();

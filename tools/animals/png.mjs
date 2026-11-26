// A small PNG reader and writer (8-bit RGB/RGBA, not interlaced) on Node's zlib, so the bear's
// textures can be made without another dependency (tools/animals/rig-bear.mjs).
import { inflateSync, deflateSync } from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

/** -> { width, height, data: Uint8Array RGBA } */
export function readPng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let o = 8, w = 0, h = 0, type = 0, depth = 0, inter = 0; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), t = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || inter || (type !== 2 && type !== 6)) throw new Error(`unsupported PNG (depth ${depth}, type ${type}, interlace ${inter})`);
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat)), px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, b = y ? px[dst - stride + x] : 0, c = x >= bpp && y ? px[dst - stride + x - bpp] : 0;
      const v = raw[src + x];
      px[dst + x] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 255;
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = px[i * bpp]; data[i * 4 + 1] = px[i * bpp + 1]; data[i * 4 + 2] = px[i * bpp + 2]; data[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] : 255; }
  return { width: w, height: h, data };
}

/** RGBA pixels -> PNG bytes (RGB, as the textures are opaque); each row gets the filter that
 *  compresses it best by the usual sum-of-differences guess */
export function writePng({ width: w, height: h, data }) {
  const bpp = 3, stride = w * bpp, px = new Uint8Array(stride * h);
  for (let i = 0; i < w * h; i++) { px[i * 3] = data[i * 4]; px[i * 3 + 1] = data[i * 4 + 1]; px[i * 3 + 2] = data[i * 4 + 2]; }
  const out = Buffer.alloc((stride + 1) * h), row = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    let best = null, bestF = 0, bestS = Infinity;
    for (let f = 0; f < 5; f++) {
      let s = 0;
      for (let x = 0; x < stride; x++) {
        const i = y * stride + x, a = x >= bpp ? px[i - bpp] : 0, b = y ? px[i - stride] : 0, c = x >= bpp && y ? px[i - stride - bpp] : 0;
        const v = (px[i] - (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c))) & 255;
        row[x] = v; s += v < 128 ? v : 256 - v;
      }
      if (s < bestS) { bestS = s; bestF = f; best = Uint8Array.from(row); }
    }
    out[y * (stride + 1)] = bestF; out.set(best, y * (stride + 1) + 1);
  }
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'latin1'); d.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

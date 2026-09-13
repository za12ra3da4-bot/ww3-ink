// 의존성 없는 PNG 인코더 + 절차적 먹/붓 그리기 도구
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// 이음매 없이 반복되는 value noise. period 는 격자 단위(≤256)
export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const P = 256;
  const g = new Float32Array(P * P).map(() => rnd());
  return (x, y, period = P) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const w = (i) => ((i % period) + period) % period;
    const v = (i, j) => g[w(i) + w(j) * P];
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

export function fbm(noise, x, y, period, oct = 4) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    s += a * noise(x * f, y * f, period * f);
    norm += a; a *= 0.5; f *= 2;
  }
  return s / norm;
}

export class Img {
  constructor(w, h, fill = [0, 0, 0, 0]) {
    this.w = w; this.h = h;
    this.d = new Float32Array(w * h * 4);
    for (let i = 0; i < w * h; i++) this.d.set(fill, i * 4);
  }

  idx(x, y) {
    x = ((Math.floor(x) % this.w) + this.w) % this.w;
    y = ((Math.floor(y) % this.h) + this.h) % this.h;
    return (x + y * this.w) * 4;
  }

  // 알파 합성(over). 좌표는 가장자리에서 감싼다(타일링)
  blend(x, y, r, g, b, a, wrap = true) {
    if (a <= 0) return;
    if (!wrap && (x < 0 || y < 0 || x >= this.w || y >= this.h)) return;
    const d = this.d, i = this.idx(x, y);
    const da = d[i + 3], oa = a + da * (1 - a);
    if (oa <= 0) return;
    d[i] = (r * a + d[i] * da * (1 - a)) / oa;
    d[i + 1] = (g * a + d[i + 1] * da * (1 - a)) / oa;
    d[i + 2] = (b * a + d[i + 2] * da * (1 - a)) / oa;
    d[i + 3] = oa;
  }

  // 부드러운 원. soft: 0=딱딱함, 1=가장자리까지 번짐
  dot(cx, cy, rad, rgb, a, soft = 0.3, wrap = true) {
    const R = rad + 1;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const cov = soft > 0 ? 1 - smooth(rad * (1 - soft), rad + 0.5, dist) : clamp01(rad + 0.5 - dist);
        if (cov > 0) this.blend(x, y, rgb[0], rgb[1], rgb[2], a * cov, wrap);
      }
    }
  }

  line(x0, y0, x1, y1, width, rgb, a, soft = 0.3, wrap = true) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / Math.max(0.5, width * 0.35)));
    const per = 1 - Math.pow(1 - a, 1 / Math.max(1, (width * 1.2) / Math.max(0.5, width * 0.35)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.dot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, rgb, per, soft, wrap);
    }
  }

  rect(x0, y0, x1, y1, rgb, a) {
    for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) this.blend(x, y, rgb[0], rgb[1], rgb[2], a);
  }

  each(fn) {
    const d = this.d;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (x + y * this.w) * 4;
        fn(x, y, d, i);
      }
    }
  }

  save(file) {
    const { w, h, d } = this;
    const row = w * 4 + 1;
    const raw = Buffer.alloc(row * h);
    for (let y = 0; y < h; y++) {
      raw[y * row] = 0;
      for (let x = 0; x < w; x++) {
        const i = (x + y * w) * 4, o = y * row + 1 + x * 4;
        for (let c = 0; c < 4; c++) raw[o + c] = Math.round(clamp01(d[i + c]) * 255);
      }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    writeFileSync(file, png);
  }
}

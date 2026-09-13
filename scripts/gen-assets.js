// 수묵화 텍스처 생성 — node scripts/gen-assets.js → public/assets/tex/*.png
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, makeNoise, fbm, mulberry32, smooth, clamp01 } from './texlib.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'tex');
mkdirSync(OUT, { recursive: true });
const out = (f) => path.join(OUT, f);
const rnd = mulberry32(20260913);
const INK = [0.075, 0.068, 0.062];
const gray = (d, i, v) => { d[i] = d[i + 1] = d[i + 2] = clamp01(v); d[i + 3] = 1; };

function crack(img, x, y, len, width, alpha, depth = 0) {
  let ang = rnd() * Math.PI * 2;
  for (let s = 0; s < len; s++) {
    const nx = x + Math.cos(ang) * 2, ny = y + Math.sin(ang) * 2;
    img.line(x, y, nx, ny, width * (1 - s / len) + 0.4, INK, alpha, 0.4);
    x = nx; y = ny; ang += (rnd() - 0.5) * 0.9;
    if (depth < 2 && rnd() < 0.04) crack(img, x, y, len * 0.4, width * 0.7, alpha, depth + 1);
  }
}

function bulletHoles(img, count, scale = 1) {
  for (let k = 0; k < count; k++) {
    const x = rnd() * img.w, y = rnd() * img.h, r = (1.2 + rnd() * 2.2) * scale;
    img.dot(x + 1, y + 1, r + 1.5, [1, 1, 1], 0.25, 0.8);
    img.dot(x, y, r, INK, 0.85, 0.3);
  }
}

// 1) 한지 (UI 배경 + 후처리 셰이더)
{
  const S = 512, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(11), n2 = makeNoise(12);
  img.each((x, y, d, i) => {
    const u = x / S, v = y / S;
    const val = 0.955 + (fbm(n, u * 4, v * 4, 4, 4) - 0.5) * 0.08 + (n2(u * 128, v * 128, 128) - 0.5) * 0.04;
    d[i] = 0.94 * val; d[i + 1] = 0.905 * val; d[i + 2] = 0.83 * val; d[i + 3] = 1;
  });
  for (let k = 0; k < 1400; k++) {
    let x = rnd() * S, y = rnd() * S, ang = rnd() * Math.PI * 2;
    const light = rnd() < 0.5, len = 8 + rnd() * 50;
    const col = light ? [1, 0.985, 0.94] : [0.55, 0.5, 0.42];
    const a = light ? 0.1 + rnd() * 0.12 : 0.025 + rnd() * 0.05;
    for (let s = 0; s < len; s++) {
      img.dot(x, y, 0.55, col, a, 0.5);
      ang += (rnd() - 0.5) * 0.35; x += Math.cos(ang); y += Math.sin(ang);
    }
  }
  for (let k = 0; k < 90; k++) img.dot(rnd() * S, rnd() * S, 0.6 + rnd() * 1.2, [0.35, 0.3, 0.25], 0.08 + rnd() * 0.15, 0.6);
  img.save(out('paper.png'));
}

// 2) 땅 — 옅은 먹 번짐 + 균열
{
  const S = 512, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(21), n2 = makeNoise(22);
  img.each((x, y, d, i) => {
    const u = x / S, v = y / S;
    gray(d, i, 0.7 + (fbm(n, u * 6, v * 6, 6, 5) - 0.5) * 0.38 + (n2(u * 160, v * 160, 160) - 0.5) * 0.09);
  });
  for (let k = 0; k < 30; k++) img.dot(rnd() * S, rnd() * S, 20 + rnd() * 60, INK, 0.04 + rnd() * 0.06, 1);
  for (let k = 0; k < 26; k++) crack(img, rnd() * S, rnd() * S, 20 + rnd() * 70, 0.8 + rnd() * 1.2, 0.35);
  for (let k = 0; k < 700; k++) {
    const light = rnd() < 0.4;
    img.dot(rnd() * S, rnd() * S, 0.6 + rnd() * 1.6, light ? [0.95, 0.95, 0.93] : INK, light ? 0.25 : 0.2, 0.5);
  }
  img.save(out('ground.png'));
}

// 3) 건물 외벽 — 2x2 창문 (8m x 6.4m 한 장)
{
  const S = 512, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(31), n2 = makeNoise(32);
  img.each((x, y, d, i) => {
    const u = x / S, v = y / S;
    const streak = (n2(u * 48, v * 3, 48) - 0.5) * 0.1;
    gray(d, i, 0.8 + (fbm(n, u * 8, v * 8, 8, 4) - 0.5) * 0.2 + streak);
  });
  for (const yy of [0, 256]) img.rect(0, yy, S, yy + 7, INK, 0.28);
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const ww = 104 + rnd() * 30, wh = 118 + rnd() * 24;
      const x0 = cx * 256 + 128 - ww / 2, y0 = cy * 256 + 132 - wh / 2, type = Math.floor(rnd() * 4);
      img.rect(x0 - 6, y0 - 6, x0 + ww + 6, y0 + wh + 10, [0.9, 0.9, 0.88], 0.35);
      img.rect(x0, y0, x0 + ww, y0 + wh, INK, type === 2 ? 0.5 : 0.88);
      if (type === 1) {
        for (let k = 0; k < 7; k++) {
          const sx = x0 + rnd() * ww, sy = y0 + rnd() * wh;
          img.line(sx, sy, sx + (rnd() - 0.5) * 50, sy + (rnd() - 0.5) * 50, 2 + rnd() * 3, [0.75, 0.75, 0.72], 0.6, 0.2);
        }
      } else if (type === 2) {
        for (let k = 0; k < 4; k++) {
          const py = y0 + 14 + k * (wh / 4.2) + rnd() * 6;
          img.line(x0 - 8, py, x0 + ww + 8, py + (rnd() - 0.5) * 18, 12, [0.62, 0.6, 0.56], 0.95, 0.15);
        }
      } else if (type === 3) {
        for (let k = 0; k < 16; k++) img.dot(x0 + ww / 2 + (rnd() - 0.5) * ww, y0 - k * 7, 16 + rnd() * 20, INK, 0.07, 1);
      }
      for (let k = 0; k < 5; k++) {
        const dx = x0 + rnd() * ww, len = 20 + rnd() * 70;
        img.line(dx, y0 + wh + 8, dx + (rnd() - 0.5) * 4, y0 + wh + 8 + len, 1.5 + rnd() * 4, INK, 0.13, 0.8);
      }
    }
  }
  bulletHoles(img, 40);
  for (let k = 0; k < 6; k++) crack(img, rnd() * S, rnd() * S, 30 + rnd() * 50, 1.2, 0.4);
  img.save(out('wall.png'));
}

// 4) 폐허 콘크리트
{
  const S = 256, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(41);
  img.each((x, y, d, i) => gray(d, i, 0.72 + (fbm(n, (x / S) * 5, (y / S) * 5, 5, 5) - 0.5) * 0.35));
  for (let k = 0; k < 14; k++) crack(img, rnd() * S, rnd() * S, 20 + rnd() * 50, 1.3, 0.45);
  bulletHoles(img, 18, 0.8);
  img.save(out('ruin.png'));
}

// 5) 모래주머니
{
  const S = 256, img = new Img(S, S, [0.28, 0.28, 0.27, 1]), n = makeNoise(51);
  for (let r = 0; r < 4; r++) {
    for (let c = -1; c < 3; c++) {
      const cx = c * 128 + (r % 2) * 64 + 64, cy = r * 64 + 32, rx = 62, ry = 29;
      for (let y = cy - ry; y <= cy + ry; y++) {
        for (let x = cx - rx; x <= cx + rx; x++) {
          const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (e >= 1) continue;
          const shade = 0.8 - ((y - cy) / ry) * 0.12 - e * 0.22 + (n(x * 0.25, y * 0.25, 64) - 0.5) * 0.1;
          const edge = smooth(0.78, 1, e) * 0.5;
          const v = shade * (1 - edge);
          img.blend(x, y, v, v, v * 0.97, 1);
        }
      }
    }
  }
  img.save(out('sandbag.png'));
}

// 6) 나무 상자
{
  const S = 256, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(61);
  img.each((x, y, d, i) => gray(d, i, 0.74 + (n(x * 0.02, y * 0.6, 64) - 0.5) * 0.25));
  for (let k = 1; k < 4; k++) img.rect(0, k * 64 - 2, S, k * 64 + 2, INK, 0.55);
  for (let k = 0; k < 40; k++) {
    const y = rnd() * S;
    img.line(0, y, S, y + (rnd() - 0.5) * 10, 0.8, INK, 0.12, 0.5);
  }
  img.rect(0, 0, S, 18, INK, 0.5); img.rect(0, S - 18, S, S, INK, 0.5);
  img.rect(0, 0, 18, S, INK, 0.5); img.rect(S - 18, 0, S, S, INK, 0.5);
  img.line(18, 18, S - 18, S - 18, 22, [0.62, 0.62, 0.6], 1, 0.05, false);
  img.line(18, 18, S - 18, S - 18, 26, INK, 0.25, 0.4, false);
  img.save(out('crate.png'));
}

// 7) 금속 (전차, 차량)
{
  const S = 256, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(71);
  img.each((x, y, d, i) => gray(d, i, 0.5 + (fbm(n, (x / S) * 6, (y / S) * 6, 6, 4) - 0.5) * 0.3));
  for (let k = 0; k < 30; k++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI;
    img.line(x, y, x + Math.cos(a) * 30, y + Math.sin(a) * 30, 0.8, [0.92, 0.92, 0.9], 0.3, 0.4);
  }
  for (let x = 12; x < S; x += 32) for (const y of [12, 244]) { img.dot(x + 1, y + 1, 3.5, INK, 0.5); img.dot(x, y, 3, [0.85, 0.85, 0.83], 0.8); }
  for (let k = 0; k < 8; k++) img.dot(rnd() * S, rnd() * S, 10 + rnd() * 26, INK, 0.12, 1);
  img.save(out('metal.png'));
}

// 8) 먹물 튄 자국 4종 (흰색 + 알파 → 재질 색으로 흑/주 틴트)
for (let v = 0; v < 4; v++) {
  const S = 256, img = new Img(S, S, [1, 1, 1, 0]), n = makeNoise(80 + v), g = makeNoise(90 + v);
  const baseR = 34 + rnd() * 22;
  img.each((x, y, d, i) => {
    const dx = x - 128, dy = y - 128, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const edge = baseR * (0.7 + 0.6 * fbm(n, Math.cos(ang) * 2 + 3, Math.sin(ang) * 2 + 3, 256, 4));
    const a = smooth(edge + 2, edge - 5, dist) * (0.82 + 0.18 * g(x * 0.2, y * 0.2, 256));
    d[i + 3] = a;
  });
  for (let k = 0, cnt = 14 + Math.floor(rnd() * 16); k < cnt; k++) {
    const ang = rnd() * Math.PI * 2, dist = baseR * 0.9 + rnd() * (118 - baseR);
    const r = Math.max(1.2, 7 * (1 - dist / 130) + rnd() * 2);
    const x = 128 + Math.cos(ang) * dist, y = 128 + Math.sin(ang) * dist;
    img.dot(x, y, r, [1, 1, 1], 0.95, 0.25, false);
    if (rnd() < 0.35) img.line(128 + Math.cos(ang) * baseR * 0.8, 128 + Math.sin(ang) * baseR * 0.8, x, y, r * 0.8, [1, 1, 1], 0.8, 0.3, false);
  }
  img.save(out(`splat${v}.png`));
}

// 9) 연기 / 번짐
{
  const S = 128, img = new Img(S, S, [1, 1, 1, 0]), n = makeNoise(99);
  img.each((x, y, d, i) => {
    const dist = Math.hypot(x - 64, y - 64) / 64;
    d[i + 3] = (1 - smooth(0.15, 1, dist)) * (0.35 + 0.65 * fbm(n, (x / S) * 4, (y / S) * 4, 4, 4));
  });
  img.save(out('smoke.png'));
}

// 10) 붓질 (예광탄, UI 밑줄)
{
  const W = 512, H = 64, img = new Img(W, H, [1, 1, 1, 0]), n = makeNoise(101);
  img.each((x, y, d, i) => {
    const t = x / W;
    const hw = 25 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.02)), 0.45) * (1 - t * 0.45);
    const y0 = 32 + 3 * Math.sin(t * 3);
    if (Math.abs(y - y0) > hw) return;
    const bristle = n(x * 0.015, y * 0.9, 256);
    const dry = smooth(0.45, 1, t);
    const edge = smooth(hw, hw - 2, Math.abs(y - y0));
    d[i + 3] = edge * (bristle > dry * 0.75 ? 0.95 : 0.12);
  });
  img.save(out('stroke.png'));
}

// 11) 먼 산 — 3겹 수묵 능선 (가로로 이음매 없이)
{
  const W = 2048, H = 512, img = new Img(W, H, [0.1, 0.1, 0.1, 0]), n = makeNoise(111), tex = makeNoise(112);
  const layers = [
    { base: 0.5, amp: 0.4, freq: 3, alpha: 0.3, fade: 0.45, c: 0.2 },
    { base: 0.66, amp: 0.3, freq: 6, alpha: 0.5, fade: 0.35, c: 0.14 },
    { base: 0.82, amp: 0.2, freq: 11, alpha: 0.72, fade: 0.25, c: 0.08 },
  ];
  layers.forEach((L, li) => {
    for (let x = 0; x < W; x++) {
      const m = fbm(n, (x / W) * L.freq, li * 7.3 + 0.5, L.freq, 5);
      const ridge = (L.base - L.amp * Math.pow(m, 1.8) * 1.5) * H;
      for (let y = Math.max(0, Math.floor(ridge)); y < H; y++) {
        const cun = 0.7 + 0.3 * tex(x * 0.08, y * 0.012, 256);
        const a = L.alpha * (1 - smooth(0, L.fade * H, y - ridge)) * cun * smooth(ridge - 1, ridge + 2, y);
        img.blend(x, y, L.c, L.c, L.c, a);
      }
    }
  });
  img.save(out('mountains.png'));
}

// 12) 붉은 해
{
  const S = 256, img = new Img(S, S, [0.72, 0.17, 0.1, 0]), n = makeNoise(121);
  img.each((x, y, d, i) => {
    const dist = Math.hypot(x - 128, y - 128);
    d[i + 3] = smooth(106, 98, dist) * (0.8 + 0.2 * n(x * 0.1, y * 0.1, 256));
  });
  img.save(out('sun.png'));
}

// 13) 수묵 소나무 (빌보드)
{
  const W = 256, H = 512, img = new Img(W, H, [INK[0], INK[1], INK[2], 0]);
  let px = 128, py = 510;
  for (let s = 0; s <= 40; s++) {
    const t = s / 40, nx = 128 + Math.sin(t * 2.4) * 22 + (rnd() - 0.5) * 3, ny = 510 - t * 430;
    img.line(px, py, nx, ny, 12 - t * 9, INK, 0.95, 0.2, false);
    px = nx; py = ny;
  }
  for (let lv = 0; lv < 7; lv++) {
    const t = lv / 6, cy = 100 + lv * 44 + (rnd() - 0.5) * 12;
    const cx = 128 + Math.sin((1 - (cy - 80) / 430) * 2.4) * 22 + (rnd() - 0.5) * 40;
    const half = 30 + t * 70;
    img.line(128 + Math.sin((1 - (cy - 80) / 430) * 2.4) * 22, cy + 10, cx, cy, 4, INK, 0.9, 0.3, false);
    for (let k = 0; k < 260 + t * 200; k++) {
      const x = cx + (rnd() - 0.5) * 2 * half * (0.3 + 0.7 * rnd()), y = cy + (rnd() - 0.6) * 22;
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.4, len = 5 + rnd() * 10;
      img.line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 1.3, INK, 0.55, 0.3, false);
    }
  }
  img.save(out('pine.png'));
}

console.log('텍스처 생성 완료 →', OUT);

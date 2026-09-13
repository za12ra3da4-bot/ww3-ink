// 추가 텍스처 (맵 소품용) — node scripts/gen-assets2.js → public/assets/tex/*.png
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, makeNoise, fbm, mulberry32, smooth, clamp01 } from './texlib.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'tex');
mkdirSync(OUT, { recursive: true });
const out = (f) => path.join(OUT, f);
const rnd = mulberry32(8080);
const INK = [0.075, 0.068, 0.062];
const gray = (d, i, v) => { d[i] = d[i + 1] = d[i + 2] = clamp01(v); d[i + 3] = 1; };

// 기와 — 세로로 이어진 수키와 골 (u: 지붕 폭, v: 경사)
{
  const S = 256, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(1);
  img.each((x, y, d, i) => {
    const u = (x % 32) / 32;
    const ridge = Math.sin(u * Math.PI);
    const course = (y % 28) / 28;
    const lip = smooth(0.82, 1, course) * 0.25;
    const v = 0.34 + ridge * 0.42 - lip + (n(x * 0.08, y * 0.08, 32) - 0.5) * 0.1;
    gray(d, i, v);
  });
  for (let k = 0; k < 20; k++) img.dot(rnd() * S, rnd() * S, 6 + rnd() * 14, INK, 0.12, 1);
  img.save(out('tile.png'));
}

// 초가 — 짚 결
{
  const S = 256, img = new Img(S, S, [0.55, 0.52, 0.45, 1]);
  for (let k = 0; k < 2600; k++) {
    const x = rnd() * S, y = rnd() * S, len = 10 + rnd() * 26, a = Math.PI / 2 + (rnd() - 0.5) * 0.35;
    const c = rnd() < 0.5 ? [0.78, 0.74, 0.62] : [0.3, 0.28, 0.24];
    img.line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 1.2, c, 0.35, 0.3);
  }
  img.save(out('thatch.png'));
}

// 나무결
{
  const S = 256, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(3);
  img.each((x, y, d, i) => {
    const w = x + fbm(n, (x / S) * 2, (y / S) * 8, 2, 3) * 40;
    gray(d, i, 0.62 + Math.sin(w * 0.35) * 0.06 + (n(x * 0.03, y * 0.4, 64) - 0.5) * 0.14);
  });
  for (let k = 0; k < 5; k++) {
    const cx = rnd() * S, cy = rnd() * S;
    for (let r = 2; r < 12; r += 2.5) img.dot(cx, cy, r, INK, 0.08, 0.4);
  }
  img.save(out('wood.png'));
}

// 컨테이너 골판
{
  const S = 256, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(4);
  img.each((x, y, d, i) => {
    const corr = Math.sin(((x % 20) / 20) * Math.PI * 2) * 0.1;
    gray(d, i, 0.72 + corr + (fbm(n, (x / S) * 5, (y / S) * 5, 5, 4) - 0.5) * 0.25);
  });
  img.rect(0, 0, S, 10, INK, 0.45);
  img.rect(0, S - 10, S, S, INK, 0.45);
  for (let k = 0; k < 16; k++) {
    const x = rnd() * S, y = rnd() * S;
    for (let j = 0; j < 5; j++) img.line(x, y + j * 3, x + (rnd() - 0.5) * 6, y + 20 + rnd() * 40, 2 + rnd() * 3, INK, 0.08, 0.8);
  }
  img.save(out('container.png'));
}

// 대나무 잎 (알파)
{
  const S = 256, img = new Img(S, S, [INK[0], INK[1], INK[2], 0]);
  for (let k = 0; k < 60; k++) {
    const cx = 20 + rnd() * 216, cy = 20 + rnd() * 216, a = rnd() * Math.PI * 2, len = 26 + rnd() * 30;
    const steps = 20;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, w = Math.sin(Math.PI * Math.pow(t, 0.7)) * (4 + len * 0.08);
      img.dot(cx + Math.cos(a) * len * t, cy + Math.sin(a) * len * t, w, INK, 0.9, 0.2, false);
    }
  }
  img.save(out('bambooleaf.png'));
}

// 설원 — 흰 바탕에 옅은 파란 그늘과 발자국
{
  const S = 512, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(6), n2 = makeNoise(7);
  img.each((x, y, d, i) => {
    const u = x / S, v = y / S;
    const g = 0.93 + (fbm(n, u * 6, v * 6, 6, 5) - 0.5) * 0.12 + (n2(u * 180, v * 180, 180) - 0.5) * 0.05;
    d[i] = g * 0.97; d[i + 1] = g * 0.98; d[i + 2] = g; d[i + 3] = 1;
  });
  for (let k = 0; k < 40; k++) {
    let x = rnd() * S, y = rnd() * S;
    const a = rnd() * Math.PI * 2;
    for (let s = 0; s < 10; s++) {
      img.dot(x + Math.cos(a + Math.PI / 2) * (s % 2 ? 5 : -5), y, 3.5, [0.6, 0.64, 0.7], 0.12, 0.8);
      x += Math.cos(a) * 14; y += Math.sin(a) * 14;
    }
  }
  img.save(out('snowfield.png'));
}

// 궁궐 박석 — 불규칙한 돌판
{
  const S = 256, img = new Img(S, S, [0, 0, 0, 1]), n = makeNoise(8);
  img.each((x, y, d, i) => gray(d, i, 0.78 + (fbm(n, (x / S) * 6, (y / S) * 6, 6, 4) - 0.5) * 0.22));
  let y = 0;
  while (y < S) {
    const h = 28 + rnd() * 26;
    img.line(0, y, S, y + (rnd() - 0.5) * 6, 1.6, INK, 0.35, 0.4);
    let x = rnd() * 30;
    while (x < S) {
      img.line(x, y, x + (rnd() - 0.5) * 8, y + h, 1.6, INK, 0.35, 0.4);
      x += 30 + rnd() * 40;
    }
    y += h;
  }
  img.save(out('paving.png'));
}

// 물결
{
  const S = 256, img = new Img(S, S, [1, 1, 1, 0]), n = makeNoise(9);
  img.each((x, y, d, i) => {
    const v = Math.sin((y + fbm(n, (x / S) * 4, (y / S) * 4, 4, 3) * 60) * 0.25);
    d[i + 3] = smooth(0.82, 1, v) * 0.55;
  });
  img.save(out('water.png'));
}

console.log('추가 텍스처 생성 완료 →', OUT);

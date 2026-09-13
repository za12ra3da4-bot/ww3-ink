// 설원 참호 — 양 진영의 참호선과 철조망이 깔린 무인지대
import { createKit, DEFAULT_POINTS } from './kit.js';

const Q = Math.PI / 2;

export function snow(seed) {
  const k = createKit(seed);
  const { R, rnd, box, prop } = k;
  const points = DEFAULT_POINTS.map((p) => ({ ...p }));
  for (const p of points) k.keepout(p.x, p.z, 8);

  // 흙벽(눈 덮인 둔덕)을 [x0, x1] 구간에서 gaps 를 비우고 12m 이하 조각으로 만든다
  const bermLine = (z, x0, x1, gaps, h, thick, step) => {
    const cuts = [[x0, x1]];
    for (const [g0, g1] of gaps) {
      for (let i = cuts.length - 1; i >= 0; i--) {
        const [a, b] = cuts[i];
        if (g1 <= a || g0 >= b) continue;
        cuts.splice(i, 1, ...[[a, g0], [g1, b]].filter(([p, q]) => q - p > 0.5));
      }
    }
    for (const [a, b] of cuts) {
      const n = Math.ceil((b - a) / 12);
      for (let i = 0; i < n; i++) {
        const p = a + ((b - a) * i) / n, q = a + ((b - a) * (i + 1)) / n, cx = (p + q) / 2;
        box(cx, 0, z, q - p, h, thick, null);
        prop('berm', cx, z, { rot: 0, len: q - p, h, thick });
        if (step) {
          box(cx, 0, z + step, q - p, 0.45, 0.7, null);
          prop('duckboard', cx, z + step, { len: q - p });
        }
      }
    }
  };

  // ── 참호선 ──
  for (const t of [0, 1]) {
    const s = t ? 1 : -1, zc = s * 34;
    const gap = (x) => [x - 2.2, x + 2.2];
    bermLine(zc - s * 1.7, -74, 74, [gap(-42), gap(0), gap(42), gap(-70), gap(70)], 1.35, 1.4, s * 1.0);
    bermLine(zc + s * 1.7, -74, 74, [gap(-62), gap(-20), gap(20), gap(62)], 1.35, 1.4, 0);
    k.bunker(-54, s * 45, t ? 0 : Math.PI);
    k.bunker(54, s * 45, t ? 0 : Math.PI);
  }

  // ── 무인지대 ──
  k.pointCover(points);
  k.scatter(12, 300, [-72, 72, -24, 24], (x, z) => {
    const len = R(6, 10);
    if (!k.free(x, z, len, 0.9, 2.2)) return false;
    k.wire(x, z, 0, len);
    return true;
  });
  k.scatter(3, 200, [-60, 60, -20, 20], (x, z, rot) => {
    if (!k.fits(x, z, rot, 3.5, 7.8, 2.5)) return false;
    k.tank(x, z, rot + (rnd() < 0.5 ? 0 : Math.PI));
    return true;
  });
  k.scatter(14, 300, [-74, 74, -28, 28], (x, z) => {
    const size = R(0.9, 1.9);
    if (!k.free(x, z, size * 1.5, size * 1.3, 2)) return false;
    k.rock(x, z, size, true);
    return true;
  });
  k.scatter(10, 300, [-74, 74, -28, 28], (x, z) => {
    if (!k.free(x, z, 0.5, 0.5, 2.5)) return false;
    k.deadtree(x, z, true);
    return true;
  });
  k.scatter(10, 300, [-74, 74, -26, 26], (x, z, rot) => {
    const len = R(2.5, 4);
    if (!k.fits(x, z, rot, len, 0.9, 2)) return false;
    k.sandbags(x, z, rot, len);
    return true;
  });
  for (let i = 0; i < 40; i++) k.crater(R(-76, 76), R(-30, 30), R(1.5, 4.2));

  // ── 후방 기지 ──
  for (const t of [0, 1]) {
    const s = t ? 1 : -1, face = t ? 0 : Math.PI;
    k.watchtower(-70, s * 55, face);
    k.watchtower(70, s * 55, face);
    k.tent(-38, s * 57, 0);
    k.tent(38, s * 57, 0);
    k.tent(-58, s * 76, Q);
    k.howitzer(-20, s * 55, face);
    k.howitzer(20, s * 55, face);
    k.crates(-48, s * 64, 0);
    k.crates(48, s * 64, 0);
    k.barrels(-30, s * 64);
    k.truck(60, s * 75, Q);
    k.banner(-8, s * 77.5, t);
    k.banner(8, s * 77.5, t);
  }

  // ── 가장자리 눈 덮인 소나무 ──
  for (let z = -72; z <= 72; z += 9) {
    for (const x of [-76, 76]) {
      const px = x + R(-1.5, 1.5), pz = z + R(-3, 3);
      if (k.free(px, pz, 0.5, 0.5, 1.2)) k.pine(px, pz, R(7, 11), true);
    }
  }

  const spawns = [k.spawnRow(0, -70, -44, 44), k.spawnRow(1, 70, -44, 44)];
  return k.finish('snow', points, spawns);
}

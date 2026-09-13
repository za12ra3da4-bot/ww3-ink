// 폐허 도시 — 무너진 아파트 블록 사이의 시가전
import { createKit, DEFAULT_POINTS } from './kit.js';

const Q = Math.PI / 2;

export function city(seed) {
  const k = createKit(seed);
  const { R, rnd, box } = k;
  const points = DEFAULT_POINTS.map((p) => ({ ...p }));
  for (const p of points) k.keepout(p.x, p.z, 7.5);

  // ── 기지 ──
  for (const t of [0, 1]) {
    const s = t ? 1 : -1, face = t ? 0 : Math.PI;
    k.bunker(-62, s * 71, face);
    k.bunker(62, s * 71, face);
    k.watchtower(-71, s * 61, face);
    k.watchtower(71, s * 61, face);
    for (let x = -66; x <= 66; x += 11) if (rnd() < 0.72) k.sandbags(x + R(-2, 2), s * (57 + R(-1.5, 1.5)), 0, R(4, 6.5));
    k.truck(-52, s * 75, Q);
    k.truck(52, s * 75, Q);
    k.banner(-8, s * 77.5, t);
    k.banner(8, s * 77.5, t);
  }
  k.pointCover(points);

  // ── 시가지 블록 ──
  const building = (cx, cz, w, d, h) => {
    box(cx, 0, cz, w, h, d, 'wall');
    k.prop('roof', cx, cz, { w, d, h, y0: 0 });
    if (rnd() < 0.4) {
      const w2 = w * R(0.35, 0.6), d2 = d * R(0.35, 0.6), h2 = R(2.5, 3.2);
      const x2 = cx + R(-(w - w2) / 2, (w - w2) / 2), z2 = cz + R(-(d - d2) / 2, (d - d2) / 2);
      box(x2, h, z2, w2, h2, d2, 'wall');
      k.prop('roof', x2, z2, { w: w2, d: d2, h: h + h2, y0: h, small: true });
    }
  };
  const wallLine = (a, b, c, axis, force) => {
    const n = 3, len = (b - a) / n;
    const gap = force || rnd() < 0.8 ? Math.floor(rnd() * n) : -1;
    for (let i = 0; i < n; i++) {
      const mid = a + (i + 0.5) * len;
      let h = R(2.2, 5.2);
      if (i === gap) {
        if (rnd() < 0.6) continue;
        h = R(0.8, 1.1);
      }
      if (axis === 'x') box(mid, 0, c, len, h, 0.6, 'ruin');
      else box(c, 0, mid, 0.6, h, len, 'ruin');
    }
  };

  for (const bx of [-56, -28, 0, 28, 56]) {
    for (const bz of [-36, -12, 12, 36]) {
      if (bx === 0 && Math.abs(bz) === 12) {
        // 광장: 부서진 기념비와 소나무
        box(0, 0, bz, 3.4, 1.2, 3.4, 'stone');
        box(R(-0.4, 0.4), 1.2, bz + R(-0.4, 0.4), 1.3, R(1.8, 3), 1.3, 'stone');
        k.prop('monument', 0, bz, {});
        for (const ox of [-6.5, 6.5]) k.pine(ox, bz + Math.sign(bz) * 5, R(6, 8));
        continue;
      }
      const r = rnd();
      if (r < 0.45) {
        if (rnd() < 0.5) {
          const w = R(9, 15), d = R(8, 12.5);
          building(bx + R(-(16 - w) / 2, (16 - w) / 2), bz + R(-(14 - d) / 2, (14 - d) / 2), w, d, R(7, 16));
        } else {
          const w1 = R(5, 7), w2 = R(5, 7), d1 = R(8, 13), d2 = R(8, 13);
          building(bx - 8 + w1 / 2, bz + R(-(14 - d1) / 2, (14 - d1) / 2), w1, d1, R(6, 13));
          building(bx + 8 - w2 / 2, bz + R(-(14 - d2) / 2, (14 - d2) / 2), w2, d2, R(6, 13));
        }
      } else if (r < 0.8) {
        const w = R(10, 14), d = R(9, 12), cx = bx + R(-1, 1), cz = bz + R(-1, 1);
        const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
        wallLine(x0, x1, z0 + 0.3, 'x', true);
        wallLine(x0, x1, z1 - 0.3, 'x');
        wallLine(z0 + 0.6, z1 - 0.6, x0 + 0.3, 'z');
        wallLine(z0 + 0.6, z1 - 0.6, x1 - 0.3, 'z');
        if (rnd() < 0.6) k.rubble(cx + R(-2, 2), cz + R(-2, 2));
        else k.crates(cx + R(-2, 2), cz + R(-2, 2), 0);
      } else {
        for (const sz of [-1, 1]) {
          box(bx - 4.55, 0, bz + sz * 6.5, 5.9, 1.2, 0.5, 'concrete');
          box(bx + 4.55, 0, bz + sz * 6.5, 5.9, 1.2, 0.5, 'concrete');
        }
        if (rnd() < 0.5) k.tank(bx + R(-1, 1), bz, rnd() < 0.5 ? 0 : Q);
        else { k.crates(bx - 3, bz + R(-2, 2), 0); k.barrels(bx + 3, bz + R(-2, 2)); }
      }
    }
  }

  // ── 가로등 · 전봇대 ──
  for (const x of [-42, -14, 14, 42]) {
    for (let z = -48; z <= 48; z += 16) {
      const px = x + (rnd() < 0.5 ? -1.5 : 1.5), pz = z + R(-2, 2);
      if (k.free(px, pz, 0.4, 0.4, 1.2)) (rnd() < 0.7 ? k.lamp : k.pole)(px, pz, rnd() * 6.28);
    }
  }

  // ── 거리 잔해 (엄폐물) ──
  k.scatter(80, 700, [-73, 73, -52, 52], (x, z, rot) => {
    const c = rnd();
    if (c < 0.24) { const len = R(2.5, 4.5); if (!k.fits(x, z, rot, len, 0.9, 1.8)) return false; k.sandbags(x, z, rot, len); }
    else if (c < 0.38) { if (!k.fits(x, z, rot, 2.6, 0.7, 1.8)) return false; k.barrier(x, z, rot); }
    else if (c < 0.52) { if (!k.fits(x, z, rot, 2.6, 1.3, 1.8)) return false; k.crates(x, z, rot); }
    else if (c < 0.68) { if (!k.fits(x, z, rot, 2, 4.4, 1.8)) return false; k.car(x, z, rot + (rnd() < 0.5 ? 0 : Math.PI)); }
    else if (c < 0.74) { if (!k.fits(x, z, rot, 2.7, 10.6, 2)) return false; k.bus(x, z, rot); }
    else if (c < 0.8) { if (!k.fits(x, z, rot, 3.5, 7.8, 2)) return false; k.tank(x, z, rot + (rnd() < 0.5 ? 0 : Math.PI)); }
    else if (c < 0.88) { if (!k.fits(x, z, 0, 2, 2, 1.8)) return false; k.barrels(x, z); }
    else { if (!k.fits(x, z, 0, 3.8, 3.8, 1.8)) return false; k.rubble(x, z); }
    return true;
  });

  // ── 소나무 · 포탄 구덩이 ──
  k.scatter(22, 300, [-76, 76, -54, 54], (x, z) => {
    if (Math.abs(x) < 70 && Math.abs(z) < 44) return false;
    if (!k.free(x, z, 0.5, 0.5, 2.5)) return false;
    k.pine(x, z);
    return true;
  });
  for (let i = 0; i < 28; i++) k.crater(R(-76, 76), R(-76, 76), R(1.5, 3.8));

  const spawns = [k.spawnRow(0, -70, -44, 44), k.spawnRow(1, 70, -44, 44)];
  return k.finish('city', points, spawns);
}

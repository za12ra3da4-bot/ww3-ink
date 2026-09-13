// 죽림 마을 — 초가집 마을, 서쪽 논, 동쪽 대숲과 사당
import { createKit } from './kit.js';

const Q = Math.PI / 2;

export function bamboo(seed) {
  const k = createKit(seed);
  const { R, rnd, rbox, prop, box } = k;
  const points = [
    { id: 0, label: '甲', x: -46, z: 0, r: 6 },
    { id: 1, label: '乙', x: 0, z: 0, r: 6 },
    { id: 2, label: '丙', x: 46, z: 0, r: 6 },
  ];
  for (const p of points) k.keepout(p.x, p.z, 8);

  const choga = (x, z, rot, w, d) => {
    rbox(x, z, rot, 0, 0, 0, w + 1, 0.35, d + 1);
    rbox(x, z, rot, 0, 0.35, 0, w, 2.6, d);
    rbox(x, z, rot, 0, 2.95, 0, w + 1.8, 1.8, d + 1.8);
    prop('choga', x, z, { rot, w, d });
  };
  const hanok = (x, z, rot, w, d) => {
    rbox(x, z, rot, 0, 0, 0, w + 1.6, 0.45, d + 1.6);
    rbox(x, z, rot, 0, 0.45, 0, w, 3.0, d);
    rbox(x, z, rot, 0, 3.45, 0, w + 2.6, 2.2, d + 2.6);
    prop('hanok', x, z, { rot, w, d });
  };
  const stonewall = (x, z, rot, len) => {
    k.rbox(x, z, rot, 0, 0, 0, len, 1.2, 0.7);
    prop('stonewall', x, z, { rot, len });
  };
  const jangdok = (x, z) => {
    box(x, 0, z, 2.6, 0.4, 1.8);
    box(x, 0.4, z, 2.2, 0.9, 1.4);
    prop('jangdok', x, z, {});
  };
  const haystack = (x, z) => { box(x, 0, z, 2.2, 1.8, 2.2); prop('haystack', x, z, {}); };
  const jangseung = (x, z, rot) => { box(x, 0, z, 0.5, 2.7, 0.5); prop('jangseung', x, z, { rot }); };
  const clump = (x, z) => {
    const n = 4 + Math.floor(rnd() * 5);
    box(x, 0, z, 1.5, 9, 1.5);
    prop('bamboo', x, z, { n, h: R(8, 12) });
  };

  // ── 마을 (乙) ──
  box(0, 0, -13, 1.4, 6, 1.4);
  prop('bigtree', 0, -13, {});
  box(10, 0, 9, 1.8, 0.9, 1.8);
  prop('well', 10, 9, {});
  choga(-18, -16, Math.PI, 8, 5.5);
  choga(18, -16, Math.PI, 8, 5.5);
  choga(-18, 17, 0, 8, 5.5);
  choga(18, 17, 0, 8, 5.5);
  choga(-6, -32, Math.PI, 7, 5);
  choga(8, 32, 0, 7, 5);
  choga(31, -24, Q, 7, 5);
  choga(-31, 24, -Q, 7, 5);
  jangdok(-10, -24);
  jangdok(12, 24);
  stonewall(-25, -5, Q, 8);
  stonewall(25, 5, Q, 8);
  stonewall(-12, -40, 0, 14);
  stonewall(12, 40, 0, 14);
  stonewall(-2, 26, 0, 6);
  stonewall(2, -26, 0, 6);
  for (const [x, z] of [[-8, 8], [7, -7]]) {
    box(x, 0, z, 0.7, 0.9, 0.7);
    prop('mortar', x, z, {});
  }

  // ── 서쪽 논 (甲) ──
  prop('shed', -46, -15, {});
  for (const lx of [-2, 2]) for (const lz of [-1.6, 1.6]) box(-46 + lx, 0, -15 + lz, 0.3, 2.6, 0.3);
  box(-46, 2.6, -15, 5.2, 1.0, 4.2);
  for (const [x, z] of [[-36, 12], [-56, 13], [-62, -32], [-34, -38], [-66, 36]]) haystack(x, z);
  box(-41, 0, 7, 0.3, 1.9, 0.3);
  prop('scarecrow', -41, 7, {});
  for (let x = -72; x <= -26; x += 11.5) {
    for (let z = -46; z <= 46; z += 11.5) {
      prop('paddy', x + 5.75, z + 5.75, { w: 11, d: 11 });
    }
  }
  // 논두렁 — 발목 높이라 걸어서 넘는다
  const berm = (cx, cz, w, d) => {
    const hit = k.boxes.some((o) => !o.ridge && o.min[0] < cx + w / 2 + 0.2 && o.max[0] > cx - w / 2 - 0.2 && o.min[2] < cz + d / 2 + 0.2 && o.max[2] > cz - d / 2 - 0.2);
    if (hit) return;
    box(cx, 0, cz, w, 0.32, d, null, { ridge: true });
    prop('ridge', cx, cz, { w, d });
  };
  for (let x = -72; x <= -26; x += 11.5) for (let z = -46; z < 46; z += 11.5) berm(x, z + 5.75, 0.8, 11.5);
  for (let z = -46; z <= 46; z += 11.5) for (let x = -72; x < -26; x += 11.5) berm(x + 5.75, z, 11.5, 0.8);

  // ── 동쪽 대숲 (丙) ──
  hanok(62, 0, Q, 7, 5);
  jangseung(36, -5, -Q);
  jangseung(36, 5, -Q);
  k.scatter(90, 1500, [24, 78, -54, 54], (x, z) => {
    if (Math.hypot(x - 46, z) < 11) return false;
    if (Math.abs(z) < 2.5 && x < 58) return false;
    if (!k.free(x, z, 1.5, 1.5, 1.35)) return false;
    clump(x, z);
    return true;
  });
  k.scatter(24, 500, [-78, -70, -54, 54], (x, z) => {
    if (!k.free(x, z, 1.5, 1.5, 1.4)) return false;
    clump(x, z);
    return true;
  });

  // ── 기지 ──
  for (const t of [0, 1]) {
    const s = t ? 1 : -1;
    for (const x of [-58, -30, 30, 58]) stonewall(x, s * 58, 0, 14);
    k.sandbags(-10, s * 60, 0, 6);
    k.sandbags(10, s * 60, 0, 6);
    jangseung(-4, s * 64, t ? 0 : Math.PI);
    jangseung(4, s * 64, t ? 0 : Math.PI);
    rbox(-46, s * 70, 0, 0, 0, 0, 1.7, 1.3, 3.2);
    prop('cart', -46, s * 70, { rot: 0 });
    haystack(46, s * 70);
    k.crates(-66, s * 66, 0);
    k.banner(-10, s * 77.5, t);
    k.banner(10, s * 77.5, t);
  }
  k.pointCover([points[1], points[2]]);
  k.scatter(12, 300, [-26, 24, -54, 54], (x, z, rot) => {
    if (rnd() < 0.5) { if (!k.fits(x, z, rot, 2.6, 1.3, 1.8)) return false; k.crates(x, z, rot); }
    else { const len = R(2.5, 4); if (!k.fits(x, z, rot, len, 0.9, 1.8)) return false; k.sandbags(x, z, rot, len); }
    return true;
  });
  for (const [x, z] of [[-22, 48], [22, -48], [-60, 52], [-58, -52]]) if (k.free(x, z, 0.5, 0.5, 2)) k.pine(x, z, R(7, 10));
  for (let i = 0; i < 12; i++) k.crater(R(-24, 24), R(-56, 56), R(1.5, 3));

  const spawns = [k.spawnRow(0, -70, -44, 44), k.spawnRow(1, 70, -44, 44)];
  return k.finish('bamboo', points, spawns);
}

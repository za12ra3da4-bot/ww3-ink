// 고궁 — 정전과 회랑이 둘러싼 궁궐 마당, 연못 정자와 종각이 있는 양쪽 별궁
import { createKit } from './kit.js';

const Q = Math.PI / 2;

export function palace(seed) {
  const k = createKit(seed);
  const { R, rnd, rbox, prop, box } = k;
  const points = [
    { id: 0, label: '甲', x: -52, z: 0, r: 6 },
    { id: 1, label: '乙', x: 0, z: 0, r: 6 },
    { id: 2, label: '丙', x: 52, z: 0, r: 6 },
  ];
  for (const p of points) k.keepout(p.x, p.z, 7.5);

  // ── 건물 조립 (충돌 상자 + 그림 소품) ──
  const hall = (x, z, rot, w, d) => {
    const pw = w + 5, pd = d + 5;
    rbox(x, z, rot, 0, 0, 0, pw, 1.0, pd);
    for (const sd of [-1, 1]) {
      rbox(x, z, rot, 0, 0, sd * (pd / 2 + 0.5), 5, 0.5, 1.0);
      rbox(x, z, rot, -(pw / 2 + 0.5), 0, sd * 2, 1.0, 0.5, 3);
      rbox(x, z, rot, pw / 2 + 0.5, 0, sd * 2, 1.0, 0.5, 3);
    }
    rbox(x, z, rot, 0, 1.0, 0, w, 5.4, d);
    for (let i = 0; i < 6; i++) {
      const lx = -w / 2 + 0.3 + (i * (w - 0.6)) / 5;
      rbox(x, z, rot, lx, 1.0, -(d / 2 + 1.3), 0.55, 5.4, 0.55);
      rbox(x, z, rot, lx, 1.0, d / 2 + 1.3, 0.55, 5.4, 0.55);
    }
    rbox(x, z, rot, 0, 6.4, 0, w + 4.5, 3.2, d + 4.5);
    prop('hall', x, z, { rot, w, d });
  };
  const hanok = (x, z, rot, w, d) => {
    rbox(x, z, rot, 0, 0, 0, w + 1.6, 0.45, d + 1.6);
    rbox(x, z, rot, 0, 0.45, 0, w, 3.0, d);
    rbox(x, z, rot, 0, 3.45, 0, w + 2.6, 2.2, d + 2.6);
    prop('hanok', x, z, { rot, w, d });
  };
  const gate = (x, z, rot, w) => {
    const side = (w - 4.4) / 2;
    rbox(x, z, rot, -(2.2 + side / 2), 0, 0, side, 4.2, 4);
    rbox(x, z, rot, 2.2 + side / 2, 0, 0, side, 4.2, 4);
    rbox(x, z, rot, 0, 3.4, 0, 4.4, 0.8, 4);
    rbox(x, z, rot, 0, 4.2, 0, w + 2, 2.6, 6);
    prop('gate', x, z, { rot, w });
  };
  const pwall = (x, z, rot, len) => {
    rbox(x, z, rot, 0, 0, 0, len, 3.0, 0.9);
    prop('pwall', x, z, { rot, len });
  };
  const corridor = (x, z, rot, len) => {
    rbox(x, z, rot, 0, 0, 0, len, 0.35, 3.2);
    rbox(x, z, rot, 0, 0, 1.3, len, 3.4, 0.5);
    const n = Math.max(2, Math.round(len / 3.5));
    for (let i = 0; i <= n; i++) rbox(x, z, rot, -len / 2 + 0.25 + (i * (len - 0.5)) / n, 0.35, -1.2, 0.4, 3.05, 0.4);
    rbox(x, z, rot, 0, 3.4, 0.1, len + 1, 1.6, 4.2);
    prop('corridor', x, z, { rot, len });
  };
  const pavilion = (x, z, rot, s, bell = false) => {
    rbox(x, z, rot, 0, 0, 0, s + 1.2, 0.5, s + 1.2);
    for (const lx of [-s / 2, s / 2]) for (const lz of [-s / 2, s / 2]) rbox(x, z, rot, lx, 0.5, lz, 0.45, 3.6, 0.45);
    rbox(x, z, rot, 0, 4.1, 0, s + 3, 2.6, s + 3);
    if (bell) rbox(x, z, rot, 0, 1.6, 0, 1.6, 2.4, 1.6);
    prop('pavilion', x, z, { rot, s, bell });
  };
  const lantern = (x, z) => { box(x, 0, z, 0.8, 1.9, 0.8); prop('slantern', x, z, {}); };
  const dmu = (x, z) => { box(x, 0, z, 1.5, 1.1, 1.5); prop('dmu', x, z, {}); };
  const pagoda = (x, z) => { box(x, 0, z, 3.2, 1.2, 3.2); box(x, 1.2, z, 2.1, 5.6, 2.1); prop('pagoda', x, z, {}); };

  // ── 기지: 성벽과 대문 ──
  for (const t of [0, 1]) {
    const s = t ? 1 : -1;
    gate(0, s * 60, 0, 16);
    for (const sx of [-1, 1]) {
      pwall(sx * 22, s * 60, 0, 28);
      pwall(sx * 54, s * 60, 0, 24);
      pwall(sx * 75.5, s * 60, 0, 7);
      lantern(sx * 10.5, s * 57);
      k.sandbags(sx * 39, s * 66, 0, 5);
      k.crates(sx * 60, s * 68, 0);
    }
    k.banner(-5, s * 63, t);
    k.banner(5, s * 63, t);
  }

  // ── 중앙 마당 (乙) ──
  hall(0, -37, Math.PI, 18, 9);
  hall(0, 37, 0, 18, 9);
  for (const sx of [-1, 1]) {
    corridor(sx * 26, -15.5, sx < 0 ? -Q : Q, 21);
    corridor(sx * 26, 15.5, sx < 0 ? -Q : Q, 21);
    pagoda(sx * 15, 0);
    for (const sz of [-1, 1]) {
      for (const dz of [9.5, 13, 16.5, 20]) { box(sx * 4.5, 0, sz * dz, 0.36, 0.9, 0.26); prop('rankstone', sx * 4.5, sz * dz, {}); }
      dmu(sx * 14, sz * 24);
      lantern(sx * 8, sz * 27);
    }
  }
  prop('paving', 0, 0, { w: 48, d: 52 });

  // ── 서쪽 별궁 (甲): 연못 정자 ──
  prop('pond', -55, -34, { rx: 11, rz: 8 });
  pavilion(-55, -34, 0, 5.5);
  hanok(-67, 22, -Q, 11, 7);
  hanok(-44, 31, 0, 10, 7);
  hanok(-70, -6, -Q, 9, 6);
  pwall(-70, -17, 0, 16);
  pwall(-37, -17, 0, 14);
  lantern(-45, -7);
  lantern(-59, 7);

  // ── 동쪽 별궁 (丙): 종각과 정원 ──
  pavilion(55, -32, 0, 7, true);
  hanok(67, -11, Q, 10, 7);
  hanok(46, 29, 0, 12, 7);
  hanok(69, 24, Q, 9, 6);
  pwall(70, 15, 0, 16);
  pwall(38, 15, 0, 12);
  lantern(45, 7);
  lantern(59, -7);

  // ── 소나무 · 괴석 ──
  for (const [x, z] of [[-36, -44], [-73, -46], [-38, 45], [-75, 42], [38, -46], [72, -45], [37, 45], [75, 44], [-20, 50], [20, -50], [-16, -52], [18, 52]]) {
    if (k.free(x, z, 0.5, 0.5, 1.5)) k.pine(x + R(-1, 1), z + R(-1, 1), R(7, 11));
  }
  k.scatter(10, 200, [30, 76, -50, 50], (x, z) => {
    if (!k.free(x, z, 2.5, 2.5, 1.8)) return false;
    k.rock(x, z, R(0.9, 1.7));
    return true;
  });

  // ── 전쟁의 흔적 ──
  k.pointCover(points);
  k.scatter(26, 400, [-76, 76, -54, 54], (x, z, rot) => {
    const c = rnd();
    if (c < 0.4) { const len = R(2.5, 4); if (!k.fits(x, z, rot, len, 0.9, 1.8)) return false; k.sandbags(x, z, rot, len); }
    else if (c < 0.65) { if (!k.fits(x, z, rot, 2.6, 1.3, 1.8)) return false; k.crates(x, z, rot); }
    else if (c < 0.8) { if (!k.fits(x, z, 0, 2, 2, 1.8)) return false; k.barrels(x, z); }
    else { if (!k.fits(x, z, 0, 3.8, 3.8, 1.8)) return false; k.rubble(x, z); }
    return true;
  });
  for (let i = 0; i < 14; i++) k.crater(R(-76, 76), R(-56, 56), R(1.5, 3));

  const spawns = [k.spawnRow(0, -70, -44, 44), k.spawnRow(1, 70, -44, 44)];
  return k.finish('palace', points, spawns);
}

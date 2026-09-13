// 항구 — 컨테이너 미로, 창고, 부두의 거대한 크레인과 정박한 화물선
import { createKit } from './kit.js';

const Q = Math.PI / 2;

export function harbor(seed) {
  const k = createKit(seed);
  const { R, rnd, rbox, prop, box } = k;
  const points = [
    { id: 0, label: '甲', x: -42, z: 0, r: 6 },
    { id: 1, label: '乙', x: 4, z: 0, r: 6 },
    { id: 2, label: '丙', x: 50, z: 0, r: 6 },
  ];
  for (const p of points) k.keepout(p.x, p.z, 8.5);

  // ── 바다와 부두 ──
  box(66.5, 0, 0, 1, 4, 160, null, { noShoot: true });
  prop('sea', 67, 0, {});
  box(80, 0, 0, 12, 7.5, 64);
  box(79, 7.5, 20, 9, 8, 9);
  prop('ship', 80, 0, {});
  for (let z = -76; z <= 76; z += 8) {
    if (Math.abs(Math.abs(z) - 28) < 7) continue;
    box(64.6, 0, z, 0.6, 0.75, 0.6);
    prop('bollard', 64.6, z, {});
  }

  const crane = (x, z) => {
    for (const lx of [-6, 6]) for (const lz of [-5, 5]) box(x + lx, 0, z + lz, 1.1, 22, 1.1);
    prop('crane', x, z, {});
  };
  crane(58, -28);
  crane(58, 28);

  // ── 창고 ──
  const warehouse = (x, z, rot, w, d) => {
    rbox(x, z, rot, 0, 0, d / 2, w, 7, 0.4);
    rbox(x, z, rot, -w / 2, 0, 0, 0.4, 7, d);
    rbox(x, z, rot, w / 2, 0, 0, 0.4, 7, d);
    const seg = (w - 8) / 2;
    rbox(x, z, rot, -(4 + seg / 2), 0, -d / 2, seg, 7, 0.4);
    rbox(x, z, rot, 4 + seg / 2, 0, -d / 2, seg, 7, 0.4);
    rbox(x, z, rot, 0, 5, -d / 2, 8, 2, 0.4);
    rbox(x, z, rot, 0, 7, 0, w + 0.6, 0.6, d + 0.6);
    prop('warehouse', x, z, { rot, w, d });
  };
  warehouse(-57, -31, -Q, 22, 16);
  warehouse(-57, 31, -Q, 22, 16);
  // 창고 안 짐
  for (const sz of [-1, 1]) {
    k.crates(-60, sz * 26, 0);
    k.crates(-54, sz * 36, 0);
    box(-61, 0, sz * 36, 1.2, 0.9, 1.0);
    prop('pallet', -61, sz * 36, { n: 6 });
    box(-52, 0, sz * 24, 1.3, 2.2, 2.6);
    prop('forklift', -52, sz * 24, { rot: rnd() * 0.4 });
  }

  // ── 컨테이너 야적장 ──
  const rows = [-42, -30, -18, -6, 6, 18, 30, 42];
  for (const gx of [-22, -10, 2, 14, 26, 38]) {
    for (const gz of rows) {
      if (rnd() < 0.2) continue;
      const n = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < n; i++) {
        const cx = gx + i * 2.55 - (n - 1) * 1.275, cz = gz + R(-0.3, 0.3);
        if (!k.free(cx, cz, 2.44, 6.06, 0.05)) continue;
        const lv = 1 + (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0);
        for (let l = 0; l < lv; l++) k.container(cx, cz, 0, l);
      }
    }
  }

  // ── 부두 차량 ──
  for (const [x, z, r] of [[48, -46, 0], [50, 44, Math.PI], [36, -58, Q], [-30, 52, Q]]) if (k.fits(x, z, r, 2.6, 8.2, 1)) k.truck(x, z, r);
  for (const [x, z] of [[-40, -14], [-44, 16], [56, 12], [30, -4]]) if (k.free(x, z, 2, 2, 1.2)) k.barrels(x, z);
  for (const x of [-70, -40, -10, 20, 50]) {
    for (const z of [-50, 50]) {
      if (!k.free(x, z, 0.5, 0.5, 1.5)) continue;
      box(x, 0, z, 0.5, 12, 0.5);
      prop('flood', x, z, { rot: z > 0 ? Math.PI : 0 });
    }
  }

  // ── 기지 ──
  for (const t of [0, 1]) {
    const s = t ? 1 : -1;
    for (const x of [-58, -34, 34, 58]) k.container(x, s * 58, Q, 0);
    k.container(-58, s * 58, Q, 1);
    k.container(58, s * 58, Q, 1);
    for (const x of [-18, 18]) k.sandbags(x, s * 60, 0, 6);
    k.barrier(-7, s * 56, 0);
    k.barrier(7, s * 56, 0);
    box(-72, 0, s * 66, 3, 2.8, 3, 'concrete');
    prop('booth', -72, s * 66, {});
    k.banner(-8, s * 77.5, t);
    k.banner(8, s * 77.5, t);
  }
  k.pointCover(points);
  k.scatter(18, 300, [-76, 62, -54, 54], (x, z, rot) => {
    const c = rnd();
    if (c < 0.35) { if (!k.fits(x, z, rot, 2.6, 1.3, 1.6)) return false; k.crates(x, z, rot); }
    else if (c < 0.6) { if (!k.fits(x, z, 0, 1.2, 1.0, 1.6)) return false; box(x, 0, z, 1.2, 1.05, 1.0); prop('pallet', x, z, { n: 7 }); }
    else if (c < 0.8) { if (!k.fits(x, z, rot, 2.6, 0.7, 1.6)) return false; k.barrier(x, z, rot); }
    else { const len = R(3, 5); if (!k.fits(x, z, rot, len, 0.9, 1.6)) return false; k.sandbags(x, z, rot, len); }
    return true;
  });
  for (let i = 0; i < 12; i++) k.crater(R(-76, 60), R(-60, 60), R(1.5, 3));

  const spawns = [k.spawnRow(0, -70, -44, 44), k.spawnRow(1, 70, -44, 44)];
  return k.finish('harbor', points, spawns);
}

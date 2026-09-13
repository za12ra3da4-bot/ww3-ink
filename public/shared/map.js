// 전장 생성 — 같은 seed 면 서버와 모든 클라이언트가 똑같은 폐허 도시를 만든다.
import { MAP_HALF } from './config.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const POINTS = [
  { id: 0, label: '甲', x: -42, z: 0, r: 6 },
  { id: 1, label: '乙', x: 0, z: 0, r: 6 },
  { id: 2, label: '丙', x: 42, z: 0, r: 6 },
];

export function generateMap(seed) {
  const rnd = mulberry32(seed >>> 0);
  const R = (a, b) => a + (b - a) * rnd();
  const boxes = [];
  const props = [];

  const add = (kind, cx, y0, cz, w, h, d, extra) => {
    const b = { kind, min: [cx - w / 2, y0, cz - d / 2], max: [cx + w / 2, y0 + h, cz + d / 2], s: rnd() };
    if (extra) Object.assign(b, extra);
    boxes.push(b);
    return b;
  };

  const keepouts = POINTS.map((p) => ({ x: p.x, z: p.z, r: 7.5 }));
  const free = (cx, cz, w, d, m) => {
    const x0 = cx - w / 2 - m, x1 = cx + w / 2 + m, z0 = cz - d / 2 - m, z1 = cz + d / 2 + m;
    if (x0 < -MAP_HALF + 1 || x1 > MAP_HALF - 1 || z0 < -MAP_HALF + 1 || z1 > MAP_HALF - 1) return false;
    for (const k of keepouts) {
      const nx = Math.max(x0, Math.min(k.x, x1)), nz = Math.max(z0, Math.min(k.z, z1));
      if ((nx - k.x) ** 2 + (nz - k.z) ** 2 < k.r * k.r) return false;
    }
    for (const b of boxes) if (b.min[0] < x1 && b.max[0] > x0 && b.min[2] < z1 && b.max[2] > z0) return false;
    return true;
  };

  // ── 조립 부품 ─────────────────────────────────────
  const house = (cx, cz, w, d, h) => {
    add('building', cx, 0, cz, w, h, d);
    if (rnd() < 0.45) add('building', cx + R(-w / 4, w / 4), h, cz + R(-d / 4, d / 4), w * R(0.3, 0.6), R(1, 3), d * R(0.3, 0.6));
  };

  const wallLine = (a, b, c, axis, force) => {
    const n = 3, len = (b - a) / n;
    const gap = force || rnd() < 0.8 ? Math.floor(rnd() * n) : -1;
    for (let i = 0; i < n; i++) {
      const mid = a + (i + 0.5) * len;
      let h = R(2.2, 5.2);
      if (i === gap) { if (rnd() < 0.6) continue; h = R(0.8, 1.1); }
      if (axis === 'x') add('ruin', mid, 0, c, len, h, 0.6);
      else add('ruin', c, 0, mid, 0.6, h, len);
    }
  };

  const crateStack = (cx, cz) => {
    add('crate', cx, 0, cz, 1.2, 1.2, 1.2);
    if (rnd() < 0.35) add('crate', cx + R(-0.15, 0.15), 1.2, cz + R(-0.15, 0.15), 1.2, 1.2, 1.2);
  };

  const rubble = (cx, cz) => {
    for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) {
      add('rubble', cx + R(-1, 1), 0, cz + R(-1, 1), R(0.6, 1.6), R(0.35, 0.9), R(0.6, 1.6));
    }
  };

  const car = (cx, cz, rot) => {
    const f = rnd() < 0.5 ? 1 : -1;
    add('car', cx, 0, cz, rot ? 4.2 : 2.0, 1.0, rot ? 2.0 : 4.2);
    const o = -0.3 * f;
    add('carTop', cx + (rot ? o : 0), 1.0, cz + (rot ? 0 : o), rot ? 2.2 : 1.8, 0.75, rot ? 1.8 : 2.2);
  };

  const tank = (cx, cz, rot) => {
    const f = rnd() < 0.5 ? 1 : -1;
    add('tank', cx, 0, cz, rot ? 6.2 : 3.4, 1.5, rot ? 3.4 : 6.2);
    const tx = cx + (rot ? -0.4 * f : 0), tz = cz + (rot ? 0 : -0.4 * f);
    add('turret', tx, 1.5, tz, rot ? 2.8 : 2.4, 0.9, rot ? 2.4 : 2.8);
    const off = 1.4 + 1.7;
    add('barrel', tx + (rot ? off * f : 0), 1.8, tz + (rot ? 0 : off * f), rot ? 3.4 : 0.28, 0.28, rot ? 0.28 : 3.4);
  };

  // 감시탑: 기둥 4개 + 발판 + 난간 + 계단(기지 쪽으로)
  const watchtower = (cx, cz, s) => {
    for (const ox of [-1.9, 1.9]) for (const oz of [-1.9, 1.9]) add('post', cx + ox, 0, cz + oz, 0.35, 5, 0.35);
    add('deck', cx, 5, cz, 4.4, 0.3, 4.4);
    add('rail', cx, 5.3, cz - s * 2.075, 4.4, 1.0, 0.25); // 전방 난간
    add('rail', cx + 2.075, 5.3, cz, 0.25, 1.0, 4.4);
    add('rail', cx - 2.075, 5.3, cz, 0.25, 1.0, 4.4);
    for (let i = 0; i < 12; i++) {
      const z0 = cz + s * (2.2 + (11 - i) * 0.55);
      add('step', cx - 1.4, 0, z0 + s * 0.275, 1.4, (i + 1) * 0.44, 0.55);
    }
  };

  // ── 기지 ──────────────────────────────────────────
  for (const t of [0, 1]) {
    const s = t === 0 ? -1 : 1;
    add('bunker', -62, 0, s * 72, 10, 3, 6);
    add('bunker', 62, 0, s * 72, 10, 3, 6);
    watchtower(-70, s * 63, s);
    watchtower(70, s * 63, s);
    for (let x = -66; x <= 66; x += 11) {
      if (rnd() < 0.72) add('sandbag', x + R(-2, 2), 0, s * (58 + R(-1.5, 1.5)), R(4, 6.5), 1.1, 1.0);
    }
    props.push({ kind: 'banner', team: t, x: -8, z: s * 77 }, { kind: 'banner', team: t, x: 8, z: s * 77 });
  }

  // ── 거점 주변 엄폐 ─────────────────────────────────
  for (const p of POINTS) {
    add('sandbag', p.x - 4.2, 0, p.z + R(-1, 1), 0.9, 1.1, R(2.4, 3.2));
    add('sandbag', p.x + 4.2, 0, p.z + R(-1, 1), 0.9, 1.1, R(2.4, 3.2));
    add('sandbag', p.x + R(-1, 1), 0, p.z - 4.4, R(2.2, 3), 1.1, 0.9);
    add('sandbag', p.x + R(-1, 1), 0, p.z + 4.4, R(2.2, 3), 1.1, 0.9);
  }

  // ── 시가지 블록 ───────────────────────────────────
  const COLS = [-56, -28, 0, 28, 56];
  const ROWS = [-36, -12, 12, 36];
  for (const bx of COLS) {
    for (const bz of ROWS) {
      if (bx === 0 && Math.abs(bz) === 12) {
        // 중앙 광장: 부서진 기념비
        add('stone', 0, 0, bz, 3.2, 1.2, 3.2);
        add('stone', R(-0.4, 0.4), 1.2, bz + R(-0.4, 0.4), 1.2, R(1.4, 2.6), 1.2);
        for (const ox of [-6, 6]) props.push({ kind: 'pine', x: ox, z: bz + Math.sign(bz) * 5, h: R(5, 7.5), s: rnd() });
        add('trunk', -6, 0, bz + Math.sign(bz) * 5, 0.5, 3, 0.5);
        add('trunk', 6, 0, bz + Math.sign(bz) * 5, 0.5, 3, 0.5);
        continue;
      }
      const r = rnd();
      if (r < 0.45) {
        if (rnd() < 0.5) {
          const w = R(9, 15), d = R(8, 12.5);
          house(bx + R(-(16 - w) / 2, (16 - w) / 2), bz + R(-(14 - d) / 2, (14 - d) / 2), w, d, R(6, 15));
        } else {
          const w1 = R(5, 7), w2 = R(5, 7), d1 = R(8, 13), d2 = R(8, 13);
          house(bx - 8 + w1 / 2, bz + R(-(14 - d1) / 2, (14 - d1) / 2), w1, d1, R(5, 13));
          house(bx + 8 - w2 / 2, bz + R(-(14 - d2) / 2, (14 - d2) / 2), w2, d2, R(5, 13));
        }
      } else if (r < 0.8) {
        const w = R(10, 14), d = R(9, 12), cx = bx + R(-1, 1), cz = bz + R(-1, 1);
        const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
        wallLine(x0, x1, z0 + 0.3, 'x', true);
        wallLine(x0, x1, z1 - 0.3, 'x');
        wallLine(z0 + 0.6, z1 - 0.6, x0 + 0.3, 'z');
        wallLine(z0 + 0.6, z1 - 0.6, x1 - 0.3, 'z');
        if (rnd() < 0.6) rubble(cx + R(-2, 2), cz + R(-2, 2));
        else crateStack(cx + R(-2, 2), cz + R(-2, 2));
      } else {
        const w = 15, d = 13;
        for (const sz of [-1, 1]) {
          add('lowwall', bx - w / 4 - 0.8, 0, bz + (sz * d) / 2, w / 2 - 1.6, 1.2, 0.5);
          add('lowwall', bx + w / 4 + 0.8, 0, bz + (sz * d) / 2, w / 2 - 1.6, 1.2, 0.5);
        }
        if (rnd() < 0.5) tank(bx + R(-1, 1), bz, rnd() < 0.5);
        else { crateStack(bx - 3, bz + R(-2, 2)); crateStack(bx + 3, bz + R(-2, 2)); }
      }
    }
  }

  // ── 거리 잡동사니 (엄폐물) ─────────────────────────
  for (let i = 0, placed = 0; i < 600 && placed < 75; i++) {
    const cx = R(-73, 73), cz = R(-52, 52), rot = rnd() < 0.5, k = rnd();
    if (k < 0.3) {
      const w = R(2.5, 4.5), W = rot ? 0.9 : w, D = rot ? w : 0.9;
      if (free(cx, cz, W, D, 1.8)) { add('sandbag', cx, 0, cz, W, 1.1, D); placed++; }
    } else if (k < 0.48) {
      const W = rot ? 0.6 : 2.4, D = rot ? 2.4 : 0.6;
      if (free(cx, cz, W, D, 1.8)) { add('barrier', cx, 0, cz, W, 1.0, D); placed++; }
    } else if (k < 0.66) {
      if (free(cx, cz, 1.5, 1.5, 1.8)) { crateStack(cx, cz); placed++; }
    } else if (k < 0.82) {
      if (free(cx, cz, rot ? 4.4 : 2.2, rot ? 2.2 : 4.4, 1.8)) { car(cx, cz, rot); placed++; }
    } else if (k < 0.9) {
      if (free(cx, cz, rot ? 9 : 3.6, rot ? 3.6 : 9, 2)) { tank(cx, cz, rot); placed++; }
    } else if (free(cx, cz, 3.8, 3.8, 1.8)) { rubble(cx, cz); placed++; }
  }

  // ── 소나무 (무인지대와 가장자리) ──────────────────
  for (let i = 0, placed = 0; i < 200 && placed < 26; i++) {
    const edge = rnd() < 0.4;
    const x = edge ? Math.sign(rnd() - 0.5) * R(74, 78) : R(-70, 70);
    const z = edge ? R(-50, 50) : Math.sign(rnd() - 0.5) * R(45, 54);
    if (!free(x, z, 0.5, 0.5, 2.5)) continue;
    add('trunk', x, 0, z, 0.5, 3, 0.5);
    props.push({ kind: 'pine', x, z, h: R(5, 9), s: rnd() });
    placed++;
  }

  for (let i = 0; i < 26; i++) props.push({ kind: 'crater', x: R(-76, 76), z: R(-76, 76), r: R(1.5, 3.8), s: rnd() });

  // ── 출현 지점 ─────────────────────────────────────
  const spawns = [[], []];
  for (const t of [0, 1]) {
    const s = t === 0 ? -1 : 1;
    for (let i = 0; i < 12; i++) {
      spawns[t].push({ x: -44 + i * 8 + R(-1.5, 1.5), z: s * (70 + R(-3, 3)), yaw: t === 0 ? Math.PI : 0 });
    }
  }

  return { seed, boxes, props, spawns, points: POINTS };
}

// 봇 길찾기용 격자 (1칸 = 1m). 걸어서 넘을 수 없는 물체가 있는 칸은 막힘.
export function buildNav(boxes) {
  const n = MAP_HALF * 2, off = MAP_HALF, pad = 0.45;
  const blocked = new Uint8Array(n * n);
  for (const b of boxes) {
    if (b.max[1] <= 0.5 || b.min[1] >= 1.7) continue;
    const x0 = Math.max(0, Math.floor(b.min[0] - pad + off)), x1 = Math.min(n - 1, Math.ceil(b.max[0] + pad + off) - 1);
    const z0 = Math.max(0, Math.floor(b.min[2] - pad + off)), z1 = Math.min(n - 1, Math.ceil(b.max[2] + pad + off) - 1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) blocked[x + z * n] = 1;
  }
  return { n, off, blocked };
}

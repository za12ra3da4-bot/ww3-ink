// 맵 생성 도구 — 충돌 상자(boxes)와 그림용 소품(props)을 함께 만든다.
// 규칙: 상자에 m(재질)이 있으면 클라이언트가 상자를 그대로 그리고, 없으면 같은 자리의 소품이 모양을 그린다.
import { MAP_HALF } from '../config.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_POINTS = [
  { id: 0, label: '甲', x: -42, z: 0, r: 6 },
  { id: 1, label: '乙', x: 0, z: 0, r: 6 },
  { id: 2, label: '丙', x: 42, z: 0, r: 6 },
];

const Q = Math.PI / 2;
const r3 = (v) => Math.round(v * 1000) / 1000;

// three.js 의 rotation.y 와 같은 방향: 국소 (lx, lz) → 월드
export function toWorld(x, z, rot, lx, lz) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

export function createKit(seed) {
  const rnd = mulberry32(seed >>> 0);
  const R = (a, b) => a + (b - a) * rnd();
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const boxes = [];
  const props = [];
  const keepouts = [];

  function box(cx, y0, cz, w, h, d, m, extra) {
    const b = { min: [r3(cx - w / 2), r3(y0), r3(cz - d / 2)], max: [r3(cx + w / 2), r3(y0 + h), r3(cz + d / 2)] };
    if (m) b.m = m;
    if (extra) Object.assign(b, extra);
    boxes.push(b);
    return b;
  }

  // 기준점 (x, z), 방향 rot(90° 단위)에서 국소 좌표 (lx, lz)에 놓인 상자
  function rbox(x, z, rot, lx, y0, lz, w, h, d, m, extra) {
    const q = ((Math.round(rot / Q) % 4) + 4) % 4;
    const [wx, wz] = toWorld(x, z, q * Q, lx, lz);
    return box(wx, y0, wz, q % 2 ? d : w, h, q % 2 ? w : d, m, extra);
  }

  function prop(kind, x, z, data) {
    const p = { kind, x: r3(x), z: r3(z), rot: 0, s: r3(rnd()), ...data };
    props.push(p);
    return p;
  }

  const keepout = (x, z, r) => keepouts.push({ x, z, r });

  function free(cx, cz, w, d, m = 1.5) {
    const x0 = cx - w / 2 - m, x1 = cx + w / 2 + m, z0 = cz - d / 2 - m, z1 = cz + d / 2 + m;
    if (x0 < -MAP_HALF + 1 || x1 > MAP_HALF - 1 || z0 < -MAP_HALF + 1 || z1 > MAP_HALF - 1) return false;
    for (const k of keepouts) {
      const nx = Math.max(x0, Math.min(k.x, x1)), nz = Math.max(z0, Math.min(k.z, z1));
      if ((nx - k.x) ** 2 + (nz - k.z) ** 2 < k.r * k.r) return false;
    }
    for (const b of boxes) if (b.min[0] < x1 && b.max[0] > x0 && b.min[2] < z1 && b.max[2] > z0) return false;
    return true;
  }

  const foot = (rot, w, d) => (Math.round(rot / Q) % 2 ? [d, w] : [w, d]);

  function clearAt(x, z, r = 0.6) {
    for (const b of boxes) {
      if (b.min[1] > 1.8 || b.max[1] < 0.3) continue;
      if (b.min[0] < x + r && b.max[0] > x - r && b.min[2] < z + r && b.max[2] > z - r) return false;
    }
    return Math.abs(x) < MAP_HALF - 1 && Math.abs(z) < MAP_HALF - 1;
  }

  const kit = {
    seed, rnd, R, pick, boxes, props, box, rbox, prop, keepout, free, foot, clearAt,

    // ── 군용 ──────────────────────────────────────
    tank(x, z, rot, wreck = true) {
      rbox(x, z, rot, 0, 0, 0, 3.4, 1.5, 6.4);
      rbox(x, z, rot, 0, 1.5, 0.3, 2.6, 0.9, 2.8);
      rbox(x, z, rot, 0, 1.8, -2.8, 0.34, 0.34, 3.4);
      prop('tank', x, z, { rot, wreck });
    },
    car(x, z, rot) {
      rbox(x, z, rot, 0, 0, 0, 1.9, 0.95, 4.3);
      rbox(x, z, rot, 0, 0.95, 0.25, 1.7, 0.7, 2.1);
      prop('car', x, z, { rot });
    },
    truck(x, z, rot) {
      rbox(x, z, rot, 0, 0, -2.7, 2.3, 2.5, 1.9);
      rbox(x, z, rot, 0, 0, 1.0, 2.4, 3.0, 5.2);
      prop('truck', x, z, { rot });
    },
    bus(x, z, rot) {
      rbox(x, z, rot, 0, 0, 0, 2.6, 3.1, 10.5);
      prop('bus', x, z, { rot });
    },
    sandbags(x, z, rot, len) {
      rbox(x, z, rot, 0, 0, 0, len, 1.1, 0.9);
      prop('sandbags', x, z, { rot, len });
    },
    barrier(x, z, rot) {
      rbox(x, z, rot, 0, 0, 0, 2.6, 1.0, 0.65);
      prop('barrier', x, z, { rot });
    },
    crates(x, z, rot) {
      const layout = pick([[[0, 0, 0]], [[-0.65, 0, 0], [0.65, 0, 0]], [[-0.65, 0, 0], [0.65, 0, 0], [0, 1.2, 0]], [[0, 0, 0], [0, 1.2, 0]]]);
      for (const [lx, y, lz] of layout) {
        rbox(x, z, rot, lx, y, lz, 1.2, 1.2, 1.2);
        const [wx, wz] = toWorld(x, z, rot, lx, lz);
        prop('crate', wx, wz, { y, rot: rot + R(-0.06, 0.06) });
      }
    },
    barrels(x, z) {
      const offs = [[0, 0], [0.66, 0.05], [0.3, 0.64], [-0.36, 0.6], [-0.66, 0]];
      for (const [ox, oz] of offs.slice(0, 2 + Math.floor(rnd() * 4))) {
        box(x + ox, 0, z + oz, 0.6, 0.92, 0.6);
        prop('barrel', x + ox, z + oz, { red: rnd() < 0.25 });
      }
    },
    rubble(x, z, spread = 1) {
      for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) {
        const w = R(0.6, 1.6), h = R(0.3, 0.9), d = R(0.6, 1.6), bx = x + R(-1, 1) * spread, bz = z + R(-1, 1) * spread;
        box(bx, 0, bz, w, h, d);
        prop('rubble', bx, bz, { w, h, d });
      }
    },
    container(x, z, rot, level = 0, tone = Math.floor(rnd() * 4)) {
      rbox(x, z, rot, 0, level * 2.6, 0, 2.44, 2.6, 6.06);
      prop('container', x, z, { rot, y: level * 2.6, tone });
    },
    // 앞(-국소z)으로 난간, 뒤로 계단
    watchtower(x, z, rot) {
      for (const lx of [-1.9, 1.9]) for (const lz of [-1.9, 1.9]) rbox(x, z, rot, lx, 0, lz, 0.35, 5, 0.35);
      rbox(x, z, rot, 0, 5, 0, 4.4, 0.3, 4.4);
      rbox(x, z, rot, 0, 5.3, -2.075, 4.4, 1.0, 0.25);
      rbox(x, z, rot, 2.075, 5.3, 0, 0.25, 1.0, 4.4);
      rbox(x, z, rot, -2.075, 5.3, 0, 0.25, 1.0, 4.4);
      for (let i = 0; i < 12; i++) rbox(x, z, rot, -1.4, 0, 2.475 + (11 - i) * 0.55, 1.4, (i + 1) * 0.44, 0.55);
      prop('watchtower', x, z, { rot });
    },
    // 앞에 사격구, 뒤 가운데 출입구
    bunker(x, z, rot) {
      rbox(x, z, rot, 0, 0, -2.0, 6.2, 1.1, 0.6);
      rbox(x, z, rot, -2.8, 0, 0.2, 0.6, 2.2, 4.2);
      rbox(x, z, rot, 2.8, 0, 0.2, 0.6, 2.2, 4.2);
      rbox(x, z, rot, -1.95, 0, 2.05, 2.3, 2.2, 0.5);
      rbox(x, z, rot, 1.95, 0, 2.05, 2.3, 2.2, 0.5);
      rbox(x, z, rot, 0, 2.2, 0.1, 6.8, 0.6, 5.0);
      prop('bunker', x, z, { rot });
    },
    tent(x, z, rot) {
      rbox(x, z, rot, 0, 0, 0, 4.2, 2.4, 5.4);
      prop('tent', x, z, { rot });
    },
    aagun(x, z, rot) {
      rbox(x, z, rot, 0, 0, 0, 2.6, 1.4, 2.6);
      prop('aagun', x, z, { rot });
    },
    howitzer(x, z, rot) {
      rbox(x, z, rot, 0, 0, 0.4, 2.4, 1.5, 3.4);
      rbox(x, z, rot, 0, 1.0, -2.4, 0.32, 0.32, 2.4);
      prop('howitzer', x, z, { rot });
    },

    // ── 자연 / 거리 ───────────────────────────────
    pine(x, z, h = R(6, 10), snow = false) {
      box(x, 0, z, 0.5, 3.2, 0.5);
      prop('pine', x, z, { h, snow });
    },
    rock(x, z, size = R(0.8, 1.8), snow = false) {
      box(x, 0, z, size * 1.5, size * 0.9, size * 1.3);
      prop('rock', x, z, { size, snow });
    },
    lamp(x, z, rot) {
      box(x, 0, z, 0.22, 5, 0.22);
      prop('lamp', x, z, { rot, broken: rnd() < 0.3 });
    },
    pole(x, z, rot) {
      box(x, 0, z, 0.3, 7, 0.3);
      prop('pole', x, z, { rot });
    },
    wire(x, z, rot, len) {
      rbox(x, z, rot, 0, 0, 0, len, 0.9, 0.9, null, { noShoot: true });
      prop('wire', x, z, { rot, len });
    },
    crater(x, z, r) {
      prop('crater', x, z, { r });
    },
    banner(x, z, team) {
      box(x, 0, z, 0.16, 6, 0.16);
      prop('banner', x, z, { team });
    },

    spawnRow(team, z, x0, x1, count = 12) {
      const list = [];
      for (let i = 0; i < count; i++) {
        list.push({ x: r3(x0 + ((x1 - x0) * i) / (count - 1) + R(-1, 1)), z: r3(z + R(-1.5, 1.5)), yaw: team === 0 ? Math.PI : 0 });
      }
      return list;
    },

    finish(id, points, spawns) {
      for (const list of spawns) {
        for (const sp of list) {
          if (clearAt(sp.x, sp.z)) continue;
          search: for (let r = 1; r < 12; r++) {
            for (let a = 0; a < 16; a++) {
              const nx = sp.x + Math.cos((a / 16) * Math.PI * 2) * r, nz = sp.z + Math.sin((a / 16) * Math.PI * 2) * r;
              if (clearAt(nx, nz)) { sp.x = r3(nx); sp.z = r3(nz); break search; }
            }
          }
        }
      }
      return { id, seed, boxes, props, points, spawns };
    },
  };
  return kit;
}

// 봇 길찾기 격자 (1칸 = 1m). 낮은 바닥(계단, 기단)은 높이를 기록하고, 막는 물체는 여유를 두고 막는다.
export function buildNav(boxes) {
  const n = MAP_HALF * 2, off = MAP_HALF, pad = 0.45;
  const blocked = new Uint8Array(n * n);
  const height = new Float32Array(n * n);
  const lo = (v) => Math.max(0, Math.min(n - 1, v));
  for (const b of boxes) {
    if (b.min[1] >= 1.7 || b.max[1] <= 0.12) continue;
    if (b.min[1] < 0.3 && b.max[1] <= 1.0) {
      const x0 = lo(Math.ceil(b.min[0] + off - 0.5)), x1 = lo(Math.floor(b.max[0] + off - 0.5));
      const z0 = lo(Math.ceil(b.min[2] + off - 0.5)), z1 = lo(Math.floor(b.max[2] + off - 0.5));
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const i = x + z * n;
          if (b.max[1] > height[i]) height[i] = b.max[1];
        }
      }
      continue;
    }
    const x0 = lo(Math.floor(b.min[0] - pad + off)), x1 = lo(Math.ceil(b.max[0] + pad + off) - 1);
    const z0 = lo(Math.floor(b.min[2] - pad + off)), z1 = lo(Math.ceil(b.max[2] + pad + off) - 1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) blocked[x + z * n] = 1;
  }
  return { n, off, blocked, height };
}

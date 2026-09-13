// 그림 전용 장식 — 도로·차선·연석, 풀숲, 잔해, 물웅덩이, 눈 더미 (충돌 없음, 게임 판정에 영향 없음)
import { mulberry32 } from '../shared/map.js';

const DENSITY = {
  city: { tuft: 110, debris: 170, puddle: 22, stones: 40, drift: 0 },
  palace: { tuft: 260, debris: 50, puddle: 10, stones: 90, drift: 0 },
  harbor: { tuft: 60, debris: 90, puddle: 30, stones: 30, drift: 0 },
  snow: { tuft: 40, debris: 40, puddle: 0, stones: 50, drift: 140 },
  bamboo: { tuft: 520, debris: 30, puddle: 12, stones: 120, drift: 0 },
};

export function decorate(map, world) {
  const rnd = mulberry32((map.seed ^ 0x5eed1234) >>> 0);
  const R = (a, b) => a + (b - a) * rnd();
  const props = [];
  const add = (kind, x, z, data = {}) => props.push({ kind, x, z, rot: 0, s: rnd(), ...data });
  const clear = (x, z, r, h = 1.6) => Math.abs(x) < 79 && Math.abs(z) < 79 && world.query(x - r, 0.01, z - r, x + r, h, z + r).length === 0;

  // ── 도시 도로 ──
  if (map.id === 'city') {
    const vx = [-42, -14, 14, 42], hz = [-50, -24, 0, 24, 50];
    for (const x of vx) add('road', x, 0, { w: 10, d: 116 });
    for (const z of hz) add('road', 0, z, { w: 154, d: 8 });
    const near = (v, list, r) => list.some((c) => Math.abs(v - c) < r);
    for (const x of vx) {
      for (let z = -56; z < 56; z += 4) if (!near(z + 1, hz, 5.5)) add('dash', x, z + 1, { w: 0.18, d: 2 });
      for (const s of [-1, 1]) {
        for (let z = -57; z < 57; z += 3) if (!near(z + 1.5, hz, 5)) add('curb', x + s * 5.1, z + 1.5, { len: 3, rot: Math.PI / 2 });
      }
    }
    for (const z of hz) {
      for (let x = -76; x < 76; x += 4) if (!near(x + 1, vx, 6.5)) add('dash', x + 1, z, { w: 2, d: 0.18 });
    }
    for (const x of vx) {
      for (const z of hz) {
        for (const s of [-1, 1]) {
          for (let k = -3; k <= 3; k++) add('dash', x + k * 1.3, z + s * 5.2, { w: 0.7, d: 1.6 });
        }
      }
    }
  }

  const D = DENSITY[map.id] || DENSITY.city;
  const walls = map.boxes.filter((b) => b.min[1] < 0.2 && b.max[1] > 1 && !b.noShoot);
  // 벽 밑을 따라 자라는 풀과 쌓인 잔해가 자연스럽다
  const nearWall = () => {
    const b = walls[Math.floor(rnd() * walls.length)];
    if (!b) return [R(-76, 76), R(-76, 76)];
    const side = Math.floor(rnd() * 4), m = R(0.3, 0.9);
    if (side === 0) return [R(b.min[0], b.max[0]), b.min[2] - m];
    if (side === 1) return [R(b.min[0], b.max[0]), b.max[2] + m];
    if (side === 2) return [b.min[0] - m, R(b.min[2], b.max[2])];
    return [b.max[0] + m, R(b.min[2], b.max[2])];
  };
  const scatter = (count, fn, wallBias) => {
    for (let i = 0, placed = 0; i < count * 4 && placed < count; i++) {
      const [x, z] = rnd() < wallBias ? nearWall() : [R(-77, 77), R(-77, 77)];
      if (fn(x, z)) placed++;
    }
  };

  scatter(D.tuft, (x, z) => {
    if (!clear(x, z, 0.3, 0.5)) return false;
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) add('tuft', x + R(-0.5, 0.5), z + R(-0.5, 0.5), { h: R(0.35, map.id === 'bamboo' ? 1.1 : 0.8), snow: map.id === 'snow' });
    return true;
  }, 0.55);
  scatter(D.debris, (x, z) => {
    if (!clear(x, z, 0.5, 0.4)) return false;
    add('debris', x, z, { rot: rnd() * 6.28 });
    return true;
  }, 0.7);
  scatter(D.stones, (x, z) => {
    if (!clear(x, z, 0.4, 0.4)) return false;
    add('pebbles', x, z, { snow: map.id === 'snow' });
    return true;
  }, 0.4);
  scatter(D.puddle, (x, z) => {
    if (!clear(x, z, 1.5, 0.3)) return false;
    add('puddle', x, z, { r: R(0.8, 2.2), rot: rnd() * 6.28 });
    return true;
  }, 0.2);
  scatter(D.drift, (x, z) => {
    if (!clear(x, z, 0.8, 0.5)) return false;
    add('drift', x, z, { r: R(0.8, 2), rot: rnd() * 6.28 });
    return true;
  }, 0.75);
  return props;
}

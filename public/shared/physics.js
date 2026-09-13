// 충돌/레이캐스트 — 모든 충돌체는 축 정렬 박스 {min:[x,y,z], max:[x,y,z]}
import { MAP_HALF, PLAYER } from './config.js';

export const STEP = 0.55;
const EPS = 1e-4;
const inv = (v) => 1 / (Math.abs(v) < 1e-9 ? (v < 0 ? -1e-9 : 1e-9) : v);

export let rayAxis = 0; // 마지막 rayBox 가 부딪힌 면의 축 (0=x, 1=y, 2=z)

// 광선-박스 교차. 광선 시작점이 박스 안이면 -1.
export function rayBox(ox, oy, oz, ix, iy, iz, min, max) {
  let t1 = (min[0] - ox) * ix, t2 = (max[0] - ox) * ix;
  let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), axis = 0;
  t1 = (min[1] - oy) * iy; t2 = (max[1] - oy) * iy;
  let lo = Math.min(t1, t2), hi = Math.max(t1, t2);
  if (lo > tmin) { tmin = lo; axis = 1; }
  if (hi < tmax) tmax = hi;
  t1 = (min[2] - oz) * iz; t2 = (max[2] - oz) * iz;
  lo = Math.min(t1, t2); hi = Math.max(t1, t2);
  if (lo > tmin) { tmin = lo; axis = 2; }
  if (hi < tmax) tmax = hi;
  if (tmax < tmin || tmin < 0) return -1;
  rayAxis = axis;
  return tmin;
}

export class World {
  constructor(boxes) {
    this.boxes = boxes;
    this.cell = 8;
    this.off = MAP_HALF + 16;
    this.n = Math.ceil((this.off * 2) / this.cell);
    this.grid = Array.from({ length: this.n * this.n }, () => []);
    this.stamp = new Uint32Array(boxes.length);
    this.mark = 0;
    boxes.forEach((b, i) => {
      const [x0, z0, x1, z1] = this.range(b.min[0], b.min[2], b.max[0], b.max[2]);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.grid[x + z * this.n].push(i);
    });
  }

  range(minx, minz, maxx, maxz) {
    const c = (v) => Math.max(0, Math.min(this.n - 1, Math.floor((v + this.off) / this.cell)));
    return [c(minx), c(minz), c(maxx), c(maxz)];
  }

  // 주어진 AABB 와 (경계 제외) 겹치는 박스 목록
  query(minx, miny, minz, maxx, maxy, maxz) {
    const out = [];
    const m = ++this.mark;
    const [x0, z0, x1, z1] = this.range(minx, minz, maxx, maxz);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        for (const i of this.grid[x + z * this.n]) {
          if (this.stamp[i] === m) continue;
          this.stamp[i] = m;
          const b = this.boxes[i];
          if (b.min[0] < maxx && b.max[0] > minx && b.min[1] < maxy && b.max[1] > miny && b.min[2] < maxz && b.max[2] > minz) out.push(b);
        }
      }
    }
    return out;
  }

  // 지형 + 바닥(y=0) 레이캐스트. dir 은 정규화되어 있어야 한다.
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    const ix = inv(dx), iy = inv(dy), iz = inv(dz);
    let best = maxT, hit = null, axis = 1;
    if (dy < 0) {
      const tg = -oy / dy;
      if (tg >= 0 && tg < best) { best = tg; hit = GROUND; axis = 1; }
    }
    for (const b of this.boxes) {
      if (b.noShoot) continue;
      const t = rayBox(ox, oy, oz, ix, iy, iz, b.min, b.max);
      if (t >= 0 && t < best) { best = t; hit = b; axis = rayAxis; }
    }
    if (!hit) return null;
    const n = [0, 0, 0];
    n[axis] = -Math.sign([dx, dy, dz][axis]) || 1;
    return { t: best, box: hit, x: ox + dx * best, y: oy + dy * best, z: oz + dz * best, n };
  }

  losClear(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-3) return true;
    const h = this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d);
    return !h || h.t > d - 0.05;
  }

  bodyFits(x, y, z, r, h) {
    return this.query(x - r, y + EPS, z - r, x + r, y + h, z + r).length === 0;
  }
}

const GROUND = { min: [-1e4, -1, -1e4], max: [1e4, 0, 1e4], kind: 'ground' };

function overlaps(b, box) {
  const r = b.radius;
  return box.min[0] < b.x + r && box.max[0] > b.x - r && box.min[2] < b.z + r && box.max[2] > b.z - r &&
    box.min[1] < b.y + b.height && box.max[1] > b.y;
}

function moveAxis(world, b, axis, d) {
  if (d === 0) return;
  if (axis === 0) b.x += d; else b.z += d;
  const r = b.radius;
  const hits = world.query(b.x - r, b.y + EPS, b.z - r, b.x + r, b.y + b.height, b.z + r);
  for (const box of hits) {
    if (!overlaps(b, box)) continue;
    const top = box.max[1];
    if (b.onGround && top - b.y <= STEP && world.bodyFits(b.x, top, b.z, r, b.height)) {
      b.y = top;
      if (b.vy < 0) b.vy = 0;
      continue;
    }
    if (axis === 0) b.x = d > 0 ? box.min[0] - r - EPS : box.max[0] + r + EPS;
    else b.z = d > 0 ? box.min[2] - r - EPS : box.max[2] + r + EPS;
    b.blocked = true;
  }
}

function moveY(world, b, d) {
  b.y += d;
  if (b.y <= 0) { b.y = 0; if (b.vy < 0) b.vy = 0; b.onGround = true; }
  const r = b.radius;
  const hits = world.query(b.x - r, b.y, b.z - r, b.x + r, b.y + b.height, b.z + r);
  for (const box of hits) {
    if (!overlaps(b, box)) continue;
    if (d <= 0) { b.y = box.max[1]; b.vy = 0; b.onGround = true; }
    else { b.y = box.min[1] - b.height - EPS; b.vy = 0; }
  }
}

// body: {x,y,z,vx,vy,vz,onGround,radius,height}. blocked=true 이면 벽에 막혔다는 뜻.
export function moveBody(world, b, dt) {
  const steps = Math.max(1, Math.ceil(dt / 0.02));
  const h = dt / steps;
  b.blocked = false;
  for (let s = 0; s < steps; s++) {
    b.vy -= PLAYER.gravity * h;
    moveAxis(world, b, 0, b.vx * h);
    moveAxis(world, b, 2, b.vz * h);
    const was = b.onGround;
    b.onGround = false;
    moveY(world, b, b.vy * h);
    if (!b.onGround && was && b.vy <= 0) {
      // 낮은 턱을 내려갈 때 붙어 있도록 살짝 끌어내림
      const below = world.query(b.x - b.radius, b.y - STEP, b.z - b.radius, b.x + b.radius, b.y, b.z + b.radius);
      let top = b.y - STEP > 0 ? -1 : 0;
      for (const box of below) top = Math.max(top, box.max[1]);
      if (top >= 0 && b.y - top <= STEP) { b.y = top; b.vy = 0; b.onGround = true; }
    }
  }
  const lim = MAP_HALF - b.radius;
  b.x = Math.max(-lim, Math.min(lim, b.x));
  b.z = Math.max(-lim, Math.min(lim, b.z));
}

// 병사 히트박스 판정 — p: {x,y,z,crouch}. 맞으면 {t, head}
export function rayPlayer(ox, oy, oz, dx, dy, dz, maxT, p) {
  const ix = inv(dx), iy = inv(dy), iz = inv(dz);
  const h = p.crouch ? PLAYER.crouchHeight : PLAYER.height;
  const hy = p.y + h - 0.2;
  const th = rayBox(ox, oy, oz, ix, iy, iz, [p.x - 0.19, hy - 0.2, p.z - 0.19], [p.x + 0.19, hy + 0.2, p.z + 0.19]);
  const tb = rayBox(ox, oy, oz, ix, iy, iz, [p.x - 0.36, p.y, p.z - 0.36], [p.x + 0.36, hy - 0.2, p.z + 0.36]);
  let t = -1, head = false;
  if (th >= 0 && th <= maxT) { t = th; head = true; }
  if (tb >= 0 && tb <= maxT && (t < 0 || tb < t)) { t = tb; head = false; }
  return t < 0 ? null : { t, head };
}

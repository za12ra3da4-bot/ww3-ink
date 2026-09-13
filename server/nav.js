// 봇 길찾기 — 8방향 A* + 직선화(string pulling)
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];

let cap = 0, gs, from, seen, done, hf, hi;
let gen = 0, hn = 0;

function ensure(N) {
  if (cap >= N) return;
  cap = N;
  gs = new Float32Array(N);
  from = new Int32Array(N);
  seen = new Uint32Array(N);
  done = new Uint32Array(N);
  hf = new Float32Array(N * 8);
  hi = new Int32Array(N * 8);
}

function push(f, i) {
  let k = hn++;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (hf[p] <= f) break;
    hf[k] = hf[p]; hi[k] = hi[p]; k = p;
  }
  hf[k] = f; hi[k] = i;
}

function pop() {
  const top = hi[0];
  const f = hf[--hn], i = hi[hn];
  let k = 0;
  for (;;) {
    let c = 2 * k + 1;
    if (c >= hn) break;
    if (c + 1 < hn && hf[c + 1] < hf[c]) c++;
    if (hf[c] >= f) break;
    hf[k] = hf[c]; hi[k] = hi[c]; k = c;
  }
  hf[k] = f; hi[k] = i;
  return top;
}

export function cellOf(nav, x, z) {
  const c = (v) => Math.max(0, Math.min(nav.n - 1, Math.floor(v + nav.off)));
  return c(x) + c(z) * nav.n;
}

export function nearestOpen(nav, i) {
  const { n, blocked } = nav;
  if (!blocked[i]) return i;
  const cx = i % n, cz = (i / n) | 0;
  for (let r = 1; r <= 8; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= n || z >= n) continue;
        if (!blocked[x + z * n]) return x + z * n;
      }
    }
  }
  return -1;
}

export function lineClear(nav, ax, az, bx, bz) {
  const { n, off, blocked } = nav;
  const d = Math.hypot(bx - ax, bz - az), steps = Math.ceil(d / 0.3);
  const at = (x, z) => {
    const ix = Math.floor(x + off), iz = Math.floor(z + off);
    return ix < 0 || iz < 0 || ix >= n || iz >= n || blocked[ix + iz * n];
  };
  for (let k = 1; k < steps; k++) {
    const t = k / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    if (at(x, z) || at(x + 0.3, z) || at(x - 0.3, z) || at(x, z + 0.3) || at(x, z - 0.3)) return false;
  }
  return true;
}

// 월드 좌표 경로 [[x,z], ...] (시작점 제외) 또는 null
export function findPath(nav, sx, sz, gx, gz, maxIter = 40000) {
  const { n, off, blocked } = nav;
  ensure(n * n);
  const s = nearestOpen(nav, cellOf(nav, sx, sz));
  const g = nearestOpen(nav, cellOf(nav, gx, gz));
  if (s < 0 || g < 0) return null;
  const gxC = g % n, gzC = (g / n) | 0;
  const h = (i) => {
    const dx = Math.abs((i % n) - gxC), dz = Math.abs(((i / n) | 0) - gzC);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
  };

  gen++; hn = 0;
  gs[s] = 0; seen[s] = gen; from[s] = -1;
  push(h(s), s);
  let found = false;
  for (let iter = 0; hn > 0 && iter < maxIter; iter++) {
    const cur = pop();
    if (done[cur] === gen) continue;
    done[cur] = gen;
    if (cur === g) { found = true; break; }
    const cx = cur % n, cz = (cur / n) | 0;
    for (let k = 0; k < 8; k++) {
      const dx = DX[k], dz = DZ[k], nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      const ni = nx + nz * n;
      if (blocked[ni] || done[ni] === gen) continue;
      if (dx && dz && (blocked[cx + dx + cz * n] || blocked[cx + (cz + dz) * n])) continue;
      const ng = gs[cur] + (dx && dz ? 1.414 : 1);
      if (seen[ni] !== gen || ng < gs[ni]) {
        seen[ni] = gen; gs[ni] = ng; from[ni] = cur;
        push(ng + h(ni), ni);
      }
    }
  }
  if (!found) return null;

  const cells = [];
  for (let c = g; c !== -1; c = from[c]) cells.push(c);
  cells.reverse();
  const wx = (c) => (c % n) - off + 0.5, wz = (c) => ((c / n) | 0) - off + 0.5;
  const pts = [];
  let i = 0;
  while (i < cells.length - 1) {
    let j = Math.min(cells.length - 1, i + 40);
    while (j > i + 1 && !lineClear(nav, wx(cells[i]), wz(cells[i]), wx(cells[j]), wz(cells[j]))) j--;
    pts.push([wx(cells[j]), wz(cells[j])]);
    i = j;
  }
  if (pts.length) pts[pts.length - 1] = [gx, gz];
  return pts;
}

export function randomOpenNear(nav, x, z, r, rnd = Math.random) {
  for (let k = 0; k < 20; k++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r;
    const i = cellOf(nav, x + Math.cos(a) * d, z + Math.sin(a) * d);
    if (!nav.blocked[i]) return [(i % nav.n) - nav.off + 0.5, ((i / nav.n) | 0) - nav.off + 0.5];
  }
  return [x, z];
}

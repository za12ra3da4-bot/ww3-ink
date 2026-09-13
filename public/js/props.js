// 맵 소품 렌더러 — map.props 를 실제 모양으로 그리고, 재질별로 하나의 메시로 합친다.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';
import { tex } from './assets.js';

const PI = Math.PI;
const tmpM = new THREE.Matrix4(), frameM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();

// ── 도형 ─────────────────────────────────────────
// 월드 크기에 맞춰 UV 를 늘린 상자 (tw × th 미터마다 텍스처 1장)
export function B(w, h, d, tw = 0, th = tw) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!tw) return g;
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tw, (uv.getY(i) * dims[f][1]) / th);
    }
  }
  return g;
}
const C = (rt, rb, h, seg = 10, open = false, ts = 0, tl = PI * 2) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl);
const S = (r, ws = 10, hs = 8, ps = 0, pl = PI * 2, ts = 0, tl = PI) => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl);
const Cone = (r, h, seg = 12, open = false) => new THREE.ConeGeometry(r, h, seg, 1, open);
const Ico = (r, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
const Dode = (r) => new THREE.DodecahedronGeometry(r, 0);
const Torus = (r, t, rs = 4, ts = 12) => new THREE.TorusGeometry(r, t, rs, ts);

function lathe(points, seg = 14) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

// 단면(가로=폭, 세로=높이)을 len 만큼 x 방향으로 밀어낸 도형
function prism(shapePts, len) {
  const shape = new THREE.Shape(shapePts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.rotateY(PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
  return g;
}

// 한옥 지붕: 가운데 용마루가 높고 처마 끝과 네 귀가 들린 곡면. down=true 면 아래를 보는 서까래 면
export function roofGeo(W, D, H, lift = 0.4, down = false, style = 'tile') {
  const segX = Math.max(8, Math.round(W * 2)), segZ = Math.max(6, Math.round(D * 2));
  const g = new THREE.PlaneGeometry(W, D, Math.min(segX, 40), Math.min(segZ, 24));
  g.rotateX(down ? PI / 2 : -PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const hx = W / 2, hz = D / 2, ridge = Math.max(0, hx - hz);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const ax = Math.abs(x) / hx, az = Math.abs(z) / hz;
    const t = Math.min(1, Math.max(az, (Math.abs(x) - ridge) / hz));
    let y;
    if (style === 'thatch') y = H * Math.pow(Math.max(0, 1 - t * t), 0.75);
    else y = H * Math.pow(1 - t, 1.7) + lift * (0.3 * Math.pow(t, 5) + Math.pow(ax, 7) * Math.pow(az, 7));
    pos.setY(i, y - (down ? 0.2 : 0));
    uv.setXY(i, (x + hx) / 2, (z + hz) / 1.6 + y * 0.6);
  }
  g.computeVertexNormals();
  return g;
}

// ── 재질 ─────────────────────────────────────────
export function makeMaterials() {
  const lam = (color, map, extra) => new THREE.MeshLambertMaterial({ color, map: map || null, ...extra });
  const DS = { side: THREE.DoubleSide };
  const splat = (i, color, opacity) => new THREE.MeshBasicMaterial({
    map: tex[`splat${i}`], color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return {
    wall: lam(0xe2ddd3, tex.ruin), ruin: lam(0xd4cfc5, tex.ruin), concrete: lam(0xcfcac0, tex.ruin), stone: lam(0xbcb7ad, tex.ruin),
    plaster: lam(0xf0ece2, tex.ruin), mud: lam(0xd6ccb8, tex.ruin), earth: lam(0x8f887c, tex.ruin), snowearth: lam(0xf2f2f0, tex.snowfield),
    dark: lam(0x2b2a28), iron: lam(0x4a4946, tex.metal), olive: lam(0x7b7c70, tex.metal), metal: lam(0x96948e, tex.metal),
    shed: lam(0xb8b6b0, tex.container), sandbag: lam(0xcac3b3, tex.sandbag), crate: lam(0xbfb6a6, tex.crate),
    wood: lam(0xaca294, tex.wood), darkwood: lam(0x5d554c, tex.wood), redwood: lam(0xa03826, tex.wood), green: lam(0x3f6d5d, tex.wood),
    tile: lam(0x5c5954, tex.tile, DS), thatch: lam(0xb0a68c, tex.thatch, DS), canvas: lam(0x9c9786, null, DS),
    snow: lam(0xf7f7f5), bamboo: lam(0x8d9a73), leaf: new THREE.MeshLambertMaterial({ color: 0x5b6650, map: tex.bambooleaf, alphaTest: 0.4, side: THREE.DoubleSide }),
    needle: lam(0x2c2d29), canopy: lam(0x3e4239), glass: new THREE.MeshPhongMaterial({ color: 0x2a3036, shininess: 80 }),
    bronze: new THREE.MeshPhongMaterial({ color: 0x4c5a4e, shininess: 40 }), onggi: lam(0x4a3b31), hanji: lam(0xefe9da),
    red: lam(0x9a3526, tex.metal), yellow: lam(0xb39a3c, tex.metal), lamp: new THREE.MeshBasicMaterial({ color: 0xfaf6e8 }),
    paving: lam(0xdad5c9, tex.paving, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    water: new THREE.MeshLambertMaterial({ color: 0x59616a, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    paddy: new THREE.MeshLambertMaterial({ color: 0xa3a7a6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    rice: lam(0x7e8a6c),
    asphalt: lam(0x8c8a86, tex.asphalt, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    paint: new THREE.MeshLambertMaterial({ color: 0xe8e4da, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    grass: new THREE.MeshLambertMaterial({ color: 0x7f8a6c, map: tex.grass, alphaTest: 0.35, side: THREE.DoubleSide }),
    puddle: new THREE.MeshPhongMaterial({ color: 0x3c4148, shininess: 120, specular: 0x9aa4ad, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    brick: lam(0x8a6a58, tex.ruin), trim: lam(0xb7b1a6, tex.ruin),
    containers: [lam(0x8e4d3c, tex.container), lam(0x40607a, tex.container), lam(0x6b7657, tex.container), lam(0xb4a98d, tex.container)],
    team: [lam(0x2a2825, null, DS), lam(0x2c5d8f, null, DS)],
    splats: [0, 1, 2, 3].map((i) => splat(i, 0x55524d, 0.22)),
  };
}

// ── 합치기 ───────────────────────────────────────
class Batch {
  constructor() { this.buckets = new Map(); }
  add(mat, g) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = `${mat}|${g.index ? 1 : 0}`;
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(g);
  }
  build(group, mats) {
    for (const [key, list] of this.buckets) {
      const [name] = key.split('|');
      const mat = name.includes('.') ? mats[name.split('.')[0]][+name.split('.')[1]] : mats[name];
      const CH = 60000;
      let chunk = [], verts = 0;
      const flush = () => {
        if (!chunk.length) return;
        const merged = mergeGeometries(chunk, false);
        for (const g of chunk) g.dispose();
        chunk = []; verts = 0;
        if (!merged) return;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        const decal = mat.transparent || ['paving', 'water', 'paddy', 'asphalt', 'paint', 'puddle', 'grass'].includes(name);
        mesh.castShadow = !decal;
        mesh.receiveShadow = true;
        if (mat.transparent) mesh.renderOrder = 1;
        group.add(mesh);
      };
      for (const g of list) {
        chunk.push(g);
        verts += g.attributes.position.count;
        if (verts > CH) flush();
      }
      flush();
    }
  }
}

// 소품 좌표계(위치 x,y,z + 회전 rot)에서 부품을 놓는 함수
function framer(batch, x, y, z, rot) {
  frameM.makeRotationY(rot || 0).setPosition(x, y, z);
  const F = frameM.clone();
  return (mat, g, lx = 0, ly = 0, lz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    tmpE.set(rx, ry, rz);
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(tmpP.set(lx, ly, lz), tmpQ, tmpS.set(sx, sy, sz));
    g.applyMatrix4(tmpM).applyMatrix4(F);
    batch.add(mat, g);
  };
}

// 시드 고정 난수 (소품마다 같은 모양)
function prng(seed) {
  let a = Math.floor(seed * 1e9) | 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 소품별 모양 ──────────────────────────────────
const wheelsZ = (put, xs, y, zs, r, w, mat = 'dark') => {
  for (const x of xs) for (const z of zs) put(mat, C(r, r, w, 14), x, y, z, 0, 0, PI / 2);
};

const DRAW = {
  tank(put, p) {
    const wreck = p.wreck;
    put('dark', B(0.75, 0.95, 6.7), -1.42, 0.48, 0);
    put('dark', B(0.75, 0.95, 6.7), 1.42, 0.48, 0);
    wheelsZ(put, [-1.82, 1.82], 0.4, [-2.6, -1.55, -0.5, 0.55, 1.6, 2.65], 0.36, 0.14);
    put('olive', B(2.2, 0.7, 6.2, 3), 0, 0.75, 0);
    put('olive', B(3.4, 0.5, 5.6, 3), 0, 1.25, 0.2);
    put('olive', B(3.2, 0.55, 1.3, 3), 0, 1.0, -2.95, 0.55);
    put('olive', C(1.2, 1.35, 0.9, 18), 0, 1.95, 0.35, 0, wreck ? 0.35 : 0);
    put('olive', C(0.38, 0.38, 0.12, 12), 0.45, 2.45, 0.7);
    put('dark', C(0.035, 0.035, 0.9, 6), 0.45, 2.7, 0.25, PI / 2);
    const br = wreck ? 0.35 : 0;
    put('olive', C(0.15, 0.13, 3.4, 12), Math.sin(br) * -1.8, 1.95, 0.35 - Math.cos(br) * 1.9, PI / 2 + (wreck ? 0.12 : 0), 0, 0, 1, 1, 1);
    put('dark', C(0.2, 0.2, 0.4, 12), Math.sin(br) * -3.6, 1.95 - (wreck ? 0.45 : 0), 0.35 - Math.cos(br) * 3.7, PI / 2);
    put('dark', B(3.3, 0.2, 0.5), 0, 1.55, 2.9);
  },
  car(put, p) {
    put('dark', B(1.8, 0.28, 4.1), 0, 0.2, 0);
    put('metal', B(1.9, 0.55, 4.3, 2), 0, 0.6, 0);
    put('metal', B(1.7, 0.72, 2.1, 2), 0, 1.23, 0.25);
    put('glass', B(1.74, 0.45, 1.9), 0, 1.26, 0.25);
    put('glass', B(1.5, 0.05, 0.62), 0, 1.22, -0.95, -0.7);
    wheelsZ(put, [-0.9, 0.9], 0.33, [-1.35, 1.35], 0.33, 0.24);
    put('dark', B(1.9, 0.2, 0.12), 0, 0.45, -2.17);
  },
  truck(put) {
    put('dark', B(2.1, 0.35, 7.4), 0, 0.62, -0.5);
    put('olive', B(2.3, 1.9, 1.9, 3), 0, 1.55, -2.7);
    put('glass', B(2.32, 0.6, 1.0), 0, 2.0, -2.95);
    put('olive', B(2.2, 0.8, 1.0, 3), 0, 1.05, -4.05);
    put('olive', B(2.4, 0.8, 5.2, 3), 0, 1.2, 1.0);
    put('canvas', C(1.2, 1.2, 5.2, 14, false, PI / 2, PI), 0, 1.6, 1.0, PI / 2);
    wheelsZ(put, [-1.05, 1.05], 0.5, [-3.4, 0.6, 2.4], 0.5, 0.35);
  },
  bus(put) {
    put('dark', B(2.5, 0.4, 10.3), 0, 0.35, 0);
    put('metal', B(2.6, 2.6, 10.5, 3), 0, 1.75, 0);
    put('glass', B(2.64, 0.85, 9.4), 0, 2.3, 0.2);
    put('glass', B(2.3, 1.2, 0.05), 0, 2.1, -5.27);
    put('dark', B(1.0, 1.8, 0.05), 0.8, 1.3, -5.28);
    wheelsZ(put, [-1.2, 1.2], 0.5, [-3.5, 3.5], 0.5, 0.35);
  },
  sandbags(put, p) {
    put('sandbag', B(p.len, 1.1, 0.9, 2, 1.1), 0, 0.55, 0);
    put('sandbag', C(0.22, 0.22, 0.85, 8), -p.len / 2, 0.9, 0, PI / 2);
    put('sandbag', C(0.22, 0.22, 0.85, 8), p.len / 2, 0.9, 0, PI / 2);
  },
  barrier(put) {
    put('concrete', prism([[-0.33, 0], [0.33, 0], [0.2, 0.3], [0.12, 1.0], [-0.12, 1.0], [-0.2, 0.3]], 2.6));
  },
  crate(put, p) {
    put('crate', B(1.2, 1.2, 1.2), 0, (p.y || 0) + 0.6, 0);
  },
  barrel(put, p) {
    put(p.red ? 'red' : 'iron', C(0.3, 0.3, 0.92, 16), 0, 0.46, 0);
    put('dark', C(0.31, 0.31, 0.04, 16), 0, 0.26, 0);
    put('dark', C(0.31, 0.31, 0.04, 16), 0, 0.68, 0);
  },
  rubble(put, p) {
    const r = prng(p.s);
    put('ruin', B(p.w, p.h, p.d, 2), 0, p.h / 2, 0, (r() - 0.5) * 0.2, r() * PI, (r() - 0.5) * 0.25);
    put('ruin', Dode(Math.min(p.w, p.d) * 0.35), (r() - 0.5) * p.w * 0.6, p.h, (r() - 0.5) * p.d * 0.6, r(), r(), r(), 1, 0.6, 1);
  },
  container(put, p) {
    const m = `containers.${p.tone % 4}`;
    const y = p.y || 0;
    put(m, B(2.44, 2.6, 6.06, 3, 2.6), 0, y + 1.3, 0);
    for (const x of [-1.16, 1.16]) for (const z of [-2.97, 2.97]) put('dark', B(0.14, 2.62, 0.14), x, y + 1.3, z);
    for (const x of [-0.8, -0.3, 0.3, 0.8]) put('dark', C(0.025, 0.025, 2.3, 6), x, y + 1.3, 3.06);
  },
  watchtower(put) {
    for (const x of [-1.9, 1.9]) for (const z of [-1.9, 1.9]) put('darkwood', C(0.14, 0.18, 5.2, 8), x, 2.6, z);
    for (const s of [-1, 1]) {
      put('darkwood', B(0.1, 0.1, 5.2), s * 1.9, 2.5, 0, 0.78);
      put('darkwood', B(5.2, 0.1, 0.1), 0, 2.5, s * 1.9, 0, 0, 0.78);
    }
    put('wood', B(4.4, 0.3, 4.4, 2), 0, 5.15, 0);
    put('sandbag', B(4.2, 0.7, 0.5, 2, 1), 0, 5.65, -1.9);
    for (const s of [-1, 1]) put('wood', B(0.2, 1.0, 4.4, 2), s * 2.07, 5.8, 0);
    for (const x of [-2.05, 2.05]) for (const z of [-2.05, 2.05]) put('darkwood', C(0.07, 0.07, 1.9, 6), x, 6.25, z);
    put('darkwood', Cone(3.5, 1.5, 4), 0, 7.9, 0, 0, PI / 4);
    for (let i = 0; i < 12; i++) put('wood', B(1.4, (i + 1) * 0.44, 0.55, 2), -1.4, ((i + 1) * 0.44) / 2, 2.475 + (11 - i) * 0.55);
  },
  bunker(put) {
    put('concrete', B(6.2, 1.1, 0.6, 3), 0, 0.55, -2.0);
    for (const s of [-1, 1]) {
      put('concrete', B(0.6, 2.2, 4.2, 3), s * 2.8, 1.1, 0.2);
      put('concrete', B(2.3, 2.2, 0.5, 3), s * 1.95, 1.1, 2.05);
    }
    put('concrete', B(6.8, 0.6, 5.0, 3), 0, 2.5, 0.1);
    put('sandbag', B(6.4, 0.5, 4.4, 2, 1), 0, 3.05, 0.1);
    put('dark', B(5.4, 1.05, 0.1), 0, 1.65, -1.75);
  },
  tent(put) {
    put('canvas', prism([[-2.1, 0], [2.1, 0], [0, 2.4]], 5.4), 0, 0, 0, 0, PI / 2);
    put('darkwood', C(0.05, 0.05, 2.5, 6), 0, 1.25, -2.75);
    put('dark', prism([[-0.6, 0], [0.6, 0], [0, 1.6]], 0.05), 0, 0, -2.72, 0, PI / 2);
  },
  aagun(put) {
    put('iron', C(1.1, 1.3, 0.5, 14), 0, 0.25, 0);
    put('olive', B(1.2, 0.9, 1.0, 2), 0, 0.95, 0);
    for (const s of [-1, 1]) put('dark', C(0.06, 0.06, 2.4, 8), s * 0.25, 1.4, -1.1, PI / 2 - 0.5);
  },
  howitzer(put) {
    wheelsZ(put, [-1.1, 1.1], 0.55, [0.6], 0.55, 0.25);
    put('olive', B(2.2, 1.2, 0.08, 2), 0, 1.15, -0.2, -0.15);
    put('olive', C(0.13, 0.1, 3.4, 12), 0, 1.35, -1.6, PI / 2 - 0.3);
    put('olive', B(0.45, 0.45, 0.8, 2), 0, 1.0, 0.25);
    for (const s of [-1, 1]) put('dark', B(0.15, 0.15, 2.8), s * 0.45, 0.35, 1.8, 0.12, s * 0.2);
  },
  pine(put, p) {
    const r = prng(p.s), h = p.h;
    const lean = (r() - 0.5) * 0.14;
    put('darkwood', C(0.1, 0.24, h * 0.8, 8), Math.sin(lean) * h * 0.4, h * 0.4, 0, 0, 0, lean);
    const n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const t = 0.45 + (i / n) * 0.55, rad = (1 - t) * 2.4 + 0.8;
      const a = r() * PI * 2, off = rad * 0.35;
      const cx = Math.sin(lean) * h * t + Math.cos(a) * off, cy = h * t, cz = Math.sin(a) * off;
      put('needle', Ico(rad, 1), cx, cy, cz, 0, r() * PI, 0, 1.3, 0.38, 1.1);
      if (p.snow) put('snow', Ico(rad * 0.85, 1), cx, cy + rad * 0.22, cz, 0, r() * PI, 0, 1.25, 0.22, 1.05);
    }
  },
  rock(put, p) {
    const r = prng(p.s);
    put('stone', Dode(p.size * 0.9), 0, p.size * 0.3, 0, r() * PI, r() * PI, r() * PI, 1.25, 0.75, 1.05);
    if (p.snow) put('snow', S(p.size * 0.8, 10, 6), 0, p.size * 0.75, 0, 0, 0, 0, 1.1, 0.3, 1);
  },
  lamp(put, p) {
    const tilt = p.broken ? 0.18 : 0;
    put('iron', C(0.07, 0.11, 5, 8), 0, 2.5, 0, 0, 0, tilt);
    put('iron', B(0.08, 0.08, 1.4), -tilt * 5, 4.95, -0.7);
    put('iron', B(0.3, 0.14, 0.55), -tilt * 5, 4.88, -1.4);
    if (!p.broken) put('lamp', B(0.24, 0.03, 0.45), -tilt * 5, 4.8, -1.4);
  },
  pole(put) {
    put('darkwood', C(0.13, 0.17, 7, 8), 0, 3.5, 0);
    put('darkwood', B(1.8, 0.12, 0.12), 0, 6.6, 0);
    for (const x of [-0.7, 0, 0.7]) put('glass', C(0.05, 0.06, 0.18, 6), x, 6.75, 0);
  },
  wire(put, p) {
    const n = Math.round(p.len / 0.36);
    for (let i = 0; i <= n; i++) put('iron', Torus(0.42, 0.018, 3, 10), -p.len / 2 + (i * p.len) / n, 0.45, 0, 0, PI / 2 + (i % 2) * 0.25, 0);
    for (let x = -p.len / 2; x <= p.len / 2 + 0.01; x += 3) put('darkwood', B(0.06, 1.1, 0.06), x, 0.55, 0);
  },
  crater(put, p) {
    put(`splats.${Math.floor(p.s * 4)}`, new THREE.PlaneGeometry(p.r * 2.4, p.r * 2.4), 0, 0.025, 0, -PI / 2, 0, p.s * 6.28);
  },
  deadtree(put, p) {
    const r = prng(p.s), h = p.h;
    put('darkwood', C(0.08, 0.22, h, 7), 0, h / 2, 0, 0, 0, (r() - 0.5) * 0.15);
    for (let i = 0; i < 4; i++) {
      const y = h * (0.45 + r() * 0.45), a = r() * PI * 2, len = 1.2 + r() * 1.6;
      put('darkwood', C(0.02, 0.07, len, 5), Math.cos(a) * len * 0.35, y + len * 0.3, Math.sin(a) * len * 0.35, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      if (p.snow) put('snow', S(0.12, 6, 4), Math.cos(a) * len * 0.5, y + len * 0.45, Math.sin(a) * len * 0.5, 0, 0, 0, 1.4, 0.5, 1.4);
    }
  },
  roof(put, p) {
    const r = prng(p.s);
    const { w, d, h } = p;
    const y0 = p.y0 || 0;
    const floors = Math.max(1, Math.floor((h - y0 - 0.4) / 3.2));
    const faces = [[0, d / 2, w, 0], [0, -d / 2, w, PI], [w / 2, 0, d, PI / 2], [-w / 2, 0, d, -PI / 2]];
    faces.forEach(([fx, fz, L, ang], fi) => {
      const nx = Math.sin(ang), nz = Math.cos(ang), tx = Math.cos(ang), tz = -Math.sin(ang);
      const cols = Math.max(1, Math.floor(L / 3));
      for (let f = 0; f < floors; f++) {
        const base = y0 + f * 3.2;
        if (f > 0) put('trim', B(L + 0.3, 0.18, 0.16), fx + nx * 0.08, base, fz + nz * 0.08, 0, ang, 0);
        for (let c = 0; c < cols; c++) {
          const off = (c - (cols - 1) / 2) * (L / cols);
          const px = fx + tx * off, pz = fz + tz * off;
          if (y0 === 0 && f === 0 && fi === 0 && c === Math.floor(cols / 2)) {
            put('dark', B(1.5, 2.4, 0.06), px + nx * 0.02, base + 1.2, pz + nz * 0.02, 0, ang, 0);
            put('trim', B(1.9, 0.25, 0.3), px + nx * 0.15, base + 2.55, pz + nz * 0.15, 0, ang, 0);
            continue;
          }
          const roll = r();
          if (roll < 0.06) continue;
          const y = base + 1.75;
          put(roll < 0.35 ? 'dark' : 'glass', B(1.1, 1.45, 0.04), px + nx * 0.02, y, pz + nz * 0.02, 0, ang, 0);
          put('trim', B(1.34, 0.1, 0.12), px + nx * 0.06, y + 0.77, pz + nz * 0.06, 0, ang, 0);
          put('trim', B(1.44, 0.09, 0.26), px + nx * 0.12, y - 0.78, pz + nz * 0.12, 0, ang, 0);
          for (const sd of [-1, 1]) put('trim', B(0.1, 1.45, 0.12), px + tx * sd * 0.62 + nx * 0.06, y, pz + tz * sd * 0.62 + nz * 0.06, 0, ang, 0);
          if (roll > 0.35 && roll < 0.5) put('dark', B(0.04, 1.4, 0.02), px + nx * 0.05, y, pz + nz * 0.05, 0, ang, 0);
          if (f > 0 && roll > 0.9) {
            put('concrete', B(1.9, 0.14, 0.9), px + nx * 0.45, base + 0.95, pz + nz * 0.45, 0, ang, 0);
            put('iron', B(1.9, 0.9, 0.05), px + nx * 0.88, base + 1.45, pz + nz * 0.88, 0, ang, 0);
          }
        }
      }
      put('trim', B(L + 0.2, 0.3, 0.2), fx + nx * 0.1, y0 + 0.15, fz + nz * 0.1, 0, ang, 0);
    });
    for (const s of [-1, 1]) {
      put('concrete', B(w, 0.6, 0.25, 3), 0, h + 0.3, s * (d / 2 - 0.125));
      put('concrete', B(0.25, 0.6, d, 3), s * (w / 2 - 0.125), h + 0.3, 0);
    }
    if (!p.small && r() < 0.7) {
      const tx = (r() - 0.5) * (w - 3), tz = (r() - 0.5) * (d - 3);
      put('iron', C(0.85, 0.85, 1.5, 14), tx, h + 1.95, tz);
      for (const [lx, lz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) put('iron', B(0.08, 1.2, 0.08), tx + lx, h + 0.6, tz + lz);
    }
    for (let i = 0; i < 6; i++) put('dark', B(0.04, 0.6 + r() * 0.8, 0.04), (r() - 0.5) * w, h + 0.5, (r() < 0.5 ? -1 : 1) * (d / 2 - 0.1), (r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5);
    if (r() < 0.5) put('dark', C(0.02, 0.02, 3, 4), (r() - 0.5) * w * 0.6, h + 1.5, (r() - 0.5) * d * 0.6);
  },
  monument(put) {
    put('dark', B(1.6, 0.5, 0.06), 0, 0.7, -1.73);
  },
  banner() { /* world.js 에서 따로 그림 (펄럭임) */ },
  road(put, p) {
    const g = new THREE.PlaneGeometry(p.w, p.d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * p.w) / 8, (uv.getY(i) * p.d) / 8);
    put('asphalt', g, 0, 0.012, 0, -PI / 2);
  },
  dash(put, p) {
    put('paint', new THREE.PlaneGeometry(p.w, p.d), 0, 0.02, 0, -PI / 2);
  },
  curb(put, p) {
    put('trim', B(p.len, 0.14, 0.26, 2), 0, 0.07, 0);
  },
  tuft(put, p) {
    const h = p.h, w = h * 1.3;
    for (let k = 0; k < 3; k++) put('grass', new THREE.PlaneGeometry(w, h), 0, h / 2, 0, 0, p.s * 6 + (k * PI) / 3, 0);
    if (p.snow) put('snow', S(h * 0.4, 6, 4), 0, 0.05, 0, 0, 0, 0, 1.6, 0.35, 1.6);
  },
  debris(put, p) {
    const r = prng(p.s);
    for (let i = 0; i < 4 + Math.floor(r() * 5); i++) {
      const kind = r();
      const x = (r() - 0.5) * 1.4, z = (r() - 0.5) * 1.4;
      if (kind < 0.45) put('brick', B(0.22, 0.07, 0.11), x, 0.035, z, 0, r() * PI, (r() - 0.5) * 0.4);
      else if (kind < 0.7) put('ruin', Dode(0.08 + r() * 0.12), x, 0.06, z, r(), r(), r(), 1, 0.6, 1);
      else if (kind < 0.85) put('hanji', new THREE.PlaneGeometry(0.22, 0.3), x, 0.015, z, -PI / 2, 0, r() * PI);
      else put('iron', C(0.02, 0.02, 0.5 + r() * 0.6, 5), x, 0.03, z, 0, r() * PI, PI / 2);
    }
  },
  pebbles(put, p) {
    const r = prng(p.s);
    for (let i = 0; i < 3 + Math.floor(r() * 4); i++) {
      const sz = 0.06 + r() * 0.16;
      put(p.snow ? 'snow' : 'stone', Dode(sz), (r() - 0.5) * 0.9, sz * 0.4, (r() - 0.5) * 0.9, r(), r(), r(), 1.2, 0.6, 1);
    }
  },
  puddle(put, p) {
    put('puddle', new THREE.CircleGeometry(1, 20), 0, 0.022, 0, -PI / 2, 0, 0, p.r, p.r * 0.65, 1);
  },
  drift(put, p) {
    put('snow', S(p.r, 12, 6, 0, PI * 2, 0, PI / 2), 0, -0.05, 0, 0, 0, 0, 1.5, 0.28, 1);
  },

  // ── 궁궐 ──
  hall(put, p) {
    const { w, d } = p, pw = w + 5, pd = d + 5;
    put('stone', B(pw, 1.0, pd, 3), 0, 0.5, 0);
    put('stone', B(pw + 0.2, 0.12, pd + 0.2, 3), 0, 1.0, 0);
    for (const s of [-1, 1]) {
      put('stone', B(5, 0.5, 1.0, 2), 0, 0.25, s * (pd / 2 + 0.5));
      put('stone', B(1.0, 0.5, 3, 2), -(pw / 2 + 0.5), 0.25, s * 2);
      put('stone', B(1.0, 0.5, 3, 2), pw / 2 + 0.5, 0.25, s * 2);
    }
    put('wood', B(w, 5.4, d, 2), 0, 3.7, 0);
    for (const s of [-1, 1]) {
      for (let x = -w / 2 + 0.5; x < w / 2; x += 0.55) put('darkwood', B(0.06, 3.6, 0.06), x, 3.2, s * (d / 2 + 0.03));
      for (let y = 1.6; y < 5.2; y += 0.6) put('darkwood', B(w, 0.06, 0.06), 0, y, s * (d / 2 + 0.03));
      put('plaster', B(w, 1.2, 0.1), 0, 5.7, s * (d / 2 + 0.06));
    }
    for (let i = 0; i < 6; i++) {
      const lx = -w / 2 + 0.3 + (i * (w - 0.6)) / 5;
      for (const s of [-1, 1]) {
        put('redwood', C(0.24, 0.28, 5.4, 12), lx, 3.7, s * (d / 2 + 1.3));
        put('stone', C(0.36, 0.4, 0.2, 10), lx, 1.1, s * (d / 2 + 1.3));
      }
    }
    for (const s of [-1, 1]) {
      put('green', B(w + 2.9, 0.5, 0.45), 0, 6.3, s * (d / 2 + 1.3));
      put('green', B(0.45, 0.5, d + 2.9), s * (w / 2 + 1.3), 6.3, 0);
      put('redwood', B(w + 2.8, 0.18, 0.3), 0, 5.95, s * (d / 2 + 1.3));
    }
    put('tile', roofGeo(w + 6, d + 6, 1.7, 0.6), 0, 6.5, 0);
    put('green', roofGeo(w + 6, d + 6, 1.7, 0.6, true), 0, 6.5, 0);
    put('plaster', B(w - 1, 1.3, d - 1, 2), 0, 7.6, 0);
    put('tile', roofGeo(w + 3.4, d + 3.4, 2.8, 0.8), 0, 8.1, 0);
    put('green', roofGeo(w + 3.4, d + 3.4, 2.8, 0.8, true), 0, 8.1, 0);
    put('dark', B(Math.max(1, w - d), 0.4, 0.5), 0, 10.95, 0);
  },
  hanok(put, p) {
    const { w, d } = p;
    put('stone', B(w + 1.6, 0.45, d + 1.6, 2), 0, 0.225, 0);
    put('plaster', B(w, 3.0, d, 2), 0, 1.95, 0);
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) put('darkwood', C(0.14, 0.16, 3.0, 8), x, 1.95, z);
    for (let x = -w / 2 + 2.4; x < w / 2 - 1; x += 2.4) {
      put('darkwood', C(0.13, 0.15, 3.0, 8), x, 1.95, -d / 2);
      put('darkwood', C(0.13, 0.15, 3.0, 8), x, 1.95, d / 2);
    }
    for (const s of [-1, 1]) put('darkwood', B(w + 0.4, 0.26, 0.26), 0, 3.35, s * (d / 2));
    const dw = w * 0.55;
    put('wood', B(dw, 2.0, 0.08, 2), 0, 1.5, -d / 2 - 0.02);
    for (let x = -dw / 2 + 0.2; x < dw / 2; x += 0.35) put('darkwood', B(0.04, 2.0, 0.04), x, 1.5, -d / 2 - 0.07);
    for (let y = 0.7; y < 2.5; y += 0.35) put('darkwood', B(dw, 0.04, 0.04), 0, y, -d / 2 - 0.07);
    put('tile', roofGeo(w + 2.8, d + 2.8, 1.9, 0.45), 0, 3.45, 0);
    put('darkwood', roofGeo(w + 2.8, d + 2.8, 1.9, 0.45, true), 0, 3.45, 0);
  },
  gate(put, p) {
    const { w } = p, side = (w - 4.4) / 2;
    for (const s of [-1, 1]) {
      put('stone', B(side + 0.2, 1.0, 4.2, 2), s * (2.2 + side / 2), 0.5, 0);
      put('plaster', B(side, 3.2, 4, 2), s * (2.2 + side / 2), 2.6, 0);
      put('redwood', C(0.22, 0.24, 3.4, 10), s * 2.3, 1.7, -1.9);
      put('redwood', C(0.22, 0.24, 3.4, 10), s * 2.3, 1.7, 1.9);
      put('redwood', B(0.12, 3.2, 2.1), s * 2.05, 1.6, -0.9, 0, s * 0.3);
    }
    put('redwood', B(4.4, 0.8, 4), 0, 3.8, 0);
    put('dark', B(1.8, 0.7, 0.08), 0, 3.8, -2.05);
    put('green', B(w + 1.6, 0.4, 0.4), 0, 4.1, -2.1);
    put('green', B(w + 1.6, 0.4, 0.4), 0, 4.1, 2.1);
    put('tile', roofGeo(w + 2.4, 6.4, 2.4, 0.6), 0, 4.2, 0);
    put('green', roofGeo(w + 2.4, 6.4, 2.4, 0.6, true), 0, 4.2, 0);
  },
  pwall(put, p) {
    put('stone', B(p.len, 0.6, 1.0, 2), 0, 0.3, 0);
    put('plaster', B(p.len, 2.4, 0.8, 3), 0, 1.8, 0);
    put('tile', roofGeo(p.len + 0.3, 1.7, 0.45, 0), 0, 3.0, 0);
    put('dark', roofGeo(p.len + 0.3, 1.7, 0.45, 0, true), 0, 3.0, 0);
  },
  corridor(put, p) {
    const { len } = p, n = Math.max(2, Math.round(len / 3.5));
    put('stone', B(len, 0.35, 3.2, 2), 0, 0.175, 0);
    put('plaster', B(len, 3.05, 0.5, 3), 0, 1.875, 1.3);
    for (let i = 0; i <= n; i++) put('redwood', C(0.17, 0.2, 3.05, 10), -len / 2 + 0.25 + (i * (len - 0.5)) / n, 1.875, -1.2);
    put('green', B(len, 0.32, 0.32), 0, 3.3, -1.2);
    put('tile', roofGeo(len + 1.2, 4.4, 1.25, 0.25), 0, 3.4, 0.1);
    put('green', roofGeo(len + 1.2, 4.4, 1.25, 0.25, true), 0, 3.4, 0.1);
  },
  pavilion(put, p) {
    const { s } = p;
    put('stone', B(s + 1.2, 0.5, s + 1.2, 2), 0, 0.25, 0);
    for (const x of [-s / 2, s / 2]) for (const z of [-s / 2, s / 2]) put('redwood', C(0.2, 0.23, 3.6, 10), x, 2.3, z);
    for (const t of [-1, 1]) {
      put('wood', B(s, 0.1, 0.1), 0, 1.25, t * s / 2);
      put('wood', B(0.1, 0.1, s), t * s / 2, 1.25, 0);
      put('green', B(s + 0.6, 0.36, 0.36), 0, 4.15, t * s / 2);
      put('green', B(0.36, 0.36, s + 0.6), t * s / 2, 4.15, 0);
    }
    put('tile', roofGeo(s + 3.2, s + 3.2, 2.4, 0.8), 0, 4.3, 0);
    put('green', roofGeo(s + 3.2, s + 3.2, 2.4, 0.8, true), 0, 4.3, 0);
    put('dark', C(0.08, 0.16, 0.7, 8), 0, 7.05, 0);
    if (p.bell) {
      put('bronze', lathe([[0, 0], [0.72, 0], [0.7, 0.2], [0.58, 0.9], [0.52, 1.7], [0.3, 1.85], [0, 1.9]], 20), 0, 1.6, 0);
      put('darkwood', B(s, 0.3, 0.3), 0, 3.7, 0);
    }
  },
  pagoda(put) {
    put('stone', B(3.2, 1.2, 3.2, 2), 0, 0.6, 0);
    for (let i = 0; i < 5; i++) {
      const bw = 2.1 - i * 0.22, y = 1.2 + i * 1.12;
      put('stone', B(bw, 0.8, bw, 2), 0, y + 0.4, 0);
      put('stone', roofGeo(2.9 - i * 0.28, 2.9 - i * 0.28, 0.3, 0.18), 0, y + 0.8, 0);
    }
    put('dark', C(0.05, 0.09, 0.9, 8), 0, 7.25, 0);
  },
  slantern(put) {
    put('stone', C(0.35, 0.42, 0.3, 8), 0, 0.15, 0);
    put('stone', C(0.12, 0.14, 0.75, 8), 0, 0.68, 0);
    put('stone', B(0.52, 0.45, 0.52, 1), 0, 1.28, 0);
    put('dark', B(0.28, 0.24, 0.54), 0, 1.28, 0);
    put('stone', Cone(0.5, 0.35, 4), 0, 1.68, 0, 0, PI / 4);
    put('stone', S(0.08, 8, 6), 0, 1.9, 0);
  },
  dmu(put) {
    put('stone', B(1.7, 0.12, 1.7, 1), 0, 0.06, 0);
    put('bronze', lathe([[0, 0.12], [0.5, 0.12], [0.68, 0.45], [0.74, 1.0], [0.8, 1.08], [0.7, 1.1], [0.62, 0.6], [0, 0.5]], 20));
    for (const s of [-1, 1]) put('bronze', Torus(0.12, 0.03, 6, 10), s * 0.76, 0.85, 0, 0, PI / 2, 0);
  },
  rankstone(put) {
    put('stone', B(0.36, 0.8, 0.26, 1), 0, 0.4, 0);
    put('stone', Cone(0.24, 0.18, 4), 0, 0.89, 0, 0, PI / 4, 0, 1, 1, 0.75);
  },
  paving(put, p) {
    const g = new THREE.PlaneGeometry(p.w, p.d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * p.w) / 4, (uv.getY(i) * p.d) / 4);
    put('paving', g, 0, 0.015, 0, -PI / 2);
  },
  pond(put, p) {
    put('water', new THREE.CircleGeometry(1, 48), 0, 0.03, 0, -PI / 2, 0, 0, p.rx, p.rz, 1);
    const r = prng(p.s);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * PI * 2;
      put('stone', Dode(0.3 + r() * 0.25), Math.cos(a) * p.rx, 0.1, Math.sin(a) * p.rz, r(), r(), r(), 1.2, 0.6, 1);
    }
  },

  // ── 항구 ──
  sea(put) {
    const g = new THREE.PlaneGeometry(700, 1400);
    put('water', g, 350 + 0.5, 0.03, 0, -PI / 2);
    put('concrete', B(1.4, 0.35, 160, 3), -0.3, 0.17, 0);
    for (let z = -76; z <= 76; z += 6) put('dark', Torus(0.35, 0.12, 6, 12), 0.42, 0.12, z, 0, PI / 2, 0);
  },
  ship(put) {
    put('iron', B(12, 7.5, 60, 4), 0, 3.75, 0);
    put('iron', B(8.49, 7.5, 8.49, 4), 0, 3.75, -30, 0, PI / 4, 0);
    put('red', B(12.05, 1.2, 60, 4), 0, 0.6, 0);
    put('dark', B(11.6, 0.3, 62), 0, 7.6, 0);
    put('plaster', B(9, 8, 9, 3), -1, 11.5, 20);
    put('glass', B(9.05, 0.7, 8.4), -1, 13.6, 20);
    put('glass', B(9.05, 0.7, 8.4), -1, 11.2, 20);
    put('red', C(1.3, 1.5, 4.5, 16), -1, 17.5, 26);
    put('dark', C(0.15, 0.15, 14, 6), 0, 14.5, -18);
    for (const [z, t] of [[-20, 0], [-12, 1], [-4, 2], [4, 3]]) put(`containers.${t}`, B(2.44, 2.6, 6.06, 3, 2.6), -3, 9.05, z);
  },
  bollard(put) {
    put('iron', C(0.22, 0.28, 0.65, 10), 0, 0.33, 0);
    put('iron', C(0.34, 0.34, 0.1, 10), 0, 0.7, 0);
  },
  crane(put) {
    for (const x of [-6, 6]) {
      for (const z of [-5, 5]) {
        put('red', B(1.1, 22, 1.1, 2, 4), x, 11, z);
        put('dark', B(1.6, 0.9, 2.4), x, 0.45, z);
      }
      put('red', B(0.4, 0.4, 14), x, 8, 0, 0.75);
      put('red', B(0.9, 1.0, 11), x, 21.5, 0);
    }
    for (const z of [-5, 5]) {
      put('red', B(13, 1.0, 1.0), 0, 21.5, z);
      put('red', B(13, 0.4, 0.4), 0, 8, z);
    }
    put('red', B(56, 1.6, 1.4, 4), 12, 23.4, -2);
    put('red', B(56, 1.6, 1.4, 4), 12, 23.4, 2);
    put('yellow', B(5, 3.4, 6, 2), 0, 25.9, 0);
    put('glass', B(2, 1.4, 2), 14, 21.8, 0);
    put('dark', B(0.06, 9, 0.06), 26, 18.5, -1);
    put('dark', B(0.06, 9, 0.06), 26, 18.5, 1);
    put('dark', B(2.4, 0.5, 6.5), 26, 13.8, 0);
    put('red', B(30, 0.3, 0.3), 8, 27, 0, 0, 0, 0.17);
  },
  warehouse(put, p) {
    const { w, d } = p, seg = (w - 8) / 2;
    put('shed', B(w, 7, 0.4, 3, 3.5), 0, 3.5, d / 2);
    put('shed', B(0.4, 7, d, 3, 3.5), -w / 2, 3.5, 0);
    put('shed', B(0.4, 7, d, 3, 3.5), w / 2, 3.5, 0);
    put('shed', B(seg, 7, 0.4, 3, 3.5), -(4 + seg / 2), 3.5, -d / 2);
    put('shed', B(seg, 7, 0.4, 3, 3.5), 4 + seg / 2, 3.5, -d / 2);
    put('shed', B(8, 2, 0.4, 3, 2), 0, 6, -d / 2);
    put('dark', B(8, 1.4, 0.12), 0, 4.3, -d / 2 - 0.1);
    put('iron', B(w + 0.6, 0.6, d + 0.6, 3), 0, 7.3, 0);
    put('iron', prism([[-(d + 0.6) / 2, 0], [(d + 0.6) / 2, 0], [0, 1.8]], w + 0.6), 0, 7.6, 0);
    put('glass', B(w * 0.8, 0.6, 0.44), 0, 5.6, d / 2);
  },
  forklift(put) {
    put('yellow', B(1.2, 1.0, 1.8, 2), 0, 0.75, 0.2);
    put('dark', B(1.0, 0.6, 0.6), 0, 0.9, 1.0);
    for (const s of [-1, 1]) {
      put('dark', B(0.1, 2.3, 0.12), s * 0.4, 1.2, -0.75);
      put('dark', B(0.12, 0.05, 1.0), s * 0.3, 0.12, -1.3);
      put('dark', B(0.06, 2.0, 0.06), s * 0.55, 2.2, 0.5);
    }
    put('dark', B(1.2, 0.06, 1.3), 0, 2.2, 0.2);
    wheelsZ(put, [-0.62, 0.62], 0.3, [-0.45, 0.8], 0.3, 0.2);
  },
  pallet(put, p) {
    for (let i = 0; i < p.n; i++) {
      put('wood', B(1.2, 0.1, 1.0, 1), 0, 0.05 + i * 0.15, 0);
      put('darkwood', B(1.05, 0.05, 0.85), 0, 0.125 + i * 0.15, 0);
    }
  },
  flood(put) {
    put('iron', C(0.14, 0.22, 12, 8), 0, 6, 0);
    put('iron', B(2.4, 0.9, 0.35), 0, 12.1, -0.3);
    put('lamp', B(2.1, 0.6, 0.05), 0, 12.1, -0.5);
  },
  booth(put) {
    put('concrete', B(3.4, 0.2, 3.4, 2), 0, 2.9, 0);
    put('glass', B(3.02, 0.8, 1.8), 0, 1.9, 0);
    put('red', B(4, 0.12, 0.12), 3.6, 1.1, 0);
    put('dark', B(0.3, 1.1, 0.3), 1.7, 0.55, 0);
  },

  // ── 설원 ──
  berm(put, p) {
    const { len, h, thick } = p;
    put('snowearth', prism([[-thick / 2 - 0.35, 0], [thick / 2 + 0.35, 0], [thick / 2 - 0.05, h * 0.85], [0.15, h + 0.05], [-0.15, h + 0.05], [-thick / 2 + 0.05, h * 0.85]], len));
    const r = prng(p.s);
    for (let i = 0; i < Math.round(len / 2.5); i++) {
      put('snow', S(0.55 + r() * 0.35, 8, 5), (r() - 0.5) * len * 0.9, h - 0.05, (r() - 0.5) * 0.4, 0, 0, 0, 1.6, 0.35, 1);
    }
    for (let x = -len / 2 + 1; x < len / 2; x += 2.2) {
      put('darkwood', B(0.12, h * 0.9, 0.12), x, h * 0.45, -thick / 2 - 0.02);
      put('darkwood', B(0.12, h * 0.9, 0.12), x, h * 0.45, thick / 2 + 0.02);
    }
  },
  duckboard(put, p) {
    put('darkwood', B(p.len, 0.38, 0.55, 2), 0, 0.19, 0);
    for (let x = -p.len / 2 + 0.2; x < p.len / 2; x += 0.4) put('wood', B(0.3, 0.06, 0.7), x, 0.42, 0);
  },

  // ── 죽림 마을 ──
  choga(put, p) {
    const { w, d } = p;
    put('stone', B(w + 1, 0.35, d + 1, 2), 0, 0.175, 0);
    put('mud', B(w, 2.6, d, 2), 0, 1.65, 0);
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) put('darkwood', C(0.1, 0.12, 2.6, 8), x, 1.65, z);
    for (const s of [-1, 1]) put('darkwood', B(w + 0.3, 0.2, 0.2), 0, 2.9, s * d / 2);
    put('darkwood', B(1.0, 1.8, 0.06), -w * 0.2, 1.25, -d / 2 - 0.03);
    put('hanji', B(0.9, 0.7, 0.06), w * 0.25, 1.7, -d / 2 - 0.03);
    for (let x = -0.35; x <= 0.36; x += 0.23) put('darkwood', B(0.03, 0.7, 0.03), w * 0.25 + x, 1.7, -d / 2 - 0.07);
    put('thatch', roofGeo(w + 1.9, d + 1.9, 1.9, 0, false, 'thatch'), 0, 2.95, 0);
    put('darkwood', roofGeo(w + 1.9, d + 1.9, 1.9, 0, true, 'thatch'), 0, 2.95, 0);
    put('dark', C(0.18, 0.22, 1.2, 8), w / 2 - 0.3, 1.0, d / 2 + 0.3);
  },
  stonewall(put, p) {
    const r = prng(p.s), { len } = p;
    put('earth', B(len - 0.1, 1.05, 0.5, 2), 0, 0.52, 0);
    for (let row = 0; row < 3; row++) {
      for (let x = -len / 2 + 0.25; x < len / 2; x += 0.52) {
        for (const s of [-1, 1]) put('stone', Dode(0.26 + r() * 0.08), x + (r() - 0.5) * 0.15, 0.22 + row * 0.36, s * 0.24, r(), r(), r(), 1.2, 0.8, 0.7);
      }
    }
    if (p.s < 0.5) {
      put('tile', roofGeo(len + 0.2, 1.0, 0.28, 0), 0, 1.15, 0);
      put('dark', roofGeo(len + 0.2, 1.0, 0.28, 0, true), 0, 1.15, 0);
    }
  },
  jangdok(put, p) {
    const r = prng(p.s);
    put('stone', B(2.6, 0.4, 1.8, 1), 0, 0.2, 0);
    const jar = [[0, 0], [0.14, 0], [0.24, 0.16], [0.29, 0.36], [0.26, 0.55], [0.15, 0.64], [0.16, 0.68], [0, 0.68]];
    for (const [x, z, s] of [[-0.8, -0.35, 1.25], [0, -0.4, 1.1], [0.8, -0.3, 1.3], [-0.5, 0.45, 0.9], [0.4, 0.45, 1.0], [0.95, 0.5, 0.75]]) {
      const k = s * (0.9 + r() * 0.2);
      put('onggi', lathe(jar, 12), x, 0.4, z, 0, 0, 0, k, k, k);
      put('onggi', C(0.18 * k, 0.2 * k, 0.05, 10), x, 0.4 + 0.7 * k, z);
    }
  },
  haystack(put) {
    put('thatch', C(1.1, 1.0, 1.2, 14), 0, 0.6, 0);
    put('thatch', Cone(1.18, 1.0, 14), 0, 1.7, 0);
  },
  jangseung(put, p) {
    put('wood', C(0.22, 0.26, 2.3, 10), 0, 1.15, 0);
    put('dark', Cone(0.32, 0.5, 10), 0, 2.55, 0);
    put('dark', C(0.3, 0.3, 0.06, 10), 0, 2.3, 0);
    for (const s of [-1, 1]) put('dark', S(0.06, 6, 5), s * 0.1, 2.0, -0.22);
    put('red', B(0.24, 0.06, 0.05), 0, 1.72, -0.23);
    put('dark', B(0.08, 0.9, 0.03), 0, 0.9, -0.25);
  },
  bamboo(put, p) {
    const r = prng(p.s), h = p.h;
    for (let i = 0; i < p.n; i++) {
      const x = (r() - 0.5) * 1.1, z = (r() - 0.5) * 1.1, tx = (r() - 0.5) * 0.14, tz = (r() - 0.5) * 0.14, hh = h * (0.75 + r() * 0.3);
      put('bamboo', C(0.045, 0.06, hh, 6), x + tx * hh * 0.5, hh / 2, z + tz * hh * 0.5, tz, 0, -tx);
      for (let y = 1.6; y < hh; y += 1.7) put('darkwood', C(0.066, 0.066, 0.05, 6), x + tx * y, y, z + tz * y);
    }
    for (let k = 0; k < 4; k++) {
      const y = h * (0.5 + k * 0.14), a = r() * PI;
      put('leaf', new THREE.PlaneGeometry(2.4, 1.8), (r() - 0.5) * 0.8, y, (r() - 0.5) * 0.8, (r() - 0.5) * 0.6, a, 0);
      put('leaf', new THREE.PlaneGeometry(2.4, 1.8), (r() - 0.5) * 0.8, y + 0.3, (r() - 0.5) * 0.8, (r() - 0.5) * 0.6, a + PI / 2, 0);
    }
  },
  bigtree(put, p) {
    const r = prng(p.s);
    put('darkwood', C(0.5, 0.9, 5.5, 12), 0, 2.75, 0, 0, 0, 0.05);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + r(), len = 3 + r() * 1.5;
      put('darkwood', C(0.12, 0.35, len, 8), Math.cos(a) * len * 0.35, 5 + len * 0.3, Math.sin(a) * len * 0.35, Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    }
    for (let i = 0; i < 9; i++) {
      const a = r() * PI * 2, dd = 1 + r() * 3.2;
      put('canopy', Ico(2.2 + r() * 1.2, 1), Math.cos(a) * dd, 6.5 + r() * 2.5, Math.sin(a) * dd, 0, r() * PI, 0, 1.3, 0.55, 1.2);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      put('darkwood', C(0.08, 0.28, 1.6, 6), Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9, Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3);
    }
  },
  well(put) {
    put('stone', C(0.9, 0.95, 0.9, 16, true), 0, 0.45, 0);
    put('stone', Torus(0.9, 0.08, 6, 16), 0, 0.9, 0, PI / 2);
    put('dark', new THREE.CircleGeometry(0.85, 16), 0, 0.5, 0, -PI / 2);
    for (const s of [-1, 1]) put('darkwood', B(0.14, 2.2, 0.14), s * 1.0, 1.1, 0);
    put('darkwood', B(2.2, 0.12, 0.12), 0, 1.9, 0);
    put('tile', roofGeo(2.6, 1.8, 0.6, 0.15), 0, 2.2, 0);
    put('darkwood', C(0.18, 0.15, 0.3, 8), 0.3, 1.2, 0);
  },
  mortar(put) {
    put('stone', C(0.35, 0.3, 0.9, 12), 0, 0.45, 0);
    put('darkwood', C(0.05, 0.08, 1.3, 6), 0.1, 1.1, 0, 0, 0, 0.2);
  },
  shed(put) {
    for (const x of [-2, 2]) for (const z of [-1.6, 1.6]) put('darkwood', C(0.1, 0.12, 2.6, 6), x, 1.3, z);
    put('thatch', roofGeo(5.6, 4.6, 1.1, 0, false, 'thatch'), 0, 2.6, 0);
    put('darkwood', roofGeo(5.6, 4.6, 1.1, 0, true, 'thatch'), 0, 2.6, 0);
    put('thatch', B(1.8, 0.9, 1.2, 1), 1, 0.45, 0.6);
  },
  scarecrow(put) {
    put('darkwood', C(0.05, 0.06, 1.9, 6), 0, 0.95, 0);
    put('darkwood', B(1.4, 0.06, 0.06), 0, 1.45, 0);
    put('canvas', B(0.6, 0.7, 0.3), 0, 1.25, 0);
    put('thatch', Cone(0.45, 0.25, 12), 0, 1.95, 0);
    put('hanji', S(0.14, 8, 6), 0, 1.72, 0);
  },
  paddy(put, p) {
    put('paddy', new THREE.PlaneGeometry(p.w - 0.7, p.d - 0.7), 0, 0.02, 0, -PI / 2);
    for (let z = -p.d / 2 + 0.8; z < p.d / 2 - 0.6; z += 0.55) put('rice', B(p.w - 1.4, 0.28, 0.07), 0, 0.14, z);
  },
  ridge(put, p) {
    put('earth', B(p.w, 0.32, p.d, 2), 0, 0.16, 0);
  },
  cart(put) {
    put('wood', B(1.5, 0.12, 2.6, 1), 0, 0.8, 0);
    for (const s of [-1, 1]) {
      put('wood', B(0.08, 0.45, 2.6, 1), s * 0.72, 1.05, 0);
      put('darkwood', C(0.6, 0.6, 0.1, 14), s * 0.85, 0.6, 0.3, 0, 0, PI / 2);
      put('darkwood', B(0.08, 0.08, 2.2), s * 0.5, 0.75, -2.2);
    }
    put('thatch', B(1.2, 0.5, 1.8, 1), 0, 1.1, 0.2);
  },
};

// map.boxes 중 m(재질)이 있는 상자 → 텍스처 크기
const BOX_TEX = { wall: [4, 4], ruin: [4, 4], concrete: [4, 4], stone: [3, 3], wood: [2, 2], plaster: [3, 3] };

export function buildProps(group, map) {
  const mats = makeMaterials();
  const batch = new Batch();
  for (const b of map.boxes) {
    if (!b.m) continue;
    const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
    const [tw, th] = BOX_TEX[b.m] || [4, 4];
    const g = B(w, h, d, tw, th);
    g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    batch.add(mats[b.m] ? b.m : 'concrete', g);
  }
  let count = 0;
  for (const p of map.props) {
    const draw = DRAW[p.kind];
    if (!draw) continue;
    draw(framer(batch, p.x, 0, p.z, p.rot || 0), p);
    count++;
  }
  batch.build(group, mats);
  return { mats, count };
}

// 3D 모델 — 스킨을 입힌 총, 생김새를 고를 수 있는 병사, 1인칭 팔
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { cleanLook, LOOKS, TEAMS } from '../shared/config.js';

const PI = Math.PI;
const GEO = new Map();
const geo = (key, make) => {
  let g = GEO.get(key);
  if (!g) { g = make(); GEO.set(key, g); }
  return g;
};
const rbox = (w, h, d, r = Math.min(w, h, d) * 0.2) => geo(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const box = (w, h, d) => geo(`bx${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylZ = (r1, r2, len, seg = 10, open = false) => geo(`cz${r1},${r2},${len},${seg},${open}`, () => new THREE.CylinderGeometry(r1, r2, len, seg, 1, open).rotateX(PI / 2));
const cylX = (r1, r2, len, seg = 10) => geo(`cx${r1},${r2},${len},${seg}`, () => new THREE.CylinderGeometry(r1, r2, len, seg).rotateZ(PI / 2));
const cylY = (r1, r2, len, seg = 10, open = false) => geo(`cy${r1},${r2},${len},${seg},${open}`, () => new THREE.CylinderGeometry(r1, r2, len, seg, 1, open));
const sphere = (r, ws = 12, hs = 8) => geo(`sp${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const capsule = (r, len) => geo(`ca${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));
const coneZ = (r, len, seg = 12, open = false) => geo(`cn${r},${len},${seg},${open}`, () => new THREE.ConeGeometry(r, len, seg, 1, open).rotateX(-PI / 2));

const glass = new THREE.MeshPhongMaterial({ color: 0x1b2833, shininess: 100, specular: 0x666666 });

// 총은 guns.js 에서 만든다
export { buildGun, GUN_MUZZLE, GRIPS } from './guns.js';
import { GRIPS, buildGun } from './guns.js';

// ── 병사 ─────────────────────────────────────────
const L = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
const MAT = {
  skin: L(0xe3d6c2), boot: L(0x221f1c), belt: L(0x3a322a), dark: L(0x262422), canvas: L(0x9a947f),
  hair: L(0x1a1816), tal: L(0xe6d9b8), thatch: L(0xb8aa82), rubber: L(0x2b2b2a), glove: L(0x2a2724),
  plate: new THREE.MeshPhongMaterial({ color: 0x3a3a3a, shininess: 30 }),
};
const TEAM_MATS = TEAMS.map((t, i) => ({
  cloth: L(i ? 0x3a6fa6 : 0x6a665f),
  clothSide: L(i ? 0x3a6fa6 : 0x6a665f, { side: THREE.DoubleSide }),
  vest: L(i ? 0x24496e : 0x3b3935),
  helmet: L(i ? 0x1f3f60 : 0x2a2826),
}));
export const teamMats = (team) => TEAM_MATS[team ? 1 : 0];
const accentMats = new Map();
function accentMat(id, side = false) {
  const key = `${id}${side}`;
  if (!accentMats.has(key)) {
    const a = LOOKS.accent.find((x) => x.id === id) || LOOKS.accent[0];
    accentMats.set(key, L(new THREE.Color(a.color).getHex(), side ? { side: THREE.DoubleSide } : undefined));
  }
  return accentMats.get(key);
}

export function buildSoldier(lookIn, team) {
  const look = cleanLook(lookIn), T = teamMats(team), A = accentMat(look.accent);
  const root = new THREE.Group();
  const add = (g, m, x, y, z, parent, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    parent.add(o);
    return o;
  };

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  add(rbox(0.4, 0.2, 0.27, 0.06), T.cloth, 0, 0.02, 0, hips);
  add(rbox(0.42, 0.055, 0.29, 0.02), MAT.belt, 0, 0.1, 0, hips);
  add(rbox(0.09, 0.08, 0.06, 0.015), MAT.belt, 0.14, 0.05, -0.15, hips);
  add(rbox(0.09, 0.08, 0.06, 0.015), MAT.belt, -0.14, 0.05, -0.15, hips);

  const legs = [-1, 1].map((s) => {
    const thigh = new THREE.Group();
    thigh.position.set(s * 0.11, -0.03, 0);
    hips.add(thigh);
    add(capsule(0.095, 0.22), T.cloth, 0, -0.2, 0, thigh);
    add(rbox(0.05, 0.12, 0.13, 0.015), T.vest, s * 0.095, -0.22, 0, thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    thigh.add(knee);
    add(capsule(0.082, 0.22), T.cloth, 0, -0.18, 0, knee);
    add(cylY(0.088, 0.095, 0.12, 12), MAT.boot, 0, -0.36, 0, knee);
    add(rbox(0.15, 0.1, 0.28, 0.035), MAT.boot, 0, -0.44, -0.04, knee);
    if (look.body === 'heavy') add(sphere(0.06), MAT.plate, 0, 0, -0.06, knee, 0, 0, 0, 1, 1, 0.6);
    return { thigh, knee };
  });

  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);
  add(rbox(0.46, 0.5, 0.28, 0.08), T.cloth, 0, 0.27, 0, torso);
  add(rbox(0.3, 0.07, 0.24, 0.03), T.vest, 0, 0.52, 0, torso);
  add(cylY(0.055, 0.06, 0.09), MAT.skin, 0, 0.56, 0, torso);

  // 옷
  if (look.body === 'coat') {
    add(cylY(0.23, 0.31, 0.55, 14, true), T.clothSide, 0, -0.33, 0, torso);
    add(box(0.3, 0.08, 0.26), T.vest, 0, 0.48, 0, torso);
    for (const y of [0.12, 0.22, 0.32]) add(sphere(0.012), A, 0, y, -0.125, torso);
  } else if (look.body === 'robe') {
    add(cylY(0.22, 0.37, 0.82, 16, true), T.clothSide, 0, -0.46, 0, torso);
    add(cylY(0.225, 0.225, 0.07, 16), A, 0, 0.02, 0, torso);
    add(box(0.05, 0.3, 0.02), A, 0.08, -0.14, -0.2, torso, 0.1);
  } else if (look.body === 'heavy') {
    add(rbox(0.47, 0.34, 0.3, 0.05), MAT.plate, 0, 0.29, 0, torso);
    for (const s of [-1, 1]) add(rbox(0.17, 0.08, 0.2, 0.03), MAT.plate, s * 0.25, 0.49, 0, torso, 0, 0, s * -0.35);
  } else {
    for (const s of [-1, 1]) add(box(0.1, 0.09, 0.03), T.vest, s * 0.1, 0.35, -0.125, torso);
  }

  // 장비
  if (look.gear === 'vest' && look.body !== 'heavy') {
    add(rbox(0.47, 0.36, 0.31, 0.04), T.vest, 0, 0.27, 0, torso);
    for (const x of [-0.13, 0, 0.13]) add(rbox(0.1, 0.12, 0.05, 0.015), T.vest, x, 0.2, -0.17, torso);
  } else if (look.gear === 'pack') {
    add(rbox(0.32, 0.38, 0.17, 0.04), MAT.canvas, 0, 0.3, 0.2, torso);
    add(cylX(0.06, 0.06, 0.34, 10), T.vest, 0, 0.52, 0.2, torso);
  } else if (look.gear === 'radio') {
    add(rbox(0.26, 0.34, 0.15, 0.02), MAT.dark, 0, 0.28, 0.19, torso);
    add(cylY(0.006, 0.006, 0.75, 4), MAT.dark, 0.09, 0.8, 0.22, torso);
    add(box(0.05, 0.03, 0.03), A, -0.08, 0.4, 0.27, torso);
  } else if (look.gear === 'cape') {
    const cape = new THREE.Mesh(geo('cape', () => new THREE.CylinderGeometry(0.27, 0.44, 1.0, 16, 1, true, -PI / 2, PI)), accentMat(look.accent, true));
    cape.position.set(0, -0.02, 0.03);
    cape.castShadow = true;
    torso.add(cape);
  } else if (look.gear === 'sword') {
    add(box(0.035, 0.72, 0.05), MAT.dark, 0.02, 0.22, 0.17, torso, 0, 0, 0.6);
    add(cylY(0.016, 0.016, 0.14, 8), A, -0.2, 0.52, 0.17, torso, 0, 0, 0.6);
    add(box(0.1, 0.02, 0.06), MAT.belt, -0.15, 0.46, 0.17, torso, 0, 0, 0.6);
  }

  // 머리
  const head = new THREE.Group();
  head.position.y = 0.6;
  torso.add(head);
  add(sphere(0.118, 16, 12), MAT.skin, 0, 0.12, 0, head, 0, 0, 0, 1, 1.12, 1.05);
  for (const s of [-1, 1]) add(box(0.026, 0.012, 0.01), MAT.hair, s * 0.042, 0.14, -0.118, head);

  switch (look.helmet) {
    case 'beret':
      add(sphere(0.14, 14, 8), A, 0.02, 0.23, 0, head, 0, 0, -0.25, 1.1, 0.42, 1.1);
      add(box(0.03, 0.035, 0.01), MAT.thatch, -0.08, 0.22, -0.1, head);
      break;
    case 'hood':
      add(sphere(0.15, 16, 10), T.cloth, 0, 0.14, 0.02, head, 0, 0, 0, 1, 1.05, 1.1);
      add(cylY(0.13, 0.24, 0.2, 12, true), T.clothSide, 0, -0.02, 0.02, head);
      break;
    case 'gat':
      add(geo('gat', () => new THREE.ConeGeometry(0.34, 0.15, 24)), MAT.thatch, 0, 0.28, 0, head);
      add(cylY(0.08, 0.1, 0.08, 12), MAT.thatch, 0, 0.36, 0, head);
      add(box(0.01, 0.2, 0.01), A, 0.1, 0.13, -0.06, head);
      add(box(0.01, 0.2, 0.01), A, -0.1, 0.13, -0.06, head);
      break;
    case 'cap':
      add(cylY(0.128, 0.138, 0.11, 16), T.helmet, 0, 0.23, 0, head);
      add(box(0.16, 0.015, 0.1), T.helmet, 0, 0.19, -0.14, head, -0.1);
      add(box(0.035, 0.03, 0.01), A, 0, 0.24, -0.135, head);
      break;
    case 'none':
      add(geo('hair', () => new THREE.SphereGeometry(0.125, 14, 8, 0, PI * 2, 0, PI * 0.5)), MAT.hair, 0, 0.14, 0.01, head, 0, 0, 0, 1, 1.05, 1.08);
      break;
    default: // steel
      add(geo('helm', () => new THREE.SphereGeometry(0.162, 18, 10, 0, PI * 2, 0, PI * 0.56)), T.helmet, 0, 0.14, 0, head, 0, 0, 0, 1, 0.92, 1.08);
      add(cylY(0.176, 0.182, 0.02, 20), T.helmet, 0, 0.13, 0, head);
      add(cylY(0.166, 0.166, 0.035, 20, true), accentMat(look.accent, true), 0, 0.165, 0, head);
  }

  switch (look.face) {
    case 'mask':
      add(rbox(0.2, 0.1, 0.14, 0.03), MAT.dark, 0, 0.07, -0.035, head);
      break;
    case 'gas':
      add(rbox(0.17, 0.14, 0.1, 0.03), MAT.rubber, 0, 0.1, -0.08, head);
      for (const s of [-1, 1]) add(cylZ(0.03, 0.03, 0.02, 12), glass, s * 0.045, 0.14, -0.13, head);
      add(cylZ(0.035, 0.03, 0.06, 12), A, 0, 0.04, -0.15, head);
      break;
    case 'tal':
      add(geo('tal', () => new THREE.SphereGeometry(0.125, 16, 12, PI, PI)), MAT.tal, 0, 0.11, -0.01, head, 0, 0, 0, 1, 1.18, 0.95);
      add(box(0.08, 0.012, 0.01), MAT.hair, 0, 0.05, -0.132, head);
      for (const s of [-1, 1]) add(box(0.04, 0.01, 0.01), MAT.hair, s * 0.045, 0.14, -0.13, head, 0, 0, s * 0.25);
      add(box(0.026, 0.015, 0.01), L(0xb3301c), 0.06, 0.09, -0.12, head);
      break;
    case 'goggles':
      add(cylY(0.13, 0.13, 0.035, 16, true), MAT.rubber, 0, 0.14, 0, head);
      for (const s of [-1, 1]) add(cylZ(0.032, 0.032, 0.03, 12), glass, s * 0.045, 0.14, -0.12, head);
      break;
    case 'beard':
      add(rbox(0.16, 0.1, 0.08, 0.03), MAT.hair, 0, 0.03, -0.08, head);
      add(box(0.09, 0.015, 0.02), MAT.hair, 0, 0.085, -0.12, head);
      break;
  }

  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.27, 0.45, 0);
    torso.add(sh);
    add(sphere(0.09, 12, 10), T.cloth, 0, 0, 0, sh);
    add(capsule(0.072, 0.17), T.cloth, 0, -0.14, 0, sh);
    if (s < 0) add(cylY(0.066, 0.066, 0.05, 12), A, 0, -0.1, 0, sh);
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    sh.add(elbow);
    add(capsule(0.064, 0.17), T.cloth, 0, -0.12, 0, elbow);
    if (look.body === 'robe') add(cylY(0.06, 0.13, 0.2, 10, true), T.clothSide, 0, -0.14, 0, elbow);
    add(rbox(0.095, 0.11, 0.1, 0.03), MAT.glove, 0, -0.29, 0, elbow);
    return { sh, elbow };
  });

  const gunMount = new THREE.Group();
  gunMount.position.set(0.08, 0.38, -0.3);
  torso.add(gunMount);

  return { root, hips, legs, torso, head, arms, gunMount };
}

// ── 1인칭 팔 + 총 ─────────────────────────────────
const UP = new THREE.Vector3(0, 1, 0);
export function buildViewmodel(gunId, skinId, team) {
  const g = new THREE.Group();
  g.add(buildGun(gunId, skinId));
  const T = teamMats(team);
  const [grip, support] = GRIPS[gunId] || GRIPS.rifle;
  const limb = (from, to, r, mat) => {
    const len = from.distanceTo(to);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    m.position.copy(from).lerp(to, 0.5);
    m.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    g.add(m);
  };
  const hand = (p) => {
    const m = new THREE.Mesh(rbox(0.07, 0.08, 0.1, 0.022), MAT.glove);
    m.position.set(p[0], p[1] - 0.02, p[2]);
    g.add(m);
  };
  const G = new THREE.Vector3(...grip), S = new THREE.Vector3(...support);
  limb(new THREE.Vector3(0.2, -0.34, 0.72), G.clone().add(new THREE.Vector3(0.01, -0.02, 0.05)), 0.05, T.cloth);
  limb(new THREE.Vector3(-0.3, -0.36, 0.42), S.clone().add(new THREE.Vector3(-0.02, -0.03, 0.04)), 0.047, T.cloth);
  hand(grip);
  hand(support);
  return g;
}

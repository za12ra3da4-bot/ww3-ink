// 병사 모델 + 애니메이션 + 스냅샷 보간
import * as THREE from 'three';
import { WEAPONS, PLAYER } from '../shared/config.js';
import { nameTexture } from './assets.js';

const WEAPON_IDS = Object.keys(WEAPONS);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const L = (color) => new THREE.MeshLambertMaterial({ color });
  MATS = {
    team: [
      { cloth: L(0x2e2c29), vest: L(0x4a4843), helmet: L(0x1c1b19) },
      { cloth: L(0xbc341f), vest: L(0x8a2615), helmet: L(0x5c1a10) },
    ],
    skin: L(0xd9cfbe),
    boot: L(0x1a1917),
    metal: L(0x262523),
    wood: L(0x6b6259),
  };
  return MATS;
}

// 무기 모델 (총구가 -z). 1인칭 뷰모델과 3인칭이 같이 쓴다.
export function buildGun(id) {
  const M = mats();
  const g = new THREE.Group();
  const part = (w, h, d, x, y, z, m = M.metal) => {
    const mesh = new THREE.Mesh(box(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  switch (id) {
    case 'smg':
      part(0.07, 0.1, 0.36, 0, 0, 0); part(0.04, 0.22, 0.05, 0, -0.14, -0.06); part(0.03, 0.03, 0.14, 0, 0.01, -0.25);
      part(0.04, 0.09, 0.05, 0, -0.08, 0.08); part(0.03, 0.06, 0.18, 0, 0, 0.26);
      break;
    case 'sniper':
      part(0.07, 0.09, 0.62, 0, 0, 0, M.wood); part(0.025, 0.025, 0.5, 0, 0.02, -0.55); part(0.05, 0.05, 0.26, 0, 0.09, -0.05);
      part(0.04, 0.08, 0.05, 0, -0.08, 0.05); part(0.06, 0.12, 0.2, 0, -0.02, 0.36, M.wood);
      break;
    case 'shotgun':
      part(0.07, 0.09, 0.42, 0, 0, 0); part(0.035, 0.035, 0.46, 0, 0.02, -0.42); part(0.05, 0.05, 0.18, 0, -0.04, -0.3, M.wood);
      part(0.06, 0.12, 0.24, 0, -0.03, 0.32, M.wood);
      break;
    case 'pistol':
      part(0.04, 0.05, 0.2, 0, 0, -0.02); part(0.035, 0.11, 0.05, 0, -0.07, 0.05);
      break;
    case 'rocket': {
      part(0.13, 0.13, 1.0, 0, 0.02, 0);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 8), M.metal);
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(0, 0.02, -0.62);
      g.add(cone);
      part(0.04, 0.1, 0.05, 0, -0.1, 0.05); part(0.05, 0.06, 0.06, 0, 0.12, -0.1);
      break;
    }
    default: // rifle
      part(0.07, 0.1, 0.5, 0, 0, 0); part(0.03, 0.03, 0.3, 0, 0.015, -0.4); part(0.05, 0.16, 0.07, 0, -0.12, -0.08);
      part(0.04, 0.09, 0.05, 0, -0.09, 0.1); part(0.06, 0.11, 0.2, 0, -0.01, 0.34); part(0.02, 0.05, 0.02, 0, 0.07, -0.2);
  }
  return g;
}

export class Soldier {
  constructor(scene, info) {
    this.scene = scene;
    this.nid = info.nid;
    this.buf = [];
    this.phase = 0;
    this.deadT = 0;
    this.state = { x: 0, y: 0, z: 0, crouch: false, alive: false, yaw: 0, pitch: 0, flags: 0, hp: 0 };
    this.root = new THREE.Group();
    this.build();
    this.setInfo(info);
    scene.add(this.root);
  }

  build() {
    const M = mats();
    const mesh = (geo, mat, x, y, z, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const r = this.root;
    this.hips = new THREE.Group();
    this.hips.position.y = 0.95;
    r.add(this.hips);

    this.legs = [-1, 1].map((s) => {
      const thigh = new THREE.Group();
      thigh.position.set(s * 0.12, 0, 0);
      this.hips.add(thigh);
      const th = mesh(box(0.18, 0.46, 0.2), null, 0, -0.23, 0, thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      thigh.add(knee);
      const sh = mesh(box(0.16, 0.44, 0.18), null, 0, -0.22, 0, knee);
      mesh(box(0.17, 0.1, 0.28), M.boot, 0, -0.45, -0.04, knee);
      return { thigh, knee, parts: [th, sh] };
    });

    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    this.chest = mesh(box(0.46, 0.56, 0.26), null, 0, 0.3, 0, this.torso);
    this.vest = mesh(box(0.5, 0.36, 0.32), null, 0, 0.33, 0, this.torso);
    this.head = new THREE.Group();
    this.head.position.y = 0.64;
    this.torso.add(this.head);
    mesh(box(0.24, 0.26, 0.24), M.skin, 0, 0.13, 0, this.head);
    this.helmet = mesh(box(0.31, 0.15, 0.33), null, 0, 0.29, 0.01, this.head);

    this.arms = [-1, 1].map((s) => {
      const sh = new THREE.Group();
      sh.position.set(s * 0.3, 0.52, 0);
      this.torso.add(sh);
      const up = mesh(box(0.13, 0.32, 0.13), null, 0, -0.15, 0, sh);
      const fore = mesh(box(0.12, 0.3, 0.12), null, 0, -0.44, 0, sh);
      return { sh, parts: [up, fore] };
    });

    this.gunMount = new THREE.Group();
    this.gunMount.position.set(0.1, 0.38, -0.32);
    this.torso.add(this.gunMount);

    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.tag.scale.set(1.9, 0.36, 1);
    this.tag.position.y = 2.25;
    this.tag.renderOrder = 6;
    r.add(this.tag);
  }

  setInfo(info) {
    const M = mats();
    if (info.team !== this.team) {
      this.team = info.team;
      const T = M.team[info.team];
      for (const leg of this.legs) leg.parts.forEach((p) => (p.material = T.cloth));
      for (const arm of this.arms) arm.parts.forEach((p) => (p.material = T.cloth));
      this.chest.material = T.cloth;
      this.vest.material = T.vest;
      this.helmet.material = T.helmet;
      this.name = null;
    }
    if (info.name !== this.name) {
      this.name = info.name;
      if (this.tag.material.map) this.tag.material.map.dispose();
      this.tag.material.map = nameTexture(info.name, info.team ? '#b3301c' : '#151412');
      this.tag.material.needsUpdate = true;
    }
  }

  setWeapon(id) {
    if (id === this.weapon) return;
    this.weapon = id;
    this.gunMount.clear();
    const gun = buildGun(id);
    gun.traverse((o) => { o.castShadow = true; });
    this.gunMount.add(gun);
  }

  push(t, e) {
    this.buf.push({ t, x: e[1], y: e[2], z: e[3], yaw: e[4], pitch: e[5], flags: e[6], hp: e[7], w: e[8] });
    if (this.buf.length > 30) this.buf.shift();
  }

  sample(rt) {
    const b = this.buf;
    if (!b.length) return null;
    if (rt <= b[0].t) return b[0];
    for (let i = b.length - 1; i >= 0; i--) {
      if (b[i].t <= rt) {
        const a = b[i], c = b[i + 1];
        if (!c) return a;
        if ((a.flags & 1) !== (c.flags & 1) || Math.hypot(c.x - a.x, c.z - a.z) > 6) return a; // 부활 순간이동은 보간하지 않음
        const k = (rt - a.t) / Math.max(1e-3, c.t - a.t);
        return {
          x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k,
          yaw: a.yaw + wrap(c.yaw - a.yaw) * k, pitch: a.pitch + (c.pitch - a.pitch) * k,
          flags: c.flags, hp: c.hp, w: c.w,
        };
      }
    }
    return b[0];
  }

  update(rt, dt, time) {
    const s = this.sample(rt);
    if (!s) { this.root.visible = false; return this.state; }
    const st = this.state;
    const alive = !!(s.flags & 1), crouch = !!(s.flags & 2), moving = !!(s.flags & 4), sprint = !!(s.flags & 8);
    const spd = Math.hypot(s.x - st.x, s.z - st.z) / Math.max(dt, 1e-3);
    Object.assign(st, { x: s.x, y: s.y, z: s.z, crouch, alive, yaw: s.yaw, pitch: s.pitch, flags: s.flags, hp: s.hp });
    this.setWeapon(WEAPON_IDS[s.w] || 'rifle');

    this.root.position.set(s.x, s.y, s.z);
    this.root.rotation.y = s.yaw;
    const k = Math.min(1, dt * 12);

    if (!alive) {
      this.deadT += dt;
      this.root.rotation.x = -Math.min(1, this.deadT * 3.2) * 1.45;
      this.root.visible = this.deadT < 3.5;
      this.tag.visible = false;
      return st;
    }
    this.deadT = 0;
    this.root.rotation.x = 0;
    this.root.visible = !(s.flags & 128) || Math.floor(time * 12) % 2 === 0;

    if (moving) this.phase += dt * Math.min(spd, 9) * 1.7;
    const swing = moving ? Math.sin(this.phase) * (sprint ? 0.95 : 0.6) : 0;
    this.hips.position.y += ((crouch ? 0.62 : 0.95) - this.hips.position.y) * k;
    this.legs.forEach((leg, i) => {
      const sw = i ? swing : -swing;
      leg.thigh.rotation.x += ((crouch ? -1.25 : 0) + sw - leg.thigh.rotation.x) * k;
      leg.knee.rotation.x += ((crouch ? 1.9 : Math.max(0, sw) * 1.2) - leg.knee.rotation.x) * k;
    });
    const lean = crouch ? 0.2 : sprint ? 0.3 : 0.05;
    this.torso.rotation.x += (lean - this.torso.rotation.x) * k;
    this.head.rotation.x = s.pitch * 0.6 - lean;
    const aim = sprint ? -0.5 : -1.35 + s.pitch * 0.7;
    this.arms[0].sh.rotation.set(aim, 0.5, 0);
    this.arms[1].sh.rotation.set(aim, -0.25, 0);
    this.gunMount.rotation.x = sprint ? -0.7 : s.pitch * 0.7;
    this.gunMount.position.y = sprint ? 0.25 : 0.38;
    return st;
  }

  dispose() {
    this.scene.remove(this.root);
    if (this.tag.material.map) this.tag.material.map.dispose();
    this.tag.material.dispose();
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

export const eyeHeight = (crouch) => (crouch ? PLAYER.crouchEye : PLAYER.eye);

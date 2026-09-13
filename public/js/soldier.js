// 다른 병사 — 생김새·스킨 반영 모델 + 애니메이션 + 스냅샷 보간
import * as THREE from 'three';
import { WEAPON_IDS, PLAYER, TEAMS } from '../shared/config.js';
import { nameTexture } from './assets.js';
import { buildSoldier, buildGun } from './models.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Soldier {
  constructor(scene, info) {
    this.scene = scene;
    this.nid = info.nid;
    this.buf = [];
    this.phase = 0;
    this.deadT = 0;
    this.state = { x: 0, y: 0, z: 0, crouch: false, alive: false, yaw: 0, pitch: 0, flags: 0, hp: 0 };
    this.root = new THREE.Group();
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.tag.scale.set(1.9, 0.36, 1);
    this.tag.position.y = 2.3;
    this.tag.renderOrder = 6;
    this.root.add(this.tag);
    this.setInfo(info);
    scene.add(this.root);
  }

  setInfo(info) {
    const lookKey = `${info.team}|${JSON.stringify(info.look || {})}`;
    if (lookKey !== this.lookKey) {
      this.lookKey = lookKey;
      if (this.rig) this.root.remove(this.rig.root);
      this.rig = buildSoldier(info.look, info.team);
      this.root.add(this.rig.root);
      this.gunKey = null;
    }
    this.team = info.team;
    this.skins = info.sk || {};
    if (this.weapon) this.setWeapon(this.weapon);
    const nameKey = `${info.name}|${info.team}`;
    if (nameKey !== this.nameKey) {
      this.nameKey = nameKey;
      if (this.tag.material.map) this.tag.material.map.dispose();
      this.tag.material.map = nameTexture(info.name, TEAMS[info.team].css);
      this.tag.material.needsUpdate = true;
    }
  }

  setWeapon(id) {
    this.weapon = id;
    const key = `${id}|${this.skins[id] || ''}`;
    if (key === this.gunKey) return;
    this.gunKey = key;
    this.rig.gunMount.clear();
    this.rig.gunMount.add(buildGun(id, this.skins[id]));
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
        if ((a.flags & 1) !== (c.flags & 1) || Math.hypot(c.x - a.x, c.z - a.z) > 6) return a;
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
    const st = this.state, R = this.rig;
    const alive = !!(s.flags & 1), crouch = !!(s.flags & 2), moving = !!(s.flags & 4), sprint = !!(s.flags & 8), reloading = !!(s.flags & 64);
    const spd = Math.hypot(s.x - st.x, s.z - st.z) / Math.max(dt, 1e-3);
    Object.assign(st, { x: s.x, y: s.y, z: s.z, crouch, alive, yaw: s.yaw, pitch: s.pitch, flags: s.flags, hp: s.hp });
    this.setWeapon(WEAPON_IDS[s.w] || 'rifle');

    this.root.position.set(s.x, s.y, s.z);
    this.root.rotation.y = s.yaw;
    const k = Math.min(1, dt * 12);

    if (!alive) {
      this.deadT += dt;
      R.root.rotation.x = Math.min(1, this.deadT * 3.2) * 1.45;
      R.root.position.y = Math.min(1, this.deadT * 3.2) * 0.15;
      this.root.visible = this.deadT < 3.5;
      this.tag.visible = false;
      return st;
    }
    this.deadT = 0;
    R.root.rotation.x = 0;
    R.root.position.y = 0;
    this.root.visible = !(s.flags & 128) || Math.floor(time * 12) % 2 === 0;

    if (moving) this.phase += dt * Math.min(spd, 9) * 1.7;
    const swing = moving ? Math.sin(this.phase) * (sprint ? 0.9 : 0.55) : 0;
    R.hips.position.y += ((crouch ? 0.6 : 0.95) - R.hips.position.y) * k;
    R.legs.forEach((leg, i) => {
      const sw = i ? swing : -swing;
      leg.thigh.rotation.x += ((crouch ? 1.3 : 0) + sw - leg.thigh.rotation.x) * k;
      leg.knee.rotation.x += ((crouch ? -2.0 : -Math.max(0, -sw) * 1.1) - leg.knee.rotation.x) * k;
    });
    const lean = crouch ? 0.22 : sprint ? 0.28 : 0.06;
    R.torso.rotation.x += (-lean - R.torso.rotation.x) * k;
    R.head.rotation.x = s.pitch * 0.6 + lean;
    const raise = sprint ? 0.55 : 1.35 + s.pitch * 0.7 - (reloading ? 0.4 : 0);
    R.arms[1].sh.rotation.set(raise, -0.12, 0);
    R.arms[1].elbow.rotation.x = sprint ? 1.1 : 0.25;
    R.arms[0].sh.rotation.set(raise + 0.1, 0.55, 0);
    R.arms[0].elbow.rotation.x = sprint ? 1.2 : 0.5;
    R.gunMount.rotation.x = sprint ? -0.8 : s.pitch * 0.7 - (reloading ? 0.5 : 0);
    R.gunMount.position.y = sprint ? 0.24 : 0.38;
    return st;
  }

  dispose() {
    this.scene.remove(this.root);
    if (this.tag.material.map) this.tag.material.map.dispose();
    this.tag.material.dispose();
  }
}

export const eyeHeight = (crouch) => (crouch ? PLAYER.crouchEye : PLAYER.eye);

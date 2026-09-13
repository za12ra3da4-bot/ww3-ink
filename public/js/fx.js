// 먹 효과 — 붓질 예광탄, 먹물 튐, 피(주홍), 먹 번짐 폭발, 탄흔, 투사체
import * as THREE from 'three';
import { tex } from './assets.js';

const V = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.decals = [];
    this.projs = new Map();
    this.shake = 0;
    this.tracerGeo = new THREE.PlaneGeometry(1, 1);
    this.decalGeo = new THREE.PlaneGeometry(1, 1);
    this.splat = (i, color, opacity) => new THREE.MeshBasicMaterial({
      map: tex[`splat${i}`], color, transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.inkDecal = [0, 1, 2, 3].map((i) => this.splat(i, 0x121110, 0.85));
    this.redDecal = [0, 1, 2, 3].map((i) => this.splat(i, 0xb8331e, 0.9));
    this.grenadeGeo = new THREE.SphereGeometry(0.09, 8, 6);
    this.rocketGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8).rotateX(Math.PI / 2);
    this.projMat = new THREE.MeshLambertMaterial({ color: 0x1c1b19 });
  }

  sprite(map, color, opacity, pos, scale, life, opts = {}) {
    if (this.parts.length > 500) this.kill(0);
    const mat = new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, rotation: Math.random() * 6.28 });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.setScalar(scale);
    this.scene.add(s);
    this.parts.push({ obj: s, mat, age: 0, life, o0: opacity, s0: scale, s1: opts.grow ?? scale, vel: opts.vel || null, grav: opts.grav || 0, drag: opts.drag ?? 1 });
    return s;
  }

  kill(i) {
    const p = this.parts[i];
    this.scene.remove(p.obj);
    p.mat.dispose();
    this.parts.splice(i, 1);
  }

  decal(point, normal, big, red) {
    const mats = red ? this.redDecal : this.inkDecal;
    const m = new THREE.Mesh(this.decalGeo, mats[Math.floor(Math.random() * 4)]);
    m.position.set(point[0] + normal[0] * 0.02, point[1] + normal[1] * 0.02, point[2] + normal[2] * 0.02);
    V.set(point[0] + normal[0], point[1] + normal[1], point[2] + normal[2]);
    m.lookAt(V);
    m.rotateZ(Math.random() * 6.28);
    m.scale.setScalar(big);
    this.scene.add(m);
    this.decals.push(m);
    if (this.decals.length > 160) this.scene.remove(this.decals.shift());
  }

  // 붓 한 획 같은 예광탄
  tracer(from, to, camPos, color = 0x141312) {
    const dir = V.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const len = dir.length();
    if (len < 0.5) return;
    const mat = new THREE.MeshBasicMaterial({ map: tex.stroke, color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.tracerGeo, mat);
    const start = Math.min(len * 0.15, 1.2);
    const a = new THREE.Vector3(...from).addScaledVector(dir.clone().normalize(), start);
    const b = new THREE.Vector3(...to);
    m.position.copy(a).lerp(b, 0.5);
    const xAxis = b.clone().sub(a).normalize();
    const toCam = camPos.clone().sub(m.position).normalize();
    const yAxis = new THREE.Vector3().crossVectors(toCam, xAxis).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    m.scale.set(a.distanceTo(b), 0.09, 1);
    this.scene.add(m);
    this.parts.push({ obj: m, mat, age: 0, life: 0.14, o0: 0.85, s0: 1, s1: 1, keepScale: true });
  }

  muzzle(pos) {
    this.sprite(tex.smoke, 0x161514, 0.9, pos, 0.35, 0.07, { grow: 0.6 });
    this.sprite(tex.smoke, 0x6b6660, 0.35, pos, 0.3, 0.6, { grow: 1.1, vel: new THREE.Vector3(0, 0.5, 0) });
  }

  impact(point, normal) {
    const p = new THREE.Vector3(...point);
    this.sprite(tex.smoke, 0x4a4640, 0.6, p, 0.3, 0.45, { grow: 1.0, vel: new THREE.Vector3(normal[0], normal[1] + 0.4, normal[2]).multiplyScalar(0.8) });
    for (let i = 0; i < 3; i++) {
      const v = new THREE.Vector3(normal[0] + rand(-0.8, 0.8), normal[1] + rand(0, 1), normal[2] + rand(-0.8, 0.8)).multiplyScalar(rand(2, 4));
      this.sprite(tex[`splat${i}`], 0x121110, 1, p, 0.08, 0.35, { vel: v, grav: 12 });
    }
    this.decal(point, normal, rand(0.18, 0.32), false);
  }

  puff(point) {
    this.sprite(tex.smoke, 0x4a4640, 0.5, new THREE.Vector3(...point), 0.25, 0.4, { grow: 0.8, vel: new THREE.Vector3(0, 0.6, 0) });
  }

  blood(point, dir, heavy) {
    const p = new THREE.Vector3(...point);
    const n = heavy ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(dir[0] + rand(-0.6, 0.6), rand(0, 0.9), dir[2] + rand(-0.6, 0.6)).multiplyScalar(rand(1.5, 4.5));
      this.sprite(tex[`splat${i % 4}`], 0xb8331e, 1, p, rand(0.12, heavy ? 0.4 : 0.25), rand(0.4, 0.7), { vel: v, grav: 14 });
    }
    this.sprite(tex.smoke, 0xa12c1a, 0.7, p, 0.4, 0.35, { grow: 1.1 });
  }

  // 먹이 물에 퍼지듯 번지는 폭발
  explosion(point, size = 1) {
    const p = new THREE.Vector3(...point);
    p.y = Math.max(p.y, 0.3);
    for (let i = 0; i < 9; i++) {
      const off = new THREE.Vector3(rand(-1, 1), rand(0, 1.2), rand(-1, 1)).multiplyScalar(size);
      this.sprite(tex.smoke, i < 5 ? 0x0d0c0b : 0x3b3833, 0.95, p.clone().add(off), rand(1.5, 2.5) * size, rand(1.2, 2.2), {
        grow: rand(6, 9) * size, vel: off.clone().multiplyScalar(1.2).add(new THREE.Vector3(0, 1.4, 0)), drag: 0.97,
      });
    }
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(0.3, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(8, 18) * size);
      this.sprite(tex[`splat${i % 4}`], i % 3 ? 0x121110 : 0xb8331e, 1, p, rand(0.15, 0.4) * size, rand(0.7, 1.3), { vel: v, grav: 18 });
    }
    this.sprite(tex.smoke, 0xb8331e, 0.9, p, 2 * size, 0.25, { grow: 6 * size });
    this.decal([point[0], 0.02, point[2]], [0, 1, 0], rand(4, 6) * size, false);
    return p;
  }

  nuke(point) {
    const p = new THREE.Vector3(point[0], 0, point[2]);
    for (let i = 0; i < 40; i++) {
      const h = (i / 40) * 60;
      const cap = h > 40;
      const off = new THREE.Vector3(rand(-1, 1) * (cap ? 20 : 5), h, rand(-1, 1) * (cap ? 20 : 5));
      this.sprite(tex.smoke, i % 5 ? 0x121110 : 0xb8331e, 0.95, p.clone().add(off), rand(8, 14), rand(6, 9), { grow: rand(30, 45), vel: new THREE.Vector3(0, 3, 0), drag: 0.99 });
    }
  }

  projectile(id, kind) {
    let m = this.projs.get(id);
    if (!m) {
      m = new THREE.Mesh(kind === 1 ? this.rocketGeo : this.grenadeGeo, this.projMat);
      m.userData = { kind, trailAt: 0 };
      this.scene.add(m);
      this.projs.set(id, m);
    }
    return m;
  }

  syncProjectiles(list, time) {
    const seen = new Set();
    for (const [id, kind, x, y, z] of list) {
      seen.add(id);
      const m = this.projectile(id, kind);
      if (kind === 1) {
        V.set(x - m.position.x, y - m.position.y, z - m.position.z);
        if (V.lengthSq() > 1e-4) m.lookAt(x + V.x, y + V.y, z + V.z);
        if (time - m.userData.trailAt > 0.03) {
          m.userData.trailAt = time;
          this.sprite(tex.smoke, 0x55514b, 0.55, new THREE.Vector3(x, y, z), 0.4, 1.0, { grow: 1.6 });
        }
      }
      m.position.set(x, y, z);
    }
    for (const [id, m] of this.projs) {
      if (seen.has(id)) continue;
      this.scene.remove(m);
      this.projs.delete(id);
    }
  }

  clear() {
    while (this.parts.length) this.kill(this.parts.length - 1);
    for (const d of this.decals) this.scene.remove(d);
    this.decals = [];
    for (const m of this.projs.values()) this.scene.remove(m);
    this.projs.clear();
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { this.kill(i); continue; }
      if (p.vel) {
        p.vel.y -= p.grav * dt;
        if (p.drag !== 1) p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
        p.obj.position.addScaledVector(p.vel, dt);
        if (p.grav && p.obj.position.y < 0.05) { p.obj.position.y = 0.05; p.vel.set(0, 0, 0); }
      }
      if (!p.keepScale) p.obj.scale.setScalar(p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - k, 2.2)));
      p.mat.opacity = p.o0 * (1 - k * k);
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
}

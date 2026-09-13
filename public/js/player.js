// 내 병사 — 입력, 이동 물리, 사격 판정, 1인칭 무기 모델(스킨)
import * as THREE from 'three';
import { PLAYER, WEAPONS, CLASSES, STREAKS, SKINS, TEAMS, SLOT_KEYS, defaultSkin } from '../shared/config.js';
import { moveBody, rayPlayer } from '../shared/physics.js';
import { buildViewmodel, GUN_MUZZLE } from './models.js';

const CLS = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
const r2 = (v) => Math.round(v * 100) / 100;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const VM_SCALE = 0.62;

export class LocalPlayer {
  constructor(game) {
    this.g = game;
    this.b = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true, radius: PLAYER.radius, height: PLAYER.height };
    this.yaw = 0;
    this.pitch = 0;
    this.kick = 0;
    this.alive = false;
    this.life = 0;
    this.cls = 'rifleman';
    this.keys = new Set();
    this.lmb = false;
    this.rmb = false;
    this.inv = null;
    this.slot = 'primary';
    this.eyeY = PLAYER.eye;
    this.bobT = 0;
    this.bloom = 0;
    this.sendAt = 0;
    this.nextFire = 0;
    this.reloadUntil = 0;
    this.switchUntil = 0;
    this.nextThrow = 0;
    this.grenades = 0;
    this.rewards = [];
    this.semiReady = true;
    this.fov = 75;
    this.vm = new THREE.Group();
    this.vmPos = new THREE.Vector3(0.2, -0.2, -0.6);
    game.camera.add(this.vm);
    this.bind();
  }

  get cur() { return this.inv && this.inv[this.slot]; }
  get weapon() { return this.cur ? WEAPONS[this.cur.id] : WEAPONS.rifle; }
  get control() { return this.g.active && !this.g.chatOpen && this.alive && this.g.state === 'playing'; }
  get reloading() { return this.reloadUntil > 0; }
  get ads() { return this.control && this.rmb && !this.reloading && !this.sprinting && this.g.time > this.switchUntil; }
  get baseFov() { return this.g.settings.fov || 75; }
  skinOf(id) { return this.g.skinFor(id); }

  bind() {
    const onKey = (e, down) => {
      if (this.g.chatOpen) return;
      if (down) this.keys.add(e.code); else this.keys.delete(e.code);
      if (!down || !this.control) return;
      if (e.code === 'KeyR') this.startReload();
      else if (e.code === 'Digit1') this.switchTo('primary');
      else if (e.code === 'Digit2') this.switchTo('secondary');
      else if (e.code === 'Digit3') this.switchTo('launcher');
      else if (e.code === 'KeyG') this.throwGrenade();
      else if (e.code === 'Digit4' || e.code === 'Digit5' || e.code === 'Digit6') this.useStreak(STREAKS[+e.code.slice(5) - 4]);
      else if (e.code === 'KeyQ' && this.g.locked) this.switchTo(this.lastSlot || 'secondary');
    };
    document.addEventListener('keydown', (e) => onKey(e, true));
    document.addEventListener('keyup', (e) => onKey(e, false));
    document.addEventListener('mousedown', (e) => {
      if (!this.g.active || !this.alive) return;
      if (e.button === 0) this.lmb = true;
      if (e.button === 2) this.rmb = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.lmb = false; this.semiReady = true; }
      if (e.button === 2) this.rmb = false;
    });
    document.addEventListener('wheel', (e) => {
      if (!this.control || Math.abs(e.deltaY) < 20) return;
      const i = SLOT_KEYS.indexOf(this.slot), n = SLOT_KEYS.length;
      this.switchTo(SLOT_KEYS[(i + (e.deltaY > 0 ? 1 : n - 1)) % n]);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.g.locked || !this.alive || !this.g.active) return;
      const S = this.g.settings, W = this.weapon;
      const scoped = this.ads && W.scope;
      const mul = this.ads ? (scoped ? S.scopeMul : S.adsMul) : 1;
      const s = 0.0021 * S.sens * mul * (this.fov / this.baseFov);
      this.yaw -= e.movementX * s;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * s * (S.invertY ? -1 : 1)));
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { this.keys.clear(); this.lmb = this.rmb = false; });
  }

  has(...codes) { return codes.some((c) => this.keys.has(c)); }

  spawn(msg) {
    const C = CLS[msg.cls];
    Object.assign(this.b, { x: msg.x, y: msg.y, z: msg.z, vx: 0, vy: 0, vz: 0, onGround: true, height: PLAYER.height });
    this.yaw = msg.yaw;
    this.pitch = 0;
    this.kick = 0;
    this.alive = true;
    this.life = msg.life;
    this.cls = msg.cls;
    this.grenades = msg.gr;
    this.rewards = msg.rw || [];
    this.streak = msg.st || 0;
    const mk = (id, reserve = WEAPONS[id].reserve) => ({ id, mag: WEAPONS[id].mag, reserve });
    this.inv = { primary: mk(C.primary), secondary: mk(C.secondary), launcher: mk('rocket', Math.max(0, C.rockets - 1)) };
    this.slot = 'primary';
    this.reloadUntil = 0;
    this.switchUntil = this.g.time + 0.3;
    this.buildViewmodel();
    this.g.hud.weapon(this);
  }

  die() {
    this.alive = false;
    this.lmb = this.rmb = false;
    this.vm.visible = false;
  }

  buildViewmodel() {
    for (const o of this.vm.children) {
      o.traverse((m) => { if (m.isMesh && m.geometry.type === 'CapsuleGeometry') m.geometry.dispose(); });
    }
    this.vm.clear();
    if (!this.cur) return;
    const id = this.cur.id;
    const model = buildViewmodel(id, this.skinOf(id), this.g.me.team);
    model.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.vm.add(model);
    this.vm.scale.setScalar(VM_SCALE);
    this.muzzleZ = GUN_MUZZLE[id];
    this.vm.visible = this.alive;
    this.vmKey = `${id}|${this.skinOf(id)}|${this.g.me.team}`;
  }

  refreshSkin() {
    if (!this.cur) return;
    const key = `${this.cur.id}|${this.skinOf(this.cur.id)}|${this.g.me.team}`;
    if (key !== this.vmKey) this.buildViewmodel();
  }

  switchTo(slot) {
    if (slot === this.slot || !this.inv || !this.inv[slot]) return;
    this.lastSlot = this.slot;
    this.slot = slot;
    this.reloadUntil = 0;
    this.switchUntil = this.g.time + 0.4;
    this.buildViewmodel();
    this.g.sound.play('click');
    this.g.hud.weapon(this);
  }

  startReload() {
    const c = this.cur, W = this.weapon;
    if (!c || this.reloading || c.mag >= W.mag || c.reserve <= 0) return;
    this.reloadUntil = this.g.time + W.reload;
    this.g.sound.play('reload');
    this.g.hud.weapon(this);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(0, 0, -1).applyQuaternion(this.g.camera.quaternion);
  }

  muzzleWorld() {
    this.vm.updateMatrixWorld(true);
    return new THREE.Vector3(0, 0.02, this.muzzleZ || -0.5).applyMatrix4(this.vm.matrixWorld);
  }

  throwGrenade() {
    const g = this.g;
    if (this.grenades <= 0 || g.time < this.nextThrow) return;
    this.grenades--;
    this.nextThrow = g.time + 0.9;
    const cam = g.camera.position, f = this.forward();
    f.y += 0.12;
    f.normalize();
    g.socket.emit('throw', { k: 'grenade', o: [r2(cam.x + f.x * 0.5), r2(cam.y + f.y * 0.5), r2(cam.z + f.z * 0.5)], d: [f.x, f.y, f.z].map(r2) });
    g.sound.play('throw');
    this.switchUntil = g.time + 0.5;
    g.hud.weapon(this);
  }

  useStreak(s) {
    const g = this.g;
    if (!s) return;
    if (!this.rewards.includes(s.id)) {
      g.hud.announce(`${s.name} 아직 사용 불가`, `연속 ${s.kills}킬 필요 (지금 ${this.streak || 0}킬)`);
      return;
    }
    const msg = { id: s.id };
    if (s.id === 'artillery') {
      const cam = g.camera.position, f = this.forward();
      const hit = g.world.raycast(cam.x, cam.y, cam.z, f.x, f.y, f.z, 300);
      if (!hit) { g.hud.announce('포격 지점을 땅에 조준하세요', '', 'red'); return; }
      msg.p = [r2(hit.x), r2(hit.y), r2(hit.z)];
    }
    this.rewards.splice(this.rewards.indexOf(s.id), 1);
    g.socket.emit('streak', msg);
    g.hud.streaks(this);
  }

  tracerColor(id) {
    const s = SKINS[this.skinOf(id)];
    if (s && s.tracer) return new THREE.Color(s.tracer).getHex();
    return this.g.me.team ? TEAMS[1].hex : 0x141312;
  }

  fire() {
    const g = this.g, W = this.weapon, c = this.cur;
    if (c.mag <= 0) {
      g.sound.play('dry');
      this.nextFire = g.time + 0.3;
      this.startReload();
      return;
    }
    c.mag--;
    this.nextFire = g.time + 60 / W.rpm;
    if (!W.auto) this.semiReady = false;
    const cam = g.camera.position;
    const f = this.forward();
    const muzzle = this.muzzleWorld();
    const skin = SKINS[this.skinOf(W.id)] || SKINS[defaultSkin(W.id)];
    g.fx.muzzle(muzzle);
    g.sound.gun(W.id, skin.sound);
    this.kick += W.recoil * (this.ads ? 0.5 : 1);
    this.pitch = Math.min(1.5, this.pitch + W.recoil * 0.3);
    this.yaw += gauss() * W.recoil * 0.25;
    this.bloom = Math.min(0.05, this.bloom + W.recoil * 0.35);

    if (W.projectile) {
      g.socket.emit('throw', { k: 'rocket', o: [r2(cam.x + f.x * 0.7), r2(cam.y + f.y * 0.7 - 0.05), r2(cam.z + f.z * 0.7)], d: [f.x, f.y, f.z].map(r2) });
      g.fx.shake = Math.max(g.fx.shake, 0.25);
      if (c.mag <= 0) setTimeout(() => this.startReload(), 250);
      g.hud.weapon(this);
      return;
    }

    const moving = Math.hypot(this.b.vx, this.b.vz) > 1;
    const spread = ((this.ads ? W.spreadAds : W.spreadHip) + this.bloom) * (moving ? 1.6 : 1) * (this.crouch ? 0.7 : 1) * (this.b.onGround ? 1 : 2.5);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(g.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(g.camera.quaternion);
    const ends = [], hits = [];
    const color = this.tracerColor(W.id);
    let hitAny = false;
    for (let p = 0; p < W.pellets; p++) {
      const d = f.clone().addScaledVector(right, gauss() * spread).addScaledVector(up, gauss() * spread).normalize();
      const wh = g.world.raycast(cam.x, cam.y, cam.z, d.x, d.y, d.z, W.range);
      let best = wh ? wh.t : W.range, target = null, head = false;
      for (const s of g.soldiers.values()) {
        if (!s.state.alive || s.team === g.me.team) continue;
        const r = rayPlayer(cam.x, cam.y, cam.z, d.x, d.y, d.z, best, s.state);
        if (r) { best = r.t; target = s; head = r.head; }
      }
      const end = [cam.x + d.x * best, cam.y + d.y * best, cam.z + d.z * best];
      ends.push(end.map(r2));
      if (target) {
        hits.push([target.nid, head ? 1 : 0]);
        g.fx.blood(end, [d.x, d.y, d.z], head);
        hitAny = true;
      } else if (wh) {
        g.fx.impact(end, wh.n);
      }
      if (p < 3 && (W.pellets > 1 || skin.tracer || Math.random() < (W.id === 'sniper' ? 1 : 0.5))) g.fx.tracer([muzzle.x, muzzle.y, muzzle.z], end, cam, color);
    }
    g.socket.emit('fire', { w: W.id, o: [r2(cam.x), r2(cam.y), r2(cam.z)], e: ends, h: hitAny ? hits : [] });
    if (c.mag <= 0) setTimeout(() => this.startReload(), 200);
    g.hud.weapon(this);
  }

  update(dt) {
    const g = this.g, cam = g.camera, b = this.b, t = g.time;
    if (!this.alive) {
      this.vm.visible = false;
      return;
    }
    const ctl = this.control, W = this.weapon, C = CLS[this.cls];

    if (this.reloading && t >= this.reloadUntil) {
      const c = this.cur, take = Math.min(W.mag - c.mag, c.reserve);
      c.mag += take;
      c.reserve -= take;
      this.reloadUntil = 0;
      g.hud.weapon(this);
    }

    // 이동
    const fwd = ctl ? (this.has('KeyW', 'ArrowUp') ? 1 : 0) - (this.has('KeyS', 'ArrowDown') ? 1 : 0) : 0;
    const side = ctl ? (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0) : 0;
    let crouch = ctl && this.has('KeyC', 'KeyZ', 'ControlLeft');
    if (!crouch && this.crouch && !g.world.bodyFits(b.x, b.y, b.z, b.radius, PLAYER.height)) crouch = true;
    this.crouch = crouch;
    b.height = crouch ? PLAYER.crouchHeight : PLAYER.height;
    this.sprinting = ctl && this.has('ShiftLeft', 'ShiftRight') && fwd > 0 && !crouch && !this.rmb && !this.lmb;
    const speed = (crouch ? PLAYER.crouchSpeed : this.rmb && !this.sprinting ? PLAYER.adsSpeed : this.sprinting ? PLAYER.sprint : PLAYER.walk) * C.speed;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fwd + cy * side, wz = -cy * fwd - sy * side;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const k = Math.min(1, dt * (b.onGround ? 14 : 2.5));
    b.vx += (wx * speed - b.vx) * k;
    b.vz += (wz * speed - b.vz) * k;
    if (ctl && this.has('Space') && b.onGround) { b.vy = PLAYER.jump; b.onGround = false; }
    if (ctl && !g.locked) this.yaw += ((this.has('KeyQ') ? 1 : 0) - (this.has('KeyE') ? 1 : 0)) * 2.4 * dt;
    const wasAir = !b.onGround, fallV = b.vy;
    moveBody(g.world, b, Math.min(dt, 0.05));
    if (wasAir && b.onGround && fallV < -6) { g.sound.play('land'); this.kick -= 0.02; }

    // 카메라
    this.eyeY += ((crouch ? PLAYER.crouchEye : PLAYER.eye) - this.eyeY) * Math.min(1, dt * 12);
    const hs = Math.hypot(b.vx, b.vz);
    const prevBob = Math.sin(this.bobT);
    if (b.onGround && hs > 0.5) this.bobT += dt * hs * 1.35;
    if (prevBob < 0 && Math.sin(this.bobT) >= 0 && hs > 3) g.sound.play('step', null, 0.6);
    const bobY = b.onGround ? Math.abs(Math.sin(this.bobT)) * 0.035 * Math.min(1, hs / 5) : 0;
    this.kick -= this.kick * Math.min(1, dt * 9);
    cam.position.set(b.x, b.y + this.eyeY + bobY, b.z);
    cam.rotation.set(this.pitch + this.kick, this.yaw, 0, 'YXZ');
    const shake = g.fx.shake;
    if (shake > 0) { cam.rotation.x += (Math.random() - 0.5) * shake * 0.05; cam.rotation.y += (Math.random() - 0.5) * shake * 0.05; }
    const ads = this.ads;
    const targetFov = ads ? W.adsFov * (this.baseFov / 75) : this.sprinting ? this.baseFov + 6 : this.baseFov;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 14);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    this.bloom = Math.max(0, this.bloom - dt * 0.08);

    if (ctl && this.lmb && t >= this.nextFire && t >= this.switchUntil && !this.reloading && !this.sprinting && (W.auto || this.semiReady)) this.fire();

    // 1인칭 무기 자세
    const scoped = ads && W.scope && this.fov < W.adsFov * (this.baseFov / 75) + 10;
    this.vm.visible = !scoped;
    const target = ads
      ? new THREE.Vector3(0, W.id === 'pistol' ? -0.06 : W.id === 'sniper' ? -0.1 : -0.065, W.id === 'pistol' ? -0.36 : -0.42)
      : this.sprinting ? new THREE.Vector3(0.14, -0.28, -0.5) : new THREE.Vector3(0.19, -0.2, -0.56);
    if (this.reloading) target.y -= 0.1;
    if (t < this.switchUntil) target.y -= (this.switchUntil - t) * 0.6;
    this.vmPos.lerp(target, Math.min(1, dt * 16));
    const sway = hs > 0.5 ? Math.sin(this.bobT) * (ads ? 0.003 : 0.012) : 0;
    this.vm.position.set(this.vmPos.x + sway, this.vmPos.y + Math.abs(sway) * 0.6, this.vmPos.z + this.kick * 0.8);
    this.vm.rotation.set(this.kick * 2 + (this.reloading ? 0.5 : 0) + (this.sprinting ? -0.35 : 0), this.sprinting ? 0.7 : 0, this.reloading ? 0.3 : 0);

    if (t >= this.sendAt) {
      this.sendAt = t + 0.05;
      const flags = (crouch ? 2 : 0) | (hs > 0.5 ? 4 : 0) | (this.sprinting ? 8 : 0) | (ads ? 16 : 0) | (b.onGround ? 0 : 32) | (this.reloading ? 64 : 0);
      g.socket.emit('input', { l: this.life, x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: Math.round(this.yaw * 1000) / 1000, pitch: Math.round(this.pitch * 1000) / 1000, f: flags, w: this.cur.id });
    }
    g.hud.crosshair(this, ads, scoped);
    g.sound.listen(cam.position.x, cam.position.y, cam.position.z, this.yaw);
  }
}

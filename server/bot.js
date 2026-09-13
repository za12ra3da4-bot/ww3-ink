// 봇 AI — 인지 → 목표 선택 → 길찾기 이동 → 조준/사격
import { PLAYER, WEAPONS, CLASSES, DIFFICULTY, PROJECTILES } from '../public/shared/config.js';
import { moveBody } from '../public/shared/physics.js';
import { findPath, randomOpenNear } from './nav.js';
import { botFire, launch, useStreak, eyeOf } from './combat.js';

const CLS = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
const wrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const dirOf = (yaw, pitch) => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

export class BotBrain {
  constructor(room, ent) {
    this.room = room;
    this.e = ent;
    this.weapon = WEAPONS[CLS[ent.cls].primary];
    this.reset();
  }

  reset() {
    this.path = null;
    this.pathAt = -99;
    this.goal = null;
    this.target = null;
    this.visible = false;
    this.seenAt = -99;
    this.reactAt = 0;
    this.lastKnown = null;
    this.nextThink = 0;
    this.strafe = 1;
    this.strafeAt = 0;
    this.burstUntil = 0;
    this.pauseUntil = 0;
    this.nextShot = 0;
    this.reloadUntil = 0;
    this.stuckAt = 0;
    this.stuckPos = [this.e.x, this.e.z];
    this.nextGrenade = 0;
    this.lookYaw = null;
  }

  onSpawn() {
    this.reset();
    this.weapon = WEAPONS[CLS[this.e.cls].primary];
    this.mag = this.weapon.mag;
    this.nextGrenade = this.room.now + 5 + Math.random() * 8;
    this.stuckAt = this.room.now;
    this.pickGoal();
  }

  onHurt(attacker) {
    if (!attacker || attacker === this.e || !attacker.alive) return;
    if (!this.visible) {
      this.lookYaw = Math.atan2(-(attacker.x - this.e.x), -(attacker.z - this.e.z));
      this.lastKnown = [attacker.x, attacker.z];
      this.seenAt = this.room.now;
      this.nextThink = 0;
    }
  }

  get diff() {
    return DIFFICULTY[this.room.opts.difficulty] || DIFFICULTY.normal;
  }

  think() {
    const { room, e } = this;
    const D = this.diff, now = room.now, eye = eyeOf(e);
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), cosFov = Math.cos(D.fov * Math.PI * 0.5);
    let best = null, bestScore = Infinity;
    for (const o of room.ents.values()) {
      if (!o.alive || o.team === e.team) continue;
      const dx = o.x - e.x, dz = o.z - e.z, dist = Math.hypot(dx, dz);
      if (dist > 95) continue;
      const inFov = (dx * fx + dz * fz) / (dist || 1) > cosFov || dist < 5 || (now - o.lastShotAt < 1 && dist < 45);
      if (!inFov && o !== this.target) continue;
      const top = o.y + (o.crouch ? PLAYER.crouchHeight : PLAYER.height) - 0.25;
      if (!room.world.losClear(eye[0], eye[1], eye[2], o.x, top, o.z) && !room.world.losClear(eye[0], eye[1], eye[2], o.x, o.y + 1, o.z)) continue;
      const score = dist - (o === this.target ? 10 : 0);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (best) {
      if (best !== this.target || !this.visible) this.reactAt = now + D.react * (0.6 + Math.random() * 0.8);
      this.target = best;
      this.visible = true;
      this.seenAt = now;
      this.lastKnown = [best.x, best.z];
    } else {
      if (this.visible) { this.path = null; this.goal = null; }
      this.visible = false;
      if (this.target && now - this.seenAt > 3) this.target = null;
    }
  }

  pickGoal() {
    const { room, e } = this;
    const pts = room.map.points, now = room.now;
    if (this.lastKnown && now - this.seenAt < 6) {
      this.goal = randomOpenNear(room.nav, this.lastKnown[0], this.lastKnown[1], 3);
      this.lastKnown = null;
    } else if (room.opts.mode === 'dom') {
      const list = pts.map((p, i) => ({ p, own: room.points[i].owner === e.team && Math.abs(room.points[i].prog) >= 1 }));
      const want = list.filter((c) => !c.own);
      const pool = want.length ? want : list;
      pool.sort((a, b) => Math.hypot(a.p.x - e.x, a.p.z - e.z) - Math.hypot(b.p.x - e.x, b.p.z - e.z));
      const c = Math.random() < 0.6 ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
      this.goal = randomOpenNear(room.nav, c.p.x, c.p.z, c.own ? 8 : 3.5);
    } else {
      const enemies = [...room.ents.values()].filter((o) => o.alive && o.team !== e.team);
      if (enemies.length && Math.random() < 0.55) {
        const o = enemies[Math.floor(Math.random() * enemies.length)];
        this.goal = randomOpenNear(room.nav, o.x, o.z, 12);
      } else {
        const p = pts[Math.floor(Math.random() * pts.length)];
        this.goal = randomOpenNear(room.nav, p.x + (Math.random() - 0.5) * 40, p.z + (Math.random() - 0.5) * 50, 6);
      }
    }
    this.path = null;
  }

  reachedGoal() {
    const { room, e } = this;
    if (Math.hypot(this.goal[0] - e.x, this.goal[1] - e.z) > 1.6) return false;
    if (room.opts.mode === 'dom') {
      const i = room.map.points.findIndex((p) => Math.hypot(p.x - e.x, p.z - e.z) < p.r);
      if (i >= 0 && !(room.points[i].owner === e.team && Math.abs(room.points[i].prog) >= 1)) {
        const p = room.map.points[i];
        this.goal = randomOpenNear(room.nav, p.x, p.z, 4);
        this.path = null;
        return false;
      }
    }
    return true;
  }

  repath() {
    const { room, e } = this;
    this.pathAt = room.now;
    this.path = this.goal ? findPath(room.nav, e.x, e.z, this.goal[0], this.goal[1]) : null;
    if (!this.path) this.goal = null;
  }

  useRewards() {
    const { room, e } = this;
    const id = e.rewards[0];
    if (id === 'uav') {
      e.rewards.shift();
      useStreak(room, e, 'uav');
    } else if (id === 'nuke') {
      if (room.nuke) return;
      e.rewards.shift();
      useStreak(room, e, 'nuke');
    } else if (id === 'artillery') {
      const enemies = [...room.ents.values()].filter((o) => o.alive && o.team !== e.team);
      if (!enemies.length) return;
      const o = enemies[Math.floor(Math.random() * enemies.length)];
      e.rewards.shift();
      useStreak(room, e, 'artillery', [o.x, 0, o.z]);
    } else {
      e.rewards.shift();
    }
  }

  startReload() {
    if (this.reloadUntil) return;
    this.reloadUntil = this.room.now + this.weapon.reload;
  }

  update(dt) {
    const { room, e } = this;
    const now = room.now, C = CLS[e.cls];
    if (now >= this.nextThink) { this.nextThink = now + 0.2; this.think(); }
    if (e.rewards.length) this.useRewards();

    const t = this.target && this.target.alive ? this.target : null;
    const fighting = t && this.visible;
    let wx = 0, wz = 0, speed = PLAYER.walk * C.speed, crouch = false;
    if (fighting) {
      const dx = t.x - e.x, dz = t.z - e.z, dist = Math.hypot(dx, dz) || 1, nx = dx / dist, nz = dz / dist;
      if (now > this.strafeAt) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeAt = now + 0.5 + Math.random() * 1.2; }
      const pref = this.weapon.id === 'shotgun' ? 5 : this.weapon.id === 'sniper' ? 35 : 16;
      const fwd = dist > pref + 4 ? 1 : dist < pref - 4 ? -0.6 : 0;
      wx = nx * fwd - nz * this.strafe * 0.8;
      wz = nz * fwd + nx * this.strafe * 0.8;
      speed *= 0.72;
      if (this.weapon.id === 'sniper' && dist > 20) { wx = wz = 0; crouch = true; }
    } else {
      if (!this.goal || this.reachedGoal()) this.pickGoal();
      if ((!this.path || now - this.pathAt > 4) && now - this.pathAt > 0.5) this.repath();
      const wp = this.path && this.path[0];
      if (wp) {
        const dx = wp[0] - e.x, dz = wp[1] - e.z, d = Math.hypot(dx, dz);
        if (d < 0.7) this.path.shift();
        else { wx = dx / d; wz = dz / d; }
        if (this.path.length > 1 && !t) speed = PLAYER.sprint * C.speed * 0.92;
      }
    }

    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    if (crouch) speed = Math.min(speed, PLAYER.crouchSpeed);
    const k = Math.min(1, dt * 10);
    e.vx += (wx * speed - e.vx) * k;
    e.vz += (wz * speed - e.vz) * k;
    e.crouch = crouch;
    e.height = crouch ? PLAYER.crouchHeight : PLAYER.height;
    moveBody(room.world, e, dt);

    if (now - this.stuckAt > 1.2) {
      if (len > 0.1 && Math.hypot(e.x - this.stuckPos[0], e.z - this.stuckPos[1]) < 0.6) {
        if (e.onGround) e.vy = PLAYER.jump;
        this.path = null;
        if (Math.random() < 0.5) this.goal = null;
      }
      this.stuckPos = [e.x, e.z];
      this.stuckAt = now;
    }

    this.aimAndShoot(dt, fighting ? t : null);

    const moving = Math.hypot(e.vx, e.vz) > 0.5;
    e.flags = (crouch ? 2 : 0) | (moving ? 4 : 0) | (moving && speed > PLAYER.walk * 1.2 ? 8 : 0) |
      (fighting ? 16 : 0) | (e.onGround ? 0 : 32) | (this.reloadUntil ? 64 : 0);
  }

  aimAndShoot(dt, t) {
    const { room, e } = this;
    const D = this.diff, now = room.now, w = this.weapon, eye = eyeOf(e);
    let wantYaw = e.yaw, wantPitch = 0, dist = 0;
    if (t) {
      const aimY = t.y + (t.crouch ? 0.75 : 1.2);
      const dx = t.x - eye[0], dy = aimY - eye[1], dz = t.z - eye[2];
      dist = Math.hypot(dx, dz);
      wantYaw = Math.atan2(-dx, -dz);
      wantPitch = Math.atan2(dy, dist);
    } else if (Math.hypot(e.vx, e.vz) > 0.5) {
      wantYaw = Math.atan2(-e.vx, -e.vz);
    } else if (this.lookYaw !== null) {
      wantYaw = this.lookYaw;
    }
    const turn = (t ? 4 + 6 * (1 - D.react) : 3.5) * dt;
    const dYaw = wrap(wantYaw - e.yaw);
    e.yaw = wrap(e.yaw + Math.max(-turn, Math.min(turn, dYaw)));
    e.pitch += Math.max(-turn, Math.min(turn, wantPitch - e.pitch));

    if (this.reloadUntil) {
      if (now >= this.reloadUntil) { this.reloadUntil = 0; this.mag = w.mag; }
      return;
    }
    if (!t) {
      if (this.mag < w.mag * 0.5) this.startReload();
      return;
    }
    if (now < this.reactAt || Math.abs(dYaw) > 0.15) return;

    // 수류탄 (사거리 약 7~15m)
    if (e.grenades > 0 && now > this.nextGrenade && dist > 7 && dist < 15) {
      const g = PROJECTILES.grenade;
      const theta = 0.5 * Math.asin(Math.min(1, (dist * g.gravity) / (g.speed * g.speed))) * 0.85;
      launch(room, e, 'grenade', eye, dirOf(e.yaw, theta));
      e.grenades--;
      e.lastThrowAt = now;
      this.nextGrenade = now + 8 + Math.random() * 10;
      return;
    }

    if (now >= this.burstUntil) {
      if (now < this.pauseUntil) return;
      this.burstUntil = now + 0.25 + Math.random() * 0.9 * D.burst;
      this.pauseUntil = this.burstUntil + (1 - D.burst) * (0.25 + Math.random() * 0.7);
      // 포병: 가끔 로켓
      if (CLS[e.cls].secondary === 'rocket' && dist > 10 && dist < 55 && now - e.lastRocketAt > 5 && Math.random() < 0.3) {
        e.lastRocketAt = now;
        e.lastShotAt = now;
        launch(room, e, 'rocket', eye, dirOf(e.yaw + gauss() * D.aimErr, e.pitch + gauss() * D.aimErr * 0.5));
        return;
      }
    }
    if (now < this.nextShot) return;
    this.nextShot = now + 60 / w.rpm + (w.auto ? 0 : 0.12 + Math.random() * 0.3);

    const moving = Math.hypot(e.vx, e.vz) > 1;
    const err = D.aimErr * (dist > 40 ? 1.4 : 1) + w.spreadAds * 0.5 + (moving ? 0.012 : 0);
    const dirs = [];
    for (let p = 0; p < (w.pellets || 1); p++) {
      const sp = w.pellets > 1 ? w.spreadHip : 0;
      dirs.push(dirOf(e.yaw + gauss() * (err + sp), e.pitch + gauss() * (err * 0.7 + sp)));
    }
    e.lastFireAt = now;
    botFire(room, e, w, dirs);
    if (--this.mag <= 0) this.startReload();
  }
}

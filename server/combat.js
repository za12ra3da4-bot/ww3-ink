// 사격 · 투척 · 폭발 · 연속처치 보상 — 서버 권한 판정
import { WEAPONS, PROJECTILES, PLAYER, STREAKS, CLASSES, MAP_HALF, COIN, falloffDamage } from '../public/shared/config.js';
import { rayPlayer } from '../public/shared/physics.js';

const CLS = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
export const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const vec = (a) => (Array.isArray(a) && a.length === 3 && a.every((v) => Number.isFinite(+v)) ? a.map(Number) : null);

export const eyeOf = (e) => [e.x, e.y + (e.crouch ? PLAYER.crouchEye : PLAYER.eye), e.z];
export const isProtected = (room, e) => room.now - e.spawnedAt < PLAYER.spawnProtect;

// ── 피해 / 처치 ───────────────────────────────────
export function damage(room, t, amount, attacker, weapon, head, src) {
  if (!t.alive || room.state !== 'playing') return;
  if (attacker !== t && isProtected(room, t)) return;
  t.hp -= amount;
  t.lastDamageAt = room.now;
  if (attacker && attacker !== t) t.dmgBy.set(attacker.id, (t.dmgBy.get(attacker.id) || 0) + amount);
  if (t.bot) t.brain.onHurt(attacker);
  else room.emitTo(t, 'hurt', { s: src, a: Math.round(amount) });
  if (attacker && !attacker.bot && attacker !== t) room.emitTo(attacker, 'hitmark', { h: head ? 1 : 0, k: t.hp <= 0 ? 1 : 0 });
  if (t.hp <= 0) kill(room, t, attacker, weapon, head);
}

export function kill(room, v, k, weapon, head) {
  if (!v.alive) return;
  v.alive = false;
  v.hp = 0;
  v.deaths++;
  v.streak = 0;
  v.respawnAt = room.now + PLAYER.respawnTime;
  if (k && k !== v && k.team !== v.team) {
    k.kills++;
    k.score += head ? 125 : 100;
    room.award(k, COIN.kill + (head ? COIN.headshot : 0), head ? '헤드샷' : '처치');
    if (room.opts.mode === 'tdm') room.scores[k.team]++;
    if (weapon !== 'nuke') {
      k.streak++;
      for (const s of STREAKS) {
        if (k.streak !== s.kills) continue;
        k.rewards.push(s.id);
        if (!k.bot) room.emitTo(k, 'reward', { id: s.id });
      }
    }
  } else if (k === v) {
    v.score = Math.max(0, v.score - 50);
  }
  for (const [id, dmg] of v.dmgBy) {
    const a = room.ents.get(id);
    if (a && a !== k && dmg >= 35) { a.assists++; a.score += 50; room.award(a, COIN.assist, '도움'); }
  }
  v.dmgBy.clear();
  room.broadcast('kill', { k: k ? k.nid : -1, v: v.nid, w: weapon, h: head ? 1 : 0, p: [r2(v.x), r2(v.y), r2(v.z)] });
  room.rosterDirty = true;
}

// ── 총격 ──────────────────────────────────────────
// 사람: 클라이언트가 레이캐스트한 결과를 받아 거리/팀/연사속도만 검증한다.
export function handleFire(room, e, msg) {
  if (!e.alive || !msg) return;
  const w = WEAPONS[msg.w], C = CLS[e.cls];
  if (!w || w.projectile || !C.weapons.includes(msg.w)) return;
  if (room.now - e.lastFireAt < (60 / w.rpm) * 0.6) return;
  e.lastFireAt = room.now;
  e.lastShotAt = room.now;
  e.w = w.id;
  const o = vec(msg.o) || eyeOf(e);
  const ends = Array.isArray(msg.e) ? msg.e.slice(0, w.pellets).map(vec).filter(Boolean) : [];
  room.broadcast('shot', { n: e.nid, w: w.id, k: e.skins[w.id], o: o.map(r2), e: ends.map((p) => p.map(r2)) }, e);
  if (!Array.isArray(msg.h)) return;
  const totals = new Map();
  for (const h of msg.h.slice(0, w.pellets)) {
    if (!Array.isArray(h)) continue;
    const t = room.byNid.get(h[0] | 0);
    if (!t || !t.alive || t.team === e.team) continue;
    const dist = Math.hypot(t.x - o[0], t.y + 1 - o[1], t.z - o[2]);
    if (dist > w.range + 6) continue;
    const c = totals.get(t) || { dmg: 0, head: false };
    c.dmg += falloffDamage(w, dist) * (h[1] ? w.head : 1);
    c.head ||= !!h[1];
    totals.set(t, c);
  }
  for (const [t, c] of totals) damage(room, t, c.dmg, e, w.id, c.head, [r2(e.x), r2(e.z)]);
}

export function traceShot(room, shooter, o, d, range) {
  const wh = room.world.raycast(o[0], o[1], o[2], d[0], d[1], d[2], range);
  let best = wh ? wh.t : range, target = null, head = false;
  for (const t of room.ents.values()) {
    if (!t.alive || t === shooter) continue;
    const r = rayPlayer(o[0], o[1], o[2], d[0], d[1], d[2], best, t);
    if (r && r.t < best) { best = r.t; target = t; head = r.head; }
  }
  return { t: best, target, head };
}

// 봇: 서버가 직접 레이캐스트
export function botFire(room, bot, w, dirs) {
  const o = eyeOf(bot), ends = [], totals = new Map();
  for (const d of dirs) {
    const r = traceShot(room, bot, o, d, w.range);
    ends.push([r2(o[0] + d[0] * r.t), r2(o[1] + d[1] * r.t), r2(o[2] + d[2] * r.t)]);
    if (!r.target || r.target.team === bot.team) continue;
    const c = totals.get(r.target) || { dmg: 0, head: false };
    c.dmg += falloffDamage(w, r.t) * (r.head ? w.head : 1);
    c.head ||= r.head;
    totals.set(r.target, c);
  }
  bot.lastShotAt = room.now;
  room.broadcast('shot', { n: bot.nid, w: w.id, k: bot.skins[w.id], o: o.map(r2), e: ends });
  for (const [t, c] of totals) damage(room, t, c.dmg, bot, w.id, c.head, [r2(bot.x), r2(bot.z)]);
}

// ── 수류탄 / 로켓 ─────────────────────────────────
export function handleThrow(room, e, msg) {
  if (!e.alive || !msg) return;
  const o = vec(msg.o), d = vec(msg.d);
  if (!o || !d) return;
  if (msg.k === 'rocket') {
    if (!CLS[e.cls].weapons.includes('rocket') || e.rockets <= 0 || room.now - e.lastRocketAt < 2.4) return;
    e.rockets--;
    e.lastRocketAt = room.now;
    e.lastShotAt = room.now;
    launch(room, e, 'rocket', o, d);
  } else {
    if (e.grenades <= 0 || room.now - e.lastThrowAt < 0.8) return;
    e.grenades--;
    e.lastThrowAt = room.now;
    launch(room, e, 'grenade', o, d);
  }
}

export function launch(room, e, kind, o, d) {
  const P = PROJECTILES[kind];
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  const eye = eyeOf(e);
  if (Math.hypot(o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]) > 3) o = eye;
  const q = {
    id: ++room.projSeq, kind, owner: e, team: e.team, x: o[0], y: o[1], z: o[2],
    vx: (d[0] / len) * P.speed, vy: (d[1] / len) * P.speed + (kind === 'grenade' ? 3 : 0), vz: (d[2] / len) * P.speed,
    fuse: room.now + P.fuse,
  };
  room.projectiles.push(q);
  room.broadcast('launch', { id: q.id, k: kind, n: e.nid, sk: kind === 'rocket' ? e.skins.rocket : null, o: [r2(q.x), r2(q.y), r2(q.z)] });
}

export function updateProjectiles(room, dt) {
  const keep = [];
  for (const q of room.projectiles) {
    const P = PROJECTILES[q.kind];
    if (P.gravity) q.vy -= P.gravity * dt;
    const sx = q.vx * dt, sy = q.vy * dt, sz = q.vz * dt, len = Math.hypot(sx, sy, sz);
    let boom = room.now >= q.fuse, gone = false;
    if (!boom && len > 1e-6) {
      const dx = sx / len, dy = sy / len, dz = sz / len;
      const hit = room.world.raycast(q.x, q.y, q.z, dx, dy, dz, len + 0.12);
      if (q.kind === 'rocket') {
        let tHit = hit ? hit.t : Infinity;
        for (const t of room.ents.values()) {
          if (!t.alive || t === q.owner || t.team === q.team) continue;
          const r = rayPlayer(q.x, q.y, q.z, dx, dy, dz, len, t);
          if (r && r.t < tHit) tHit = r.t;
        }
        if (tHit < Infinity) {
          const back = Math.max(0, tHit - 0.15);
          q.x += dx * back; q.y += dy * back; q.z += dz * back;
          boom = true;
        } else { q.x += sx; q.y += sy; q.z += sz; }
      } else if (hit) {
        q.x = hit.x + hit.n[0] * 0.06; q.y = hit.y + hit.n[1] * 0.06; q.z = hit.z + hit.n[2] * 0.06;
        if (hit.n[0]) q.vx = -q.vx * P.bounce;
        if (hit.n[1]) q.vy = -q.vy * P.bounce;
        if (hit.n[2]) q.vz = -q.vz * P.bounce;
        q.vx *= 0.7; q.vz *= 0.7;
        if (hit.n[1] > 0 && Math.abs(q.vy) < 1.2) q.vy = 0;
      } else { q.x += sx; q.y += sy; q.z += sz; }
      if (Math.abs(q.x) > MAP_HALF + 30 || Math.abs(q.z) > MAP_HALF + 30 || q.y > 90) gone = true;
    }
    if (boom) explode(room, q.x, q.y, q.z, q.kind, room.ents.has(q.owner.id) ? q.owner : null);
    else if (!gone) keep.push(q);
  }
  room.projectiles = keep;
}

export function explode(room, x, y, z, kind, owner) {
  const P = PROJECTILES[kind];
  room.broadcast('boom', { k: kind, p: [r2(x), r2(y), r2(z)] });
  for (const t of [...room.ents.values()]) {
    if (!t.alive) continue;
    if (owner && t !== owner && t.team === owner.team) continue;
    const d = Math.hypot(t.x - x, t.y + 0.9 - y, t.z - z);
    if (d > P.radius) continue;
    if (!room.world.losClear(x, y + 0.25, z, t.x, t.y + 0.9, t.z) && !room.world.losClear(x, y + 0.25, z, t.x, t.y + 1.6, t.z)) continue;
    let dmg = P.dmg * Math.pow(1 - d / P.radius, 1.1);
    if (t === owner) dmg *= 0.5;
    if (dmg >= 1) damage(room, t, dmg, owner, kind, false, [r2(x), r2(z)]);
  }
}

// ── 연속 처치 보상 ────────────────────────────────
export function handleStreak(room, e, msg) {
  const id = msg && msg.id;
  const i = e.rewards.indexOf(id);
  if (i < 0 || room.state !== 'playing') return;
  if (id === 'nuke' && room.nuke) return;
  e.rewards.splice(i, 1);
  useStreak(room, e, id, Array.isArray(msg.p) ? msg.p.map(Number) : null);
}

export function useStreak(room, e, id, p) {
  if (id === 'uav') {
    room.uavUntil[e.team] = room.now + 20;
    room.broadcast('streak', { id, n: e.nid, team: e.team, dur: 20 });
  } else if (id === 'artillery') {
    const x = clamp(Number.isFinite(p?.[0]) ? p[0] : e.x, -MAP_HALF + 2, MAP_HALF - 2);
    const z = clamp(Number.isFinite(p?.[2]) ? p[2] : e.z, -MAP_HALF + 2, MAP_HALF - 2);
    room.broadcast('streak', { id, n: e.nid, team: e.team, p: [r2(x), r2(z)] });
    for (let k = 0; k < 8; k++) {
      room.strikes.push({ at: room.now + 2.4 + k * 0.35 + Math.random() * 0.2, x: x + (Math.random() - 0.5) * 16, z: z + (Math.random() - 0.5) * 16, owner: e });
    }
  } else if (id === 'nuke') {
    room.nuke = { team: e.team, owner: e, at: room.now + 10 };
    room.broadcast('streak', { id, n: e.nid, team: e.team, dur: 10 });
  }
}

export function updateStrikes(room) {
  if (room.strikes.length) {
    room.strikes = room.strikes.filter((s) => {
      if (room.now < s.at) return true;
      const hit = room.world.raycast(s.x, 60, s.z, 0, -1, 0, 80);
      explode(room, s.x, hit ? hit.y + 0.1 : 0.1, s.z, 'shell', room.ents.has(s.owner.id) ? s.owner : null);
      return false;
    });
  }
  if (room.nuke && room.now >= room.nuke.at) {
    const { team, owner } = room.nuke;
    room.nuke = null;
    room.broadcast('nukeboom', { team });
    const killer = room.ents.has(owner.id) ? owner : null;
    for (const t of [...room.ents.values()]) if (t.alive && t.team !== team) kill(room, t, killer, 'nuke', false);
  }
}

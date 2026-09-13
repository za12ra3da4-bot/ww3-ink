// 방 하나 = 진행 중인 전투 하나. 30Hz 시뮬레이션, 20Hz 스냅샷, 판이 끝나면 다음 맵 투표
import {
  TICK_RATE, PLAYER, CLASSES, MODES, TEAMS, WEAPON_IDS, BOT_NAMES, MAP_HALF, MAP_IDS, VOTE_TIME, COIN,
  GACHA_POOL, RARITY, defaultSkin, randomLook,
} from '../public/shared/config.js';
import { generateMap, buildNav } from '../public/shared/map.js';
import { World } from '../public/shared/physics.js';
import { BotBrain } from './bot.js';
import { handleFire, handleThrow, handleStreak, updateProjectiles, updateStrikes, r2 } from './combat.js';
import { addCoins, packet, skinsOf } from './profiles.js';

const CLS = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickMap = (except) => {
  const pool = MAP_IDS.filter((m) => m !== except);
  return pool[Math.floor(Math.random() * pool.length)];
};

function botSkins() {
  const out = {};
  for (const w of WEAPON_IDS) {
    out[w] = defaultSkin(w);
    if (Math.random() < 0.55) {
      const pool = GACHA_POOL.filter((s) => s.weapon === w);
      let r = Math.random() * pool.reduce((a, s) => a + RARITY[s.rarity].weight, 0);
      for (const s of pool) if ((r -= RARITY[s.rarity].weight) <= 0) { out[w] = s.id; break; }
    }
  }
  return out;
}

export class Room {
  constructor(io, code, opts) {
    this.io = io;
    this.code = code;
    this.opts = opts;
    this.isPublic = opts.isPublic;
    this.ents = new Map();
    this.byNid = new Map();
    this.nidSeq = 1;
    this.t0 = Date.now() / 1000;
    this.now = 0;
    this.lastSnap = 0;
    this.lastRoster = 0;
    this.rosterDirty = true;
    this.chatAt = new Map();
    this.votes = new Map();
    this.mapId = MAP_IDS.includes(opts.map) ? opts.map : pickMap();
    this.newMatch(this.mapId);
    this.timer = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error(`[${this.code}] tick 오류:`, err);
      }
    }, 1000 / TICK_RATE);
  }

  destroy() {
    clearInterval(this.timer);
  }

  newMatch(mapId) {
    this.mapId = mapId;
    this.map = generateMap(mapId, (Math.random() * 2 ** 31) | 0);
    this.world = new World(this.map.boxes);
    this.nav = buildNav(this.map.boxes);
    this.scores = [0, 0];
    this.timeLeft = MODES[this.opts.mode].time;
    this.state = 'playing';
    this.endAt = 0;
    this.votes.clear();
    this.points = this.map.points.map(() => ({ owner: -1, prog: 0, acc: 0, contested: false }));
    this.projectiles = [];
    this.projSeq = 0;
    this.strikes = [];
    this.nuke = null;
    this.uavUntil = [0, 0];
    for (const e of this.ents.values()) {
      Object.assign(e, { kills: 0, deaths: 0, assists: 0, score: 0, caps: 0, streak: 0, rewards: [], alive: false, hp: 0 });
      e.respawnAt = this.now + 0.3 + Math.random() * 0.8;
      e.dmgBy.clear();
      if (e.bot) e.brain.reset();
    }
    this.rosterDirty = true;
    this.broadcast('match', this.matchInfo());
  }

  matchInfo() {
    return {
      code: this.code, map: this.mapId, seed: this.map.seed, mode: this.opts.mode, difficulty: this.opts.difficulty,
      fill: this.opts.fill, timeLeft: Math.ceil(this.timeLeft), scores: this.scores, state: this.state,
      vote: this.state === 'ended' ? this.voteInfo() : null,
    };
  }

  voteInfo() {
    const counts = Object.fromEntries(MAP_IDS.map((m) => [m, 0]));
    for (const v of this.votes.values()) counts[v]++;
    return { options: MAP_IDS, counts, left: Math.max(0, Math.ceil(this.endAt - this.now)) };
  }

  summary() {
    return { code: this.code, mode: this.opts.mode, map: this.mapId, host: this.opts.hostName, humans: this.humanCount(), total: this.ents.size, state: this.state };
  }

  humanCount() {
    let n = 0;
    for (const e of this.ents.values()) if (!e.bot) n++;
    return n;
  }

  makeEnt(id, name, team, bot, cls) {
    const e = {
      id, nid: this.nidSeq++, name, team, bot, cls, nextCls: cls, socket: null, brain: null, profile: null,
      look: randomLook(), skins: botSkins(),
      alive: false, hp: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, flags: 0, crouch: false, w: CLS[cls].primary,
      vx: 0, vy: 0, vz: 0, onGround: true, radius: PLAYER.radius, height: PLAYER.height, life: 0,
      kills: 0, deaths: 0, assists: 0, score: 0, caps: 0, streak: 0, rewards: [], grenades: 0,
      respawnAt: 0, spawnedAt: -99, lastDamageAt: -99, lastShotAt: -99, lastFireAt: -99, lastThrowAt: -99, lastRocketAt: -99,
      dmgBy: new Map(),
    };
    this.ents.set(id, e);
    this.byNid.set(e.nid, e);
    return e;
  }

  uniqueName(name) {
    const taken = new Set([...this.ents.values()].map((e) => e.name));
    if (!taken.has(name)) return name;
    for (let i = 2; ; i++) if (!taken.has(`${name.slice(0, 10)}${i}`)) return `${name.slice(0, 10)}${i}`;
  }

  addPlayer(socket, name, cls, profile) {
    const humans = [0, 0], totals = [0, 0];
    for (const o of this.ents.values()) { totals[o.team]++; if (!o.bot) humans[o.team]++; }
    const team = humans[0] !== humans[1] ? (humans[0] < humans[1] ? 0 : 1) : totals[0] <= totals[1] ? 0 : 1;
    const e = this.makeEnt(socket.id, this.uniqueName(name), team, false, cls);
    e.socket = socket;
    e.profile = profile;
    e.look = profile.look;
    e.skins = skinsOf(profile);
    e.respawnAt = this.now + 1;
    socket.join(this.code);
    this.rebalanceBots();
    this.system(`${e.name} 님이 ${TEAMS[team].name}에 합류했습니다.`);
    return { you: e.nid, team, ...this.matchInfo(), roster: this.roster() };
  }

  refreshAppearance(id) {
    const e = this.ents.get(id);
    if (!e || !e.profile) return;
    e.look = e.profile.look;
    e.skins = skinsOf(e.profile);
    this.rosterDirty = true;
  }

  removePlayer(id) {
    const e = this.ents.get(id);
    if (!e) return;
    this.ents.delete(id);
    this.byNid.delete(e.nid);
    this.votes.delete(id);
    this.broadcast('left', { nid: e.nid });
    this.system(`${e.name} 님이 나갔습니다.`);
    this.rebalanceBots();
  }

  addBot(team) {
    const used = new Set([...this.ents.values()].map((e) => e.name));
    const base = BOT_NAMES.find((n) => !used.has(`AI ${n}`)) || `병사${this.nidSeq}`;
    const cls = CLASSES[Math.floor(Math.random() * CLASSES.length)].id;
    const e = this.makeEnt(`bot${this.nidSeq}`, `AI ${base}`, team, true, cls);
    e.brain = new BotBrain(this, e);
    e.respawnAt = this.now + 0.5 + Math.random() * 1.5;
    return e;
  }

  // 팀당 인원이 fill 이 되도록 봇을 넣고 뺀다
  rebalanceBots() {
    for (const team of [0, 1]) {
      let humans = 0;
      const bots = [];
      for (const e of this.ents.values()) {
        if (e.team !== team) continue;
        if (e.bot) bots.push(e); else humans++;
      }
      const want = Math.max(0, this.opts.fill - humans);
      bots.sort((a, b) => Number(b.alive) - Number(a.alive));
      while (bots.length > want) {
        const b = bots.pop();
        this.ents.delete(b.id);
        this.byNid.delete(b.nid);
        this.broadcast('left', { nid: b.nid });
      }
      while (bots.length < want) bots.push(this.addBot(team));
    }
    this.rosterDirty = true;
  }

  emitTo(e, ev, data) {
    if (e.socket) e.socket.emit(ev, data);
  }

  broadcast(ev, data, except) {
    if (except && except.socket) except.socket.to(this.code).emit(ev, data);
    else this.io.to(this.code).emit(ev, data);
  }

  system(text) {
    this.broadcast('chat', { sys: true, text });
  }

  // 코인 지급 (사람만)
  award(e, n, why) {
    if (!e || e.bot || !e.profile || !n) return;
    addCoins(e.profile, n);
    this.emitTo(e, 'coins', { n, why, profile: packet(e.profile) });
  }

  onMessage(id, ev, msg) {
    const e = this.ents.get(id);
    if (!e) return;
    switch (ev) {
      case 'input': return this.onInput(e, msg);
      case 'fire': return handleFire(this, e, msg);
      case 'throw': return handleThrow(this, e, msg);
      case 'streak': return handleStreak(this, e, msg);
      case 'chat': return this.onChat(e, msg);
      case 'class': return this.onClass(e, msg);
      case 'team': return this.switchTeam(e);
      case 'vote': return this.onVote(e, msg);
    }
  }

  onVote(e, m) {
    if (this.state !== 'ended' || !m || !MAP_IDS.includes(m.map)) return;
    this.votes.set(e.id, m.map);
    this.broadcast('votes', this.voteInfo());
  }

  onInput(e, m) {
    if (!e.alive || !m || (m.l | 0) !== e.life) return;
    const x = +m.x, y = +m.y, z = +m.z;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    e.x = clamp(x, -MAP_HALF, MAP_HALF);
    e.y = clamp(y, 0, 40);
    e.z = clamp(z, -MAP_HALF, MAP_HALF);
    if (Number.isFinite(+m.yaw)) e.yaw = +m.yaw;
    if (Number.isFinite(+m.pitch)) e.pitch = clamp(+m.pitch, -1.55, 1.55);
    e.flags = (m.f | 0) & 0x7e;
    e.crouch = !!(e.flags & 2);
    if (CLS[e.cls].weapons.includes(m.w)) e.w = m.w;
  }

  onChat(e, m) {
    const text = String((m && m.text) || '').replace(/[ -]/g, '').trim().slice(0, 120);
    if (!text) return;
    const last = this.chatAt.get(e.id) || 0;
    if (Date.now() - last < 600) return;
    this.chatAt.set(e.id, Date.now());
    this.broadcast('chat', { nid: e.nid, name: e.name, team: e.team, text });
  }

  onClass(e, m) {
    if (!m || !CLS[m.cls]) return;
    e.nextCls = m.cls;
    this.rosterDirty = true;
    if (e.alive && this.now - e.spawnedAt < 4 && e.cls !== m.cls) this.equip(e, true);
  }

  switchTeam(e) {
    if (this.state !== 'playing') return;
    if (e.alive) {
      e.alive = false;
      e.hp = 0;
      this.broadcast('kill', { k: -1, v: e.nid, w: 'team', h: 0, p: [r2(e.x), r2(e.y), r2(e.z)] });
    }
    e.team = 1 - e.team;
    e.streak = 0;
    e.respawnAt = this.now + 2;
    this.emitTo(e, 'teamchange', { team: e.team });
    this.system(`${e.name} 님이 ${TEAMS[e.team].name}으로 이동했습니다.`);
    this.rebalanceBots();
  }

  pickSpawn(team) {
    let best = null, bestScore = -Infinity;
    for (const sp of this.map.spawns[team]) {
      let minD = 60;
      for (const o of this.ents.values()) {
        if (!o.alive) continue;
        const d = Math.hypot(o.x - sp.x, o.z - sp.z);
        if (o.team !== team) minD = Math.min(minD, d);
        else if (d < 1.5) minD -= 30;
      }
      const score = minD + Math.random() * 12;
      if (score > bestScore) { bestScore = score; best = sp; }
    }
    return best;
  }

  equip(e, notify) {
    e.cls = e.nextCls;
    const C = CLS[e.cls];
    e.w = C.primary;
    e.grenades = C.grenades;
    e.rockets = C.rockets;
    e.life++;
    if (e.bot) e.brain.onSpawn();
    else if (notify) this.emitTo(e, 'spawn', { x: e.x, y: e.y, z: e.z, yaw: e.yaw, cls: e.cls, life: e.life, rw: e.rewards, gr: e.grenades, st: e.streak });
  }

  spawn(e) {
    const sp = this.pickSpawn(e.team);
    Object.assign(e, {
      alive: true, hp: PLAYER.maxHp, x: sp.x, y: 0, z: sp.z, yaw: sp.yaw, pitch: 0, vx: 0, vy: 0, vz: 0,
      onGround: true, crouch: false, height: PLAYER.height, flags: 0, spawnedAt: this.now, lastDamageAt: -99,
    });
    e.dmgBy.clear();
    this.equip(e, true);
  }

  updatePoints(dt) {
    this.map.points.forEach((P, i) => {
      const c = this.points[i];
      const inside = [];
      let n0 = 0, n1 = 0;
      for (const e of this.ents.values()) {
        if (!e.alive || e.y > 4 || Math.hypot(e.x - P.x, e.z - P.z) > P.r) continue;
        inside.push(e);
        if (e.team) n1++; else n0++;
      }
      c.contested = n0 > 0 && n1 > 0;
      if ((n0 > 0) !== (n1 > 0)) {
        const team = n1 ? 1 : 0, dir = team ? 1 : -1;
        if (c.owner !== team || Math.abs(c.prog) < 1) {
          c.prog = clamp(c.prog + dir * Math.min(3, n0 + n1) * 0.3 * dt, -1, 1);
          if (c.owner !== -1 && c.owner !== team && (team ? c.prog >= 0 : c.prog <= 0)) {
            c.owner = -1;
            this.broadcast('point', { p: i, team: -1 });
          }
          if (Math.abs(c.prog) >= 1 && c.owner !== team) {
            c.owner = team;
            for (const e of inside) { e.score += 150; e.caps++; this.award(e, COIN.capture, '거점 점령'); }
            this.broadcast('point', { p: i, team });
            this.rosterDirty = true;
          }
        }
      } else if (!n0 && !n1 && c.owner === -1) {
        c.prog -= Math.sign(c.prog) * Math.min(Math.abs(c.prog), 0.1 * dt);
      }
      if (c.owner >= 0) {
        c.acc += dt;
        if (c.acc >= 2) { c.acc -= 2; this.scores[c.owner]++; }
      }
    });
  }

  checkEnd() {
    const lim = MODES[this.opts.mode].scoreLimit;
    const [a, b] = this.scores;
    if (a < lim && b < lim && this.timeLeft > 0) return;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    this.state = 'ended';
    this.endAt = this.now + VOTE_TIME;
    this.votes.clear();
    this.projectiles = [];
    this.strikes = [];
    this.nuke = null;
    for (const e of this.ents.values()) {
      if (e.bot) continue;
      const n = winner === -1 ? COIN.draw : winner === e.team ? COIN.win : COIN.lose;
      this.award(e, n, winner === -1 ? '무승부' : winner === e.team ? '승리' : '참전');
    }
    this.broadcast('end', { winner, scores: this.scores, roster: this.roster(), vote: this.voteInfo() });
  }

  finishVote() {
    const counts = new Map();
    for (const v of this.votes.values()) counts.set(v, (counts.get(v) || 0) + 1);
    let best = [], max = 0;
    for (const [m, n] of counts) {
      if (n > max) { max = n; best = [m]; } else if (n === max) best.push(m);
    }
    const next = best.length ? best[Math.floor(Math.random() * best.length)] : pickMap(this.mapId);
    this.newMatch(next);
  }

  roster() {
    return [...this.ents.values()].map((e) => ({
      nid: e.nid, name: e.name, team: e.team, bot: e.bot, cls: e.cls,
      k: e.kills, d: e.deaths, a: e.assists, sc: e.score, st: e.streak, look: e.look, sk: e.skins,
    }));
  }

  snapshot() {
    const e = [];
    for (const p of this.ents.values()) {
      let f = p.flags & 0x7e;
      if (p.alive) f |= 1;
      if (p.alive && this.now - p.spawnedAt < PLAYER.spawnProtect) f |= 128;
      if (this.now - p.lastShotAt < 1.2) f |= 256;
      e.push([p.nid, r2(p.x), r2(p.y), r2(p.z), Math.round(p.yaw * 1000) / 1000, Math.round(p.pitch * 1000) / 1000, f, Math.ceil(p.hp), WEAPON_IDS.indexOf(p.w)]);
    }
    this.io.to(this.code).volatile.emit('snap', {
      t: r2(this.now),
      e,
      pr: this.projectiles.map((q) => [q.id, q.kind === 'rocket' ? 1 : 0, r2(q.x), r2(q.y), r2(q.z)]),
      cp: this.opts.mode === 'dom' ? this.points.map((c) => [c.owner, r2(c.prog), c.contested ? 1 : 0]) : null,
      s: this.scores,
      tl: Math.max(0, Math.ceil(this.timeLeft)),
      uav: [Math.max(0, r2(this.uavUntil[0] - this.now)), Math.max(0, r2(this.uavUntil[1] - this.now))],
    });
  }

  tick() {
    const t = Date.now() / 1000 - this.t0;
    const dt = Math.min(0.1, t - this.now);
    this.now = t;
    if (this.state === 'playing') {
      this.timeLeft -= dt;
      for (const e of this.ents.values()) {
        if (!e.alive) {
          if (this.now >= e.respawnAt) this.spawn(e);
          continue;
        }
        if (e.hp < PLAYER.maxHp && this.now - e.lastDamageAt > PLAYER.regenDelay) e.hp = Math.min(PLAYER.maxHp, e.hp + PLAYER.regenRate * dt);
      }
      for (const e of [...this.ents.values()]) {
        if (!e.bot || !e.alive) continue;
        try {
          e.brain.update(dt);
        } catch (err) {
          console.error(`[${this.code}] 봇 오류:`, err);
          e.brain.reset();
        }
      }
      updateProjectiles(this, dt);
      updateStrikes(this);
      if (this.opts.mode === 'dom') this.updatePoints(dt);
      this.checkEnd();
    } else if (this.now >= this.endAt) {
      this.finishVote();
    }
    if (this.now - this.lastSnap >= 0.05) {
      this.lastSnap = this.now;
      this.snapshot();
    }
    if (this.rosterDirty && this.now - this.lastRoster >= 0.5) {
      this.rosterDirty = false;
      this.lastRoster = this.now;
      this.broadcast('roster', this.roster());
    }
  }
}

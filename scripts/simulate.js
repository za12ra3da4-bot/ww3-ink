// 서버 로직 헤드리스 시뮬레이션 — node scripts/simulate.js [tdm|dom] [초] [팀당인원] [맵]
import { Room } from '../server/room.js';

const mode = process.argv[2] || 'tdm';
const seconds = Number(process.argv[3]) || 180;
const fill = Number(process.argv[4]) || 6;
const map = process.argv[5] || 'random';

const realNow = Date.now;
let fakeNow = realNow();
Date.now = () => fakeNow;

const counts = {};
const io = {
  to: () => ({
    emit: (ev) => { counts[ev] = (counts[ev] || 0) + 1; },
    get volatile() { return this; },
  }),
};

const origSetInterval = globalThis.setInterval;
globalThis.setInterval = () => 0;
const room = new Room(io, 'TEST', { mode, difficulty: 'normal', fill, map, isPublic: false, hostName: 'sim' });
globalThis.setInterval = origSetInterval;
room.rebalanceBots();

const kills = [], booms = {}, points = [];
let ended = null;
const broadcast = room.broadcast.bind(room);
room.broadcast = (ev, data, except) => {
  if (ev === 'kill') kills.push(data);
  if (ev === 'boom') booms[data.k] = (booms[data.k] || 0) + 1;
  if (ev === 'point') points.push(data);
  if (ev === 'end') ended = data;
  broadcast(ev, data, except);
};

const travel = new Map();
let last = new Map();
let maxTick = 0, total = 0, ticks = 0;
const wall0 = realNow();
for (let i = 0; i < seconds * 30; i++) {
  fakeNow += 1000 / 30;
  const a = performance.now();
  room.tick();
  const d = performance.now() - a;
  total += d; ticks++;
  maxTick = Math.max(maxTick, d);
  if (i % 30 === 0) {
    for (const e of room.ents.values()) {
      const p = last.get(e.id);
      if (p && e.alive && p.alive) travel.set(e.id, (travel.get(e.id) || 0) + Math.hypot(e.x - p.x, e.z - p.z));
      last.set(e.id, { x: e.x, z: e.z, alive: e.alive });
    }
  }
  if (ended) break;
}

const bad = [...room.ents.values()].filter((e) => ![e.x, e.y, e.z, e.yaw, e.pitch, e.hp].every(Number.isFinite));
const byWeapon = {};
for (const k of kills) byWeapon[k.w] = (byWeapon[k.w] || 0) + 1;
console.log(`맵 ${room.mapId} | 모드 ${mode} | 봇 ${room.ents.size}명 | 시뮬 ${(ticks / 30).toFixed(0)}초 | 실제 ${realNow() - wall0}ms`);
console.log(`tick 평균 ${(total / ticks).toFixed(3)}ms, 최대 ${maxTick.toFixed(2)}ms`);
console.log('점수', room.scores, '처치', kills.length, '무기별', byWeapon, '폭발', booms);
console.log('거점 변화', points.length, '최종 거점', room.points.map((c) => c.owner));
console.log('종료', ended ? `승리팀 ${ended.winner} ${ended.scores}` : '아직 진행 중');
console.log('NaN 엔티티', bad.length);
const moves = [...travel.values()].map((v) => Math.round(v));
console.log('봇 이동거리(m)', moves.sort((a, b) => a - b).join(' '));
console.log('상위', room.roster().sort((a, b) => b.sc - a.sc).slice(0, 5).map((r) => `${r.name} ${r.k}/${r.d}`).join(', '));
console.log('이벤트', counts);

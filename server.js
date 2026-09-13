// 묵전(墨戰) 서버 — 정적 파일 + socket.io 방 관리 + 프로필(코인·스킨)
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { Room } from './server/room.js';
import { getProfile, packet, pull, equip, setLook, redeem, saveNow } from './server/profiles.js';
import { cleanName, MODES, DIFFICULTY, ROOM_MAX, CLASSES, MAP_IDS } from './public/shared/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 3030;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString('ko-KR', { hour12: false })}]`, ...a);

// 어떤 오류가 나도 서버 전체가 꺼지지 않게 한다
process.on('uncaughtException', (err) => console.error('처리되지 않은 오류 (서버는 계속 실행):', err));
process.on('unhandledRejection', (err) => console.error('처리되지 않은 Promise 오류 (서버는 계속 실행):', err));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    saveNow();
    process.exit(0);
  });
}

const app = express();
// 코드가 바뀌면 브라우저가 옛 파일을 쓰지 않도록 매번 확인하게 한다
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
app.get('/healthz', (_req, res) => res.send('ok'));

const server = http.createServer(app);
// 페이지를 다른 주소(Vercel 등)에 올려도 접속할 수 있도록 CORS 허용
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000, cors: { origin: true }, maxHttpBufferSize: 1e5 });

/** @type {Map<string, Room>} */
const rooms = new Map();
const reply = (cb, payload) => { if (typeof cb === 'function') cb(payload); };
const clsOf = (v) => (CLASSES.some((c) => c.id === v) ? v : 'rifleman');
const obj = (v) => (v && typeof v === 'object' ? v : {});

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do code = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join('');
  while (rooms.has(code));
  return code;
}

io.on('connection', (socket) => {
  /** @type {Room|null} */
  let room = null;
  let profile = null;
  const ip = String(socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '').split(',')[0].replace('::ffff:', '');
  log(`접속 ${ip}`);

  // 모든 이벤트를 감싸서 오류가 나도 서버가 죽지 않고 요청한 쪽에 오류를 돌려준다
  const on = (ev, fn) => socket.on(ev, (...args) => {
    const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    try {
      fn(obj(typeof args[0] === 'function' ? null : args[0]), cb);
    } catch (err) {
      console.error(`[${ev}] 처리 오류:`, err);
      reply(cb, { ok: false, error: '서버 오류가 났습니다. 다시 시도하세요.' });
    }
  });

  const leave = () => {
    if (!room) return;
    const r = room;
    room = null;
    r.removePlayer(socket.id);
    socket.leave(r.code);
    if (r.humanCount() === 0) {
      r.destroy();
      rooms.delete(r.code);
      log(`방 닫힘 ${r.code}`);
    }
  };

  const needProfile = () => profile || (profile = getProfile(crypto.randomBytes(18).toString('base64url')));

  on('hello', (m, cb) => {
    profile = getProfile(m.token, m.backup) || needProfile();
    reply(cb, { ok: true, profile: packet(profile) });
  });

  on('gacha', (m, cb) => {
    const p = needProfile();
    const res = pull(p, m.count === 10 ? 10 : 1);
    reply(cb, { ...res, profile: packet(p) });
  });

  on('equip', (m, cb) => {
    const p = needProfile();
    const ok = equip(p, String(m.skin || ''));
    if (ok && room) room.refreshAppearance(socket.id);
    reply(cb, { ok, profile: packet(p) });
  });

  on('redeem', (m, cb) => {
    const p = needProfile();
    const now = Date.now();
    if (now - (socket.data.redeemAt || 0) < 1000) return reply(cb, { ok: false, error: '잠시 후 다시 시도하세요.' });
    socket.data.redeemAt = now;
    const res = redeem(p, m.code);
    if (res.ok) log(`코드 사용 ${String(m.code).toUpperCase()} — ${ip}`);
    reply(cb, { ...res, profile: packet(p) });
  });

  on('look', (m, cb) => {
    const p = needProfile();
    setLook(p, m.look);
    if (room) room.refreshAppearance(socket.id);
    reply(cb, { ok: true, profile: packet(p) });
  });

  on('rooms', (_m, cb) => {
    reply(cb, [...rooms.values()].filter((r) => r.isPublic).map((r) => r.summary()));
  });

  on('create', (opts, cb) => {
    leave();
    const code = newCode();
    const fill = Math.max(0, Math.min(8, Math.floor(Number(opts.fill) || 0)));
    const r = new Room(io, code, {
      mode: MODES[opts.mode] ? opts.mode : 'tdm',
      difficulty: DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal',
      map: MAP_IDS.includes(opts.map) ? opts.map : 'random',
      fill,
      isPublic: opts.isPublic !== false,
      hostName: cleanName(opts.name) || '병사',
    });
    rooms.set(code, r);
    room = r;
    const res = r.addPlayer(socket, cleanName(opts.name) || '병사', clsOf(opts.cls), needProfile());
    log(`방 생성 ${code} (${r.mapId}) — ${ip}`);
    reply(cb, { ok: true, ...res });
  });

  on('join', (opts, cb) => {
    const r = rooms.get(String(opts.code || '').toUpperCase().trim());
    if (!r) return reply(cb, { ok: false, error: '그런 코드의 방이 없습니다. 코드를 확인하거나, 방장과 같은 서버 주소로 접속했는지 확인하세요.' });
    if (r === room) return reply(cb, { ok: false, error: '이미 이 방에 있습니다.' });
    if (r.humanCount() >= ROOM_MAX) return reply(cb, { ok: false, error: '방이 가득 찼습니다.' });
    leave();
    room = r;
    const res = r.addPlayer(socket, cleanName(opts.name) || '병사', clsOf(opts.cls), needProfile());
    log(`방 참가 ${r.code} — ${ip}`);
    reply(cb, { ok: true, ...res });
  });

  on('leave', leave);
  socket.on('disconnect', (reason) => {
    log(`연결 끊김 ${ip} (${reason})`);
    try { leave(); } catch (err) { console.error('퇴장 처리 오류:', err); }
  });

  for (const ev of ['input', 'fire', 'throw', 'streak', 'chat', 'class', 'team', 'vote']) {
    socket.on(ev, (msg) => {
      if (!room) return;
      try {
        room.onMessage(socket.id, ev, msg);
      } catch (err) {
        console.error(`[${room.code}] ${ev} 처리 오류:`, err);
      }
    });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ${PORT} 포트를 이미 다른 프로그램이 쓰고 있습니다.`);
    console.error('  묵전 서버가 이미 켜져 있는지 확인하세요. (켜져 있다면 이 창은 닫아도 됩니다)\n');
    process.exit(2);
  }
  console.error('서버 오류:', err);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  묵전(墨戰) 서버 실행 중');
  console.log(`  내 컴퓨터:   http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const ip = a.address;
      const label = ip.startsWith('25.') ? '하마치(Hamachi)' : /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? '같은 공유기' : '인터넷(공인 IP)';
      console.log(`  ${label}: http://${ip}:${PORT}`);
    }
  }
  console.log('');
});

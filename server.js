// 묵전(墨戰) 서버 — 정적 파일 + socket.io 방 관리
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { Room } from './server/room.js';
import { cleanName, MODES, DIFFICULTY, ROOM_MAX, CLASSES } from './public/shared/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 3030;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three', 'build')));
app.get('/healthz', (_req, res) => res.send('ok'));

const server = http.createServer(app);
// 프런트엔드를 다른 주소(Vercel 등)에 올려도 접속할 수 있도록 CORS 허용
const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000, cors: { origin: true } });
const log = (...a) => console.log(`[${new Date().toLocaleTimeString('ko-KR', { hour12: false })}]`, ...a);

/** @type {Map<string, Room>} */
const rooms = new Map();
const reply = (cb, payload) => { if (typeof cb === 'function') cb(payload); };
const clsOf = (v) => (CLASSES.some((c) => c.id === v) ? v : 'rifleman');

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
  const ip = String(socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '').split(',')[0].replace('::ffff:', '');
  log(`접속 ${ip}`);
  // 처리 중 오류가 나도 서버가 죽지 않고, 클라이언트는 기다리지 않고 오류를 받는다
  const guard = (cb, fn) => {
    try {
      fn();
    } catch (err) {
      console.error('처리 오류:', err);
      reply(cb, { ok: false, error: '서버 오류가 났습니다. 다시 시도하세요.' });
    }
  };

  const leave = () => {
    if (!room) return;
    const r = room;
    room = null;
    r.removePlayer(socket.id);
    socket.leave(r.code);
    if (r.humanCount() === 0) {
      r.destroy();
      rooms.delete(r.code);
    }
  };

  socket.on('rooms', (cb) => {
    reply(cb, [...rooms.values()].filter((r) => r.isPublic).map((r) => r.summary()));
  });

  socket.on('create', (opts = {}, cb) => guard(cb, () => {
    leave();
    const code = newCode();
    const fill = Math.max(0, Math.min(8, Math.floor(Number(opts.fill) || 0)));
    room = new Room(io, code, {
      mode: MODES[opts.mode] ? opts.mode : 'tdm',
      difficulty: DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal',
      fill,
      isPublic: opts.isPublic !== false,
      hostName: cleanName(opts.name) || '병사',
    });
    rooms.set(code, room);
    const res = room.addPlayer(socket, cleanName(opts.name) || '병사', clsOf(opts.cls));
    log(`방 생성 ${code} — ${ip}`);
    reply(cb, { ok: true, ...res });
  }));

  socket.on('join', (opts = {}, cb) => guard(cb, () => {
    const r = rooms.get(String(opts.code || '').toUpperCase().trim());
    if (!r) return reply(cb, { ok: false, error: '그런 코드의 방이 없습니다.' });
    if (r === room) return reply(cb, { ok: false, error: '이미 이 방에 있습니다.' });
    if (r.humanCount() >= ROOM_MAX) return reply(cb, { ok: false, error: '방이 가득 찼습니다.' });
    leave();
    room = r;
    const res = room.addPlayer(socket, cleanName(opts.name) || '병사', clsOf(opts.cls));
    log(`방 참가 ${r.code} — ${ip}`);
    reply(cb, { ok: true, ...res });
  }));

  socket.on('leave', leave);
  socket.on('disconnect', (reason) => {
    log(`연결 끊김 ${ip} (${reason})`);
    leave();
  });

  for (const ev of ['input', 'fire', 'throw', 'streak', 'chat', 'class', 'team']) {
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

server.listen(PORT, () => {
  console.log(`\n  묵전(墨戰) 서버 실행 중`);
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

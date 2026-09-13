// 묵전(墨戰) 클라이언트 — 로비, 네트워크, 게임 루프
import * as THREE from 'three';
import { io } from '../vendor/socket.io.esm.min.js';
import { CLASSES, MODES, TEAMS, STREAKS, WEAPONS, PLAYER, SKINS, MAPS, MAP_IDS, defaultSkin } from '../shared/config.js';

const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
// 이 방에서 들릴 총소리를 미리 합성해 둔다
function prewarmSounds() {
  const jobs = new Map();
  const addFor = (cls, skins) => {
    const C = CLASS_BY_ID[cls];
    if (!C) return;
    for (const w of C.weapons) {
      const sk = SKINS[(skins && skins[w]) || defaultSkin(w)];
      jobs.set(`${w}|${sk ? sk.sound : 'classic'}`, [w, sk ? sk.sound : 'classic']);
    }
  };
  addFor(game.cls, game.profile && Object.fromEntries(WEAPON_KEYS.map((w) => [w, game.skinFor(w)])));
  for (const r of game.roster.values()) addFor(r.cls, null);
  sound.prewarm([...jobs.values()]);
}
const WEAPON_KEYS = Object.keys(WEAPONS);
import { generateMap } from '../shared/map.js';
import { World, rayPlayer } from '../shared/physics.js';
import { InkRenderer } from './ink.js';
import { loadAssets, tex } from './assets.js';
import { buildWorld } from './world.js';
import { Soldier } from './soldier.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { LocalPlayer } from './player.js';
import { HUD, KILL_ICON, esc } from './hud.js';
import { Lobby } from './lobby.js';
import { tickSkins } from './skins.js';
import { loadSettings, openSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const store = {
  get: (k, d = null) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } },
};
const CLS = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
const settings = loadSettings();

// ── 서버 연결 / 내 토큰 ───────────────────────────
const serverUrl = String(settings.server || window.MUKJEON_SERVER || '').trim();
const socket = io(serverUrl || undefined, { reconnectionDelayMax: 4000 });

function getToken() {
  let t = store.get('mukjeon.token');
  if (!t || !/^[A-Za-z0-9_-]{16,64}$/.test(t)) {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    t = btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    store.set('mukjeon.token', t);
  }
  return t;
}
let backup = null;
try { backup = JSON.parse(store.get('mukjeon.profile') || 'null'); } catch { backup = null; }

const game = {
  socket, settings,
  time: 0, locked: false, active: false, chatOpen: false, state: 'menu', lockSupported: false,
  me: { nid: -1, team: 0 }, meHp: 100, cls: CLS[store.get('cls')] ? store.get('cls') : 'rifleman',
  profile: backup && backup.data ? backup.data : null,
  soldiers: new Map(), roster: new Map(),
  scores: [0, 0], timeLeft: 0, cp: null, uav: [0, 0], strikes: [], nuke: null,
  offset: null, respawnAt: 0, voteEndsAt: 0, code: '', mode: 'tdm', mapKey: null,
  hurtFx: 0, flash: 0, aimNid: -1,
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 900),
  fx: null,
  skinFor(id) { return (this.profile && this.profile.equip[id]) || defaultSkin(id); },
  vote(map) {
    if (this.state !== 'ended' || !MAP_IDS.includes(map)) return;
    socket.emit('vote', { map });
    hud.myVote = map;
    document.querySelectorAll('.vote-card').forEach((c) => c.classList.toggle('mine', c.dataset.map === map));
    sound.play('click');
  },
};
game.scene.background = new THREE.Color(0xffffff);
game.camera.rotation.order = 'YXZ';
game.scene.add(game.camera);
game.ink = new InkRenderer($('view'), settings.quality);
game.sound = new Sound();
game.hud = new HUD(game);
game.player = new LocalPlayer(game);
const { hud, player, sound, ink } = game;

function applySettings(s) {
  sound.setVolume(s.vol);
  hud.applySettings(s);
  if (s.quality !== ink.quality) ink.setQuality(s.quality);
}
applySettings(settings);

function setProfile(packet) {
  if (!packet || !packet.data) return;
  game.profile = packet.data;
  store.set('mukjeon.profile', JSON.stringify(packet));
  lobby.refresh();
  player.refreshSkin();
}

const netStatus = (text, cls) => {
  const el = $('netStatus');
  el.textContent = text;
  el.className = `net ${cls}`;
};
netStatus('서버 연결 중…', 'wait');
socket.on('connect', () => {
  $('serverSetup').hidden = true;
  netStatus(serverUrl ? `서버 연결됨 · ${serverUrl}` : '서버 연결됨', 'ok');
  socket.emit('hello', { token: getToken(), backup }, (res) => { if (res && res.ok) setProfile(res.profile); });
});
socket.on('connect_error', (err) => {
  const vercel = /vercel\.app$/.test(location.hostname) && !serverUrl;
  if (vercel || serverUrl) $('serverSetup').hidden = false;
  netStatus(vercel
    ? '게임 서버 주소가 없습니다 — 설정에서 서버 주소(예: Render)를 넣으세요'
    : `서버 연결 실패 (${err.message}) — 주소와 방장 PC 방화벽을 확인하세요`, 'bad');
});
socket.io.on('reconnect_attempt', (n) => netStatus(`서버에 다시 연결하는 중… (${n}번째)`, 'wait'));

$('serverSetupInput').value = serverUrl;
$('serverSetupBtn').addEventListener('click', () => {
  let url = $('serverSetupInput').value.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//.test(url)) url = `https://${url}`;
  settings.server = url;
  store.set('mukjeon.settings', JSON.stringify(settings));
  location.reload();
});

// ── 로비 ─────────────────────────────────────────
$('nameInput').value = store.get('name', '');
const playerName = () => {
  const n = $('nameInput').value.trim().slice(0, 12) || `병사${Math.floor(Math.random() * 900 + 100)}`;
  store.set('name', n);
  return n;
};

const lobby = new Lobby(game, {
  settings: () => openSettings(settings, applySettings),
  code: () => openCode(),
  look: (look) => socket.emit('look', { look }, (res) => res && setProfile(res.profile)),
  equip: (skin) => socket.emit('equip', { skin }, (res) => res && setProfile(res.profile)),
  gacha: (count) => new Promise((resolve) => {
    if (!socket.connected) return resolve({ ok: false, error: '서버에 연결되어 있지 않습니다.' });
    socket.timeout(10000).emit('gacha', { count }, (err, res) => resolve(err ? { ok: false, error: '서버가 응답하지 않습니다.' } : res));
  }),
  setProfile,
  refreshRooms,
  create: (opts) => enter('create', { ...opts, name: playerName(), cls: game.cls }),
  join: (code) => {
    code = String(code || '').trim().toUpperCase();
    if (code.length !== 4) { $('menuError').textContent = '방 코드 4자리를 입력하세요.'; return; }
    enter('join', { code, name: playerName(), cls: game.cls });
  },
});

function refreshRooms() {
  socket.emit('rooms', (list) => {
    const ul = $('roomList');
    if (!Array.isArray(list) || !list.length) {
      ul.innerHTML = '<li class="empty">열린 전장이 없습니다. 직접 만들어 보세요.</li>';
      return;
    }
    ul.innerHTML = list.map((r) => {
      const M = MAPS.find((m) => m.id === r.map);
      return `<li data-code="${r.code}"><span class="code">${r.code}</span>` +
        `<span>${esc(r.host)}의 전장<br><span class="meta">${M ? M.name : ''} · ${MODES[r.mode] ? MODES[r.mode].name : ''} · 사람 ${r.humans} / 전체 ${r.total}</span></span>` +
        `<span class="meta">${r.state === 'ended' ? '투표 중' : '전투 중'}</span></li>`;
    }).join('');
    ul.querySelectorAll('li[data-code]').forEach((li) => li.addEventListener('click', () => lobby.h.join(li.dataset.code)));
  });
}
// ── 보상 코드 창 ──
function openCode() {
  const modal = $('codeModal');
  modal.hidden = false;
  $('redeemMsg').textContent = '';
  $('redeemMsg').className = 'code-msg';
  $('codeCoins').innerHTML = '';
  sound.init();
  sound.play('open');
  setTimeout(() => $('redeemInput').focus(), 350);
}
function closeCode() {
  $('codeModal').hidden = true;
}
function coinBurst(n) {
  const box = $('codeCoins');
  box.innerHTML = Array.from({ length: Math.min(24, 8 + Math.floor(n / 10)) }, () => {
    const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 140;
    return `<img src="assets/ui/coin.svg" alt="" style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 60}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.15}s">`;
  }).join('');
}
function redeemCode() {
  const input = $('redeemInput'), msg = $('redeemMsg');
  const code = input.value.trim();
  const fail = (text) => {
    msg.textContent = text;
    msg.className = 'code-msg bad';
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    sound.play('dry');
  };
  if (!code) return fail('코드를 입력하세요.');
  if (!socket.connected) return fail('서버에 연결되어 있지 않습니다.');
  socket.timeout(8000).emit('redeem', { code }, (err, res) => {
    if (err || !res) return fail('서버가 응답하지 않습니다.');
    if (res.profile) setProfile(res.profile);
    if (!res.ok) return fail(res.error);
    msg.textContent = `코인 ${res.coins}개를 받았습니다!`;
    msg.className = 'code-msg ok';
    input.value = '';
    coinBurst(res.coins);
    sound.play('coin');
    setTimeout(() => sound.play('sparkle'), 120);
  });
}
$('redeemBtn').addEventListener('click', redeemCode);
$('redeemInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') redeemCode();
  if (e.key === 'Escape') closeCode();
});
$('codeClose').addEventListener('click', closeCode);
$('codeModal').addEventListener('mousedown', (e) => { if (e.target === $('codeModal')) closeCode(); });

const urlCode = new URLSearchParams(location.search).get('room');
if (urlCode) {
  document.querySelector('.play-tabs button[data-p="join"]').click();
  $('codeInput').value = urlCode.toUpperCase().slice(0, 4);
}

let assetsReady = null;
function ensureAssets() {
  if (!assetsReady) {
    $('loading').hidden = false;
    assetsReady = Promise.all([
      loadAssets((p) => { $('loadingText').textContent = `먹을 가는 중… ${Math.round(p * 100)}%`; }),
      Promise.race([document.fonts.load("40px 'Song Myung'"), new Promise((r) => setTimeout(r, 2500))]),
    ]).then(() => {
      ink.setPaper(tex.paper);
      game.fx = new FX(game.scene);
      lobby.build();
    }).finally(() => { $('loading').hidden = true; });
    assetsReady.catch(() => { assetsReady = null; });
  }
  return assetsReady;
}
ensureAssets().then(() => {
  $('menu').hidden = false;
  ink.setMist(30, 220);
  lobby.refresh();
}).catch(() => { $('loading').hidden = false; $('loadingText').textContent = '그림 파일을 불러오지 못했습니다. 새로고침 해 보세요.'; });

let busy = false;
async function enter(ev, payload) {
  if (busy) return;
  busy = true;
  $('menuError').textContent = '';
  sound.init();
  try {
    await ensureAssets();
  } catch {
    busy = false;
    $('menuError').textContent = '그림 파일을 불러오지 못했습니다. 새로고침 해 보세요.';
    return;
  }
  if (!socket.connected) {
    $('menuError').textContent = '서버에 연결하는 중…';
    const ok = await new Promise((resolve) => {
      const on = () => done(true);
      const t = setTimeout(() => done(false), 10000);
      function done(v) { clearTimeout(t); socket.off('connect', on); resolve(v); }
      socket.on('connect', on);
      socket.connect();
    });
    if (!ok) {
      busy = false;
      $('menuError').textContent = '서버에 연결할 수 없습니다. 주소가 맞는지, 방장 PC 방화벽에서 Node.js 가 허용됐는지 확인하세요.';
      return;
    }
    $('menuError').textContent = '';
  }
  socket.timeout(15000).emit(ev, payload, (err, res) => {
    busy = false;
    if (err) { $('menuError').textContent = '서버가 응답하지 않습니다. 잠시 후 다시 시도하세요.'; return; }
    onJoined(res);
  });
}

// ── 입장 / 전투 시작 ─────────────────────────────
function onJoined(res) {
  if (!res || !res.ok) { $('menuError').textContent = (res && res.error) || '입장하지 못했습니다.'; return; }
  game.me = { nid: res.you, team: res.team };
  game.code = res.code;
  game.roster.clear();
  applyRoster(res.roster);
  startMatch(res);
  $('menu').hidden = true;
  $('hud').hidden = false;
  $('roomCode').innerHTML = `방 코드 <b>${res.code}</b>`;
  history.replaceState(null, '', `?room=${res.code}`);
  hud.chat({ sys: true, text: `방 코드 ${res.code} — 친구에게 알려 주면 같은 전장에 들어올 수 있습니다.` });
  hud.streaks(player);
  if (res.state === 'ended' && res.vote) {
    hud.end({ waiting: true, winner: -1, scores: res.scores, roster: res.roster, vote: res.vote });
  } else {
    showPause();
  }
}

function startMatch(info) {
  game.mode = info.mode;
  game.scores = info.scores;
  game.timeLeft = info.timeLeft;
  game.state = info.state === 'ended' ? 'ended' : 'playing';
  game.nuke = null;
  game.strikes = [];
  game.deathPos = null;
  const key = `${info.map}:${info.seed}`;
  if (game.mapKey !== key) {
    game.mapKey = key;
    if (game.worldView) game.worldView.dispose();
    game.fx.clear();
    game.map = generateMap(info.map, info.seed);
    game.world = new World(game.map.boxes);
    game.worldView = buildWorld(game.scene, game.map, ink);
    game.worldView.setMode(info.mode);
    hud.setMap(game.map, info.mode);
    for (const s of game.soldiers.values()) s.buf.length = 0;
    const sp = game.map.spawns[game.me.team][0];
    game.camera.position.set(sp.x, 14, sp.z);
    game.camera.rotation.set(-0.4, sp.yaw, 0);
  }
  player.die();
  game.respawnAt = game.time + 1;
  $('endScreen').hidden = true;
  $('deathScreen').hidden = true;
}

function applyRoster(list) {
  const seen = new Set();
  for (const r of list) {
    seen.add(r.nid);
    game.roster.set(r.nid, r);
    if (r.nid === game.me.nid) { game.me.team = r.team; continue; }
    const s = game.soldiers.get(r.nid);
    if (s) s.setInfo(r);
  }
  for (const nid of [...game.roster.keys()]) if (!seen.has(nid)) removeSoldier(nid);
  hud.streaks(player);
  if (!$('scoreboard').hidden) hud.scoreboard(true);
}

function removeSoldier(nid) {
  game.roster.delete(nid);
  const s = game.soldiers.get(nid);
  if (s) { s.dispose(); game.soldiers.delete(nid); }
}

function leaveGame(msg) {
  socket.emit('leave');
  game.state = 'menu';
  softUnlock = null;
  setActive(false);
  document.body.classList.remove('free');
  if (document.pointerLockElement) document.exitPointerLock();
  for (const nid of [...game.soldiers.keys()]) removeSoldier(nid);
  game.roster.clear();
  if (game.worldView) { game.worldView.dispose(); game.worldView = null; }
  game.world = null;
  game.map = null;
  game.mapKey = null;
  game.offset = null;
  if (game.fx) game.fx.clear();
  player.die();
  $('hud').hidden = true;
  for (const id of ['pauseScreen', 'deathScreen', 'endScreen', 'scoreboard']) $(id).hidden = true;
  $('menu').hidden = false;
  $('menuError').textContent = msg || '';
  ink.setMist(30, 220);
  lobby.refresh();
  history.replaceState(null, '', location.pathname);
}

function showDeath(killer, w) {
  $('deathBy').innerHTML = killer
    ? `<b class="c${killer.team}">${esc(killer.name)}</b> 에게 쓰러짐 <img src="assets/ui/${KILL_ICON[w] || 'w_rifle'}.svg" alt="" style="height:24px;vertical-align:middle">`
    : '스스로 쓰러짐';
  hud.classCards($('classPick'), game.cls, pickClass);
  $('deathScreen').hidden = false;
}

function pickClass(id) {
  game.cls = id;
  store.set('cls', id);
  socket.emit('class', { cls: id });
  hud.classCards($('classPick'), id, pickClass);
  hud.classCards($('pauseClassPick'), id, pickClass);
  sound.play('click');
}

// ── 서버 이벤트 ──────────────────────────────────
socket.on('match', (info) => {
  if (!game.world) return;
  startMatch(info);
  const M = MAPS.find((m) => m.id === info.map);
  hud.announce(`${M ? M.name : '새 전투'}`, `${MODES[info.mode].name} — 먼저 ${MODES[info.mode].scoreLimit}점`);
  sound.play('gong');
  softResume();
});

socket.on('snap', (m) => {
  if (!game.world) return;
  const est = m.t - performance.now() / 1000;
  if (game.offset === null || est > game.offset) game.offset = est;
  else game.offset += (est - game.offset) * 0.02;
  for (const e of m.e) {
    const nid = e[0];
    if (nid === game.me.nid) { game.meHp = e[7]; continue; }
    let s = game.soldiers.get(nid);
    if (!s) {
      const r = game.roster.get(nid);
      if (!r) continue;
      s = new Soldier(game.scene, r);
      game.soldiers.set(nid, s);
    }
    s.push(m.t, e);
  }
  game.fx.syncProjectiles(m.pr, game.time);
  game.scores = m.s;
  game.timeLeft = m.tl;
  game.cp = m.cp;
  game.uav = m.uav;
  if (m.cp) game.worldView.setPointState(m.cp);
});

socket.on('roster', applyRoster);

socket.on('spawn', (m) => {
  if (!game.world) return;
  player.spawn(m);
  game.meHp = PLAYER.maxHp;
  prewarmSounds();
  $('deathScreen').hidden = true;
  hud.streaks(player);
  sound.play('spawn');
  softResume();
});

socket.on('kill', (m) => {
  hud.killfeed(m);
  if (m.w === 'team' || !game.world) return;
  const K = game.roster.get(m.k), V = game.roster.get(m.v);
  if (m.p) game.fx.blood([m.p[0], m.p[1] + 1.1, m.p[2]], [0, 0.4, 0], true);
  if (m.v === game.me.nid) {
    player.die();
    game.deathPos = new THREE.Vector3(m.p[0], m.p[1], m.p[2]);
    game.killerNid = m.k !== m.v ? m.k : -1;
    game.respawnAt = game.time + PLAYER.respawnTime;
    if (game.state === 'playing') {
      showDeath(K && m.k !== m.v ? K : null, m.w);
      softRelease('dead');
    }
  } else if (m.k === game.me.nid) {
    hud.stamp('斬', `${V ? V.name : ''} ${m.h ? '헤드샷 +125' : '처치 +100'}`);
  }
});

socket.on('shot', (m) => {
  const W = WEAPONS[m.w];
  if (!W || !game.world) return;
  const sk = SKINS[m.k];
  // 다른 사람 총소리는 스킨과 상관없이 기본 총소리로 (스킨 총소리는 내 총에서만)
  sound.gun(m.w, 'classic', m.o, 1, m.n);
  const s = game.soldiers.get(m.n);
  const color = sk && sk.tracer ? new THREE.Color(sk.tracer).getHex() : s && s.team === 1 ? TEAMS[1].hex : 0x141312;
  game.fx.muzzle(new THREE.Vector3(m.o[0], m.o[1] - 0.15, m.o[2]));
  m.e.forEach((end, i) => {
    if (i < 3) game.fx.tracer(m.o, end, game.camera.position, color);
    if (i < 2) game.fx.puff(end);
  });
});

socket.on('launch', (m) => {
  if (m.n === game.me.nid && m.k === 'rocket') return;
  if (m.k === 'rocket') sound.gun('rocket', 'classic', m.o, 0.9, `r${m.n}`);
  else sound.play('throw', m.o, 0.9);
});

socket.on('boom', (m) => {
  if (!game.world) return;
  game.fx.explosion(m.p, m.k === 'shell' ? 1.3 : m.k === 'rocket' ? 0.9 : 1);
  sound.play('boom', m.p, 1.2);
  const d = game.camera.position.distanceTo(new THREE.Vector3(m.p[0], m.p[1], m.p[2]));
  game.fx.shake = Math.max(game.fx.shake, Math.max(0, 1.2 - d / 30));
  if (d < 12) game.flash = Math.max(game.flash, 0.35 * (1 - d / 12));
});

socket.on('hurt', (m) => {
  hud.hurt(m.s);
  game.hurtFx = Math.min(1, game.hurtFx + m.a / 60);
  sound.play('hurt');
});

socket.on('hitmark', (m) => {
  hud.hitmarker(m.h, m.k);
  sound.play(m.k ? 'kill' : 'hit');
});

socket.on('coins', (m) => {
  setProfile(m.profile);
  if (game.state !== 'menu') hud.coins(m.n, m.why);
  sound.play('coin');
});

socket.on('reward', (m) => {
  const s = STREAKS.find((x) => x.id === m.id);
  if (!s) return;
  if (!player.rewards.includes(m.id)) player.rewards.push(m.id);
  hud.streaks(player);
  hud.announce(`${s.name} 준비 완료`, `[${STREAKS.indexOf(s) + 4}] 키를 눌러 사용 — ${s.desc}`);
  sound.play('gong');
});

socket.on('streak', (m) => {
  const r = game.roster.get(m.n), mine = m.team === game.me.team, who = r ? r.name : '누군가';
  if (m.id === 'uav') {
    hud.announce(mine ? '아군 정찰기 출격' : '적 정찰기 포착', `${who} · 20초`, mine ? '' : 'red');
    sound.play('whistle');
  } else if (m.id === 'artillery') {
    game.strikes.push({ x: m.p[0], z: m.p[1], until: game.time + 5.5 });
    hud.announce(mine ? '포격 개시' : '적 포격 요청!', mine ? who : '지도의 붉은 표시에서 벗어나라', mine ? '' : 'red');
    sound.play('whistle', [m.p[0], 25, m.p[1]]);
  } else if (m.id === 'nuke') {
    game.nuke = { team: m.team, at: game.time + m.dur };
    sound.play('siren');
  }
});

socket.on('nukeboom', (m) => {
  if (!game.world) return;
  game.nuke = null;
  game.flash = 1.3;
  game.fx.shake = 2;
  const base = game.map.spawns[1 - m.team][0];
  game.fx.nuke([base.x, 0, base.z * 0.7]);
  sound.play('boom', null, 1.5);
  setTimeout(() => sound.play('boom', null, 1.2), 300);
});

socket.on('point', (m) => {
  if (!game.map) return;
  const P = game.map.points[m.p];
  hud.announce(m.team < 0 ? `거점 ${P.label} 중립화` : `거점 ${P.label} · ${TEAMS[m.team].name} 점령`, '', m.team === 1 ? 'blue' : '');
  sound.play('gong');
});

socket.on('end', (m) => {
  game.state = 'ended';
  player.die();
  $('deathScreen').hidden = true;
  $('pauseScreen').hidden = true;
  hud.end(m);
  sound.play('gong');
  softRelease('end');
});
socket.on('votes', (info) => hud.votes(info));

socket.on('chat', (m) => hud.chat(m));
socket.on('left', (m) => removeSoldier(m.nid));
socket.on('teamchange', (m) => {
  game.me.team = m.team;
  player.die();
  hud.announce(`${TEAMS[m.team].name}으로 이동`, '', m.team === 1 ? 'blue' : '');
});
socket.on('disconnect', () => { if (game.state !== 'menu') leaveGame('서버와 연결이 끊어졌습니다. 다시 연결되면 방 코드로 들어오세요.'); });

// ── 마우스 잠금 / 일시정지 / 채팅 ────────────────
// softUnlock: 죽었거나 판이 끝나 잠시 마우스를 풀어 준 상태 ('dead' | 'end')
let softUnlock = null, lockNoticeShown = false;
function lockFailed() {
  if (game.state === 'menu') return;
  if (game.lockSupported) { setActive(false); return; }
  if (lockNoticeShown) return;
  lockNoticeShown = true;
  hud.chat({ sys: true, text: '이 창에서는 마우스 고정이 안 됩니다. Q/E 로도 시점을 돌릴 수 있고, 크롬 같은 일반 브라우저로 열면 훨씬 편합니다.' });
}
function setActive(on) {
  game.active = on;
  document.body.classList.toggle('active', on);
  const pause = $('pauseScreen');
  const show = !on && game.state === 'playing';
  if (show && pause.hidden) {
    pause.classList.remove('open');
    void pause.offsetWidth;
    pause.classList.add('open');
    sound.play('open');
  }
  pause.hidden = !show;
  $('hud').classList.toggle('paused', show);
  if (!on) {
    player.keys.clear();
    player.lmb = player.rmb = false;
    hud.classCards($('pauseClassPick'), game.cls, pickClass);
  }
}
function requestLock() {
  try {
    const p = document.body.requestPointerLock();
    if (p && p.catch) p.catch(lockFailed);
  } catch {
    lockFailed();
  }
}
function lock() {
  if (game.state === 'menu') return;
  sound.init();
  softUnlock = null;
  document.body.classList.remove('free');
  setActive(true);
  requestLock();
}
function pause() {
  softUnlock = null;
  document.body.classList.remove('free');
  if (document.pointerLockElement) document.exitPointerLock();
  setActive(false);
}
function showPause() { pause(); }
function softRelease(reason) {
  if (!game.active) return;
  softUnlock = reason;
  document.body.classList.add('free');
  if (document.pointerLockElement) document.exitPointerLock();
}
function softResume() {
  if (!softUnlock) return;
  softUnlock = null;
  document.body.classList.remove('free');
  if (game.active && game.lockSupported && !game.locked) requestLock();
}
document.addEventListener('pointerlockerror', lockFailed);
document.addEventListener('pointerlockchange', () => {
  const was = game.locked;
  game.locked = document.pointerLockElement === document.body;
  if (game.locked) game.lockSupported = true;
  if (game.state !== 'menu' && was && !game.locked && !game.chatOpen && !softUnlock) setActive(false);
});
$('resumeBtn').addEventListener('click', lock);
$('view').addEventListener('click', () => { if (!game.active && game.state === 'playing') lock(); });
$('leaveBtn').addEventListener('click', () => leaveGame());
$('teamBtn').addEventListener('click', () => socket.emit('team'));
$('pauseTeamBtn').addEventListener('click', () => socket.emit('team'));
$('pauseSettingsBtn').addEventListener('click', () => openSettings(settings, applySettings));
$('endLeaveBtn').addEventListener('click', () => leaveGame());

function openChat() {
  game.chatOpen = true;
  player.keys.clear();
  player.lmb = false;
  $('chat').classList.add('open');
  const i = $('chatInput');
  i.hidden = false;
  i.value = '';
  i.focus();
}
function closeChat() {
  game.chatOpen = false;
  const i = $('chatInput');
  i.hidden = true;
  i.blur();
  $('chat').classList.remove('open');
  if (game.state === 'playing' && !softUnlock) lock();
}
document.addEventListener('keydown', (e) => {
  if (game.state === 'menu') {
    if (e.key === 'Escape' && !$('gachaFx').hidden) lobby.closeGacha();
    return;
  }
  if (!$('settingsModal').hidden) return;
  if (e.code === 'Tab') { e.preventDefault(); hud.scoreboard(true); return; }
  if (game.chatOpen) {
    if (e.key === 'Enter') {
      const text = $('chatInput').value.trim();
      if (text) socket.emit('chat', { text });
      closeChat();
    } else if (e.key === 'Escape') closeChat();
    return;
  }
  if (e.key === 'Enter' || e.code === 'KeyT') { e.preventDefault(); openChat(); return; }
  if (game.state === 'ended' && /^Digit[1-5]$/.test(e.code)) { game.vote(MAP_IDS[+e.code.slice(5) - 1]); return; }
  if (e.code === 'KeyB' || e.key === 'Escape') {
    if (game.active) pause();
    else if (!$('pauseScreen').hidden && e.code === 'KeyB') lock();
    return;
  }
  if (!player.alive && game.state === 'playing' && /^Digit[1-4]$/.test(e.code)) pickClass(CLASSES[+e.code.slice(5) - 1].id);
});
document.addEventListener('keyup', (e) => { if (e.code === 'Tab') hud.scoreboard(false); });

// ── 게임 루프 ────────────────────────────────────
const ray = new THREE.Vector3();
const lookM = new THREE.Matrix4(), lookQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
let last = performance.now(), aimAt = 0;

function deathCam(dt) {
  if (!game.deathPos) return;
  const cam = game.camera, k = game.soldiers.get(game.killerNid);
  ray.set(game.deathPos.x, game.deathPos.y + 3.5, game.deathPos.z);
  cam.position.lerp(ray, Math.min(1, dt * 2));
  const look = k && k.state.alive ? new THREE.Vector3(k.state.x, k.state.y + 1.2, k.state.z) : game.deathPos;
  lookM.lookAt(cam.position, look, UP);
  lookQ.setFromRotationMatrix(lookM);
  cam.quaternion.slerp(lookQ, Math.min(1, dt * 3));
}

function updateTags() {
  const cam = game.camera.position;
  if (game.time - aimAt > 0.1) {
    aimAt = game.time;
    game.aimNid = -1;
    if (player.alive) {
      player.forward(ray);
      const wh = game.world.raycast(cam.x, cam.y, cam.z, ray.x, ray.y, ray.z, 150);
      let best = wh ? wh.t : 150;
      for (const s of game.soldiers.values()) {
        if (!s.state.alive || s.team === game.me.team) continue;
        const r = rayPlayer(cam.x, cam.y, cam.z, ray.x, ray.y, ray.z, best, s.state);
        if (r) { best = r.t; game.aimNid = s.nid; }
      }
    }
  }
  for (const s of game.soldiers.values()) {
    const st = s.state;
    s.tag.visible = st.alive && (s.team === game.me.team ? Math.hypot(st.x - cam.x, st.z - cam.z) < 90 : s.nid === game.aimNid);
  }
}

function frame() {
  requestAnimationFrame(frame);
  const nowMs = performance.now(), dt = Math.min(0.1, (nowMs - last) / 1000);
  last = nowMs;
  game.time += dt;
  tickSkins(game.time);
  if (game.state === 'menu') {
    if (lobby.built && $('gachaFx').hidden) {
      lobby.update(dt, game.time);
      ink.hurt = 0;
      ink.flash = 0;
      ink.render(lobby.scene, lobby.camera);
    }
    return;
  }
  if (!game.world) return;
  player.update(dt);
  if (!player.alive) deathCam(dt);
  const rt = nowMs / 1000 + (game.offset ?? 0) - 0.1;
  for (const s of game.soldiers.values()) s.update(rt, dt, game.time);
  updateTags();
  game.worldView.update(game.camera, game.time, dt);
  sound.listen(game.camera.position.x, game.camera.position.y, game.camera.position.z, player.alive ? player.yaw : game.camera.rotation.y);
  game.fx.update(dt);
  game.hurtFx = Math.max(0, game.hurtFx - dt * 0.8);
  game.flash = Math.max(0, game.flash - dt * 0.9);
  ink.hurt = Math.min(0.8, game.hurtFx + (player.alive && game.meHp < 35 ? 0.25 : 0));
  ink.flash = Math.min(1, game.flash);
  game.strikes = game.strikes.filter((s) => s.until > game.time);
  hud.frame();
  ink.render(game.scene, game.camera);
}
requestAnimationFrame(frame);

window.__game = game; // 디버깅용
window.__lobby = lobby;

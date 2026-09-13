// 묵전(墨戰) 공용 설정 — 서버와 클라이언트가 함께 import 한다.

export const TICK_RATE = 30; // 서버 시뮬레이션 Hz
export const SNAP_RATE = 20; // 스냅샷 전송 Hz
export const MAP_HALF = 80; // 전장은 x, z 모두 [-80, 80]
export const ROOM_MAX = 16;

export const TEAMS = [
  { id: 0, name: '흑군', hanja: '黑', css: '#1d1b18', hex: 0x2a2825 },
  { id: 1, name: '청군', hanja: '靑', css: '#2c5d8f', hex: 0x2c5d8f },
];

export const PLAYER = {
  radius: 0.4,
  height: 1.8,
  crouchHeight: 1.15,
  eye: 1.62,
  crouchEye: 1.0,
  walk: 5.2,
  sprint: 8.0,
  crouchSpeed: 2.6,
  adsSpeed: 3.2,
  gravity: 22,
  jump: 7.4,
  maxHp: 100,
  regenDelay: 5,
  regenRate: 22,
  spawnProtect: 2.5,
  respawnTime: 4,
};

// falloff: [피해 감소 시작 거리, 최소 피해 도달 거리]
export const WEAPONS = {
  rifle: {
    id: 'rifle', name: '소총', auto: true, dmg: 24, head: 1.6, rpm: 650, mag: 30, reserve: 150,
    reload: 2.1, spreadHip: 0.03, spreadAds: 0.005, recoil: 0.011, falloff: [35, 70], minDmg: 17,
    range: 220, pellets: 1, adsFov: 55, sound: 'rifle', icon: 'w_rifle',
  },
  smg: {
    id: 'smg', name: '기관단총', auto: true, dmg: 19, head: 1.5, rpm: 880, mag: 32, reserve: 192,
    reload: 1.8, spreadHip: 0.04, spreadAds: 0.015, recoil: 0.008, falloff: [15, 35], minDmg: 12,
    range: 140, pellets: 1, adsFov: 62, sound: 'smg', icon: 'w_smg',
  },
  sniper: {
    id: 'sniper', name: '저격총', auto: false, dmg: 90, head: 2.5, rpm: 50, mag: 5, reserve: 30,
    reload: 3.0, spreadHip: 0.08, spreadAds: 0, recoil: 0.05, falloff: [999, 1000], minDmg: 90,
    range: 450, pellets: 1, adsFov: 18, scope: true, sound: 'sniper', icon: 'w_sniper',
  },
  shotgun: {
    id: 'shotgun', name: '산탄총', auto: false, dmg: 14, head: 1.25, rpm: 75, mag: 6, reserve: 42,
    reload: 2.6, spreadHip: 0.085, spreadAds: 0.06, recoil: 0.06, falloff: [8, 24], minDmg: 4,
    range: 70, pellets: 9, adsFov: 62, sound: 'shotgun', icon: 'w_shotgun',
  },
  pistol: {
    id: 'pistol', name: '권총', auto: false, dmg: 30, head: 1.6, rpm: 400, mag: 12, reserve: 72,
    reload: 1.4, spreadHip: 0.025, spreadAds: 0.01, recoil: 0.02, falloff: [20, 45], minDmg: 18,
    range: 140, pellets: 1, adsFov: 62, sound: 'pistol', icon: 'w_pistol',
  },
  rocket: {
    id: 'rocket', name: '로켓포', auto: false, projectile: 'rocket', rpm: 40, mag: 1, reserve: 4,
    reload: 2.8, spreadHip: 0.02, spreadAds: 0, recoil: 0.08, adsFov: 50, sound: 'rocket', icon: 'w_rocket',
  },
};
export const WEAPON_IDS = Object.keys(WEAPONS);

export const PROJECTILES = {
  grenade: { speed: 17, gravity: 20, fuse: 2.4, radius: 7, dmg: 130, bounce: 0.35, icon: 'w_grenade' },
  rocket: { speed: 48, gravity: 0, fuse: 6, radius: 5.5, dmg: 125, bounce: 0, icon: 'w_rocket' },
  shell: { radius: 8, dmg: 170, icon: 's_artillery' },
  nuke: { icon: 's_nuke' },
};

// 모든 병과가 1 주무기 · 2 권총 · 3 로켓포 를 든다 (rockets = 로켓 수)
export const CLASSES = [
  { id: 'rifleman', name: '소총수', desc: '어느 거리에서나 믿음직한 자동소총', primary: 'rifle', secondary: 'pistol', rockets: 2, grenades: 2, speed: 1.0 },
  { id: 'marksman', name: '저격수', desc: '한 발에 한 명. 머리를 노려라', primary: 'sniper', secondary: 'pistol', rockets: 1, grenades: 1, speed: 0.95 },
  { id: 'breacher', name: '돌격병', desc: '근접전의 지배자. 빠른 발', primary: 'shotgun', secondary: 'pistol', rockets: 1, grenades: 3, speed: 1.1 },
  { id: 'rocketeer', name: '포병', desc: '기관단총 + 로켓 6발로 엄폐물째 날린다', primary: 'smg', secondary: 'pistol', rockets: 6, grenades: 1, speed: 0.95 },
];
for (const c of CLASSES) c.weapons = [c.primary, c.secondary, 'rocket'];
export const SLOT_KEYS = ['primary', 'secondary', 'launcher'];

export const STREAKS = [
  { id: 'uav', kills: 2, name: '정찰기', desc: '20초간 모든 적 위치를 지도에 표시', duration: 20 },
  { id: 'artillery', kills: 4, name: '포격 요청', desc: '조준한 지점에 포탄 일제 사격' },
  { id: 'nuke', kills: 7, name: '전술핵', desc: '10초 후 모든 적 섬멸' },
];

export const MODES = {
  tdm: { id: 'tdm', name: '섬멸전', desc: '적을 먼저 목표 처치 수만큼 쓰러뜨리는 팀 승리', scoreLimit: 50, time: 600 },
  dom: { id: 'dom', name: '점령전', desc: '거점 甲·乙·丙을 점령해 점수를 쌓는 팀 승리', scoreLimit: 200, time: 720 },
};

// ── 전장 ──────────────────────────────────────────
export const MAPS = [
  { id: 'city', name: '폐허 도시', hanja: '廢墟', desc: '무너진 아파트 사이의 시가전' },
  { id: 'palace', name: '고궁', hanja: '古宮', desc: '기와 지붕과 회랑이 둘러싼 궁궐 마당' },
  { id: 'harbor', name: '항구', hanja: '港口', desc: '컨테이너 미로와 거대한 크레인' },
  { id: 'snow', name: '설원 참호', hanja: '雪原', desc: '눈 덮인 참호와 철조망의 무인지대' },
  { id: 'bamboo', name: '죽림 마을', hanja: '竹林', desc: '대숲과 초가집, 논두렁 사이의 매복전' },
];
export const MAP_IDS = MAPS.map((m) => m.id);
export const VOTE_TIME = 15;

// ── 병사 생김새 (무료, 로비에서 변경) ─────────────
export const LOOKS = {
  helmet: [
    { id: 'steel', name: '철모' }, { id: 'beret', name: '베레모' }, { id: 'hood', name: '두건' },
    { id: 'gat', name: '삿갓' }, { id: 'cap', name: '전투모' }, { id: 'none', name: '맨머리' },
  ],
  face: [
    { id: 'bare', name: '맨얼굴' }, { id: 'mask', name: '복면' }, { id: 'gas', name: '방독면' },
    { id: 'tal', name: '하회탈' }, { id: 'goggles', name: '고글' }, { id: 'beard', name: '수염' },
  ],
  body: [
    { id: 'plain', name: '전투복' }, { id: 'coat', name: '긴 외투' }, { id: 'robe', name: '도포' }, { id: 'heavy', name: '중장갑' },
  ],
  gear: [
    { id: 'vest', name: '방탄조끼' }, { id: 'pack', name: '배낭' }, { id: 'radio', name: '무전기' },
    { id: 'cape', name: '망토' }, { id: 'sword', name: '환도' },
  ],
  accent: [
    { id: 'ink', name: '먹', color: '#1d1b18' }, { id: 'red', name: '주', color: '#b3301c' }, { id: 'white', name: '백', color: '#e8e2d4' },
    { id: 'gold', name: '황', color: '#b08a3c' }, { id: 'jade', name: '옥', color: '#4f8a78' },
  ],
};
export const LOOK_PARTS = [['helmet', '머리'], ['face', '얼굴'], ['body', '옷'], ['gear', '장비'], ['accent', '띠 색']];

export function cleanLook(v) {
  const out = {};
  for (const k of Object.keys(LOOKS)) {
    const id = v && typeof v[k] === 'string' ? v[k] : '';
    out[k] = LOOKS[k].some((o) => o.id === id) ? id : LOOKS[k][0].id;
  }
  return out;
}

export function randomLook(rnd = Math.random) {
  const out = {};
  for (const k of Object.keys(LOOKS)) out[k] = LOOKS[k][Math.floor(rnd() * LOOKS[k].length)].id;
  return out;
}

// ── 총 스킨 (코인 뽑기) ──────────────────────────
export const RARITY = {
  common: { id: 'common', name: '일반', hanja: '凡', color: '#8b8579', weight: 58, refund: 20 },
  rare: { id: 'rare', name: '희귀', hanja: '稀', color: '#3d7bb0', weight: 29, refund: 50 },
  epic: { id: 'epic', name: '영웅', hanja: '雄', color: '#8c4fb5', weight: 10.5, refund: 150 },
  legendary: { id: 'legendary', name: '전설', hanja: '傳', color: '#c9982f', weight: 2.5, refund: 500 },
};
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

// sound: 스킨마다 총소리가 다르다 (audio.js 의 GUN_VOICES)
export const SKIN_STYLES = [
  { id: 'default', name: '기본', rarity: 'common', pattern: 'plain', body: '#3b3936', accent: '#232220', sound: 'classic', starter: true },
  { id: 'sand', name: '황토', rarity: 'common', pattern: 'stripe', body: '#b39a6d', accent: '#6b573a', sound: 'dry' },
  { id: 'forest', name: '녹림 위장', rarity: 'common', pattern: 'camo', body: '#66704f', accent: '#2f3827', sound: 'thud' },
  { id: 'frost', name: '서리', rarity: 'common', pattern: 'frost', body: '#dde7ee', accent: '#86aac4', sound: 'frost' },
  { id: 'celadon', name: '청화 백자', rarity: 'rare', pattern: 'cloud', body: '#eef0ee', accent: '#2d5d9a', sound: 'crisp' },
  { id: 'inkwave', name: '먹물 파도', rarity: 'rare', pattern: 'wave', body: '#1b1b1d', accent: '#a3a8ad', sound: 'heavy' },
  { id: 'bamboo', name: '죽절', rarity: 'rare', pattern: 'bamboo', body: '#7d8b50', accent: '#3d4822', sound: 'wood' },
  { id: 'dragon', name: '청룡 비늘', rarity: 'epic', pattern: 'scale', body: '#1f5a56', accent: '#d9b44c', sound: 'thunder', tracer: '#3fb3a6' },
  { id: 'blossom', name: '매화', rarity: 'epic', pattern: 'blossom', body: '#efe1dd', accent: '#c2455a', sound: 'bell', tracer: '#d45a70' },
  { id: 'shadow', name: '야행', rarity: 'epic', pattern: 'shadow', body: '#151517', accent: '#c93a28', sound: 'silent', tracer: '#c93a28' },
  { id: 'phoenix', name: '황금 봉황', rarity: 'legendary', pattern: 'gold', body: '#d6ab3c', accent: '#9c291d', sound: 'phoenix', shiny: true, tracer: '#e8b83e' },
  { id: 'raijin', name: '뇌신', rarity: 'legendary', pattern: 'lightning', body: '#1c2142', accent: '#72e2ff', sound: 'laser', shiny: true, tracer: '#72e2ff' },
  { id: 'digital', name: '디지털 위장', rarity: 'common', pattern: 'digital', body: '#7b7d6f', accent: '#3b3d33', sound: 'tactical' },
  { id: 'arctic', name: '극지 위장', rarity: 'common', pattern: 'digital', body: '#e2e4e2', accent: '#8d9296', sound: 'crisp' },
  { id: 'rust', name: '녹슨 강철', rarity: 'common', pattern: 'rust', body: '#6e5a4c', accent: '#a4552c', sound: 'rusty' },
  { id: 'hanji', name: '한지', rarity: 'common', pattern: 'hanji', body: '#e9dfc9', accent: '#2a2622', sound: 'brush' },
  { id: 'hangul', name: '한글', rarity: 'rare', pattern: 'hangul', body: '#efe6d2', accent: '#1d1b18', sound: 'brush' },
  { id: 'magpie', name: '까치', rarity: 'rare', pattern: 'magpie', body: '#151618', accent: '#3b6fb0', sound: 'feather', tracer: '#3b6fb0' },
  { id: 'goryeo', name: '고려청자', rarity: 'rare', pattern: 'crackle', body: '#8fb5a2', accent: '#f0efe6', sound: 'jade', tracer: '#8fd0b2' },
  { id: 'neon', name: '네온 서울', rarity: 'rare', pattern: 'neon', body: '#120f1c', accent: '#ff3fb4', sound: 'synth', tracer: '#ff3fb4', shiny: true },
  { id: 'tiger', name: '호랑이', rarity: 'rare', pattern: 'tiger', body: '#d98a2e', accent: '#1a1410', sound: 'beast' },
  { id: 'dancheong', name: '단청', rarity: 'epic', pattern: 'dancheong', body: '#2f6f5e', accent: '#c23b2a', sound: 'temple', tracer: '#e0503a' },
  { id: 'dokkaebi', name: '도깨비불', rarity: 'epic', pattern: 'wisp', body: '#0c1220', accent: '#4fd0ff', sound: 'spirit', tracer: '#4fd0ff', shiny: true },
  { id: 'najeon', name: '나전칠기', rarity: 'epic', pattern: 'pearl', body: '#0d0d10', accent: '#bfe8e4', sound: 'shimmer', tracer: '#d6f2ee', shiny: true },
  { id: 'lava', name: '용암', rarity: 'epic', pattern: 'lava', body: '#1b1412', accent: '#ff6a1a', sound: 'magma', tracer: '#ff7a2a', shiny: true },
  { id: 'galaxy', name: '은하수', rarity: 'epic', pattern: 'galaxy', body: '#120d2a', accent: '#b58cff', sound: 'cosmic', tracer: '#c9a8ff', shiny: true },
  { id: 'baekho', name: '백호', rarity: 'legendary', pattern: 'whitetiger', body: '#f2f1ec', accent: '#5ab6ff', sound: 'roar', shiny: true, tracer: '#7cc6ff' },
  { id: 'jujak', name: '주작', rarity: 'legendary', pattern: 'flame', body: '#8e1b12', accent: '#ffb02e', sound: 'flame', shiny: true, tracer: '#ff8a2a' },
  { id: 'hyeonmu', name: '현무', rarity: 'legendary', pattern: 'hexshell', body: '#101a1a', accent: '#39e0b8', sound: 'abyss', shiny: true, tracer: '#39e0b8' },
  { id: 'taegeuk', name: '태극', rarity: 'legendary', pattern: 'taegeuk', body: '#f4f1ea', accent: '#c8102e', sound: 'harmony', shiny: true, tracer: '#e8e4ff' },
];

export const SKINS = {};
for (const w of WEAPON_IDS) {
  for (const st of SKIN_STYLES) {
    const id = `${w}.${st.id}`;
    SKINS[id] = { ...st, id, style: st.id, weapon: w, fullName: `${st.name} ${WEAPONS[w].name}` };
  }
}
export const defaultSkin = (w) => `${w}.default`;
export const GACHA_POOL = Object.values(SKINS).filter((s) => !s.starter);

export const GACHA = { cost: 100, cost10: 900, startCoins: 1000 };
export const COIN = { kill: 10, headshot: 5, assist: 4, capture: 15, win: 120, lose: 50, draw: 80 };

// minRarity 가 있으면 그 등급 이상만 나온다 (10연속 뽑기 보장)
export function rollSkin(rnd = Math.random, minRarity = 'common') {
  const minIdx = RARITY_ORDER.indexOf(minRarity);
  const tiers = RARITY_ORDER.filter((_, i) => i >= minIdx);
  const total = tiers.reduce((s, t) => s + RARITY[t].weight, 0);
  let r = rnd() * total, tier = tiers[tiers.length - 1];
  for (const t of tiers) {
    if ((r -= RARITY[t].weight) <= 0) { tier = t; break; }
  }
  const pool = GACHA_POOL.filter((s) => s.rarity === tier);
  return pool[Math.floor(rnd() * pool.length)];
}

export const DIFFICULTY = {
  easy: { name: '쉬움', react: 0.9, aimErr: 0.07, burst: 0.45, fov: 0.55 },
  normal: { name: '보통', react: 0.55, aimErr: 0.04, burst: 0.65, fov: 0.7 },
  hard: { name: '어려움', react: 0.3, aimErr: 0.02, burst: 0.85, fov: 0.85 },
};

export const BOT_NAMES = [
  '까마귀', '백호', '독수리', '늑대', '송골매', '호랑이', '표범', '반달곰',
  '승냥이', '살쾡이', '올빼미', '두루미', '먹구름', '벼락', '천둥', '서리',
];

export function falloffDamage(w, dist) {
  const [a, b] = w.falloff;
  if (dist <= a) return w.dmg;
  if (dist >= b) return w.minDmg;
  return w.dmg + (w.minDmg - w.dmg) * ((dist - a) / (b - a));
}

export function cleanName(s) {
  return String(s || '').replace(/[ -<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
}

// 이미지 에셋 로딩 + 캔버스로 그리는 표지·이름표·지도 썸네일
import * as THREE from 'three';
import { TEAMS, MAP_HALF } from '../shared/config.js';

const TEX = [
  'paper', 'ground', 'wall', 'ruin', 'sandbag', 'crate', 'metal', 'splat0', 'splat1', 'splat2', 'splat3', 'smoke', 'stroke',
  'mountains', 'sun', 'pine', 'tile', 'thatch', 'wood', 'container', 'bambooleaf', 'snowfield', 'paving', 'water', 'grass', 'asphalt',
];
const UI = ['enso', 'seal'];
const REPEAT = ['ground', 'wall', 'ruin', 'sandbag', 'metal', 'tile', 'thatch', 'wood', 'container', 'snowfield', 'paving', 'water', 'asphalt'];
export const tex = {};
export const img = {};
export const TEAM_COLOR = TEAMS.map((t) => t.hex);

export async function loadAssets(onProgress) {
  const loader = new THREE.TextureLoader();
  const total = TEX.length + UI.length;
  let done = 0;
  const tick = () => onProgress && onProgress(++done / total);
  await Promise.all([
    ...TEX.map((name) => loader.loadAsync(`assets/tex/${name}.png`).then((t) => { tex[name] = t; tick(); })),
    ...UI.map((name) => new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => { img[name] = im; tick(); resolve(); };
      im.onerror = reject;
      im.src = `assets/ui/${name}.svg`;
    })),
  ]);
  for (const n of REPEAT) {
    tex[n].wrapS = tex[n].wrapT = THREE.RepeatWrapping;
    tex[n].anisotropy = 8;
  }
  tex.mountains.wrapS = THREE.RepeatWrapping;
  return tex;
}

const canvasTex = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
};

// 원상 + 한자 한 글자 표지
export function labelTexture(glyph, ringColor = '#151412', textColor = '#151412', size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (img.enso) {
    ctx.drawImage(img.enso, 0, 0, size, size);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = ringColor;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = textColor;
  ctx.font = `${Math.round(size * 0.46)}px 'Song Myung', 'Batang', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.03);
  return canvasTex(c);
}

// 팀 깃발 천 (팀 색 바탕 + 흰 원상 + 한자)
export function bannerTexture(team) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d');
  ctx.fillStyle = TEAMS[team].css;
  ctx.fillRect(0, 0, 256, 384);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  for (let y = 0; y < 384; y += 6) ctx.fillRect(0, y, 256, 2);
  if (img.enso) {
    const s = document.createElement('canvas');
    s.width = s.height = 200;
    const sc = s.getContext('2d');
    sc.drawImage(img.enso, 0, 0, 200, 200);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = '#efe7d6';
    sc.fillRect(0, 0, 200, 200);
    ctx.drawImage(s, 28, 92);
  }
  ctx.fillStyle = '#efe7d6';
  ctx.font = "120px 'Song Myung', 'Batang', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TEAMS[team].hanja, 128, 198);
  ctx.fillStyle = '#b3301c';
  ctx.fillRect(196, 330, 40, 40);
  return canvasTex(c);
}

export function nameTexture(name, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.font = "bold 30px 'Gowun Batang', 'Batang', serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(239,231,214,0.95)';
  ctx.strokeText(name, 128, 26);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 26);
  return canvasTex(c);
}

// 위에서 내려다본 수묵 지도 (투표 카드, 미니맵 공용)
export function drawMap(ctx, map, size, { points = true, spawns = true } = {}) {
  const k = size / (MAP_HALF * 2);
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(MAP_HALF, MAP_HALF);
  ctx.fillStyle = map.id === 'snow' ? '#f4f3ef' : '#e8dfca';
  ctx.fillRect(-MAP_HALF, -MAP_HALF, MAP_HALF * 2, MAP_HALF * 2);
  for (const p of map.props) {
    if (p.kind === 'pond' || p.kind === 'paddy' || p.kind === 'sea') {
      ctx.fillStyle = 'rgba(80,92,104,.28)';
      if (p.kind === 'pond') { ctx.beginPath(); ctx.ellipse(p.x, p.z, p.rx, p.rz, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (p.kind === 'paddy') ctx.fillRect(p.x - p.w / 2 + 0.4, p.z - p.d / 2 + 0.4, p.w - 0.8, p.d - 0.8);
      else ctx.fillRect(p.x, -MAP_HALF, MAP_HALF, MAP_HALF * 2);
    } else if (p.kind === 'paving') {
      ctx.fillStyle = 'rgba(27,26,24,.08)';
      ctx.fillRect(p.x - p.w / 2, p.z - p.d / 2, p.w, p.d);
    }
  }
  for (const b of map.boxes) {
    const h = b.max[1] - b.min[1];
    if (b.max[1] < 0.9 || b.noShoot || b.min[1] > 2) continue;
    ctx.fillStyle = h > 4.5 ? 'rgba(27,26,24,0.85)' : h > 2 ? 'rgba(27,26,24,0.55)' : 'rgba(27,26,24,0.3)';
    ctx.fillRect(b.min[0], b.min[2], b.max[0] - b.min[0], b.max[2] - b.min[2]);
  }
  if (spawns) {
    for (const t of [0, 1]) {
      ctx.fillStyle = TEAMS[t].css;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(-46, (t ? 1 : -1) * 70 - 1.5, 92, 3);
      ctx.globalAlpha = 1;
    }
  }
  if (points) {
    for (const P of map.points) {
      ctx.beginPath();
      ctx.arc(P.x, P.z, P.r, 0, Math.PI * 2);
      ctx.strokeStyle = '#b3301c';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(27,26,24,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-MAP_HALF, -MAP_HALF, MAP_HALF * 2, MAP_HALF * 2);
  ctx.restore();
}

const thumbCache = new Map();
export function mapThumb(map, size = 320) {
  const key = `${map.id}:${map.seed}:${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawMap(c.getContext('2d'), map, size);
  const url = c.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}

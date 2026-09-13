// 총 스킨 — 무늬 텍스처(캔버스로 그림), 재질, 인벤토리용 썸네일
import * as THREE from 'three';
import { SKINS, WEAPONS, defaultSkin } from '../shared/config.js';

const texCache = new Map();
const matCache = new Map();
const thumbCache = new Map();
const svgCache = new Map();

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};

// 무늬 그리기 (512x512)
export function drawPattern(ctx, style, S = 512) {
  const { pattern, body, accent } = style;
  const R = mulberry(pattern.length * 977 + body.charCodeAt(1));
  ctx.save();
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, S, S);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (pattern) {
    case 'stripe':
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 26;
      for (let x = -S; x < S * 2; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + S, S); ctx.stroke(); }
      break;
    case 'camo':
      for (const [col, n, r] of [[accent, 22, 60], [shade(body, 1.35), 16, 45], [shade(accent, 0.55), 14, 36]]) {
        ctx.fillStyle = col;
        for (let i = 0; i < n; i++) {
          const x = R() * S, y = R() * S;
          ctx.beginPath();
          for (let a = 0; a <= 12; a++) {
            const ang = (a / 12) * Math.PI * 2, rr = r * (0.55 + R() * 0.6);
            const px = x + Math.cos(ang) * rr * 1.4, py = y + Math.sin(ang) * rr;
            if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    case 'frost':
      ctx.strokeStyle = accent;
      for (let i = 0; i < 14; i++) {
        const x = R() * S, y = R() * S;
        for (let b = 0; b < 6; b++) {
          const a = (b / 6) * Math.PI * 2, len = 20 + R() * 40;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
          ctx.lineWidth = 2;
          for (const t of [0.4, 0.7]) {
            const bx = x + Math.cos(a) * len * t, by = y + Math.sin(a) * len * t;
            for (const s of [-0.6, 0.6]) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + s) * 10, by + Math.sin(a + s) * 10); ctx.stroke(); }
          }
        }
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.5 + R() * 0.5; ctx.fillRect(R() * S, R() * S, 3, 3); }
      break;
    case 'cloud':
      ctx.strokeStyle = accent;
      ctx.lineWidth = 7;
      for (let i = 0; i < 10; i++) {
        const x = R() * S, y = R() * S, r = 26 + R() * 22;
        ctx.beginPath();
        ctx.arc(x, y, r, Math.PI * 0.2, Math.PI * 1.9);
        ctx.arc(x + r * 1.2, y + r * 0.3, r * 0.7, Math.PI * 1.1, Math.PI * 2.6);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 1.5); ctx.stroke();
      }
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      for (const y of [30, S - 30]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
      break;
    case 'wave': {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      const r = 40;
      for (let row = 0; row < 16; row++) {
        for (let col = -1; col < 8; col++) {
          const cx = col * r * 2 + (row % 2) * r, cy = row * r * 0.55;
          for (let k = 3; k >= 1; k--) {
            ctx.fillStyle = body;
            ctx.beginPath(); ctx.arc(cx, cy, (r * k) / 3, Math.PI, 0); ctx.fill(); ctx.stroke();
          }
        }
      }
      break;
    }
    case 'bamboo':
      for (let x = 0; x < S; x += 64) {
        ctx.fillStyle = shade(body, 0.8 + R() * 0.4);
        ctx.fillRect(x + 6, 0, 52, S);
        ctx.fillStyle = accent;
        for (let y = R() * 60; y < S; y += 90 + R() * 30) ctx.fillRect(x + 2, y, 60, 7);
      }
      ctx.fillStyle = accent;
      for (let i = 0; i < 12; i++) {
        const x = R() * S, y = R() * S, a = R() * Math.PI * 2;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      break;
    case 'scale': {
      const r = 34;
      for (let row = 0; row < 20; row++) {
        for (let col = -1; col < 9; col++) {
          const cx = col * r * 2 + (row % 2) * r, cy = row * r * 0.9;
          const g = ctx.createRadialGradient(cx, cy - r * 0.3, 2, cx, cy, r);
          g.addColorStop(0, shade(body, 1.5));
          g.addColorStop(1, shade(body, 0.7));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
          ctx.strokeStyle = accent; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.stroke();
        }
      }
      break;
    }
    case 'blossom':
      ctx.strokeStyle = '#3a2a22';
      ctx.lineWidth = 9;
      for (let i = 0; i < 4; i++) {
        let x = R() * S, y = S, a = -Math.PI / 2 + (R() - 0.5);
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 8; s++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 60; y += Math.sin(a) * 60; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let i = 0; i < 26; i++) {
        const x = R() * S, y = R() * S, r = 10 + R() * 9;
        ctx.fillStyle = accent;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#e8c35a';
        ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'shadow':
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        let x = R() * S, y = R() * S;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          if (R() < 0.5) x += (R() < 0.5 ? -1 : 1) * (30 + R() * 50); else y += (R() < 0.5 ? -1 : 1) * (30 + R() * 50);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'gold': {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, shade(body, 1.3)); g.addColorStop(0.35, body); g.addColorStop(0.5, shade(body, 1.45));
      g.addColorStop(0.65, body); g.addColorStop(1, shade(body, 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        const x = R() * S, y = R() * S;
        ctx.beginPath();
        for (let t = 0; t < 26; t++) {
          const a = t * 0.45, r = 4 + t * 2.4;
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
          if (t) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = shade(body, 0.6);
      for (let i = 0; i < 16; i++) {
        const x = R() * S, y = R() * S;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 40, y - 30, x + 90, y + 10); ctx.stroke();
      }
      break;
    }
    case 'lightning':
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = accent;
      for (let i = 0; i < 7; i++) {
        let x = R() * S, y = 0;
        ctx.lineWidth = 3 + R() * 4;
        ctx.beginPath(); ctx.moveTo(x, y);
        while (y < S) { x += (R() - 0.5) * 70; y += 20 + R() * 40; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 60; i++) ctx.fillRect(R() * S, R() * S, 2, 2);
      break;
    default: // plain
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = R() < 0.5 ? '#000' : '#fff';
        ctx.fillRect(R() * S, R() * S, 2 + R() * 3, 2 + R() * 3);
      }
  }
  ctx.restore();
}

export function skinTexture(skinId) {
  if (texCache.has(skinId)) return texCache.get(skinId);
  const s = SKINS[skinId];
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  drawPattern(c.getContext('2d'), s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache.set(skinId, t);
  return t;
}

// { body, accent, metal } 재질
export function skinMaterials(skinId) {
  const id = SKINS[skinId] ? skinId : 'rifle.default';
  if (matCache.has(id)) return matCache.get(id);
  const s = SKINS[id];
  const map = skinTexture(id);
  let body;
  if (s.shiny) {
    body = new THREE.MeshPhongMaterial({ map, shininess: 70, specular: new THREE.Color(s.pattern === 'gold' ? 0x9a7a30 : 0x4a7aa0) });
    if (s.pattern === 'lightning') { body.emissive = new THREE.Color(0x225566); body.emissiveMap = map; }
  } else {
    body = new THREE.MeshLambertMaterial({ map });
  }
  const accent = new THREE.MeshLambertMaterial({ color: new THREE.Color(s.accent) });
  if (s.pattern === 'lightning') accent.emissive = new THREE.Color(s.accent).multiplyScalar(0.8);
  const metal = new THREE.MeshPhongMaterial({ color: s.style === 'phoenix' ? 0x5a4520 : 0x1e1d1b, shininess: 40, specular: 0x333333 });
  const out = { body, accent, metal };
  matCache.set(id, out);
  return out;
}

function loadSvg(src) {
  if (svgCache.has(src)) return svgCache.get(src);
  const p = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
  svgCache.set(src, p);
  return p;
}

// 무기 실루엣에 무늬를 입힌 썸네일 (dataURL)
export async function skinThumb(skinId, W = 240, H = 80) {
  const key = `${skinId}@${W}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const s = SKINS[skinId] || SKINS[defaultSkin('rifle')];
  const im = await loadSvg(`assets/ui/${WEAPONS[s.weapon].icon}.svg`);
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext('2d');
  // 1) 테두리용 검은 실루엣을 약간 크게
  for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) ctx.drawImage(im, ox, oy, c.width, c.height);
  // 2) 무늬 실루엣
  const p = document.createElement('canvas');
  p.width = c.width;
  p.height = c.height;
  const pc = p.getContext('2d');
  pc.drawImage(im, 0, 0, p.width, p.height);
  pc.globalCompositeOperation = 'source-in';
  const pat = document.createElement('canvas');
  pat.width = pat.height = 512;
  drawPattern(pat.getContext('2d'), s);
  pc.drawImage(pat, 0, 0, p.width, p.width);
  pc.globalCompositeOperation = 'source-atop';
  const shine = pc.createLinearGradient(0, 0, 0, p.height);
  shine.addColorStop(0, 'rgba(255,255,255,.22)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  shine.addColorStop(1, 'rgba(0,0,0,.25)');
  pc.fillStyle = shine;
  pc.fillRect(0, 0, p.width, p.height);
  ctx.drawImage(p, 0, 0);
  const url = c.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}

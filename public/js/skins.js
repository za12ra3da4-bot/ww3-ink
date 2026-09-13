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
    case 'digital': {
      const cell = 16;
      const cols = [accent, shade(body, 1.25), shade(body, 0.75), body];
      for (let y = 0; y < S; y += cell) {
        for (let x = 0; x < S; x += cell) {
          const n = Math.sin(x * 0.021 + Math.sin(y * 0.017) * 3) + Math.cos(y * 0.019 + x * 0.007) + (R() - 0.5) * 0.8;
          ctx.fillStyle = cols[Math.max(0, Math.min(3, Math.floor((n + 2) * 1)))];
          ctx.fillRect(x, y, cell, cell);
        }
      }
      break;
    }
    case 'rust':
      for (let i = 0; i < 60; i++) {
        const x = R() * S, y = R() * S, r = 10 + R() * 50;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, R() < 0.5 ? accent : shade(accent, 0.6));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.35 + R() * 0.4;
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = shade(body, 0.5);
      for (let i = 0; i < 30; i++) { ctx.lineWidth = 1 + R() * 2; ctx.beginPath(); const x = R() * S; ctx.moveTo(x, 0); ctx.lineTo(x + (R() - 0.5) * 30, S); ctx.stroke(); }
      break;
    case 'hanji':
    case 'hangul': {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = shade(body, 0.8);
      for (let i = 0; i < 300; i++) ctx.fillRect(R() * S, R() * S, 1 + R() * 18, 1);
      ctx.globalAlpha = 1;
      if (pattern === 'hanji') {
        ctx.strokeStyle = accent;
        for (let i = 0; i < 6; i++) {
          ctx.lineWidth = 8 + R() * 16;
          ctx.globalAlpha = 0.6 + R() * 0.4;
          ctx.beginPath();
          const x = R() * S, y = R() * S;
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + (R() - 0.5) * 300, y + (R() - 0.5) * 200, x + (R() - 0.5) * 400, y + (R() - 0.5) * 300);
          ctx.stroke();
        }
      } else {
        const letters = '가나다라마바사아자차카타파하한글묵전청흑용봉호랑';
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let y = 36; y < S; y += 72) {
          for (let x = 36; x < S; x += 72) {
            ctx.font = `${48 + R() * 20}px 'Nanum Brush Script', 'Song Myung', serif`;
            ctx.globalAlpha = 0.55 + R() * 0.45;
            ctx.save(); ctx.translate(x, y); ctx.rotate((R() - 0.5) * 0.4);
            ctx.fillText(letters[Math.floor(R() * letters.length)], 0, 0);
            ctx.restore();
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#b3301c';
        ctx.fillRect(S - 70, S - 70, 44, 44);
      }
      break;
    }
    case 'magpie':
      ctx.fillStyle = '#f4f2ec';
      for (let i = 0; i < 7; i++) {
        const x = R() * S, y = R() * S;
        ctx.beginPath(); ctx.ellipse(x, y, 70, 26, R() * Math.PI, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      for (let i = 0; i < 16; i++) {
        const x = R() * S, y = R() * S, a = R() * Math.PI;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        for (let f = -3; f <= 3; f++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, f * 6, 70, f * 12); ctx.stroke(); }
        ctx.restore();
      }
      break;
    case 'crackle':
      ctx.strokeStyle = shade(body, 0.65);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 70; i++) {
        let x = R() * S, y = R() * S;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      ctx.strokeStyle = shade(body, 0.4);
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const x = R() * S, y = R() * S;
        ctx.save(); ctx.translate(x, y); ctx.rotate(R() * 6.28);
        ctx.beginPath(); ctx.ellipse(0, 0, 36, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(30, -4); ctx.quadraticCurveTo(60, -30, 76, -26); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-40, -50); ctx.lineTo(10, -14); ctx.fill();
        ctx.restore();
      }
      break;
    case 'neon':
      ctx.shadowBlur = 16;
      for (const [c, n] of [[accent, 10], ['#38e8ff', 9], ['#ffe14a', 4]]) {
        ctx.strokeStyle = c;
        ctx.shadowColor = c;
        for (let i = 0; i < n; i++) {
          ctx.lineWidth = 3 + R() * 3;
          ctx.beginPath();
          let x = R() * S, y = R() * S;
          ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) { if (k % 2) x += (R() - 0.5) * 260; else y += (R() - 0.5) * 260; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
      break;
    case 'tiger':
    case 'whitetiger':
      ctx.fillStyle = pattern === 'tiger' ? accent : '#141414';
      for (let i = 0; i < 26; i++) {
        const y = R() * S, w = 20 + R() * 30;
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.bezierCurveTo(S * 0.3, y - w, S * 0.5, y + w * 1.4, S * 0.55 + R() * 200, y + (R() - 0.5) * 40);
        ctx.bezierCurveTo(S * 0.45, y + w * 0.4, S * 0.25, y + w * 0.2, -20, y + 10);
        ctx.fill();
      }
      if (pattern === 'whitetiger') {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(R() * S, R() * S, 20 + R() * 40, 0, Math.PI * (0.5 + R())); ctx.stroke(); }
        ctx.shadowBlur = 0;
      }
      break;
    case 'dancheong': {
      const tile = 128;
      for (let y = 0; y < S; y += tile) {
        for (let x = 0; x < S; x += tile) {
          ctx.save(); ctx.translate(x + tile / 2, y + tile / 2);
          for (const [r, c] of [[58, accent], [46, '#e8c35a'], [36, '#2b4f8f'], [24, '#efe7d6'], [14, accent]]) {
            ctx.fillStyle = c;
            ctx.beginPath();
            for (let p = 0; p < 8; p++) { const a = (p / 8) * Math.PI * 2; const rr = p % 2 ? r * 0.72 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
            ctx.closePath(); ctx.fill();
          }
          ctx.restore();
        }
      }
      break;
    }
    case 'wisp':
      for (let i = 0; i < 14; i++) {
        const x = R() * S, y = R() * S, r = 20 + R() * 40;
        const g = ctx.createRadialGradient(x, y + r * 0.3, 1, x, y, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, accent); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + r * 0.4);
        ctx.quadraticCurveTo(x - r * 0.2, y - r * 1.8, x + r * 0.1, y - r * 2.2);
        ctx.quadraticCurveTo(x + r * 0.9, y - r * 0.6, x + r * 0.6, y + r * 0.5);
        ctx.arc(x, y + r * 0.3, r * 0.65, 0, Math.PI);
        ctx.fill();
      }
      break;
    case 'pearl':
      for (let i = 0; i < 90; i++) {
        const x = R() * S, y = R() * S, w = 8 + R() * 30, h = 4 + R() * 14;
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#9fe7e0'); g.addColorStop(0.35, '#f3d6ff'); g.addColorStop(0.7, '#d9f7c8'); g.addColorStop(1, '#8fc3ff');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.6 + R() * 0.4;
        ctx.save(); ctx.translate(x, y); ctx.rotate(R() * 6.28);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h * 0.3); ctx.lineTo(w * 0.7, h); ctx.lineTo(-w * 0.1, h * 0.8); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#e8c35a';
      ctx.lineWidth = 2;
      for (let x = 40; x < S; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 60, S * 0.3, x - 60, S * 0.7, x, S); ctx.stroke(); }
      break;
    case 'lava':
    case 'flame':
      if (pattern === 'lava') {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = accent;
        for (let i = 0; i < 40; i++) {
          ctx.lineWidth = 2 + R() * 5;
          let x = R() * S, y = R() * S;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 80; y += (R() - 0.5) * 80; ctx.lineTo(x, y); }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else {
        for (let i = 0; i < 26; i++) {
          const x = R() * S, y = R() * S + 60, h = 60 + R() * 120, w = 20 + R() * 30;
          const g = ctx.createLinearGradient(x, y, x, y - h);
          g.addColorStop(0, '#ffe36a'); g.addColorStop(0.4, accent); g.addColorStop(1, 'rgba(160,20,10,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x - w, y);
          ctx.quadraticCurveTo(x - w, y - h * 0.6, x + (R() - 0.5) * w, y - h);
          ctx.quadraticCurveTo(x + w, y - h * 0.5, x + w, y);
          ctx.fill();
        }
        ctx.strokeStyle = '#ffd35a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          const x = R() * S, y = R() * S;
          ctx.beginPath();
          for (let f = 0; f < 6; f++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 40, y - 20 - f * 8, x + 90, y - f * 14); }
          ctx.stroke();
        }
      }
      break;
    case 'galaxy': {
      for (const [c, n] of [[accent, 5], ['#4fb0ff', 4], ['#ff6fd0', 3]]) {
        for (let i = 0; i < n; i++) {
          const x = R() * S, y = R() * S, r = 80 + R() * 140;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 220; i++) { const s2 = R() < 0.9 ? 1.5 : 3.5; ctx.globalAlpha = 0.4 + R() * 0.6; ctx.fillRect(R() * S, R() * S, s2, s2); }
      break;
    }
    case 'hexshell': {
      const r = 38, h = r * Math.sqrt(3);
      ctx.lineWidth = 4;
      for (let row = -1; row < S / h + 1; row++) {
        for (let col = -1; col < S / (r * 1.5) + 1; col++) {
          const cx = col * r * 1.5, cy = row * h + (col % 2 ? h / 2 : 0);
          ctx.beginPath();
          for (let p = 0; p < 6; p++) { const a = (p / 6) * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3)); }
          ctx.closePath();
          ctx.fillStyle = shade(body, 1.3 + R() * 0.8);
          ctx.fill();
          ctx.strokeStyle = accent;
          ctx.shadowColor = accent;
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      break;
    }
    case 'taegeuk': {
      const tile = 256;
      for (let y = 0; y < S; y += tile) {
        for (let x = 0; x < S; x += tile) {
          const cx = x + tile / 2, cy = y + tile / 2, r = 90;
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.arc(cx + r / 2, cy, r / 2, 0, Math.PI, true); ctx.arc(cx - r / 2, cy, r / 2, 0, Math.PI); ctx.fill();
          ctx.fillStyle = '#0047a0';
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.arc(cx - r / 2, cy, r / 2, Math.PI, 0, true); ctx.arc(cx + r / 2, cy, r / 2, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#151412';
          const bar = (bx, by, a, broken) => {
            ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
            for (let k = 0; k < 3; k++) {
              if (broken[k]) { ctx.fillRect(-22, -14 + k * 10, 18, 6); ctx.fillRect(4, -14 + k * 10, 18, 6); } else ctx.fillRect(-22, -14 + k * 10, 44, 6);
            }
            ctx.restore();
          };
          bar(cx - 110, cy - 90, -Math.PI / 4 - 0.2, [0, 0, 0]);
          bar(cx + 110, cy + 90, -Math.PI / 4 - 0.2, [1, 1, 1]);
          bar(cx + 110, cy - 90, Math.PI / 4 + 0.2, [0, 1, 0]);
          bar(cx - 110, cy + 90, Math.PI / 4 + 0.2, [1, 0, 1]);
        }
      }
      break;
    }
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

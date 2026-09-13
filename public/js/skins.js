// 총 스킨 — 총 한 자루를 감싸는 1024×512 도안(옆면 기준), 재질(영웅·전설은 빛 흐름), 인벤토리 썸네일
// 도안 좌표: 가로 = 총 길이(개머리판 → 총구), 세로 = 총 높이. 가운데 띠(세로 25%~75%)가 옆면에 가장 잘 보인다.
import * as THREE from 'three';
import { SKINS, WEAPONS, RARITY, defaultSkin } from '../shared/config.js';

export const TW = 1024, TH = 512;
const texCache = new Map();
const matCache = new Map();
const thumbCache = new Map();
const svgCache = new Map();
export const SKIN_TIME = { value: 0 };
export const tickSkins = (t) => { SKIN_TIME.value = t; };

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
const mix = (a, b, k) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;

// ── 공용 붓 ───────────────────────────────────────
function grain(ctx, R, alpha = 0.08, n = 2500) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * R();
    ctx.fillStyle = R() < 0.5 ? '#000' : '#fff';
    ctx.fillRect(R() * TW, R() * TH, 1 + R() * 2, 1 + R() * 2);
  }
  ctx.globalAlpha = 1;
}
function brushed(ctx, R, alpha = 0.06) {
  ctx.lineWidth = 1;
  for (let i = 0; i < 600; i++) {
    ctx.globalAlpha = alpha * R();
    ctx.strokeStyle = R() < 0.5 ? '#000' : '#fff';
    const y = R() * TH, x = R() * TW, l = 40 + R() * 200;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + (R() - 0.5) * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function gloss(ctx, strength = 0.25) {
  const g = ctx.createLinearGradient(0, 0, 0, TH);
  g.addColorStop(0, `rgba(255,255,255,${strength})`);
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength * 1.3})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TW, TH);
}
// 가로 테두리 띠 (총신을 따라 흐르는 금선)
function trims(ctx, color, width = 6, ys = [0.26, 0.74]) {
  ctx.strokeStyle = color;
  for (const y of ys) {
    ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(0, TH * y); ctx.lineTo(TW, TH * y); ctx.stroke();
    ctx.lineWidth = width / 3; ctx.beginPath(); ctx.moveTo(0, TH * y + width * 1.6 * (y < 0.5 ? 1 : -1)); ctx.lineTo(TW, TH * y + width * 1.6 * (y < 0.5 ? 1 : -1)); ctx.stroke();
  }
}
function panels(ctx, color = 'rgba(0,0,0,.35)') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const x of [0.22, 0.47, 0.71]) { ctx.beginPath(); ctx.moveTo(TW * x, TH * 0.2); ctx.lineTo(TW * x, TH * 0.8); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  for (const x of [0.24, 0.45, 0.73]) for (const y of [0.33, 0.67]) { ctx.beginPath(); ctx.arc(TW * x, TH * y, 4, 0, 7); ctx.fill(); }
}
function blob(ctx, R, x, y, r, pts = 14) {
  ctx.beginPath();
  for (let a = 0; a <= pts; a++) {
    const ang = (a / pts) * Math.PI * 2, rr = r * (0.6 + R() * 0.55);
    const px = x + Math.cos(ang) * rr * 1.5, py = y + Math.sin(ang) * rr;
    if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
function cloudMotif(ctx, x, y, s, color, lw = 5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, 22 * s, Math.PI * 0.9, Math.PI * 2.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 30 * s, y + 6 * s, 15 * s, Math.PI * 1.1, Math.PI * 2.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 26 * s, y + 8 * s, 12 * s, Math.PI * 0.4, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 40 * s, y + 20 * s); ctx.quadraticCurveTo(x, y + 30 * s, x + 50 * s, y + 18 * s); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 8 * s, 0, Math.PI * 1.4); ctx.stroke();
}
function glowStroke(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}
function feather(ctx, x, y, len, ang, w, fill) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -w, len, 0);
  ctx.quadraticCurveTo(len * 0.5, w * 0.6, 0, 0);
  ctx.fill();
  ctx.restore();
}

// ── 도안 ─────────────────────────────────────────
export function drawPattern(ctx, style) {
  const { pattern, body, accent } = style;
  const R = mulberry(pattern.length * 977 + body.charCodeAt(1) * 31 + accent.charCodeAt(2));
  const cx = TW / 2, cy = TH / 2;
  ctx.save();
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, TW, TH);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (pattern) {
    case 'plain':
      brushed(ctx, R, 0.08);
      panels(ctx);
      grain(ctx, R, 0.06);
      gloss(ctx, 0.12);
      break;

    case 'stripe':
      brushed(ctx, R, 0.05);
      ctx.fillStyle = accent;
      for (let x = -TH; x < TW + TH; x += 90) {
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 38, 0); ctx.lineTo(x + 38 + TH * 0.6, TH); ctx.lineTo(x + TH * 0.6, TH); ctx.fill();
      }
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = shade(accent, 0.6);
      ctx.font = "bold 44px 'Song Myung', serif";
      ctx.fillText('黃土 · 03', TW * 0.58, TH * 0.58);
      ctx.globalAlpha = 1;
      grain(ctx, R, 0.1);
      break;

    case 'camo':
      for (const [col, n, r] of [[shade(body, 1.3), 18, 70], [accent, 22, 60], [shade(accent, 0.55), 18, 44], [mix(body, '#a79b6e', 0.5), 12, 34]]) {
        ctx.fillStyle = col;
        for (let i = 0; i < n; i++) blob(ctx, R, R() * TW, R() * TH, r * (0.6 + R() * 0.6));
      }
      grain(ctx, R, 0.1);
      gloss(ctx, 0.08);
      break;

    case 'digital': {
      const cols = [accent, shade(body, 1.3), shade(body, 0.72), body, mix(body, accent, 0.5)];
      const cell = 14;
      for (let y = 0; y < TH; y += cell) {
        for (let x = 0; x < TW; x += cell) {
          const n = Math.sin(x * 0.011 + Math.sin(y * 0.02) * 2.4) + Math.cos(y * 0.017 + x * 0.004) + Math.sin((x + y) * 0.03) * 0.5 + (R() - 0.5) * 0.9;
          ctx.fillStyle = cols[Math.max(0, Math.min(4, Math.floor((n + 2.5) * 1)))];
          ctx.fillRect(x, y, cell, cell);
        }
      }
      grain(ctx, R, 0.05);
      break;
    }

    case 'frost': {
      const g = ctx.createLinearGradient(0, 0, TW, TH);
      g.addColorStop(0, '#f4f8fb'); g.addColorStop(0.5, body); g.addColorStop(1, mix(body, accent, 0.5));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      const branch = (x, y, len, ang, depth) => {
        const nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
        ctx.lineWidth = Math.max(0.6, depth * 1.3);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        if (depth > 0) for (const s of [-0.55, 0.55]) branch(x + (nx - x) * 0.55, y + (ny - y) * 0.55, len * 0.55, ang + s, depth - 1);
      };
      ctx.strokeStyle = mix(accent, '#ffffff', 0.2);
      for (let i = 0; i < 16; i++) {
        const x = R() * TW, y = R() * TH, s = 30 + R() * 50;
        for (let k = 0; k < 6; k++) branch(x, y, s, (k / 6) * Math.PI * 2 + R() * 0.2, 3);
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 300; i++) { ctx.globalAlpha = 0.3 + R() * 0.7; ctx.fillRect(R() * TW, R() * TH, 2, 2); }
      ctx.globalAlpha = 1;
      gloss(ctx, 0.3);
      break;
    }

    case 'rust':
      brushed(ctx, R, 0.1);
      for (let i = 0; i < 90; i++) {
        const x = R() * TW, y = R() * TH, r = 12 + R() * 70;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, R() < 0.5 ? accent : shade(accent, 0.55));
        g.addColorStop(0.6, shade(accent, 0.4));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.3 + R() * 0.5;
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#d9d3c8';
      for (let i = 0; i < 40; i++) { ctx.lineWidth = 0.8; ctx.beginPath(); const x = R() * TW, y = R() * TH; ctx.moveTo(x, y); ctx.lineTo(x + 30 + R() * 60, y + (R() - 0.5) * 20); ctx.stroke(); }
      ctx.globalAlpha = 1;
      panels(ctx, 'rgba(0,0,0,.45)');
      break;

    case 'hanji':
    case 'hangul': {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = shade(body, 0.75);
      for (let i = 0; i < 900; i++) { ctx.lineWidth = 0.7; ctx.beginPath(); const x = R() * TW, y = R() * TH; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y + (R() - 0.5) * 10, x + 5 + R() * 40, y + (R() - 0.5) * 12); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (pattern === 'hanji') {
        ctx.strokeStyle = accent;
        for (let i = 0; i < 5; i++) {
          const x = TW * (0.1 + i * 0.2), y = TH * (0.35 + R() * 0.3);
          for (let k = 0; k < 12; k++) {
            ctx.globalAlpha = 0.08 + (k / 12) * 0.12;
            ctx.lineWidth = 50 - k * 3.5;
            ctx.beginPath(); ctx.moveTo(x - 90, y + 40); ctx.bezierCurveTo(x - 20, y - 60, x + 60, y + 60, x + 150, y - 30); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      } else {
        const lines = ['동해물과 백두산이', '마르고 닳도록', '하느님이 보우하사', '묵전 청군 흑군'];
        ctx.fillStyle = accent;
        ctx.textBaseline = 'middle';
        lines.forEach((t, i) => {
          ctx.font = `${58 + (i % 2) * 10}px 'Nanum Brush Script', 'Song Myung', serif`;
          ctx.globalAlpha = 0.85;
          ctx.fillText(t, 40 + i * 70, TH * (0.3 + i * 0.14));
        });
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#b3301c';
      ctx.fillRect(TW * 0.82, TH * 0.56, 64, 64);
      ctx.fillStyle = '#efe7d6';
      ctx.font = "34px 'Song Myung', serif";
      ctx.fillText('墨', TW * 0.82 + 15, TH * 0.56 + 44);
      break;
    }

    case 'cloud': {
      const g = ctx.createLinearGradient(0, 0, 0, TH);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      trims(ctx, accent, 5, [0.24, 0.76]);
      for (let i = 0; i < 9; i++) cloudMotif(ctx, 80 + i * 110 + (i % 2) * 20, TH * (0.4 + (i % 2) * 0.2), 1.1, accent, 6);
      ctx.fillStyle = accent;
      for (let x = 30; x < TW; x += 60) { ctx.beginPath(); ctx.moveTo(x, TH * 0.15); ctx.lineTo(x + 15, TH * 0.08); ctx.lineTo(x + 30, TH * 0.15); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, TH * 0.85); ctx.lineTo(x + 15, TH * 0.92); ctx.lineTo(x + 30, TH * 0.85); ctx.fill(); }
      gloss(ctx, 0.35);
      break;
    }

    case 'wave': {
      const r = 46;
      for (let row = -1; row < 16; row++) {
        for (let col = -1; col < 14; col++) {
          const x = col * r * 2 + (row % 2) * r, y = row * r * 0.52;
          for (let k = 4; k >= 1; k--) {
            ctx.fillStyle = k % 2 ? body : shade(body, 1.6);
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(x, y + r, (r * k) / 4, Math.PI, 0); ctx.fill(); ctx.stroke();
          }
        }
      }
      gloss(ctx, 0.2);
      break;
    }

    case 'bamboo': {
      const g = ctx.createLinearGradient(0, 0, TW, 0);
      g.addColorStop(0, mix(body, '#e7ecd8', 0.7)); g.addColorStop(1, mix(body, '#e7ecd8', 0.4));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      for (let i = 0; i < 9; i++) {
        const y = TH * (0.15 + R() * 0.7), h = 22 + R() * 16;
        ctx.fillStyle = shade(body, 0.7 + R() * 0.3);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(0, y, TW, h);
        ctx.fillStyle = accent;
        for (let x = R() * 120; x < TW; x += 130 + R() * 60) { ctx.fillRect(x, y - 3, 10, h + 6); }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      for (let i = 0; i < 24; i++) {
        const x = R() * TW, y = R() * TH, a = (R() - 0.5) * 1.2;
        for (let k = 0; k < 4; k++) feather(ctx, x, y, 60 + R() * 40, a + (k - 1.5) * 0.35, 12, accent);
      }
      grain(ctx, R, 0.06);
      break;
    }

    case 'magpie': {
      const g = ctx.createLinearGradient(0, 0, 0, TH);
      g.addColorStop(0, '#2a2d33'); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      ctx.strokeStyle = '#6b4d3a';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(-20, TH * 0.8); ctx.bezierCurveTo(TW * 0.3, TH * 0.4, TW * 0.6, TH * 0.9, TW + 20, TH * 0.45); ctx.stroke();
      ctx.fillStyle = '#e04a5a';
      for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(R() * TW, TH * (0.4 + R() * 0.45), 6 + R() * 6, 0, 7); ctx.fill(); }
      const bird = (x, y, s, flip) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
        ctx.fillStyle = '#0c0c0e';
        ctx.beginPath(); ctx.ellipse(0, 0, 60, 26, -0.2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(52, -22, 18, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-50, 5); ctx.lineTo(-150, 25); ctx.lineTo(-145, 5); ctx.fill();
        ctx.fillStyle = '#f4f2ec';
        ctx.beginPath(); ctx.ellipse(-5, 10, 34, 14, -0.2, 0, 7); ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.ellipse(-12, -8, 36, 10, -0.3, 0, 7); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.moveTo(68, -24); ctx.lineTo(90, -18); ctx.lineTo(68, -16); ctx.fill();
        ctx.restore();
      };
      bird(TW * 0.3, TH * 0.45, 1.1, false);
      bird(TW * 0.72, TH * 0.55, 0.9, true);
      gloss(ctx, 0.2);
      break;
    }

    case 'crackle': {
      const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, TW * 0.7);
      g.addColorStop(0, mix(body, '#ffffff', 0.25)); g.addColorStop(1, shade(body, 0.8));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      ctx.strokeStyle = shade(body, 0.62);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 160; i++) {
        let x = R() * TW, y = R() * TH;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      // 상감 학과 구름
      const crane = (x, y, s, flip) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s);
        ctx.fillStyle = accent; ctx.strokeStyle = '#26332e'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, 40, 14, -0.1, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(30, -6); ctx.quadraticCurveTo(70, -50, 95, -46); ctx.stroke();
        ctx.beginPath(); ctx.arc(97, -47, 6, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, -8); ctx.quadraticCurveTo(-40, -90, 20, -70); ctx.quadraticCurveTo(10, -30, 14, -10); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-38, 4); ctx.lineTo(-80, 22); ctx.stroke();
        ctx.restore();
      };
      crane(TW * 0.25, TH * 0.5, 1.1, false);
      crane(TW * 0.62, TH * 0.44, 0.95, true);
      crane(TW * 0.88, TH * 0.6, 0.7, false);
      for (let i = 0; i < 5; i++) cloudMotif(ctx, TW * (0.1 + i * 0.2), TH * (0.72 - (i % 2) * 0.42), 0.8, accent, 4);
      trims(ctx, '#26332e', 3, [0.2, 0.8]);
      gloss(ctx, 0.4);
      break;
    }

    case 'neon': {
      const g = ctx.createLinearGradient(0, 0, 0, TH);
      g.addColorStop(0, '#1b1030'); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      ctx.fillStyle = '#07060c';
      let x = 0;
      while (x < TW) { const w = 40 + R() * 70, h = TH * (0.25 + R() * 0.4); ctx.fillRect(x, TH - h, w, h); x += w + 4; }
      ctx.strokeStyle = 'rgba(56,232,255,.35)';
      ctx.lineWidth = 1;
      for (let y = TH * 0.78; y < TH; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(TW, y); ctx.stroke(); }
      for (let i = -10; i < 20; i++) { ctx.beginPath(); ctx.moveTo(cx, TH * 0.78); ctx.lineTo(cx + i * 90, TH); ctx.stroke(); }
      const sign = (t, x0, y0, c, size) => glowStroke(ctx, c, 24, () => {
        ctx.font = `${size}px 'Gowun Batang', serif`;
        ctx.fillStyle = c; ctx.fillText(t, x0, y0);
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6; ctx.fillText(t, x0, y0); ctx.globalAlpha = 1;
      });
      sign('서울', TW * 0.12, TH * 0.42, accent, 86);
      sign('묵전', TW * 0.55, TH * 0.36, '#38e8ff', 72);
      sign('24시', TW * 0.8, TH * 0.6, '#ffe14a', 48);
      glowStroke(ctx, accent, 20, () => {
        ctx.strokeStyle = accent; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(0, TH * 0.22); ctx.lineTo(TW, TH * 0.22); ctx.stroke();
      });
      break;
    }

    case 'tiger':
    case 'whitetiger': {
      if (pattern === 'tiger') {
        const g = ctx.createLinearGradient(0, 0, 0, TH);
        g.addColorStop(0, shade(body, 1.15)); g.addColorStop(0.7, body); g.addColorStop(1, '#f2e6cf');
        ctx.fillStyle = g;
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, TH);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8dde4');
        ctx.fillStyle = g;
      }
      ctx.fillRect(0, 0, TW, TH);
      ctx.fillStyle = pattern === 'tiger' ? accent : '#131316';
      for (let i = 0; i < 22; i++) {
        const x = (i / 22) * TW + (R() - 0.5) * 30, w = 12 + R() * 22, top = R() * TH * 0.2, len = TH * (0.45 + R() * 0.45);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.bezierCurveTo(x + w * 2, top + len * 0.3, x - w, top + len * 0.6, x + w * 0.4, top + len);
        ctx.bezierCurveTo(x + w * 1.5, top + len * 0.6, x + w * 3.2, top + len * 0.3, x + w * 0.9, top);
        ctx.fill();
        if (R() < 0.6) { ctx.beginPath(); ctx.ellipse(x + w * 2.5, top + len * 0.5, w * 0.5, w * 1.6, 0.3, 0, 7); ctx.fill(); }
      }
      if (pattern === 'whitetiger') {
        glowStroke(ctx, accent, 26, () => {
          ctx.strokeStyle = accent; ctx.lineWidth = 4;
          const runes = ['虎', '白', '西', '金'];
          ctx.font = "70px 'Song Myung', serif";
          runes.forEach((t, i) => { ctx.fillStyle = accent; ctx.fillText(t, TW * (0.12 + i * 0.24), TH * 0.6); });
          ctx.beginPath(); ctx.moveTo(0, TH * 0.28); ctx.lineTo(TW, TH * 0.28); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, TH * 0.72); ctx.lineTo(TW, TH * 0.72); ctx.stroke();
        });
        gloss(ctx, 0.35);
      } else {
        grain(ctx, R, 0.08);
      }
      break;
    }

    case 'scale': {
      const g = ctx.createLinearGradient(0, 0, 0, TH);
      g.addColorStop(0, shade(body, 1.5)); g.addColorStop(0.5, body); g.addColorStop(1, shade(body, 0.6));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      const r = 30;
      for (let row = 0; row < 22; row++) {
        for (let col = -1; col < 20; col++) {
          const x = col * r * 1.8 + (row % 2) * r * 0.9, y = row * r * 0.75;
          const gg = ctx.createRadialGradient(x, y + r * 0.2, 2, x, y + r * 0.4, r);
          gg.addColorStop(0, shade(body, 1.9)); gg.addColorStop(1, shade(body, 0.7));
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(x, y, r, 0.15, Math.PI - 0.15); ctx.fill();
          ctx.strokeStyle = shade(accent, 0.75); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, r, 0.15, Math.PI - 0.15); ctx.stroke();
        }
      }
      // 금빛 용 몸통이 총신을 휘감는다
      glowStroke(ctx, accent, 18, () => {
        ctx.strokeStyle = accent; ctx.lineWidth = 16;
        ctx.beginPath();
        for (let x = -40; x <= TW + 40; x += 8) { const y = cy + Math.sin(x * 0.011) * 110; if (x < -30) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.strokeStyle = shade(accent, 0.6); ctx.lineWidth = 5;
        for (let x = 0; x < TW; x += 26) { const y = cy + Math.sin(x * 0.011) * 110; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 10, y - 22); ctx.stroke(); }
      });
      const hx = TW * 0.86, hy = cy + Math.sin(hx * 0.011) * 110;
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(hx - 30, hy - 30); ctx.lineTo(hx + 60, hy - 10); ctx.lineTo(hx + 40, hy + 24); ctx.lineTo(hx - 20, hy + 26); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(hx + 50, hy - 8); ctx.quadraticCurveTo(hx + 110, hy - 60, hx + 140, hy - 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 20, hy - 26); ctx.lineTo(hx - 50, hy - 70); ctx.stroke();
      ctx.fillStyle = '#b3301c'; ctx.beginPath(); ctx.arc(hx + 18, hy - 8, 6, 0, 7); ctx.fill();
      gloss(ctx, 0.28);
      break;
    }

    case 'blossom': {
      const g = ctx.createLinearGradient(0, 0, TW, TH);
      g.addColorStop(0, '#fbf3f1'); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      const branchTo = (x, y, a, len, w, depth) => {
        const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
        ctx.strokeStyle = '#2d201a'; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + nx) / 2 + (R() - 0.5) * 30, (y + ny) / 2 + (R() - 0.5) * 30, nx, ny); ctx.stroke();
        if (depth > 0) { branchTo(nx, ny, a - 0.5 + R() * 0.3, len * 0.72, w * 0.62, depth - 1); if (R() < 0.8) branchTo(nx, ny, a + 0.4 + R() * 0.3, len * 0.6, w * 0.55, depth - 1); }
        else flowers.push([nx, ny]);
      };
      const flowers = [];
      branchTo(-20, TH * 0.9, -0.35, 240, 18, 4);
      branchTo(TW + 20, TH * 0.2, Math.PI + 0.25, 200, 14, 3);
      for (const [x, y] of flowers) {
        const r = 12 + R() * 8;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2 + R();
          const gg = ctx.createRadialGradient(x + Math.cos(a) * r, y + Math.sin(a) * r, 1, x + Math.cos(a) * r, y + Math.sin(a) * r, r);
          gg.addColorStop(0, '#ffffff'); gg.addColorStop(1, accent);
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, 0, 7); ctx.fill();
        }
        ctx.fillStyle = '#e8c35a';
        for (let s = 0; s < 6; s++) { const a = R() * 6.28; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, 2, 0, 7); ctx.fill(); }
      }
      ctx.fillStyle = accent;
      for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(R() * TW, R() * TH, 6, 3, R() * 3, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      gloss(ctx, 0.25);
      break;
    }

    case 'shadow': {
      brushed(ctx, R, 0.05);
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.lineWidth = 1;
      const hr = 14;
      for (let y = 0; y < TH + hr; y += hr * 1.5) for (let x = 0; x < TW + hr; x += hr * 1.73) {
        const ox = x + ((y / (hr * 1.5)) % 2) * hr * 0.86;
        ctx.beginPath(); for (let p = 0; p < 6; p++) { const a = (p / 6) * 6.283 + 0.52; ctx.lineTo(ox + Math.cos(a) * hr * 0.9, y + Math.sin(a) * hr * 0.9); } ctx.closePath(); ctx.stroke();
      }
      glowStroke(ctx, accent, 16, () => {
        ctx.strokeStyle = accent;
        for (const [x0, y0, x1, y1, w] of [[0, TH * 0.7, TW * 0.55, TH * 0.28, 7], [TW * 0.4, TH * 0.9, TW, TH * 0.35, 4], [TW * 0.1, TH * 0.3, TW * 0.3, TH * 0.22, 3]]) {
          ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
      });
      ctx.fillStyle = accent;
      ctx.font = "60px 'Song Myung', serif";
      ctx.fillText('夜行', TW * 0.7, TH * 0.64);
      break;
    }

    case 'dancheong': {
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, TW, TH);
      // 긴 띠 무늬
      const bands = [[0.18, '#2b4f8f'], [0.24, '#efe7d6'], [0.28, accent], [0.72, accent], [0.76, '#efe7d6'], [0.82, '#2b4f8f']];
      for (const [y, c] of bands) { ctx.fillStyle = c; ctx.fillRect(0, TH * y - 8, TW, 16); }
      // 머리초(연꽃 문양)
      const rosette = (x, y, s) => {
        const rings = [[70, '#e8c35a'], [58, accent], [46, '#efe7d6'], [36, '#2b4f8f'], [24, '#58a57f'], [12, '#e8c35a']];
        for (const [r, c] of rings) {
          ctx.fillStyle = c;
          ctx.beginPath();
          for (let p = 0; p < 16; p++) { const a = (p / 16) * Math.PI * 2; const rr = (p % 2 ? r * 0.8 : r) * s; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#1a1714'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      };
      for (const x of [TW * 0.14, TW * 0.5, TW * 0.86]) rosette(x, cy, 1.3);
      ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 4;
      for (const x of [TW * 0.32, TW * 0.68]) {
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x - 60 + k * 30, TH * 0.34); ctx.lineTo(x - 45 + k * 30, cy); ctx.lineTo(x - 60 + k * 30, TH * 0.66); ctx.stroke(); }
      }
      gloss(ctx, 0.18);
      break;
    }

    case 'wisp': {
      const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, TW * 0.6);
      g.addColorStop(0, '#16253f'); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      const flame = (x, y, r) => {
        const gg = ctx.createRadialGradient(x, y + r * 0.3, 1, x, y, r * 1.4);
        gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.25, '#b8f0ff'); gg.addColorStop(0.6, accent); gg.addColorStop(1, 'rgba(0,60,120,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.moveTo(x - r * 0.8, y + r * 0.4);
        ctx.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.1, y - r * 1.2, x + r * 0.2, y - r * 2.4);
        ctx.bezierCurveTo(x + r * 0.5, y - r * 1.2, x + r * 1.1, y - r * 0.5, x + r * 0.8, y + r * 0.4);
        ctx.arc(x, y + r * 0.35, r * 0.8, 0, Math.PI);
        ctx.fill();
      };
      for (let i = 0; i < 12; i++) flame(R() * TW, TH * (0.35 + R() * 0.55), 18 + R() * 26);
      // 도깨비 얼굴
      ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = 0.9;
      glowStroke(ctx, accent, 20, () => {
        ctx.strokeStyle = accent; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(0, 0, 90, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-60, -70); ctx.lineTo(-40, -130); ctx.lineTo(-20, -80); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(60, -70); ctx.lineTo(40, -130); ctx.lineTo(20, -80); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(-32, -15, 16, 10, 0.3, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(32, -15, 16, 10, -0.3, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-50, 35); ctx.quadraticCurveTo(0, 70, 50, 35); ctx.stroke();
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 25, 45); ctx.lineTo(s * 18, 70); ctx.lineTo(s * 10, 48); ctx.fill(); }
      });
      ctx.restore();
      break;
    }

    case 'pearl': {
      const g = ctx.createLinearGradient(0, 0, 0, TH);
      g.addColorStop(0, '#1c1a20'); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      const shell = (x, y, w, h, a) => {
        const gg = ctx.createLinearGradient(x - w, y - h, x + w, y + h);
        gg.addColorStop(0, '#9fe7e0'); gg.addColorStop(0.3, '#f3d6ff'); gg.addColorStop(0.55, '#ffffff'); gg.addColorStop(0.75, '#d9f7c8'); gg.addColorStop(1, '#8fc3ff');
        ctx.fillStyle = gg;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, 7); ctx.fill();
        ctx.restore();
      };
      // 넝쿨 줄기를 따라 자개 꽃잎과 잎
      ctx.strokeStyle = '#d4b060'; ctx.lineWidth = 3;
      const vine = [];
      ctx.beginPath();
      for (let x = -20; x <= TW + 20; x += 6) { const y = cy + Math.sin(x * 0.012) * 90 + Math.sin(x * 0.037) * 20; vine.push([x, y]); if (x < -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      vine.forEach(([x, y], i) => {
        if (i % 14 === 0) {
          const up = i % 28 === 0 ? -1 : 1;
          ctx.strokeStyle = '#d4b060'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y + up * 50, x + 10, y + up * 90); ctx.stroke();
          shell(x + 12, y + up * 60, 18, 9, up * 1.1);
          shell(x + 30, y + up * 30, 14, 7, up * 0.4);
        }
        if (i % 42 === 21) {
          for (let p = 0; p < 8; p++) shell(x + Math.cos((p / 8) * 6.28) * 24, y + Math.sin((p / 8) * 6.28) * 24, 20, 9, (p / 8) * 6.28);
          ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
        }
      });
      trims(ctx, '#d4b060', 4, [0.16, 0.84]);
      gloss(ctx, 0.35);
      break;
    }

    case 'lava': {
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, TW, TH);
      // 보로노이 딱지 + 빛나는 틈
      const seeds = Array.from({ length: 60 }, () => [R() * TW, R() * TH]);
      const img = ctx.getImageData(0, 0, TW, TH);
      const d = img.data, glow = new THREE.Color(accent);
      for (let y = 0; y < TH; y += 2) {
        for (let x = 0; x < TW; x += 2) {
          let a = 1e9, b = 1e9;
          for (const [sx, sy] of seeds) {
            const dd = (sx - x) ** 2 + (sy - y) ** 2;
            if (dd < a) { b = a; a = dd; } else if (dd < b) b = dd;
          }
          const edge = Math.sqrt(b) - Math.sqrt(a);
          const k = Math.max(0, 1 - edge / 9);
          const crust = 0.12 + 0.1 * Math.min(1, Math.sqrt(a) / 60);
          for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const i = ((y + oy) * TW + (x + ox)) * 4;
            d[i] = 255 * Math.min(1, crust + glow.r * k * 1.2 + k * k * 0.5);
            d[i + 1] = 255 * Math.min(1, crust * 0.8 + glow.g * k * 1.1 + k * k * 0.35);
            d[i + 2] = 255 * Math.min(1, crust * 0.7 + glow.b * k);
            d[i + 3] = 255;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      break;
    }

    case 'galaxy': {
      const g = ctx.createLinearGradient(0, 0, TW, TH);
      g.addColorStop(0, '#05030f'); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      ctx.globalCompositeOperation = 'lighter';
      for (const [c, n] of [[accent, 7], ['#4fb0ff', 6], ['#ff6fd0', 4]]) {
        for (let i = 0; i < n; i++) {
          const x = R() * TW, y = TH * (0.3 + R() * 0.4), r = 90 + R() * 160;
          const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
          gg.addColorStop(0, c); gg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.7, R() - 0.5, 0, 7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 500; i++) {
        const s = R() < 0.92 ? 1.2 : 3;
        ctx.globalAlpha = 0.3 + R() * 0.7;
        ctx.fillStyle = R() < 0.2 ? '#bcd8ff' : '#ffffff';
        ctx.beginPath(); ctx.arc(R() * TW, R() * TH, s, 0, 7); ctx.fill();
      }
      for (let i = 0; i < 6; i++) {
        const x = R() * TW, y = R() * TH;
        ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      break;
    }

    case 'gold': {
      const g = ctx.createLinearGradient(0, 0, 0, TH);
      g.addColorStop(0, '#fff1bd'); g.addColorStop(0.25, shade(body, 1.2)); g.addColorStop(0.5, body); g.addColorStop(0.62, '#fff4c8'); g.addColorStop(0.8, shade(body, 0.8)); g.addColorStop(1, shade(body, 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      brushed(ctx, R, 0.07);
      trims(ctx, shade(body, 0.55), 5, [0.2, 0.8]);
      // 봉황: 가운데 몸통, 좌우로 날개, 뒤로 긴 꼬리깃
      ctx.save(); ctx.translate(cx + 60, cy);
      const eng = shade(body, 0.5);
      ctx.strokeStyle = eng; ctx.lineWidth = 3;
      for (let k = 0; k < 9; k++) {
        const a = -2.6 + k * 0.17;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * 120, Math.sin(a) * 90 - 30, Math.cos(a) * 230, Math.sin(a) * 150);
        ctx.stroke();
        feather(ctx, Math.cos(a) * 170, Math.sin(a) * 110, 70, a, 12, 'rgba(120,70,10,.35)');
      }
      for (let k = 0; k < 5; k++) {
        ctx.beginPath(); ctx.moveTo(-10, 10);
        ctx.bezierCurveTo(-150, 40 + k * 16, -300, -40 + k * 30, -520, 20 + k * 22);
        ctx.stroke();
        ctx.fillStyle = '#9c291d'; ctx.beginPath(); ctx.ellipse(-520, 20 + k * 22, 14, 7, 0.2, 0, 7); ctx.fill();
      }
      ctx.fillStyle = eng;
      ctx.beginPath(); ctx.ellipse(10, 0, 44, 20, -0.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(40, -12); ctx.quadraticCurveTo(80, -60, 110, -50); ctx.lineWidth = 12; ctx.strokeStyle = eng; ctx.stroke();
      ctx.beginPath(); ctx.arc(112, -52, 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#9c291d'; ctx.beginPath(); ctx.arc(116, -56, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(108, -66); ctx.quadraticCurveTo(100, -100, 130, -96); ctx.lineWidth = 4; ctx.strokeStyle = '#9c291d'; ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 6; i++) cloudMotif(ctx, 60 + i * 180, TH * (i % 2 ? 0.7 : 0.32), 0.8, accent, 4);
      gloss(ctx, 0.3);
      break;
    }

    case 'lightning': {
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, TW * 0.6);
      g.addColorStop(0, '#2c3470'); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      // 북 테두리 + 삼파문
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = '#12162e'; ctx.beginPath(); ctx.arc(0, 0, 130, 0, 7); ctx.fill();
      for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283; ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(Math.cos(a) * 120, Math.sin(a) * 120, 6, 0, 7); ctx.fill(); }
      glowStroke(ctx, accent, 30, () => {
        for (let k = 0; k < 3; k++) {
          ctx.rotate((Math.PI * 2) / 3);
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.arc(0, -45, 36, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-36, -45); ctx.quadraticCurveTo(-30, 30, 50, 60); ctx.quadraticCurveTo(0, 10, 36, -45); ctx.fill();
        }
      });
      ctx.restore();
      glowStroke(ctx, accent, 24, () => {
        ctx.strokeStyle = '#e9fbff';
        for (let i = 0; i < 8; i++) {
          let x = R() * TW, y = 0;
          ctx.lineWidth = 2 + R() * 4;
          ctx.beginPath(); ctx.moveTo(x, y);
          while (y < TH) { x += (R() - 0.5) * 80; y += 25 + R() * 45; ctx.lineTo(x, y); if (R() < 0.2) { ctx.moveTo(x, y); } }
          ctx.stroke();
        }
      });
      trims(ctx, '#c9a24a', 4, [0.15, 0.85]);
      break;
    }

    case 'flame': {
      const g = ctx.createLinearGradient(0, TH, 0, 0);
      g.addColorStop(0, '#ffcf4a'); g.addColorStop(0.45, accent); g.addColorStop(1, body);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) {
        const x = R() * TW, y = TH + 20, h = 120 + R() * 260, w = 30 + R() * 50;
        const gg = ctx.createLinearGradient(x, y, x, y - h);
        gg.addColorStop(0, 'rgba(255,230,120,.7)'); gg.addColorStop(0.5, 'rgba(255,120,30,.45)'); gg.addColorStop(1, 'rgba(160,20,10,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.bezierCurveTo(x - w, y - h * 0.5, x + (R() - 0.5) * w * 2, y - h * 0.7, x + (R() - 0.5) * w, y - h); ctx.bezierCurveTo(x + w, y - h * 0.5, x + w, y - h * 0.3, x + w, y); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // 주작: 활짝 편 두 날개
      ctx.save(); ctx.translate(cx, cy + 20);
      for (const side of [-1, 1]) {
        for (let k = 0; k < 11; k++) {
          const a = side < 0 ? Math.PI + 0.5 - k * 0.1 : -0.5 + k * 0.1;
          const len = 150 + k * 18;
          const gg = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
          gg.addColorStop(0, '#fff2b0'); gg.addColorStop(0.6, '#ff8a2a'); gg.addColorStop(1, '#8e1b12');
          feather(ctx, side * 20, -10, len, a - side * 0.25, 18, gg);
        }
      }
      ctx.fillStyle = '#fff2b0';
      ctx.beginPath(); ctx.ellipse(0, 0, 30, 52, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -70, 18, 0, 7); ctx.fill();
      ctx.fillStyle = '#8e1b12'; ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(10, -120); ctx.lineTo(-6, -90); ctx.fill();
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 40); ctx.quadraticCurveTo((k - 1) * 60, 130, (k - 1) * 110, 200); ctx.stroke(); }
      ctx.restore();
      break;
    }

    case 'hexshell': {
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, TW, TH);
      const r = 44, h = r * Math.sqrt(3);
      for (let row = -1; row < TH / h + 1; row++) {
        for (let col = -1; col < TW / (r * 1.5) + 1; col++) {
          const x = col * r * 1.5, y = row * h + (col % 2 ? h / 2 : 0);
          const gg = ctx.createRadialGradient(x, y - 10, 2, x, y, r);
          gg.addColorStop(0, '#2c4a44'); gg.addColorStop(1, '#0a1413');
          ctx.fillStyle = gg;
          ctx.beginPath();
          for (let p = 0; p < 6; p++) { const a = (p / 6) * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4)); }
          ctx.closePath(); ctx.fill();
          glowStroke(ctx, accent, 12, () => { ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.stroke(); });
        }
      }
      // 뱀이 등껍질을 휘감는다
      glowStroke(ctx, accent, 20, () => {
        ctx.strokeStyle = '#0c1e1b'; ctx.lineWidth = 34;
        ctx.beginPath();
        for (let x = -40; x <= TW + 40; x += 8) { const y = cy + Math.sin(x * 0.009 + 1) * 120; if (x < -30) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.strokeStyle = accent; ctx.lineWidth = 4;
        ctx.stroke();
      });
      ctx.fillStyle = accent;
      ctx.font = "80px 'Song Myung', serif";
      ctx.fillText('玄武', TW * 0.4, TH * 0.62);
      gloss(ctx, 0.25);
      break;
    }

    case 'taegeuk': {
      // 비단 흰 바탕
      const g = ctx.createLinearGradient(0, 0, 0, TH);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, body); g.addColorStop(1, '#e0dbd0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = '#8a7a50';
      for (let y = 0; y < TH; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(TW, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 8; i++) cloudMotif(ctx, 50 + i * 135, TH * (i % 2 ? 0.83 : 0.17), 0.6, 'rgba(200,170,90,.35)', 3);
      trims(ctx, '#c9a24a', 5, [0.08, 0.92]);

      // 태극 (국기처럼 기울기 약 33.7°)
      const r = 150;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(2, 3));
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#0047a0';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI, 0);
      ctx.arc(r / 2, 0, r / 2, 0, Math.PI, true);
      ctx.arc(-r / 2, 0, r / 2, 0, Math.PI, false);
      ctx.fill();
      ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // 건곤감리: 괘의 막대는 태극을 향하게
      const barW = 88, barH = 17, gap = 11, split = 12;
      const trigram = (dx, dy, lines) => {
        ctx.save();
        ctx.translate(cx + dx, cy + dy);
        ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
        ctx.fillStyle = '#111111';
        lines.forEach((broken, k) => {
          const y = (k - 1) * (barH + gap) - barH / 2;
          if (broken) { ctx.fillRect(-barW / 2, y, barW / 2 - split / 2, barH); ctx.fillRect(split / 2, y, barW / 2 - split / 2, barH); }
          else ctx.fillRect(-barW / 2, y, barW, barH);
        });
        ctx.restore();
      };
      const ox = 345, oy = 175;
      trigram(-ox, -oy, [0, 0, 0]); // 건 (좌상)
      trigram(ox, oy, [1, 1, 1]); // 곤 (우하)
      trigram(ox, -oy, [1, 0, 1]); // 감 (우상)
      trigram(-ox, oy, [0, 1, 0]); // 리 (좌하)
      gloss(ctx, 0.3);
      break;
    }

    default:
      brushed(ctx, R, 0.08);
      panels(ctx);
  }
  ctx.restore();
}

export function skinTexture(skinId) {
  if (texCache.has(skinId)) return texCache.get(skinId);
  const s = SKINS[skinId];
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  drawPattern(c.getContext('2d'), s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  texCache.set(skinId, t);
  return t;
}

// 영웅·전설: 총신을 따라 빛이 흐른다
function addSweep(mat, color, amount) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSkinTime = SKIN_TIME;
    shader.uniforms.uSweepColor = { value: new THREE.Color(color) };
    shader.uniforms.uSweepAmt = { value: amount };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSkinTime;\nuniform vec3 uSweepColor;\nuniform float uSweepAmt;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
#ifdef USE_MAP
  float sweepU = fract(vMapUv.x * 0.8 + vMapUv.y * 0.35 - uSkinTime * 0.45);
  float band = 1.0 - smoothstep(0.0, 0.05, abs(sweepU - 0.5));
  gl_FragColor.rgb += uSweepColor * band * uSweepAmt;
#endif`);
  };
  mat.customProgramCacheKey = () => `sweep${amount}`;
}

export function skinMaterials(skinId) {
  const id = SKINS[skinId] ? skinId : 'rifle.default';
  if (matCache.has(id)) return matCache.get(id);
  const s = SKINS[id];
  const map = skinTexture(id);
  let body;
  if (s.shiny || s.rarity === 'epic' || s.rarity === 'legendary') {
    body = new THREE.MeshPhongMaterial({ map, shininess: s.shiny ? 80 : 40, specular: new THREE.Color(s.pattern === 'gold' ? 0xb08a3a : 0x6f8aa0) });
    if (['lightning', 'wisp', 'neon', 'lava', 'hexshell', 'galaxy'].includes(s.pattern)) {
      body.emissive = new THREE.Color(0x404040);
      body.emissiveMap = map;
    }
  } else {
    body = new THREE.MeshPhongMaterial({ map, shininess: 18, specular: 0x222222 });
  }
  if (s.rarity === 'legendary') addSweep(body, s.tracer || s.accent, 0.55);
  else if (s.rarity === 'epic') addSweep(body, s.tracer || s.accent, 0.25);
  const accent = new THREE.MeshPhongMaterial({ color: new THREE.Color(s.accent), shininess: 50 });
  if (['lightning', 'wisp', 'hexshell', 'neon'].includes(s.pattern)) accent.emissive = new THREE.Color(s.accent).multiplyScalar(0.8);
  const metal = new THREE.MeshPhongMaterial({ color: s.pattern === 'gold' ? 0x6a5222 : s.pattern === 'taegeuk' ? 0x2a2a30 : 0x1e1d1b, shininess: 45, specular: 0x444444 });
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

// 무기 실루엣에 도안을 입힌 썸네일 (dataURL)
export async function skinThumb(skinId, W = 240, H = 80) {
  const key = `${skinId}@${W}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const s = SKINS[skinId] || SKINS[defaultSkin('rifle')];
  const im = await loadSvg(`assets/ui/${WEAPONS[s.weapon].icon}.svg`);
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext('2d');
  for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) ctx.drawImage(im, ox, oy, c.width, c.height);
  const p = document.createElement('canvas');
  p.width = c.width;
  p.height = c.height;
  const pc = p.getContext('2d');
  pc.drawImage(im, 0, 0, p.width, p.height);
  pc.globalCompositeOperation = 'source-in';
  const pat = document.createElement('canvas');
  pat.width = TW;
  pat.height = TH;
  drawPattern(pat.getContext('2d'), s);
  // 도안 가운데 띠를 실루엣 높이에 맞춘다
  pc.drawImage(pat, 0, TH * 0.18, TW, TH * 0.64, 0, 0, p.width, p.height);
  pc.globalCompositeOperation = 'source-atop';
  const shine = pc.createLinearGradient(0, 0, 0, p.height);
  shine.addColorStop(0, 'rgba(255,255,255,.25)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  shine.addColorStop(1, 'rgba(0,0,0,.25)');
  pc.fillStyle = shine;
  pc.fillRect(0, 0, p.width, p.height);
  if (RARITY[s.rarity] && (s.rarity === 'legendary' || s.rarity === 'epic')) {
    ctx.shadowColor = s.tracer || s.accent;
    ctx.shadowBlur = 14;
  }
  ctx.drawImage(p, 0, 0);
  const url = c.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}

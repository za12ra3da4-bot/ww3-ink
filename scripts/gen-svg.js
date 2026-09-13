// UI 그림(SVG) 생성 — node scripts/gen-svg.js → public/assets/ui/*.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from './texlib.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'ui');
mkdirSync(OUT, { recursive: true });
const INK = '#151412', RED = '#b3301c', PAPER = '#efe7d6';
const rnd = mulberry32(777);

function save(name, w, h, body, rough = 2.5, freq = 0.05) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${Math.floor(rnd() * 99)}" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="${rough}" xChannelSelector="R" yChannelSelector="G"/>
</filter></defs>
<g filter="url(#ink)">${body}</g></svg>`;
  writeFileSync(path.join(OUT, name + '.svg'), svg);
}

const f = (d) => `<path fill="${INK}" d="${d}"/>`;
const st = (d, w = 4, c = INK) => `<path fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`;

// ── 무기 (240x80, 오른쪽을 향함) ──────────────────
save('w_rifle', 240, 80, [
  f('M8 30 L46 25 L58 25 L58 45 L46 45 L14 55 L8 53 Z'),
  f('M56 23 H126 V42 H56 Z'), f('M66 15 H100 V21 H66 Z'), f('M69 20 H73 V24 H69 Z M93 20 H97 V24 H93 Z'),
  f('M78 42 L90 42 L84 64 L72 64 Z'), f('M100 42 L114 42 Q116 58 125 70 L111 75 Q102 60 100 42 Z'),
  f('M126 26 H178 V39 H126 Z'), f('M170 26 L173 14 L178 14 L178 26 Z'),
  f('M178 30 H222 V35 H178 Z'), f('M220 27.5 H231 V37.5 H220 Z'),
].join(''));

save('w_smg', 240, 80, [
  st('M12 30 L50 30 M12 44 L50 44 M12 30 L12 44', 5),
  f('M50 23 H130 V44 H50 Z'), f('M60 17 H80 V23 H60 Z'),
  f('M70 44 L84 44 L78 68 L64 68 Z'), f('M102 44 L115 44 L119 78 L106 78 Z'),
  f('M130 27 H166 V40 H130 Z'), f('M166 30 H190 V36 H166 Z'),
].join(''));

save('w_sniper', 240, 80, [
  f('M4 34 L40 28 L70 28 L70 46 L58 46 Q50 60 36 58 L10 56 Z'),
  f('M70 28 H130 V44 H70 Z'), f('M80 12 H140 V21 H80 Z'), f('M140 10 L154 7 L154 24 L140 21 Z'),
  f('M71 12 L80 13 L80 20 L71 21 Z'), f('M92 21 H98 V28 H92 Z M122 21 H128 V28 H122 Z'),
  f('M86 44 L98 44 L92 64 L80 64 Z'), f('M106 44 H120 V55 H106 Z'),
  f('M130 32 H228 V37 H130 Z'), f('M225 29.5 H238 V39.5 H225 Z'),
  st('M168 38 L158 70 M168 38 L180 70', 3),
].join(''));

save('w_shotgun', 240, 80, [
  f('M4 36 L50 28 L62 28 L62 44 L50 46 L10 58 L4 56 Z'),
  f('M62 26 H108 V44 H62 Z'), st('M84 44 Q91 57 100 44', 3.5),
  f('M108 27 H228 V34 H108 Z'), f('M108 36 H204 V42 H108 Z'),
  f('M130 33 H176 V46 H130 Z'), `<circle cx="225" cy="25" r="2.5" fill="${INK}"/>`,
].join(''));

save('w_pistol', 240, 80, [
  f('M70 22 H156 V38 H70 Z'), f('M76 38 H146 V47 H76 Z'), f('M64 21 H72 V28 H64 Z'),
  f('M80 46 L104 46 L98 76 L72 76 Z'), st('M104 47 Q113 61 125 47', 3.5), f('M154 26 H161 V34 H154 Z'),
].join(''));

save('w_rocket', 240, 80, [
  f('M16 26 L30 30 L30 42 L16 46 Z'), f('M30 30 H182 V42 H30 Z'),
  f('M180 25 L204 25 Q236 36 204 47 L180 47 Z'), f('M100 19 H111 V30 H100 Z'),
  f('M80 42 L92 42 L88 62 L76 62 Z'), f('M120 42 L132 42 L128 58 L116 58 Z'),
].join(''));

save('w_grenade', 240, 80, [
  `<ellipse cx="120" cy="50" rx="20" ry="24" fill="${INK}"/>`,
  st('M101 42 H139 M100 56 H140 M120 27 V73', 2.5, PAPER),
  f('M112 20 H128 V29 H112 Z'), st('M127 22 Q142 26 139 58', 4),
  `<circle cx="104" cy="21" r="7" fill="none" stroke="${INK}" stroke-width="3"/>`,
].join(''));

save('headshot', 80, 80, [
  f('M10 52 Q12 14 40 12 Q68 14 70 52 L76 56 L4 56 Z'),
  st('M40 13 L33 26 L43 33 L35 47', 3, PAPER),
].join(''));

// ── 연속 처치 보상 (120x120) ───────────────────────
save('s_uav', 120, 120, [
  `<ellipse cx="60" cy="64" rx="6" ry="38" fill="${INK}"/>`,
  f('M60 52 L112 66 L112 72 L60 66 L8 72 L8 66 Z'), f('M60 92 L82 99 L82 103 L60 99 L38 103 L38 99 Z'),
  st('M24 26 Q60 2 96 26', 3), st('M36 34 Q60 18 84 34', 3),
].join(''));

save('s_artillery', 120, 120, [
  `<circle cx="42" cy="88" r="17" fill="none" stroke="${INK}" stroke-width="6"/>`,
  st('M42 72 V104 M26 88 H58', 3), f('M28 80 L104 98 L100 104 L24 87 Z'),
  f('M36 74 L96 20 L105 29 L46 83 Z'), `<circle cx="108" cy="12" r="4" fill="${RED}"/>`,
  st('M100 8 L92 2 M112 20 L118 24', 2.5, RED),
].join(''));

save('s_nuke', 120, 120, [
  f('M18 52 Q14 28 38 27 Q44 9 62 15 Q82 6 90 26 Q110 26 104 52 Q92 62 60 58 Q28 62 18 52 Z'),
  f('M50 56 Q46 82 42 98 L78 98 Q74 82 70 56 Z'),
  `<ellipse cx="60" cy="102" rx="46" ry="9" fill="${INK}"/>`,
  `<ellipse cx="60" cy="74" rx="22" ry="5" fill="none" stroke="${PAPER}" stroke-width="2.5"/>`,
].join(''), 3);

// ── 낙관 (붉은 도장 틀) ────────────────────────────
{
  let specks = '';
  for (let i = 0; i < 26; i++) specks += `<circle cx="${(6 + rnd() * 88).toFixed(1)}" cy="${(6 + rnd() * 88).toFixed(1)}" r="${(0.6 + rnd() * 2.2).toFixed(1)}" fill="${PAPER}" opacity="${(0.3 + rnd() * 0.6).toFixed(2)}"/>`;
  save('seal', 100, 100, `<rect x="4" y="4" width="92" height="92" rx="5" fill="${RED}"/>
<rect x="11" y="11" width="78" height="78" rx="3" fill="none" stroke="${PAPER}" stroke-width="3"/>${specks}`, 4, 0.08);
}

// ── 원상(圓相) 붓 원 — 거점 표시, 로고 ─────────────
{
  const pts = [], inner = [], N = 90, r = 78, span = Math.PI * 2 * 0.9, a0 = -Math.PI * 0.35;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = a0 + span * t;
    const w = 15 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.03)), 0.35) * (1 - t * 0.5) + 1.5;
    pts.push([100 + Math.cos(a) * (r + w / 2), 100 + Math.sin(a) * (r + w / 2)]);
    inner.push([100 + Math.cos(a) * (r - w / 2), 100 + Math.sin(a) * (r - w / 2)]);
  }
  const d = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L') +
    ' L' + inner.reverse().map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L') + ' Z';
  save('enso', 200, 200, `<path fill="${INK}" d="${d}"/>`, 5, 0.06);
}

// ── 붓질 버튼 배경 ────────────────────────────────
{
  const top = [], bot = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, x = 8 + t * 384;
    const h = 34 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08 + 0.02)), 0.3) * (1 - t * 0.25);
    top.push(`${x.toFixed(1)} ${(50 - h + (rnd() - 0.5) * 3).toFixed(1)}`);
    bot.push(`${x.toFixed(1)} ${(50 + h + (rnd() - 0.5) * 3).toFixed(1)}`);
  }
  let gaps = '';
  for (let i = 0; i < 9; i++) {
    const y = 24 + rnd() * 52, x0 = 120 + rnd() * 160;
    gaps += st(`M${x0.toFixed(0)} ${y.toFixed(1)} L396 ${(y + (rnd() - 0.5) * 4).toFixed(1)}`, 1 + rnd() * 1.6, PAPER);
  }
  save('brush', 400, 100, `<path fill="${INK}" d="M${top.join(' L')} L${bot.reverse().join(' L')} Z"/>${gaps}`, 5, 0.04);
}

// ── 저격 조준경 ───────────────────────────────────
{
  let hash = '';
  for (let k = -4; k <= 4; k++) {
    if (!k) continue;
    hash += st(`M${500 + k * 40} 492 V508`, 2.5) + st(`M492 ${500 + k * 40} H508`, 2.5);
  }
  const body = `<path fill="#0b0a09" fill-rule="evenodd" d="M-20 -20 H1020 V1020 H-20 Z M40 500 A460 460 0 1 0 960 500 A460 460 0 1 0 40 500 Z"/>
${st('M40 500 H300 M700 500 H960 M500 40 V300 M500 700 V960', 12)}
${st('M300 500 H700 M500 300 V700', 2)}${hash}
<circle cx="500" cy="500" r="3" fill="${RED}"/>`;
  save('scope', 1000, 1000, body, 6, 0.02);
}

console.log('UI 그림 생성 완료 →', OUT);

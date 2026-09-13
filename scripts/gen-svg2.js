// 추가 UI 그림 — node scripts/gen-svg2.js → public/assets/ui/*.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from './texlib.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'ui');
mkdirSync(OUT, { recursive: true });
const INK = '#151412', RED = '#b3301c', PAPER = '#efe7d6', BRASS = '#a8843a', BRASS2 = '#6d5220';
const rnd = mulberry32(4242);

function save(name, w, h, body, rough = 2.5, freq = 0.05, defs = '') {
  writeFileSync(path.join(OUT, name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${Math.floor(rnd() * 99)}" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="${rough}" xChannelSelector="R" yChannelSelector="G"/>
</filter>${defs}</defs>
<g filter="url(#ink)">${body}</g></svg>`);
}
const st = (d, w = 4, c = INK) => `<path fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`;
const f = (d, c = INK) => `<path fill="${c}" d="${d}"/>`;

// 엽전 코인 (상평통보)
save('coin', 100, 100, `
<circle cx="50" cy="50" r="46" fill="url(#brass)" stroke="${BRASS2}" stroke-width="4"/>
<circle cx="50" cy="50" r="38" fill="none" stroke="${BRASS2}" stroke-width="2" opacity=".7"/>
<rect x="38" y="38" width="24" height="24" fill="${PAPER}" stroke="${BRASS2}" stroke-width="4"/>
<g fill="${BRASS2}" font-family="Song Myung, Batang, serif" font-size="17" text-anchor="middle">
<text x="50" y="31">常</text><text x="50" y="84">平</text><text x="23" y="56">通</text><text x="77" y="56">寶</text></g>`,
2, 0.06, `<radialGradient id="brass" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#e2c070"/><stop offset=".6" stop-color="${BRASS}"/><stop offset="1" stop-color="#7a5a22"/></radialGradient>`);

// 메뉴 아이콘 (80x80)
save('i_play', 80, 80, [
  st('M16 70 L16 10', 5), f('M18 11 Q40 4 62 13 Q52 24 64 34 Q42 40 18 34 Z', RED),
  st('M8 70 H40', 5),
].join(''));
save('i_soldier', 80, 80, [
  f('M14 44 Q14 12 40 11 Q66 12 66 44 L72 48 L8 48 Z'),
  f('M24 50 H56 Q56 66 40 70 Q24 66 24 50 Z', '#3b3936'),
  st('M20 45 H60', 3, PAPER),
].join(''));
save('i_armory', 80, 80, [
  f('M6 34 L28 30 L30 40 L10 46 Z'), f('M28 28 H62 V38 H28 Z'), f('M62 31 H76 V35 H62 Z'),
  f('M38 38 L46 38 L42 52 L34 52 Z'), f('M50 38 L58 38 Q58 50 64 56 L56 60 Q50 50 50 38 Z'),
  st('M10 64 H70', 3), st('M10 72 H70', 3),
].join(''));
save('i_gacha', 80, 80, [
  `<rect x="14" y="22" width="52" height="40" rx="4" fill="${INK}"/>`,
  `<ellipse cx="14" cy="42" rx="7" ry="20" fill="#3b3936"/>`, `<ellipse cx="66" cy="42" rx="7" ry="20" fill="#3b3936"/>`,
  `<rect x="30" y="30" width="20" height="20" rx="2" fill="${RED}"/>`, st('M34 40 H46 M40 34 V46', 2.5, PAPER),
  st('M30 12 L36 20 M50 12 L44 20 M40 8 V18', 3, RED),
].join(''));
save('i_settings', 80, 80, [
  st('M18 62 L56 24', 7), f('M54 26 Q64 10 72 8 Q70 18 58 30 Z'),
  st('M14 66 Q10 72 8 74', 5), st('M20 30 H34 M27 23 V37', 3, RED),
].join(''));
save('i_map', 80, 80, [
  f('M8 16 L28 10 L52 18 L72 12 V64 L52 70 L28 62 L8 68 Z', '#3b3936'),
  st('M28 10 V62 M52 18 V70', 2.5, PAPER), st('M14 48 Q30 30 44 42 T66 26', 3, RED),
].join(''));

// 봉인된 두루마리 (뽑기 연출)
save('scroll', 240, 300, `
<rect x="40" y="40" width="160" height="220" fill="${PAPER}" stroke="${INK}" stroke-width="5"/>
<rect x="28" y="22" width="184" height="26" rx="13" fill="#3b3936"/>
<rect x="28" y="252" width="184" height="26" rx="13" fill="#3b3936"/>
<circle cx="28" cy="35" r="10" fill="${INK}"/><circle cx="212" cy="35" r="10" fill="${INK}"/>
<circle cx="28" cy="265" r="10" fill="${INK}"/><circle cx="212" cy="265" r="10" fill="${INK}"/>
<path d="M120 48 V252" stroke="${INK}" stroke-width="3" opacity=".25"/>
<rect x="80" y="110" width="80" height="80" rx="6" fill="${RED}"/>
<rect x="88" y="118" width="64" height="64" rx="3" fill="none" stroke="${PAPER}" stroke-width="3"/>
<text x="120" y="164" text-anchor="middle" font-family="Song Myung, Batang, serif" font-size="44" fill="${PAPER}">封</text>`, 3, 0.04);

// 조준경 — 가운데는 완전히 투명, 바깥은 먹빛
{
  let hash = '';
  for (let k = -5; k <= 5; k++) {
    if (!k) continue;
    const len = k % 5 === 0 ? 22 : 12;
    hash += st(`M${500 + k * 34} ${500 - len / 2} V${500 + len / 2}`, 2.5) + st(`M${500 - len / 2} ${500 + k * 34} H${500 + len / 2}`, 2.5);
  }
  save('scope', 1000, 1000, `
<path fill="#0b0a09" fill-rule="evenodd" d="M-40 -40 H1040 V1040 H-40 Z M60 500 A440 440 0 1 0 940 500 A440 440 0 1 0 60 500 Z"/>
<circle cx="500" cy="500" r="440" fill="url(#lens)"/>
<circle cx="500" cy="500" r="446" fill="none" stroke="#0b0a09" stroke-width="22"/>
${st('M60 500 H330 M670 500 H940 M500 60 V330 M500 670 V940', 10)}
${st('M330 500 H470 M530 500 H670 M500 330 V470 M500 530 V670', 2)}
${hash}
<circle cx="500" cy="500" r="3.5" fill="${RED}"/>`, 5, 0.02,
  `<radialGradient id="lens" cx="50%" cy="50%" r="50%"><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`);
}

console.log('추가 UI 그림 생성 완료 →', OUT);

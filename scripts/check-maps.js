// 맵 검증 — node scripts/check-maps.js  (각 맵 × 여러 seed: 출현 지점, 길찾기 연결, 성능)
import { generateMap, buildNav } from '../public/shared/map.js';
import { World } from '../public/shared/physics.js';
import { findPath } from '../server/nav.js';
import { MAP_IDS, PLAYER } from '../public/shared/config.js';

let fail = 0;
for (const id of MAP_IDS) {
  for (const seed of [1, 777, 123456, 99999]) {
    const t0 = performance.now();
    const map = generateMap(id, seed);
    const world = new World(map.boxes);
    const nav = buildNav(map.boxes);
    const ms = (performance.now() - t0).toFixed(0);
    const badNum = map.boxes.filter((b) => ![...b.min, ...b.max].every(Number.isFinite) || b.max[0] <= b.min[0] || b.max[1] <= b.min[1] || b.max[2] <= b.min[2]);
    const blockedSpawns = map.spawns.flat().filter((s) => !world.bodyFits(s.x, 0, s.z, PLAYER.radius, PLAYER.height));
    let noPath = 0, tries = 0;
    const tp = performance.now();
    for (const team of [0, 1]) {
      for (const sp of map.spawns[team].filter((_, i) => i % 3 === 0)) {
        for (const p of map.points) {
          tries++;
          if (!findPath(nav, sp.x, sp.z, p.x, p.z)) noPath++;
        }
      }
    }
    const pathMs = ((performance.now() - tp) / tries).toFixed(2);
    // 거점 안이 막혀 있지 않은지
    const pointBlocked = map.points.filter((p) => !world.bodyFits(p.x, 0.56, p.z, 0.4, 1.8));
    const kinds = {};
    for (const pr of map.props) kinds[pr.kind] = (kinds[pr.kind] || 0) + 1;
    const ok = !badNum.length && !blockedSpawns.length && !noPath && !pointBlocked.length;
    if (!ok) fail++;
    console.log(`${ok ? 'OK ' : 'BAD'} ${id.padEnd(7)} seed ${String(seed).padEnd(6)} boxes ${String(map.boxes.length).padEnd(4)} props ${String(map.props.length).padEnd(4)} gen ${ms}ms path ${pathMs}ms` +
      (badNum.length ? ` 잘못된상자 ${badNum.length}` : '') + (blockedSpawns.length ? ` 막힌출현 ${blockedSpawns.length}` : '') +
      (noPath ? ` 길없음 ${noPath}/${tries}` : '') + (pointBlocked.length ? ` 막힌거점 ${pointBlocked.map((p) => p.label)}` : ''));
    if (seed === 1) console.log('     ', Object.entries(kinds).map(([a, b]) => `${a}:${b}`).join(' '));
  }
}
console.log(fail ? `\n실패 ${fail}건` : '\n모든 맵 통과');
process.exit(fail ? 1 : 0);

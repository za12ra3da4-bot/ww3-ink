// 브라우저용 라이브러리를 public/vendor 로 복사 — 정적 호스팅(Vercel 등)에서도 그대로 동작하도록
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  ['node_modules/three/build/three.module.js', 'public/vendor/three/three.module.js'],
  ['node_modules/three/build/three.core.js', 'public/vendor/three/three.core.js'],
  ['node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js', 'public/vendor/three/addons/geometries/RoundedBoxGeometry.js'],
  ['node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', 'public/vendor/three/addons/utils/BufferGeometryUtils.js'],
  ['node_modules/socket.io/client-dist/socket.io.esm.min.js', 'public/vendor/socket.io.esm.min.js'],
];
for (const [from, to] of files) {
  const src = path.join(root, from);
  if (!existsSync(src)) { console.warn('없음:', from); continue; }
  mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
  copyFileSync(src, path.join(root, to));
}
console.log('vendor 복사 완료');

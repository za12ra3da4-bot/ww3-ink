// 이미지 에셋 로딩 + 공용 재질/도형 도구
import * as THREE from 'three';

const TEX = ['paper', 'ground', 'wall', 'ruin', 'sandbag', 'crate', 'metal', 'splat0', 'splat1', 'splat2', 'splat3', 'smoke', 'stroke', 'mountains', 'sun', 'pine'];
const UI = ['enso', 'seal'];
export const tex = {};
export const img = {};

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
  for (const n of ['ground', 'wall', 'ruin', 'sandbag', 'metal']) {
    tex[n].wrapS = tex[n].wrapT = THREE.RepeatWrapping;
    tex[n].anisotropy = 4;
  }
  tex.mountains.wrapS = THREE.RepeatWrapping;
  return tex;
}

// 면마다 월드 크기에 맞춰 UV 를 늘린 박스 (tw x th 미터마다 텍스처 1장)
export function boxGeometry(w, h, d, tw, th) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!tw) return g;
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tw, (uv.getY(i) * dims[f][1]) / th);
    }
  }
  return g;
}

// 같은 속성(position/normal/uv + index)을 가진 도형들을 하나로 합친다
export function mergeGeometries(list) {
  let vCount = 0, iCount = 0;
  for (const g of list) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const index = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const src = g.index.array;
    for (let i = 0; i < src.length; i++) index[io + i] = src[i] + vo;
    vo += g.attributes.position.count;
    io += src.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

export const TEAM_COLOR = [0x2a2825, 0xb8331e];

// 캔버스에 원상 + 한자 한 글자를 그린 표지 텍스처
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

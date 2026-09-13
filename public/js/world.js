// 맵 데이터 → Three.js 장면 (지형, 건물, 소나무, 먼 산, 붉은 해, 거점)
import * as THREE from 'three';
import { tex, boxGeometry, mergeGeometries, labelTexture, TEAM_COLOR } from './assets.js';
import { MAP_HALF } from '../shared/config.js';

const lambert = (map, color) => new THREE.MeshLambertMaterial({ map, color });

function materials() {
  return {
    wall: lambert(tex.wall, 0xe6e2da),
    ruin: lambert(tex.ruin, 0xd4cfc5),
    sandbag: lambert(tex.sandbag, 0xcac3b3),
    crate: lambert(tex.crate, 0xbfb6a6),
    metal: lambert(tex.metal, 0x8f8e89),
    wood: lambert(tex.ruin, 0x837b70),
    trunk: new THREE.MeshLambertMaterial({ color: 0x2c2a27 }),
  };
}

const KIND = {
  building: ['wall', 8, 6.4],
  ruin: ['ruin', 4, 4], stone: ['ruin', 3, 3], bunker: ['ruin', 4, 4], lowwall: ['ruin', 4, 4],
  rubble: ['ruin', 2, 2], barrier: ['ruin', 2.4, 2.4], step: ['ruin', 2, 2],
  sandbag: ['sandbag', 2, 1.1],
  crate: ['crate', 0, 0],
  tank: ['metal', 3, 3], turret: ['metal', 3, 3], barrel: ['metal', 3, 3], car: ['metal', 3, 3], carTop: ['metal', 3, 3],
  post: ['wood', 2, 2], deck: ['wood', 2, 2], rail: ['wood', 2, 2],
  trunk: ['trunk', 0, 0],
};

export function buildWorld(scene, map) {
  const group = new THREE.Group();
  const mats = materials();

  // 빛
  const hemi = new THREE.HemisphereLight(0xffffff, 0x77736d, 1.35);
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 260 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  const sunDir = new THREE.Vector3(-0.45, 0.8, -0.4).normalize();
  group.add(hemi, sun, sun.target);

  // 땅
  const S = 1400;
  const groundGeo = new THREE.PlaneGeometry(S, S);
  const guv = groundGeo.attributes.uv;
  for (let i = 0; i < guv.count; i++) guv.setXY(i, (guv.getX(i) * S) / 14, (guv.getY(i) * S) / 14);
  const ground = new THREE.Mesh(groundGeo, lambert(tex.ground, 0xe2ded6));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 구조물 — 재질별로 하나의 메시로 합친다
  const buckets = new Map();
  for (const b of map.boxes) {
    const K = KIND[b.kind];
    if (!K) continue;
    const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
    const g = boxGeometry(w, h, d, K[1], K[2]);
    g.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    if (!buckets.has(K[0])) buckets.set(K[0], []);
    buckets.get(K[0]).push(g);
  }
  for (const [key, geos] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), mats[key]);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 경계 철조망 말뚝
  const posts = [];
  for (let t = -MAP_HALF; t <= MAP_HALF; t += 5) {
    for (const [x, z] of [[t, -MAP_HALF], [t, MAP_HALF], [-MAP_HALF, t], [MAP_HALF, t]]) {
      const g = boxGeometry(0.14, 1.5, 0.14);
      g.translate(x, 0.75, z);
      posts.push(g);
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(posts), mats.trunk));
  const wirePts = [];
  for (const y of [0.6, 1.2]) {
    const c = [[-MAP_HALF, -MAP_HALF], [MAP_HALF, -MAP_HALF], [MAP_HALF, MAP_HALF], [-MAP_HALF, MAP_HALF], [-MAP_HALF, -MAP_HALF]];
    for (let i = 0; i < 4; i++) wirePts.push(new THREE.Vector3(c[i][0], y, c[i][1]), new THREE.Vector3(c[i + 1][0], y, c[i + 1][1]));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: 0x1a1918 })));

  // 소나무 (교차 빌보드), 포탄 구덩이, 깃발
  const pineMat = new THREE.MeshBasicMaterial({ map: tex.pine, alphaTest: 0.35, side: THREE.DoubleSide });
  const splatMats = [0, 1, 2, 3].map((i) => new THREE.MeshBasicMaterial({
    map: tex[`splat${i}`], color: 0x3a3835, transparent: true, opacity: 0.4, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  const banners = [];
  for (const p of map.props) {
    if (p.kind === 'pine') {
      const w = p.h * 0.5;
      for (const rot of [0, Math.PI / 2]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, p.h), pineMat);
        m.position.set(p.x, p.h / 2, p.z);
        m.rotation.y = rot + p.s * 3;
        group.add(m);
      }
    } else if (p.kind === 'crater') {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.r * 2.4, p.r * 2.4), splatMats[Math.floor(p.s * 4)]);
      m.rotation.set(-Math.PI / 2, 0, p.s * 6.28);
      m.position.set(p.x, 0.02, p.z);
      group.add(m);
    } else if (p.kind === 'banner') {
      const pole = new THREE.Mesh(boxGeometry(0.12, 6, 0.12), mats.trunk);
      pole.position.set(p.x, 3, p.z);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2, 8, 1), new THREE.MeshLambertMaterial({ color: TEAM_COLOR[p.team], side: THREE.DoubleSide }));
      cloth.geometry.translate(1.1, 0, 0);
      cloth.position.set(p.x + 0.06, 4.3, p.z);
      group.add(pole, cloth);
      banners.push(cloth);
    }
  }

  // 먼 산 (카메라를 따라다니는 원통)
  const skyGeo = new THREE.CylinderGeometry(460, 460, 170, 64, 1, true);
  tex.mountains.repeat.set(3, 1);
  const mountains = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: tex.mountains, transparent: true, side: THREE.BackSide, depthWrite: false }));
  mountains.renderOrder = -2;
  group.add(mountains);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.sun, depthWrite: false }));
  sunSprite.scale.set(70, 70, 1);
  sunSprite.renderOrder = -3;
  group.add(sunSprite);
  const sunSky = new THREE.Vector3(0.6, 0.26, -0.76).normalize();

  // 거점 표지 (점령전)
  const points = map.points.map((P) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(P.r - 0.35, P.r, 64), new THREE.MeshBasicMaterial({ color: 0x55524d, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(P.x, 0.04, P.z);
    const pole = new THREE.Mesh(boxGeometry(0.12, 4.5, 0.12), mats.trunk);
    pole.position.set(P.x, 2.25, P.z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshLambertMaterial({ color: 0xdedad2, side: THREE.DoubleSide }));
    flag.geometry.translate(0.9, 0, 0);
    flag.position.set(P.x + 0.06, 3.9, P.z);
    const labels = [labelTexture(P.label, '#55524d', '#151412'), labelTexture(P.label, '#151412', '#151412'), labelTexture(P.label, '#b3301c', '#b3301c')];
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labels[0], depthTest: false, transparent: true }));
    label.scale.set(2.6, 2.6, 1);
    label.position.set(P.x, 6.2, P.z);
    label.renderOrder = 5;
    const g = new THREE.Group();
    g.add(ring, pole, flag, label);
    group.add(g);
    return { P, g, ring, flag, label, labels, owner: -2 };
  });

  scene.add(group);

  return {
    group,
    points,
    setMode(mode) {
      for (const p of points) p.g.visible = mode === 'dom';
    },
    setPointState(cp) {
      if (!cp) return;
      cp.forEach(([owner], i) => {
        const p = points[i];
        if (!p || p.owner === owner) return;
        p.owner = owner;
        const col = owner === 0 ? TEAM_COLOR[0] : owner === 1 ? TEAM_COLOR[1] : 0xdedad2;
        p.flag.material.color.setHex(col);
        p.ring.material.color.setHex(owner === 0 ? 0x1d1b18 : owner === 1 ? 0xb8331e : 0x55524d);
        p.label.material.map = p.labels[owner + 1];
        p.label.material.needsUpdate = true;
      });
    },
    update(cam, t) {
      mountains.position.set(cam.position.x, 58, cam.position.z);
      sunSprite.position.copy(cam.position).addScaledVector(sunSky, 520);
      sun.position.set(cam.position.x + sunDir.x * 120, sunDir.y * 120, cam.position.z + sunDir.z * 120);
      sun.target.position.set(cam.position.x, 0, cam.position.z);
      for (let i = 0; i < banners.length; i++) banners[i].rotation.y = Math.sin(t * 1.3 + i) * 0.35;
      for (const p of points) p.flag.rotation.y = Math.sin(t * 1.7 + p.P.x) * 0.4;
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}

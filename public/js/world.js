// 맵 데이터 → Three.js 장면 (땅, 빛, 소품, 먼 산, 해, 깃발, 거점, 눈)
import * as THREE from 'three';
import { tex, labelTexture, bannerTexture } from './assets.js';
import { buildProps } from './props.js';
import { MAP_HALF, TEAMS } from '../shared/config.js';
import { THEMES } from '../shared/map.js';

export function buildWorld(scene, map, ink) {
  const theme = THEMES[map.id] || THEMES.city;
  const group = new THREE.Group();
  ink.setMist(theme.mist[0], theme.mist[1]);

  // 빛
  const hemi = new THREE.HemisphereLight(0xffffff, 0x77736d, theme.snow ? 1.55 : 1.35);
  const sun = new THREE.DirectionalLight(0xffffff, theme.snow ? 1.9 : 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(ink.shadowSize, ink.shadowSize);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  const sunDir = new THREE.Vector3(-0.45, 0.8, -0.4).normalize();
  group.add(hemi, sun, sun.target);

  // 땅
  const S = 1400;
  const groundGeo = new THREE.PlaneGeometry(S, S);
  const guv = groundGeo.attributes.uv;
  const tile = theme.groundTex === 'snowfield' ? 22 : 14;
  for (let i = 0; i < guv.count; i++) guv.setXY(i, (guv.getX(i) * S) / tile, (guv.getY(i) * S) / tile);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ map: tex[theme.groundTex], color: theme.ground }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 소품 + 재질 상자
  const { mats } = buildProps(group, map);

  // 경계 철조망
  const posts = [];
  for (let t = -MAP_HALF; t <= MAP_HALF; t += 5) {
    for (const [x, z] of [[t, -MAP_HALF], [t, MAP_HALF], [-MAP_HALF, t], [MAP_HALF, t]]) {
      if (map.id === 'harbor' && x > 60) continue;
      const g = new THREE.BoxGeometry(0.14, 1.5, 0.14);
      g.translate(x, 0.75, z);
      posts.push(g);
    }
  }
  const postGeo = posts.reduce((acc, g) => { acc.push(g); return acc; }, []);
  for (const g of postGeo) group.add(new THREE.Mesh(g, mats.dark));
  const wirePts = [];
  for (const y of [0.6, 1.2]) {
    const c = [[-MAP_HALF, -MAP_HALF], [MAP_HALF, -MAP_HALF], [MAP_HALF, MAP_HALF], [-MAP_HALF, MAP_HALF], [-MAP_HALF, -MAP_HALF]];
    for (let i = 0; i < 4; i++) {
      if (map.id === 'harbor' && c[i][0] > 60 && c[i + 1][0] > 60) continue;
      wirePts.push(new THREE.Vector3(c[i][0], y, c[i][1]), new THREE.Vector3(c[i + 1][0], y, c[i + 1][1]));
    }
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: 0x1a1918 })));

  // 팀 깃발 (펄럭임)
  const banners = [];
  const bannerMats = [0, 1].map((t) => new THREE.MeshLambertMaterial({ map: bannerTexture(t), side: THREE.DoubleSide }));
  for (const p of map.props) {
    if (p.kind !== 'banner') continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), mats.dark);
    pole.position.set(p.x, 3, p.z);
    pole.castShadow = true;
    const clothGeo = new THREE.PlaneGeometry(2.2, 3.3, 10, 4);
    clothGeo.translate(1.1, 0, 0);
    const cloth = new THREE.Mesh(clothGeo, bannerMats[p.team]);
    cloth.position.set(p.x + 0.07, 4.2, p.z);
    cloth.rotation.y = p.team ? Math.PI : 0;
    cloth.castShadow = true;
    cloth.userData.base = clothGeo.attributes.position.array.slice();
    group.add(pole, cloth);
    banners.push(cloth);
  }

  // 먼 산 + 해
  tex.mountains.repeat.set(3, 1);
  const mountains = new THREE.Mesh(
    new THREE.CylinderGeometry(460, 460, 170, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: tex.mountains, transparent: true, side: THREE.BackSide, depthWrite: false, color: theme.snow ? 0xbfc4c8 : 0xffffff }),
  );
  mountains.renderOrder = -2;
  group.add(mountains);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.sun, depthWrite: false, color: theme.snow ? 0x777777 : 0xffffff, opacity: theme.snow ? 0.6 : 1, transparent: true }));
  sunSprite.scale.set(70, 70, 1);
  sunSprite.renderOrder = -3;
  group.add(sunSprite);
  const sunSky = new THREE.Vector3(0.6, 0.26, -0.76).normalize();

  // 눈
  let snow = null;
  if (theme.snow) {
    const N = 2200, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa3ab, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
    snow.frustumCulled = false;
    group.add(snow);
  }

  // 거점 표지 (점령전)
  const RING = ['#55524d', TEAMS[0].css, TEAMS[1].css];
  const points = map.points.map((P) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(P.r - 0.35, P.r, 64), new THREE.MeshBasicMaterial({ color: 0x55524d, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(P.x, 0.05, P.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.5, 8), mats.dark);
    pole.position.set(P.x, 2.25, P.z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshLambertMaterial({ color: 0xdedad2, side: THREE.DoubleSide }));
    flag.geometry.translate(0.9, 0, 0);
    flag.position.set(P.x + 0.06, 3.9, P.z);
    const labels = RING.map((c) => labelTexture(P.label, c, c));
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labels[0], depthTest: false, transparent: true }));
    label.scale.set(2.6, 2.6, 1);
    label.position.set(P.x, 6.4, P.z);
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
    theme,
    setMode(mode) {
      for (const p of points) p.g.visible = mode === 'dom';
    },
    setPointState(cp) {
      if (!cp) return;
      cp.forEach(([owner], i) => {
        const p = points[i];
        if (!p || p.owner === owner) return;
        p.owner = owner;
        const col = owner >= 0 ? TEAMS[owner].hex : 0xdedad2;
        p.flag.material.color.setHex(col);
        p.ring.material.color.setHex(owner >= 0 ? TEAMS[owner].hex : 0x55524d);
        p.label.material.map = p.labels[owner + 1];
        p.label.material.needsUpdate = true;
      });
    },
    update(cam, t, dt = 0.016) {
      mountains.position.set(cam.position.x, 58, cam.position.z);
      sunSprite.position.copy(cam.position).addScaledVector(sunSky, 520);
      sun.position.set(cam.position.x + sunDir.x * 140, sunDir.y * 140, cam.position.z + sunDir.z * 140);
      sun.target.position.set(cam.position.x, 0, cam.position.z);
      for (let i = 0; i < banners.length; i++) {
        const b = banners[i], pos = b.geometry.attributes.position, base = b.userData.base;
        for (let v = 0; v < pos.count; v++) {
          const x = base[v * 3];
          pos.setZ(v, Math.sin(t * 3 + x * 2.2 + i) * 0.14 * x);
        }
        pos.needsUpdate = true;
      }
      for (const p of points) p.flag.rotation.y = Math.sin(t * 1.7 + p.P.x) * 0.4;
      if (snow) {
        const pos = snow.geometry.attributes.position;
        snow.position.set(Math.round(cam.position.x / 70) * 0, 0, 0);
        for (let i = 0; i < pos.count; i++) {
          let x = pos.getX(i), y = pos.getY(i) - dt * (1.2 + (i % 7) * 0.12), z = pos.getZ(i);
          x += Math.sin(t + i) * dt * 0.4;
          if (y < 0) y += 30;
          if (x - cam.position.x > 35) x -= 70; else if (x - cam.position.x < -35) x += 70;
          if (z - cam.position.z > 35) z -= 70; else if (z - cam.position.z < -35) z += 70;
          pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;
      }
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          for (const m of [].concat(o.material)) {
            if (m.map && m.map.isCanvasTexture) m.map.dispose();
            m.dispose();
          }
        }
      });
    },
  };
}

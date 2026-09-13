// 뽑기 3D 무대 — 제단 · 옻칠 두루마리 통 · 빛기둥 · 불티 입자 · 충격파 · 총 등장(빛 테두리 디졸브)
import * as THREE from 'three';
import { SKINS } from '../shared/config.js';
import { buildGun } from './models.js';

const PI = Math.PI;
const NOISE = /* glsl */ `
float gh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gnoise3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gh3(i), gh3(i + vec3(1,0,0)), f.x), mix(gh3(i + vec3(0,1,0)), gh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gh3(i + vec3(0,0,1)), gh3(i + vec3(1,0,1)), f.x), mix(gh3(i + vec3(0,1,1)), gh3(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export class GachaStage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x0b0a09);
    scene.fog = new THREE.FogExp2(0x0b0a09, 0.055);
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 100);
    this.camPos = new THREE.Vector3(0, 2.2, 8);
    this.camLook = new THREE.Vector3(0, 1.6, 0);
    this.camPosGoal = this.camPos.clone();
    this.camLookGoal = this.camLook.clone();
    this.color = new THREE.Color(0xefe7d6);
    this.glowTex = glowTexture();

    scene.add(new THREE.HemisphereLight(0x8a8070, 0x0b0a09, 0.7));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.5);
    key.position.set(3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    this.rim = new THREE.PointLight(0xffffff, 0, 14);
    this.rim.position.set(0, 2.4, -1.6);
    this.spot = new THREE.SpotLight(0xffffff, 0, 24, 0.38, 0.6, 1);
    this.spot.position.set(0, 10, 0.5);
    this.spot.target.position.set(0, 1.6, 0);
    this.spot.castShadow = true;
    this.fill = new THREE.DirectionalLight(0xfff6ea, 0);
    this.fill.position.set(2, 3, 6);
    this.front = new THREE.PointLight(0xffffff, 0, 8);
    this.front.position.set(0.6, 2.4, 2.6);
    scene.add(this.rim, this.spot, this.spot.target, this.fill, this.front);

    // 바닥: 새겨진 동심원 + 퍼지는 충격파
    this.floorU = { uTime: { value: 0 }, uColor: { value: this.color }, uWave: { value: -1 }, uGlow: { value: 0.2 } };
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 96), new THREE.ShaderMaterial({
      uniforms: this.floorU,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uWave; uniform float uGlow; varying vec2 vP;
        ${NOISE}
        void main(){
          float r = length(vP), a = atan(vP.y, vP.x);
          float stone = 0.06 + 0.035 * gnoise3(vec3(vP * 2.2, 0.0)) + 0.02 * gnoise3(vec3(vP * 9.0, 1.0));
          float rings = smoothstep(0.03, 0.0, abs(fract(r * 0.75) - 0.5) - 0.46) * smoothstep(9.0, 2.0, r);
          float spokes = smoothstep(0.02, 0.0, abs(fract(a / 6.2831 * 24.0) - 0.5) - 0.48) * step(2.0, r) * step(r, 5.2);
          vec3 col = vec3(stone) + uColor * (rings * 0.1 + spokes * 0.05) * (0.5 + uGlow);
          col += uColor * uGlow * 0.5 * exp(-r * 0.7);
          if (uWave > 0.0) col += uColor * exp(-pow((r - uWave) * 3.0, 2.0)) * 1.6 * smoothstep(12.0, 3.0, uWave);
          col *= smoothstep(16.0, 6.0, r);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    floor.rotation.x = -PI / 2;
    scene.add(floor);

    // 제단
    const stone = new THREE.MeshPhongMaterial({ color: 0x2c2a27, shininess: 25, specular: 0x222222 });
    const altar = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [1.6, 0], [1.6, 0.16], [1.3, 0.26], [1.05, 0.34], [0.85, 0.78], [0.92, 0.88], [1.25, 0.96], [1.25, 1.08], [0, 1.08]].map(([x, y]) => new THREE.Vector2(x, y)), 48), stone);
    altar.castShadow = altar.receiveShadow = true;
    scene.add(altar);
    this.runeMat = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.018, 8, 96), this.runeMat);
    ring.rotation.x = PI / 2;
    ring.position.y = 1.02;
    scene.add(ring);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * PI * 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.035), this.runeMat);
      m.position.set(Math.cos(a) * 1.4, 0.2, Math.sin(a) * 1.4);
      m.rotation.y = -a;
      scene.add(m);
    }

    // 옻칠 두루마리 통
    this.casket = new THREE.Group();
    this.casket.position.set(0, 2.0, 0);
    scene.add(this.casket);
    const lacquer = new THREE.MeshPhongMaterial({ color: 0x151313, shininess: 110, specular: 0x777777 });
    const gold = new THREE.MeshPhongMaterial({ color: 0xc9a24a, shininess: 90, specular: 0xffe6a0, emissive: 0x2a1c00 });
    this.halves = [0, 1].map((i) => {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.5, 40, 1, false, i ? PI / 2 : -PI / 2, PI), lacquer);
      shell.rotation.z = PI / 2;
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.68), new THREE.MeshBasicMaterial({ color: 0x3a0f0a, side: THREE.DoubleSide }));
      inner.rotation.x = PI / 2;
      g.add(shell, inner);
      for (const x of [-0.75, 0.75]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.09, 40, 1, false, i ? PI / 2 : -PI / 2, PI), gold);
        cap.rotation.z = PI / 2;
        cap.position.x = x;
        g.add(cap);
      }
      for (const x of [-0.32, 0.32]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.352, 0.352, 0.05, 40, 1, true, i ? PI / 2 : -PI / 2, PI), gold);
        band.rotation.z = PI / 2;
        band.position.x = x;
        g.add(band);
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.casket.add(g);
      return { g, vel: new THREE.Vector3(), spin: new THREE.Vector3() };
    });
    this.sealMat = new THREE.MeshPhongMaterial({ color: 0xb3301c, emissive: 0x220000, shininess: 30 });
    this.seal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.06), this.sealMat);
    this.seal.position.set(0, 0, 0.36);
    this.casket.add(this.seal);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this.color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.scale.setScalar(4);
    this.halo.position.set(0, 2.0, -0.2);
    scene.add(this.halo);

    // 빛기둥
    this.beamU = { uTime: { value: 0 }, uColor: { value: this.color }, uOpacity: { value: 0 } };
    const beamMat = new THREE.ShaderMaterial({
      uniforms: this.beamU,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; ${NOISE}
        void main(){ float n = gnoise3(vec3(vUv.x * 18.0, vUv.y * 3.0 - uTime * 1.5, uTime * 0.3));
          float a = pow(1.0 - vUv.y, 0.3) * smoothstep(0.0, 0.25, vUv.y) * (0.45 + 0.55 * n) * uOpacity;
          gl_FragColor = vec4(uColor * a, a); }`,
    });
    this.beams = [];
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06 + k * 0.05, 1.1 + k * 0.35, 11, 40, 1, true), beamMat);
      b.position.y = 7.2;
      scene.add(b);
      this.beams.push(b);
    }

    // 입자 (불티 · 금가루)
    const N = (this.pN = 1400);
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(N * 3);
    this.pAlpha = new Float32Array(N);
    this.pSize = new Float32Array(N);
    this.pVel = new Float32Array(N * 3);
    this.pLife = new Float32Array(N);
    this.pMax = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1));
    this.pU = { uColor: { value: this.color }, uTex: { value: this.glowTex }, uScale: { value: 300 } };
    const points = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: this.pU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float alpha; attribute float size; varying float vA; uniform float uScale;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform sampler2D uTex; varying float vA;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35) * t.a * vA, t.a * vA); }`,
    }));
    points.frustumCulled = false;
    scene.add(points);
    this.points = points;
    this.pNext = 0;

    // 충격파 링
    this.shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 96), new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.shock.position.set(0, 2.0, 0);
    scene.add(this.shock);

    this.gunPivot = new THREE.Group();
    this.gunPivot.position.set(0, 2.05, 0);
    scene.add(this.gunPivot);

    this.U = { prog: { value: 0 }, edge: { value: this.color } };
    this.running = false;
    this.t = 0;
    this.reset();
  }

  setColor(hex) {
    this.color.set(hex);
    this.spot.color.set(hex);
    this.rim.color.set(hex);
    this.halo.material.color.set(hex);
    this.shock.material.color.set(hex);
    this.runeMat.color.set(hex);
  }

  reset() {
    this.phase = 'intro';
    this.shake = 0;
    this.tease = 0;
    this.teaseRank = 0;
    this.orbit = false;
    this.casket.visible = true;
    this.casket.position.set(0, 3.8, 0);
    this.casket.rotation.set(0, 0.35, 0);
    this.seal.visible = true;
    this.seal.scale.setScalar(1);
    for (const h of this.halves) { h.g.position.set(0, 0, 0); h.g.rotation.set(0, 0, 0); h.vel.set(0, 0, 0); h.spin.set(0, 0, 0); }
    this.sealMat.emissive.setHex(0x220000);
    this.beamU.uOpacity.value = 0;
    this.floorU.uGlow.value = 0.2;
    this.floorU.uWave.value = -1;
    this.spot.intensity = 12;
    this.rim.intensity = 0;
    this.fill.intensity = 0;
    this.front.intensity = 0;
    this.gunPivot.position.x = 0;
    this.halo.material.opacity = 0.18;
    this.shock.material.opacity = 0;
    this.clearGun();
    this.setColor(0xefe7d6);
    this.camPosGoal.set(0, 2.3, 8.2);
    this.camLookGoal.set(0, 1.7, 0);
    this.camPos.set(0, 3.2, 11);
    this.pAlpha.fill(0);
    this.pLife.fill(0);
  }

  emit(x, y, z, vx, vy, vz, life, size) {
    const i = this.pNext;
    this.pNext = (this.pNext + 1) % this.pN;
    this.pPos.set([x, y, z], i * 3);
    this.pVel.set([vx, vy, vz], i * 3);
    this.pLife[i] = 0;
    this.pMax[i] = life;
    this.pSize[i] = size;
  }

  // 1) 기다림: 통이 내려앉고 불티가 피어오른다
  intro() {
    this.phase = 'intro';
  }

  // 2) 예고: 등급 색으로 물들고, 등급이 높을수록 빛기둥과 흔들림이 거세진다
  teaseTo(rankIndex, hex) {
    this.phase = 'tease';
    this.teaseRank = rankIndex;
    this.setColor(hex);
    this.orbit = rankIndex >= 3;
    this.sealMat.emissive.set(hex).multiplyScalar(0.8);
    this.camPosGoal.set(0, 2.1, 6.2 - rankIndex * 0.35);
    this.camLookGoal.set(0, 1.95, 0);
  }

  // 3) 파열
  burst() {
    this.phase = 'burst';
    this.shake = 0.35 + this.teaseRank * 0.2;
    this.seal.visible = false;
    this.halves[0].vel.set(0, 3.2, 1.2); this.halves[0].spin.set(-4, 0.6, 0.8);
    this.halves[1].vel.set(0, -1.2, 2.0); this.halves[1].spin.set(3, -0.5, -0.6);
    this.shockR = 0.2;
    this.shock.material.opacity = 1;
    this.floorU.uWave.value = 0.5;
    const c = this.casket.position;
    const n = 260 + this.teaseRank * 160;
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * PI * 2, s = 2 + Math.random() * (5 + this.teaseRank * 2.5);
      const r = Math.sqrt(1 - u * u);
      this.emit(c.x, c.y, c.z, Math.cos(a) * r * s, u * s + 1.5, Math.sin(a) * r * s, 0.8 + Math.random() * 1.4, 0.05 + Math.random() * 0.12);
    }
    this.spot.intensity = 90;
    this.halo.material.opacity = 1;
    this.halo.scale.setScalar(9);
  }

  // 4) 총 등장: 아래에서부터 빛 테두리와 함께 짜여 나온다
  reveal(skinId, hex) {
    this.phase = 'reveal';
    this.setColor(hex);
    this.casket.visible = false;
    this.clearGun();
    const s = SKINS[skinId];
    const gun = buildGun(s.weapon, skinId);
    const box = new THREE.Box3().setFromObject(gun);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    gun.position.sub(center);
    const holder = new THREE.Group();
    holder.add(gun);
    holder.scale.setScalar(Math.min(1.9, 1.9 / Math.max(size.z, 0.3)) * (size.z < 0.5 ? 0.75 : 1));
    holder.rotation.y = PI / 2;
    this.U.prog.value = 0;
    const U = this.U;
    gun.traverse((o) => {
      if (!o.isMesh) return;
      const base = o.material;
      const m = base.clone();
      const prev = base.onBeforeCompile;
      m.onBeforeCompile = (shader, renderer) => {
        if (prev) prev.call(base, shader, renderer);
        shader.uniforms.uProg = U.prog;
        shader.uniforms.uEdgeCol = U.edge;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vGP;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = position;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\nvarying vec3 vGP;\nuniform float uProg;\nuniform vec3 uEdgeCol;\n${NOISE}`)
          .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  float dn = gnoise3(vGP * 38.0) * 0.65 + gnoise3(vGP * 7.0) * 0.35;
  float edgeD = uProg * 1.25 - dn - (vGP.z * 0.0);
  if (edgeD < 0.0) discard;
  gl_FragColor.rgb += uEdgeCol * (1.0 - smoothstep(0.0, 0.07, edgeD)) * 4.0;`);
      };
      m.customProgramCacheKey = () => `dissolve|${base.customProgramCacheKey ? base.customProgramCacheKey() : ''}|${base.type}`;
      o.material = m;
      o.userData.dissolveMat = true;
    });
    this.gunPivot.add(holder);
    this.gunT = 0;
    this.gunPivot.position.x = -0.55;
    this.camPosGoal.set(0.55, 2.3, 5.6);
    this.camLookGoal.set(0.35, 1.95, 0);
    this.fill.intensity = 2.2;
    this.front.intensity = 14;
    this.beamU.uOpacity.value = 0.55;
    this.floorU.uGlow.value = 0.9;
    this.halo.material.opacity = 0.35;
    this.halo.scale.setScalar(5);
    this.spot.intensity = 30;
    this.rim.intensity = 30;
  }

  // 10연 카드 볼 때: 무대를 어둡게
  dim() {
    this.phase = 'dim';
    this.clearGun();
    this.casket.visible = false;
    this.beamU.uOpacity.value = 0.18;
    this.spot.intensity = 6;
    this.rim.intensity = 0;
    this.camPosGoal.set(0, 2.6, 9);
    this.camLookGoal.set(0, 1.6, 0);
  }

  clearGun() {
    for (const c of [...this.gunPivot.children]) {
      c.traverse((o) => { if (o.isMesh && o.userData.dissolveMat) o.material.dispose(); });
      this.gunPivot.remove(c);
    }
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.floor(w * this.renderer.getPixelRatio())) this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.beamU.uTime.value = t;
    this.floorU.uTime.value = t;

    // 통
    if (this.casket.visible) {
      const c = this.casket.position;
      const bob = Math.sin(t * 1.6) * 0.06;
      c.y += (2.0 + bob - c.y) * Math.min(1, dt * 3);
      this.casket.rotation.y += dt * 0.25;
      if (this.phase === 'tease') {
        this.tease = Math.min(1, this.tease + dt * 0.8);
        const amp = (0.01 + this.teaseRank * 0.018) * this.tease;
        this.casket.rotation.z = Math.sin(t * 43) * amp * 3;
        c.x = Math.sin(t * 57) * amp;
        this.beamU.uOpacity.value = this.tease * (0.2 + this.teaseRank * 0.27);
        this.floorU.uGlow.value = 0.2 + this.tease * (0.3 + this.teaseRank * 0.25);
        this.spot.intensity = 12 + this.tease * (10 + this.teaseRank * 25);
        this.rim.intensity = this.tease * 20;
        this.halo.material.opacity = 0.2 + this.tease * (0.2 + this.teaseRank * 0.15);
        this.halo.scale.setScalar(4 + Math.sin(t * 8) * 0.3 * this.tease);
        this.sealMat.emissiveIntensity = 1 + Math.sin(t * 20) * 0.5;
      }
      if (this.phase === 'burst') {
        for (const h of this.halves) {
          h.vel.y -= 9 * dt;
          h.g.position.addScaledVector(h.vel, dt);
          h.g.rotation.x += h.spin.x * dt;
          h.g.rotation.y += h.spin.y * dt;
          h.g.rotation.z += h.spin.z * dt;
        }
      }
    }
    // 충격파
    if (this.shock.material.opacity > 0) {
      this.shockR += dt * 9;
      this.shock.scale.setScalar(this.shockR);
      this.shock.lookAt(this.camera.position);
      this.shock.material.opacity = Math.max(0, 1 - this.shockR / 6);
    }
    if (this.floorU.uWave.value > 0) {
      this.floorU.uWave.value += dt * 7;
      if (this.floorU.uWave.value > 14) this.floorU.uWave.value = -1;
    }
    if (this.phase === 'burst') {
      this.spot.intensity += (30 - this.spot.intensity) * Math.min(1, dt * 3);
      this.halo.material.opacity += (0.3 - this.halo.material.opacity) * Math.min(1, dt * 3);
    }

    // 총
    if (this.gunPivot.children.length) {
      this.gunT += dt;
      this.U.prog.value = Math.min(1.2, this.gunT / 1.3);
      const e = 1 - Math.pow(1 - Math.min(1, this.gunT / 1.6), 3);
      this.gunPivot.rotation.y = (1 - e) * -3.5 + this.gunT * 0.45 + 0.4;
      this.gunPivot.rotation.x = Math.sin(this.gunT * 0.9) * 0.08;
      this.gunPivot.position.y = 2.05 + Math.sin(this.gunT * 1.3) * 0.05 + (1 - e) * -0.6;
    }

    // 입자: 늘 피어오르는 불티 + (전설) 궤도 금가루
    const emitRate = this.phase === 'intro' ? 22 : this.phase === 'tease' ? 40 + this.teaseRank * 40 : 30;
    for (let k = 0; k < emitRate * dt * 1.0 + Math.random(); k++) {
      const a = Math.random() * PI * 2, r = 0.5 + Math.random() * 2.2;
      this.emit(Math.cos(a) * r, 0.2 + Math.random() * 0.8, Math.sin(a) * r, (Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 0.2, 2 + Math.random() * 2, 0.03 + Math.random() * 0.06);
    }
    if (this.orbit) {
      for (let k = 0; k < 3; k++) {
        const a = t * 3 + k * 2.1, r = 1.1;
        this.emit(Math.cos(a) * r, 2.0 + Math.sin(t * 2 + k) * 0.4, Math.sin(a) * r, -Math.sin(a) * 0.8, 0.2, Math.cos(a) * 0.8, 0.8, 0.1);
      }
    }
    const P = this.pPos, V = this.pVel;
    for (let i = 0; i < this.pN; i++) {
      if (this.pMax[i] <= 0) continue;
      this.pLife[i] += dt;
      const k = this.pLife[i] / this.pMax[i];
      if (k >= 1) { this.pMax[i] = 0; this.pAlpha[i] = 0; continue; }
      V[i * 3] *= 1 - dt * 1.2; V[i * 3 + 1] *= 1 - dt * 1.2; V[i * 3 + 2] *= 1 - dt * 1.2;
      V[i * 3 + 1] -= dt * 0.6;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      this.pAlpha[i] = Math.sin(k * PI) * 0.95;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;

    // 카메라
    this.camPos.lerp(this.camPosGoal, Math.min(1, dt * 1.6));
    this.camLook.lerp(this.camLookGoal, Math.min(1, dt * 2));
    this.shake = Math.max(0, this.shake - dt * 1.4);
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * this.shake * 0.25, this.camPos.y + (Math.random() - 0.5) * this.shake * 0.25, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.pU.uScale.value = this.renderer.domElement.height * 0.9;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.resize();
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }
}

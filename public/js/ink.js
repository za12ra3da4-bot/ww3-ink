// 수묵채색 후처리 렌더러 — 장면을 한 번 그린 뒤 먹선·먹번짐·한지·안개로 다시 칠한다.
// 채도가 높은 색(팀 색, 피, 총 스킨)은 채색으로 남기고 나머지는 먹의 농담으로 바꾼다.
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tPaper;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uHurt;
uniform float uFlash;
uniform vec2 uMist;
uniform float uLine;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float linDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 px = 1.0 / uRes;
  vec2 wob = (vec2(noise(vUv * 38.0), noise(vUv * 38.0 + 19.7)) - 0.5) * px * 0.8;
  vec2 uv = vUv + wob;
  vec3 col = texture2D(tColor, uv).rgb;
  float d = linDepth(uv);
  float sky = step(uFar * 0.98, d);

  // 먹선 1: 1/z 라플라시안 — 평면은 0, 윤곽과 모서리만
  float th = mix(1.6, 0.85, clamp(d / 45.0, 0.0, 1.0)) * uLine;
  vec2 o = px * th;
  float ic = 1.0 / d;
  float lap = abs(1.0 / linDepth(uv + vec2(o.x, 0.0)) + 1.0 / linDepth(uv - vec2(o.x, 0.0)) +
                  1.0 / linDepth(uv + vec2(0.0, o.y)) + 1.0 / linDepth(uv - vec2(0.0, o.y)) - 4.0 * ic) / ic;
  float edgeD = smoothstep(0.035, 0.15, lap);

  // 먹선 2: 밝기 경계(소벨)
  float l00 = luma(texture2D(tColor, uv + vec2(-o.x, -o.y)).rgb), l10 = luma(texture2D(tColor, uv + vec2(0.0, -o.y)).rgb);
  float l20 = luma(texture2D(tColor, uv + vec2(o.x, -o.y)).rgb), l01 = luma(texture2D(tColor, uv + vec2(-o.x, 0.0)).rgb);
  float l21 = luma(texture2D(tColor, uv + vec2(o.x, 0.0)).rgb), l02 = luma(texture2D(tColor, uv + vec2(-o.x, o.y)).rgb);
  float l12 = luma(texture2D(tColor, uv + vec2(0.0, o.y)).rgb), l22 = luma(texture2D(tColor, uv + vec2(o.x, o.y)).rgb);
  float gx = (l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02);
  float gy = (l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20);
  float edgeL = smoothstep(0.25, 0.65, sqrt(gx * gx + gy * gy));

  float mist = smoothstep(uMist.x, uMist.y, d) * (1.0 - step(700.0, d));
  float edge = clamp(edgeD + edgeL * 0.7, 0.0, 1.0);
  edge *= mix(0.8, 1.0, noise(vUv * uRes / 2.5));
  edge *= 1.0 - mist * 0.92;

  // 먹 농담
  float L = luma(col);
  float ink = 1.0 - L;
  float band = floor(ink * 5.0 + noise(vUv * 6.0) * 0.6) / 5.0;
  ink = mix(ink, band, 0.1);
  ink = pow(clamp(ink, 0.0, 1.0), 1.1);
  ink *= 0.97 + 0.06 * noise(vUv * uRes / 2.0);

  // 주변광 차폐: 가까운 곳이 둘러싸면 먹이 살짝 짙어진다 (구석·틈의 깊이감)
  float ao = 0.0;
  float rad = clamp(9.0 / d, 1.5, 14.0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.785 + 0.4;
    vec2 o2 = vec2(cos(a), sin(a)) * px * rad * (1.0 + 0.5 * mod(float(k), 2.0));
    float dd = d - linDepth(uv + o2);
    ao += smoothstep(0.08, 0.6, dd) * (1.0 - smoothstep(0.6, 3.0, dd));
  }
  ink = clamp(ink + (ao / 8.0) * 0.28 * (1.0 - sky), 0.0, 1.0);
  ink *= 1.0 - mist * 0.9;

  vec3 paper = texture2D(tPaper, gl_FragCoord.xy / 512.0).rgb;
  vec3 inkCol = vec3(0.075, 0.07, 0.065);
  vec3 c = mix(paper, inkCol, clamp(ink * 0.94, 0.0, 1.0));

  // 채색: 채도가 높은 곳은 원래 색을 한지 결과 함께 남긴다
  float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
  float sat = (mx - mn) / max(mx, 0.08);
  float ck = smoothstep(0.22, 0.55, sat) * smoothstep(0.02, 0.12, mx) * (1.0 - mist * 0.75) * (1.0 - sky);
  vec3 tinted = col * (paper / vec3(0.94, 0.905, 0.83));
  c = mix(c, tinted, ck * 0.92);

  c = mix(c, inkCol, edge * (1.0 - sky));

  vec2 q = vUv - 0.5;
  float vig = dot(q, q);
  c *= 1.0 - vig * 0.3;
  c = mix(c, vec3(0.6, 0.12, 0.07), uHurt * smoothstep(0.08, 0.5, vig * 2.2));
  c = mix(c, vec3(1.0, 0.975, 0.92), uFlash);
  gl_FragColor = vec4(c, 1.0);
}`;

const QUALITY = {
  low: { ratio: 0.85, samples: 0, shadow: 1024 },
  medium: { ratio: 1.25, samples: 2, shadow: 2048 },
  high: { ratio: 2, samples: 4, shadow: 4096 },
};

export class InkRenderer {
  constructor(canvas, quality = 'medium') {
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        tPaper: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.05 },
        uFar: { value: 900 },
        uHurt: { value: 0 },
        uFlash: { value: 0 },
        uMist: { value: new THREE.Vector2(24, 160) },
        uLine: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);

    this.setQuality(quality);
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    const Q = QUALITY[name] || QUALITY.medium;
    this.quality = QUALITY[name] ? name : 'medium';
    this.shadowSize = Q.shadow;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.ratio));
    if (this.target) this.target.dispose();
    const depth = new THREE.DepthTexture(1, 1);
    depth.type = THREE.FloatType;
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: depth, depthBuffer: true, samples: Q.samples });
    this.material.uniforms.tColor.value = this.target.texture;
    this.material.uniforms.tDepth.value = depth;
    this.resize();
  }

  setPaper(tex) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    this.material.uniforms.tPaper.value = tex;
  }

  setMist(near, far) { this.material.uniforms.uMist.value.set(near, far); }
  set hurt(v) { this.material.uniforms.uHurt.value = v; }
  set flash(v) { this.material.uniforms.uFlash.value = v; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight, pr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h, false);
    this.target.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.material.uniforms.uRes.value.set(Math.floor(w * pr), Math.floor(h * pr));
    this.material.uniforms.uLine.value = Math.max(1, pr * 0.8);
    this.aspect = w / h;
  }

  render(scene, camera) {
    const u = this.material.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    if (camera.aspect !== this.aspect) {
      camera.aspect = this.aspect;
      camera.updateProjectionMatrix();
    }
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }
}

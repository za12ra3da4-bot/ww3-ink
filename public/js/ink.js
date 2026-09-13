// 수묵화 후처리 렌더러 — 장면을 한 번 그린 뒤 먹선·먹번짐·한지·안개로 다시 칠한다.
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
uniform float uGray;
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
float luma(vec2 uv) { return dot(texture2D(tColor, uv).rgb, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 px = 1.0 / uRes;
  vec2 wob = (vec2(noise(vUv * 42.0), noise(vUv * 42.0 + 19.7)) - 0.5) * px * 2.5;
  vec2 uv = vUv + wob;
  vec3 col = texture2D(tColor, uv).rgb;
  float d = linDepth(uv);
  float sky = step(uFar * 0.98, d);

  // 먹선 1: 1/z 라플라시안 — 평면은 0, 윤곽과 모서리만 검출
  float th = mix(1.7, 0.9, clamp(d / 50.0, 0.0, 1.0));
  vec2 o = px * th;
  float ic = 1.0 / d;
  float lap = abs(1.0 / linDepth(uv + vec2(o.x, 0.0)) + 1.0 / linDepth(uv - vec2(o.x, 0.0)) +
                  1.0 / linDepth(uv + vec2(0.0, o.y)) + 1.0 / linDepth(uv - vec2(0.0, o.y)) - 4.0 * ic) / ic;
  float edgeD = smoothstep(0.03, 0.14, lap);

  // 먹선 2: 밝기 경계(소벨)
  float l00 = luma(uv + vec2(-o.x, -o.y)), l10 = luma(uv + vec2(0.0, -o.y)), l20 = luma(uv + vec2(o.x, -o.y));
  float l01 = luma(uv + vec2(-o.x, 0.0)), l21 = luma(uv + vec2(o.x, 0.0));
  float l02 = luma(uv + vec2(-o.x, o.y)), l12 = luma(uv + vec2(0.0, o.y)), l22 = luma(uv + vec2(o.x, o.y));
  float gx = (l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02);
  float gy = (l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20);
  float edgeL = smoothstep(0.22, 0.6, sqrt(gx * gx + gy * gy));

  float mist = smoothstep(22.0, 150.0, d) * (1.0 - step(300.0, d));
  float edge = clamp(edgeD + edgeL * 0.75, 0.0, 1.0);
  edge *= mix(0.5, 1.0, noise(vUv * uRes / 2.5));
  edge *= 1.0 - mist * 0.9;

  // 먹 농담: 몇 단계로 뭉친 번짐 + 입자감
  float L = dot(col, vec3(0.299, 0.587, 0.114));
  float ink = 1.0 - L;
  float band = floor(ink * 4.0 + noise(vUv * 7.0) * 0.7) / 4.0;
  ink = mix(ink, band, 0.4);
  ink = pow(clamp(ink, 0.0, 1.0), 1.2);
  ink *= 0.82 + 0.34 * noise(vUv * uRes / 3.0);
  ink *= 1.0 - mist * 0.88;

  // 주홍 먹(붉은 팀, 피, 해)
  float red = clamp((col.r - max(col.g, col.b)) * 3.2, 0.0, 1.0) * (1.0 - uGray);

  vec3 paper = texture2D(tPaper, gl_FragCoord.xy / 512.0).rgb;
  vec3 inkCol = vec3(0.075, 0.07, 0.065);
  vec3 verm = vec3(0.7, 0.18, 0.1);
  vec3 c = mix(paper, inkCol, clamp(ink * 0.94, 0.0, 1.0));
  c = mix(c, mix(paper, verm, 0.8 + 0.2 * (1.0 - L)), red * (1.0 - mist * 0.6));
  c = mix(c, inkCol, edge * (1.0 - sky));

  vec2 q = vUv - 0.5;
  float vig = dot(q, q);
  c *= 1.0 - vig * 0.32;
  c = mix(c, vec3(0.6, 0.12, 0.07), uHurt * smoothstep(0.08, 0.5, vig * 2.2));
  c = mix(c, vec3(1.0, 0.975, 0.92), uFlash);
  gl_FragColor = vec4(c, 1.0);
}`;

export class InkRenderer {
  constructor(canvas) {
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const depth = new THREE.DepthTexture(1, 1);
    depth.type = THREE.FloatType;
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: depth, depthBuffer: true });

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: depth },
        tPaper: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.05 },
        uFar: { value: 900 },
        uHurt: { value: 0 },
        uFlash: { value: 0 },
        uGray: { value: 0 },
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

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setPaper(tex) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    this.material.uniforms.tPaper.value = tex;
  }

  set hurt(v) { this.material.uniforms.uHurt.value = v; }
  set flash(v) { this.material.uniforms.uFlash.value = v; }
  set gray(v) { this.material.uniforms.uGray.value = v; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight, pr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h, false);
    this.target.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.material.uniforms.uRes.value.set(Math.floor(w * pr), Math.floor(h * pr));
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

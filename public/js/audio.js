// 효과음 엔진
// - 총소리: 무기 × 스킨 음색을 샘플 단위로 합성한 버퍼(타격음·크랙·저음·기계음·잔향)를 미리 만들어 재생
// - 거리/방향: 직접 계산 (멀수록 작고 먹먹하게, 좌우 패닝) — 다른 사람 총소리는 거리만큼 줄어든다
// - 그 밖의 효과음: 실시간 합성

const TAU = Math.PI * 2;

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// ── 바이쿼드 필터 (RBJ) ───────────────────────────
class Biquad {
  constructor(sr) { this.sr = sr; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(type, f, q = 0.707) {
    f = Math.max(20, Math.min(this.sr * 0.45, f));
    const w = (TAU * f) / this.sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
    let b0, b1, b2;
    const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ── 합성 도구 (mono Float32Array 에 더한다) ──────
function S(sr, buf, rnd) {
  const N = buf.length;
  const idx = (t) => Math.floor(t * sr);
  return {
    // 걸러낸 잡음 폭발. sweep: [시작Hz, 끝Hz] 이면 시간에 따라 필터가 움직인다
    noise(at, { type = 'bp', f = 1000, to = 0, q = 0.7, attack = 0.001, tau = 0.05, gain = 1, dur = tau * 7, am = 0 }) {
      const bq = new Biquad(sr);
      bq.set(type, f, q);
      const s0 = idx(at), s1 = Math.min(N, s0 + idx(dur));
      for (let i = s0; i < s1; i++) {
        const t = (i - s0) / sr;
        if (to && (i - s0) % 32 === 0) bq.set(type, f * Math.pow(to / f, Math.min(1, t / dur)), q);
        let e = t < attack ? t / attack : Math.exp(-(t - attack) / tau);
        if (am) e *= 0.5 + 0.5 * Math.sin(TAU * am * t);
        buf[i] += bq.run(rnd() * 2 - 1) * e * gain;
      }
    },
    // 음정이 떨어지는 톤 (몸통 저음, 뿅 소리)
    tone(at, { f = 100, to = 0, glide = 0.05, tau = 0.08, attack = 0.001, gain = 1, wave = 'sine', dur = tau * 7, vib = 0, fm = 0, ratio = 2, am = 0 }) {
      const s0 = idx(at), s1 = Math.min(N, s0 + idx(dur));
      let ph = 0, mph = 0;
      for (let i = s0; i < s1; i++) {
        const t = (i - s0) / sr;
        let fr = to ? to + (f - to) * Math.exp(-t / glide) : f;
        if (vib) fr *= 1 + 0.01 * Math.sin(TAU * vib * t);
        mph += (TAU * fr * ratio) / sr;
        ph += (TAU * fr) / sr + (fm ? (fm * Math.exp(-t / (tau * 0.6)) * Math.cos(mph) * TAU * fr * ratio) / sr : 0);
        let v;
        const p = ph % TAU;
        if (wave === 'saw') v = p / Math.PI - 1;
        else if (wave === 'square') v = p < Math.PI ? 0.7 : -0.7;
        else if (wave === 'tri') v = 1 - Math.abs(p / Math.PI - 1) * 2;
        else v = Math.sin(ph);
        let e = t < attack ? t / attack : Math.exp(-(t - attack) / tau);
        if (am) e *= 0.6 + 0.4 * Math.sin(TAU * am * t);
        buf[i] += v * e * gain;
      }
    },
    // 공명 (금속 딸깍, 목탁, 종)
    modal(at, freqs, taus, gains) {
      freqs.forEach((f, k) => this.tone(at, { f: f * (0.98 + rnd() * 0.04), tau: taus[k] ?? taus[0], gain: gains[k] ?? gains[0], attack: 0.0005 }));
    },
    crackle(at, span, count, gain, f = 3500) {
      for (let k = 0; k < count; k++) this.noise(at + rnd() * span, { type: 'bp', f: f * (0.6 + rnd() * 0.9), q: 1.2, tau: 0.004 + rnd() * 0.006, gain: gain * (0.4 + rnd() * 0.6) });
    },
    grains(at, span, count, lo, hi, gain, tau = 0.06) {
      for (let k = 0; k < count; k++) this.tone(at + rnd() * span, { f: lo + rnd() * (hi - lo), tau, gain: gain * (0.5 + rnd() * 0.5), attack: 0.002 });
    },
  };
}

// 슈뢰더 잔향 → 스테레오
function reverb(mono, sr, room) {
  const N = mono.length;
  const L = new Float32Array(N), R = new Float32Array(N);
  const rt = 0.25 + room * 2.8;
  const make = (sec) => {
    const len = Math.max(1, Math.floor(sec * sr));
    return { b: new Float32Array(len), i: 0, g: Math.pow(0.001, sec / rt), lp: 0 };
  };
  const combsL = [0.0297, 0.0371, 0.0411, 0.0437].map(make);
  const combsR = [0.0313, 0.0359, 0.0423, 0.0451].map(make);
  const ap = (sec) => ({ b: new Float32Array(Math.floor(sec * sr)), i: 0 });
  const apL = [ap(0.005), ap(0.0017)], apR = [ap(0.0053), ap(0.0019)];
  const runComb = (c, x) => {
    const y = c.b[c.i];
    c.lp = y * 0.7 + c.lp * 0.3;
    c.b[c.i] = x + c.lp * c.g;
    c.i = (c.i + 1) % c.b.length;
    return y;
  };
  const runAp = (a, x) => {
    const y = a.b[a.i];
    const v = x + y * 0.5;
    a.b[a.i] = v;
    a.i = (a.i + 1) % a.b.length;
    return y - v * 0.5;
  };
  const wet = room;
  for (let i = 0; i < N; i++) {
    const x = mono[i] * 0.25;
    let l = 0, r = 0;
    for (const c of combsL) l += runComb(c, x);
    for (const c of combsR) r += runComb(c, x);
    for (const a of apL) l = runAp(a, l);
    for (const a of apR) r = runAp(a, r);
    L[i] = mono[i] + l * wet;
    R[i] = mono[i] + r * wet;
  }
  return [L, R];
}

// ── 무기 기본 음색 ────────────────────────────────
const WEAPON = {
  rifle: { len: 0.8, crackF: 1600, crackTau: 0.034, crack: 1.0, bodyF: 150, bodyTo: 55, bodyTau: 0.07, body: 0.9, boomF: 600, boomTau: 0.09, boom: 0.6, mech: [2900, 4100, 6200], mechGain: 0.12, room: 0.22, drive: 2.2, level: 0.52 },
  smg: { len: 0.55, crackF: 2100, crackTau: 0.022, crack: 0.9, bodyF: 180, bodyTo: 70, bodyTau: 0.045, body: 0.6, boomF: 800, boomTau: 0.05, boom: 0.45, mech: [3300, 5200], mechGain: 0.1, room: 0.15, drive: 2.0, level: 0.42 },
  pistol: { len: 0.6, crackF: 2600, crackTau: 0.025, crack: 0.9, bodyF: 220, bodyTo: 85, bodyTau: 0.04, body: 0.55, boomF: 900, boomTau: 0.05, boom: 0.4, mech: [3800, 6000], mechGain: 0.15, room: 0.2, drive: 2.0, level: 0.44 },
  sniper: { len: 1.7, crackF: 1100, crackTau: 0.06, crack: 1.1, bodyF: 110, bodyTo: 38, bodyTau: 0.12, body: 1.1, boomF: 420, boomTau: 0.24, boom: 0.8, mech: [1800, 2600, 3900], mechGain: 0.2, room: 0.45, drive: 2.6, level: 0.58, bolt: true },
  shotgun: { len: 1.05, crackF: 2400, crackTau: 0.05, crack: 1.0, crackType: 'lp', bodyF: 95, bodyTo: 40, bodyTau: 0.1, body: 1.1, boomF: 500, boomTau: 0.16, boom: 0.9, mech: [1200, 1900], mechGain: 0.15, room: 0.35, drive: 2.8, level: 0.58, pump: true },
  rocket: { len: 1.5, crackF: 1500, crackTau: 0.06, crack: 0.6, crackType: 'lp', bodyF: 80, bodyTo: 35, bodyTau: 0.12, body: 0.9, boomF: 350, boomTau: 0.2, boom: 0.5, mech: [700], mechGain: 0.05, room: 0.4, drive: 2.0, level: 0.52, rocket: true },
};

// ── 스킨 음색 (기본 음색을 바꾸고 고유한 층을 더한다) ──
const VOICES = {
  classic: {},
  tactical: { crackF: 1.15, mech: 2.2, room: -0.08, extra: (s) => s.modal(0.06, [4500, 6800], [0.01], [0.12]) },
  dry: { crackF: 1.3, boom: 0.5, room: -0.12, len: 0.7 },
  thud: { crack: 0.55, crackF: 0.7, body: 1.35, bodyF: 0.8, boom: 1.3 },
  frost: { extra: (s) => { s.modal(0.01, [2637, 3520, 4698, 5920], [0.28], [0.07]); s.noise(0, { type: 'hp', f: 7000, attack: 0.02, tau: 0.2, gain: 0.12 }); } },
  crisp: { crackF: 1.5, crack: 1.1, body: 0.8, len: 0.8, extra: (s) => s.noise(0, { type: 'hp', f: 6000, tau: 0.002, gain: 0.5 }) },
  heavy: { body: 1.4, bodyF: 0.75, boom: 1.5, room: 0.1, len: 1.3, drive: 1.3 },
  rusty: { drive: 1.4, extra: (s) => { s.crackle(0.02, 0.12, 6, 0.18, 2500); s.modal(0.03, [900, 1450], [0.05], [0.12]); } },
  brush: { crack: 0.8, extra: (s) => s.noise(0.02, { type: 'bp', f: 800, to: 3200, q: 1.5, attack: 0.05, tau: 0.15, gain: 0.45 }) },
  wood: { crack: 0.6, extra: (s) => s.modal(0, [420, 870, 1330], [0.08, 0.05, 0.03], [0.4, 0.22, 0.12]) },
  feather: { extra: (s) => { s.noise(0.01, { type: 'bp', f: 3000, q: 2, attack: 0.01, tau: 0.15, gain: 0.3, am: 38 }); s.tone(0.01, { f: 2400, to: 3600, glide: 0.05, tau: 0.06, gain: 0.12 }); } },
  jade: { crack: 0.85, extra: (s) => { s.tone(0.005, { f: 1760, tau: 0.45, gain: 0.16, vib: 6 }); s.modal(0.005, [2800, 4200], [0.2], [0.06]); } },
  synth: { body: 1.1, extra: (s) => { for (const f of [220, 277.2, 329.6]) s.tone(0, { f, wave: 'saw', tau: 0.22, gain: 0.07 }); s.tone(0, { f: 110, wave: 'square', tau: 0.12, gain: 0.08 }); } },
  beast: { body: 1.2, extra: (s) => { s.tone(0.01, { f: 90, to: 70, glide: 0.2, wave: 'saw', tau: 0.25, gain: 0.18, am: 23 }); s.noise(0.01, { type: 'bp', f: 600, q: 1.5, tau: 0.22, gain: 0.3, am: 19 }); } },
  temple: { room: 0.15, tail: 0.8, extra: (s) => { s.modal(0.01, [180, 247, 333, 472], [1.2, 0.9, 0.7, 0.5], [0.12, 0.08, 0.06, 0.04]); s.modal(0, [640, 1310], [0.05, 0.03], [0.25, 0.12]); } },
  bell: { tail: 0.5, extra: (s) => s.modal(0.005, [880, 2429, 4752], [0.9, 0.5, 0.3], [0.15, 0.08, 0.05]) },
  silent: { crack: 0.15, crackF: 0.45, body: 0.45, boom: 0.4, mech: 2.5, room: -0.15, level: 0.75, len: 0.5, extra: (s) => s.noise(0, { type: 'lp', f: 700, tau: 0.06, gain: 0.55 }) },
  thunder: { room: 0.1, tail: 0.6, extra: (s) => { s.crackle(0.03, 0.35, 14, 0.35, 3000); s.noise(0.04, { type: 'lp', f: 130, attack: 0.05, tau: 0.6, gain: 0.7 }); } },
  spirit: { room: 0.2, tail: 0.7, extra: (s) => { for (const f of [523, 528, 784, 790]) s.tone(0.02, { f, attack: 0.06, tau: 0.6, gain: 0.06, am: 7 }); } },
  shimmer: { extra: (s) => s.grains(0.01, 0.5, 20, 3000, 8000, 0.05) },
  magma: { body: 1.2, extra: (s) => { s.grains(0.02, 0.4, 10, 80, 200, 0.16, 0.05); s.noise(0.02, { type: 'hp', f: 5000, attack: 0.05, tau: 0.4, gain: 0.08 }); } },
  cosmic: { room: 0.15, tail: 0.6, extra: (s) => { s.tone(0.01, { f: 1500, to: 600, glide: 0.25, tau: 0.5, gain: 0.1, fm: 3, ratio: 2.01 }); s.grains(0.05, 0.5, 8, 4000, 9000, 0.05, 0.1); } },
  laser: { crack: 0.35, boom: 0.6, extra: (s) => { s.tone(0, { f: 2200, to: 180, glide: 0.06, tau: 0.18, gain: 0.3, fm: 5, ratio: 1.5 }); s.noise(0, { type: 'bp', f: 5000, q: 1, tau: 0.05, gain: 0.15 }); } },
  phoenix: { tail: 0.5, extra: (s) => { [880, 1109, 1319, 1760].forEach((f, i) => s.tone(0.01 + i * 0.035, { f, tau: 0.35, gain: 0.09 })); s.noise(0.01, { type: 'lp', f: 500, to: 4000, attack: 0.04, tau: 0.35, gain: 0.28 }); } },
  roar: { body: 1.3, level: 1.05, extra: (s) => { s.noise(0.02, { type: 'bp', f: 300, to: 900, q: 2.5, attack: 0.03, tau: 0.35, gain: 0.5 }); s.tone(0.01, { f: 55, tau: 0.3, gain: 0.4 }); } },
  flame: { extra: (s) => { s.noise(0.01, { type: 'lp', f: 600, to: 5000, attack: 0.05, tau: 0.45, gain: 0.35 }); s.crackle(0.05, 0.5, 10, 0.12, 2500); } },
  abyss: { room: 0.2, tail: 0.7, extra: (s) => { s.tone(0.01, { f: 70, to: 28, glide: 0.2, tau: 0.5, gain: 0.6 }); s.noise(0.02, { type: 'lp', f: 300, tau: 0.6, gain: 0.35, am: 5 }); } },
  harmony: { room: 0.1, extra: (s) => [1318.5, 1661.2, 1975.5].forEach((f, i) => s.tone(0.01 + i * 0.03, { f, tau: 0.6, gain: 0.09 })) },
};
export const GUN_VOICES = Object.keys(VOICES);
export { synthGun };

function synthGun(weapon, voice, sr) {
  const W = WEAPON[weapon] || WEAPON.rifle, V = VOICES[voice] || {};
  const m = (k) => (V[k] ?? 1);
  const len = W.len * m('len') + (V.tail || 0);
  const mono = new Float32Array(Math.ceil(len * sr));
  const rnd = mulberry(hashStr(weapon + voice));
  const s = S(sr, mono, rnd);

  // 1 타격음: 아주 짧은 광대역 딸깍
  s.noise(0, { type: 'hp', f: 3000, tau: 0.003, gain: 0.7 });
  // 2 크랙: 총구 폭발음의 날카로운 부분
  s.noise(0, { type: W.crackType || 'bp', f: W.crackF * m('crackF'), q: 0.7, tau: W.crackTau, gain: W.crack * m('crack') });
  if (weapon === 'sniper') s.noise(0, { type: 'hp', f: 4200, tau: 0.012, gain: 0.5 * m('crack') });
  // 3 몸통: 음정이 떨어지는 저음 + 4 둥둥 울림
  s.tone(0, { f: W.bodyF * m('bodyF'), to: W.bodyTo * m('bodyF'), glide: 0.05, tau: W.bodyTau, gain: W.body * m('body') });
  s.noise(0.002, { type: 'lp', f: W.boomF, tau: W.boomTau, gain: W.boom * m('boom') });
  // 5 기계음
  s.modal(0.004, W.mech, [0.02], [W.mechGain * m('mech')]);
  if (W.bolt) { s.modal(0.45, [1800, 2600, 3900], [0.03], [0.14]); s.modal(0.62, [2200, 3300], [0.025], [0.12]); }
  if (W.pump) { s.noise(0.36, { type: 'bp', f: 900, tau: 0.03, gain: 0.22 }); s.modal(0.37, [1200, 1900], [0.02], [0.13]); s.modal(0.5, [1500, 2300], [0.02], [0.13]); }
  if (W.rocket) {
    s.noise(0, { type: 'bp', f: 400, to: 2600, q: 1.2, attack: 0.08, tau: 0.45, gain: 0.7 });
    s.noise(0.05, { type: 'hp', f: 5000, attack: 0.05, tau: 0.4, gain: 0.14 });
  }
  if (V.extra) V.extra(s);

  // 포화(펀치감) + 잔향 + 정규화
  const drive = W.drive * m('drive');
  const td = Math.tanh(drive);
  for (let i = 0; i < mono.length; i++) mono[i] = Math.tanh(mono[i] * drive) / td;
  const room = Math.max(0.02, Math.min(0.8, W.room + (V.room || 0)));
  const [L, R] = reverb(mono, sr, room);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = (W.level * m('level')) / (peak || 1);
  const fade = Math.floor(sr * 0.02);
  for (let i = 0; i < L.length; i++) {
    const f = i > L.length - fade ? (L.length - i) / fade : 1;
    L[i] *= k * f;
    R[i] *= k * f;
  }
  return [L, R];
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.vol = 0.7;
    this.voices = 0;
    this.buffers = new Map();
    this.lx = 0; this.ly = 0; this.lz = 0; this.lyaw = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.vol * 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ready() { return this.ctx && this.ctx.state === 'running'; }

  setVolume(v) {
    this.vol = v;
    if (this.master) this.master.gain.value = v * 0.8;
  }

  // 매 프레임 카메라 위치/방향
  listen(x, y, z, yaw) {
    this.lx = x; this.ly = y; this.lz = z; this.lyaw = yaw;
  }

  // 거리 → 음량/먹먹함, 방향 → 좌우
  out(pos, gain = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    if (!pos) {
      g.gain.value = gain;
      g.connect(this.master);
      return g;
    }
    const dx = pos[0] - this.lx, dy = pos[1] - this.ly, dz = pos[2] - this.lz;
    const d = Math.hypot(dx, dy, dz);
    g.gain.value = gain / (1 + Math.pow(d / 7, 1.35));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(900, 18000 * Math.exp(-d / 45));
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      const rx = Math.cos(this.lyaw) * dx - Math.sin(this.lyaw) * dz;
      pan.pan.value = d < 0.5 ? 0 : Math.max(-0.85, Math.min(0.85, rx / Math.max(d, 1)));
      g.connect(lp).connect(pan).connect(this.master);
    } else {
      g.connect(lp).connect(this.master);
    }
    return g;
  }

  gunBuffer(weapon, voice) {
    const key = `${weapon}|${voice}`;
    let b = this.buffers.get(key);
    if (!b && this.ctx) {
      const sr = this.ctx.sampleRate;
      const [L, R] = synthGun(weapon, voice, sr);
      b = this.ctx.createBuffer(2, L.length, sr);
      b.copyToChannel(L, 0);
      b.copyToChannel(R, 1);
      this.buffers.set(key, b);
    }
    return b;
  }

  // 전투 시작 시 미리 만들어 첫 발 끊김을 없앤다
  prewarm(list) {
    if (!this.ctx) return;
    const todo = list.filter(([w, v]) => !this.buffers.has(`${w}|${v}`));
    const step = () => {
      const job = todo.shift();
      if (!job) return;
      this.gunBuffer(job[0], job[1]);
      setTimeout(step, 16);
    };
    step();
  }

  claim() {
    if (!this.ready || this.voices > 48) return false;
    this.voices++;
    setTimeout(() => this.voices--, 600);
    return true;
  }

  gun(weapon, voice = 'classic', pos = null, gain = 1) {
    if (!this.claim()) return;
    const buf = this.gunBuffer(weapon, VOICES[voice] ? voice : 'classic');
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    src.connect(this.out(pos, gain * (pos ? 1 : 0.85)));
    src.start();
  }

  burst(dest, t, { dur, type = 'bandpass', freq = 1000, q = 1, peak = 1, attack = 0.002, sweep = 0 }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  tone(dest, t, { dur, freq, to, type = 'sine', peak = 0.5, attack = 0.003 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, pos, gain = 1) {
    if (!this.claim()) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, gain * 0.75);
    switch (name) {
      case 'boom':
        this.burst(o, t, { dur: 1.6, type: 'lowpass', freq: 600, sweep: 80, peak: 1, attack: 0.005 });
        this.tone(o, t, { dur: 0.9, freq: 70, to: 25, peak: 1 });
        this.burst(o, t, { dur: 0.25, freq: 2500, q: 0.4, peak: 0.5 });
        break;
      case 'whistle':
        this.tone(o, t, { dur: 1.6, freq: 1800, to: 350, peak: 0.25, attack: 0.3 });
        break;
      case 'throw':
        this.tone(o, t, { dur: 0.04, freq: 2600, type: 'square', peak: 0.12 });
        this.burst(o, t + 0.05, { dur: 0.2, freq: 700, q: 2, peak: 0.25, attack: 0.05 });
        break;
      case 'reload':
        this.burst(o, t, { dur: 0.05, freq: 2500, q: 3, peak: 0.25 });
        this.tone(o, t, { dur: 0.04, freq: 900, type: 'triangle', peak: 0.15 });
        this.burst(o, t + 0.35, { dur: 0.06, freq: 1800, q: 3, peak: 0.3 });
        this.tone(o, t + 0.35, { dur: 0.05, freq: 600, type: 'triangle', peak: 0.2 });
        break;
      case 'dry':
        this.burst(o, t, { dur: 0.03, freq: 3000, q: 4, peak: 0.2 });
        break;
      case 'hit':
        this.tone(o, t, { dur: 0.07, freq: 1700, peak: 0.22 });
        this.burst(o, t, { dur: 0.03, freq: 5000, q: 2, peak: 0.15 });
        break;
      case 'kill':
        this.tone(o, t, { dur: 0.12, freq: 1300, peak: 0.25 });
        this.tone(o, t + 0.08, { dur: 0.28, freq: 1950, peak: 0.25 });
        break;
      case 'hurt':
        this.tone(o, t, { dur: 0.18, freq: 120, to: 60, peak: 0.5 });
        this.burst(o, t, { dur: 0.12, type: 'lowpass', freq: 500, peak: 0.35 });
        break;
      case 'step':
        this.burst(o, t, { dur: 0.08, type: 'lowpass', freq: 380, peak: 0.22 });
        break;
      case 'land':
        this.burst(o, t, { dur: 0.14, type: 'lowpass', freq: 300, peak: 0.45 });
        break;
      case 'gong':
        for (const [f, p] of [[196, 0.4], [293, 0.2], [466, 0.1], [587, 0.06]]) this.tone(o, t, { dur: 2.8, freq: f, peak: p, attack: 0.01 });
        break;
      case 'click':
        this.tone(o, t, { dur: 0.06, freq: 820, peak: 0.2 });
        break;
      case 'open':
        this.burst(o, t, { dur: 0.28, freq: 900, sweep: 2600, q: 0.7, peak: 0.16, attack: 0.08 });
        this.tone(o, t + 0.05, { dur: 0.25, freq: 520, to: 780, peak: 0.07 });
        break;
      case 'coin':
        this.tone(o, t, { dur: 0.12, freq: 2100, peak: 0.14 });
        this.tone(o, t + 0.06, { dur: 0.2, freq: 3150, peak: 0.1 });
        break;
      case 'drum':
        for (let i = 0; i < 6; i++) this.tone(o, t + i * 0.12, { dur: 0.16, freq: 110 - i * 4, to: 55, peak: 0.45 + i * 0.05 });
        break;
      case 'reveal':
        this.burst(o, t, { dur: 0.6, freq: 500, sweep: 5000, q: 0.6, peak: 0.22, attack: 0.3 });
        break;
      case 'legend':
        for (const [f, p] of [[196, 0.4], [293, 0.25], [392, 0.16], [587, 0.1], [784, 0.06]]) this.tone(o, t, { dur: 3.2, freq: f, peak: p, attack: 0.01 });
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(o, t + 0.1 + i * 0.09, { dur: 0.8, freq: f, peak: 0.1 }));
        break;
      case 'whoosh':
        this.burst(o, t, { dur: 0.55, freq: 300, sweep: 4000, q: 0.8, peak: 0.4, attack: 0.15 });
        break;
      case 'shatter':
        for (let i = 0; i < 9; i++) this.burst(o, t + i * 0.018, { dur: 0.12 + Math.random() * 0.15, freq: 2500 + Math.random() * 4000, q: 3, peak: 0.24 });
        this.tone(o, t, { dur: 0.5, freq: 90, to: 40, peak: 0.6 });
        break;
      case 'flip':
        this.burst(o, t, { dur: 0.09, freq: 1800, sweep: 900, q: 1.2, peak: 0.2, attack: 0.01 });
        break;
      case 'sparkle':
        this.burst(o, t, { dur: 0.09, freq: 1800, sweep: 900, q: 1.2, peak: 0.2, attack: 0.01 });
        [1568, 2093, 2637].forEach((f, i) => this.tone(o, t + 0.03 + i * 0.05, { dur: 0.35, freq: f, peak: 0.08 }));
        break;
      case 'charge':
        this.tone(o, t, { dur: 1.1, freq: 180, to: 720, type: 'sawtooth', peak: 0.06, attack: 0.6 });
        this.burst(o, t, { dur: 1.1, freq: 400, sweep: 3000, q: 2, peak: 0.1, attack: 0.9 });
        break;
      case 'siren':
        for (let i = 0; i < 6; i++) this.tone(o, t + i * 0.8, { dur: 0.75, freq: 420, to: 640, type: 'sawtooth', peak: 0.1, attack: 0.2 });
        break;
      case 'spawn':
        this.tone(o, t, { dur: 0.5, freq: 330, peak: 0.18, attack: 0.02 });
        this.tone(o, t + 0.12, { dur: 0.6, freq: 495, peak: 0.13, attack: 0.02 });
        break;
    }
  }
}

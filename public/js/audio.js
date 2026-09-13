// 효과음 — WebAudio 로 실시간 합성. 총소리는 무기 × 스킨 음색(GUN_VOICES) 조합.
const BASE = {
  rifle: { f: 1300, d: 0.16, lo: 140, loTo: 50, q: 0.7, peak: 0.9 },
  smg: { f: 1800, d: 0.1, lo: 160, loTo: 60, q: 0.8, peak: 0.7 },
  pistol: { f: 2200, d: 0.11, lo: 220, loTo: 80, q: 1, peak: 0.7 },
  sniper: { f: 900, d: 0.55, lo: 110, loTo: 35, q: 0.5, peak: 1 },
  shotgun: { f: 1500, d: 0.35, lo: 100, loTo: 40, q: 0.4, peak: 1, type: 'lowpass' },
  rocket: { f: 300, d: 0.7, lo: 90, loTo: 40, q: 1.5, peak: 0.8, sweep: 2400 },
};
export const GUN_VOICES = ['classic', 'dry', 'thud', 'frost', 'crisp', 'heavy', 'wood', 'thunder', 'bell', 'silent', 'phoenix', 'laser'];

export class Sound {
  constructor() {
    this.ctx = null;
    this.vol = 0.7;
    this.voices = 0;
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
    this.master.gain.value = this.vol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ready() { return this.ctx && this.ctx.state === 'running'; }

  setVolume(v) {
    this.vol = v;
    if (this.master) this.master.gain.value = v;
  }

  listen(x, y, z, yaw) {
    const Lr = this.ctx && this.ctx.listener;
    if (!Lr || !Lr.positionX) return;
    const t = this.ctx.currentTime;
    Lr.positionX.setTargetAtTime(x, t, 0.02);
    Lr.positionY.setTargetAtTime(y, t, 0.02);
    Lr.positionZ.setTargetAtTime(z, t, 0.02);
    Lr.forwardX.setTargetAtTime(-Math.sin(yaw), t, 0.02);
    Lr.forwardY.setTargetAtTime(0, t, 0.02);
    Lr.forwardZ.setTargetAtTime(-Math.cos(yaw), t, 0.02);
    Lr.upX.value = 0; Lr.upY.value = 1; Lr.upZ.value = 0;
  }

  out(pos, gain = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = gain;
    if (pos) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 4;
      p.rolloffFactor = 1.1;
      p.maxDistance = 400;
      p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2];
      g.connect(p).connect(this.master);
    } else {
      g.connect(this.master);
    }
    return g;
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

  claim() {
    if (!this.ready || this.voices > 44) return false;
    this.voices++;
    setTimeout(() => this.voices--, 450);
    return true;
  }

  // 총소리: weapon(무기) × voice(스킨 음색)
  gun(weapon, voice = 'classic', pos = null, gain = 1) {
    if (!this.claim()) return;
    const B = BASE[weapon] || BASE.rifle, t = this.ctx.currentTime, o = this.out(pos, gain);
    const shot = (mul = {}) => {
      const f = B.f * (mul.f || 1), d = B.d * (mul.d || 1);
      this.burst(o, t, { dur: d, type: mul.type || B.type || 'bandpass', freq: f, q: mul.q || B.q, peak: B.peak * (mul.peak || 1), sweep: B.sweep && f * 8 });
      if (mul.tone !== false) this.tone(o, t, { dur: d * 0.6 * (mul.toneD || 1), freq: B.lo * (mul.lo || 1), to: B.loTo * (mul.lo || 1), peak: B.peak * 0.9 * (mul.lowPeak || 1) });
    };
    switch (voice) {
      case 'dry':
        shot({ f: 1.35, d: 0.8, type: 'highpass', lo: 1.3 });
        this.burst(o, t + 0.02, { dur: 0.25, type: 'lowpass', freq: 400, peak: 0.2 });
        break;
      case 'thud':
        shot({ f: 0.45, d: 1.25, type: 'lowpass', lo: 0.8, toneD: 1.6, lowPeak: 1.2 });
        break;
      case 'frost':
        shot({ f: 1.5, q: 2 });
        this.tone(o, t, { dur: 0.3, freq: 2700, to: 2100, peak: 0.18 });
        this.burst(o, t, { dur: 0.35, type: 'highpass', freq: 6000, peak: 0.15, attack: 0.02 });
        break;
      case 'crisp':
        shot({ f: 1.4, d: 0.7, q: 1.2 });
        this.tone(o, t, { dur: 0.02, freq: 3200, type: 'square', peak: 0.22 });
        break;
      case 'heavy':
        shot({ f: 0.6, d: 1.5, type: 'lowpass', lo: 0.7, toneD: 2, lowPeak: 1.2 });
        this.burst(o, t + 0.13, { dur: 0.4, type: 'lowpass', freq: 500, peak: 0.25 });
        break;
      case 'wood':
        this.burst(o, t, { dur: B.d * 0.9, freq: 700, q: 3, peak: B.peak * 0.8 });
        this.tone(o, t, { dur: 0.09, freq: 430, to: 300, type: 'triangle', peak: 0.55 });
        this.tone(o, t, { dur: B.d * 0.5, freq: B.lo, to: B.loTo, peak: 0.6 });
        break;
      case 'thunder':
        shot({ f: 0.8, lowPeak: 1.2 });
        for (let i = 0; i < 5; i++) this.burst(o, t + 0.03 + Math.random() * 0.2, { dur: 0.04, freq: 2500 + Math.random() * 2000, q: 0.8, peak: 0.35 });
        this.burst(o, t + 0.05, { dur: 0.9, type: 'lowpass', freq: 160, peak: 0.6, attack: 0.05 });
        break;
      case 'bell':
        shot({ peak: 0.6 });
        for (const [fq, pk] of [[1320, 0.2], [1980, 0.12], [2640, 0.07]]) this.tone(o, t, { dur: 0.9, freq: fq, peak: pk, attack: 0.004 });
        break;
      case 'silent':
        this.burst(o, t, { dur: 0.12, type: 'lowpass', freq: 520, peak: 0.55 });
        this.tone(o, t, { dur: 0.05, freq: 190, to: 90, peak: 0.35 });
        this.tone(o, t + 0.02, { dur: 0.015, freq: 1900, type: 'square', peak: 0.06 });
        break;
      case 'phoenix':
        shot({ peak: 0.85 });
        [880, 1108, 1318, 1760].forEach((fq, i) => this.tone(o, t + i * 0.04, { dur: 0.5, freq: fq, peak: 0.12 }));
        this.burst(o, t + 0.02, { dur: 0.45, type: 'highpass', freq: 6500, peak: 0.16, attack: 0.03 });
        break;
      case 'laser':
        this.tone(o, t, { dur: 0.2, freq: 1900, to: 170, type: 'sawtooth', peak: 0.32 });
        this.tone(o, t, { dur: 0.14, freq: 950, to: 90, type: 'square', peak: 0.14 });
        this.burst(o, t, { dur: 0.08, freq: 3000, q: 0.6, peak: 0.3 });
        break;
      default:
        shot();
        if (weapon === 'sniper') this.burst(o, t + 0.18, { dur: 0.6, type: 'lowpass', freq: 700, peak: 0.25 });
    }
  }

  play(name, pos, gain = 1) {
    if (!this.claim()) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, gain);
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
        this.tone(o, t, { dur: 0.04, freq: 900, type: 'square', peak: 0.15 });
        this.tone(o, t + 0.35, { dur: 0.05, freq: 600, type: 'square', peak: 0.2 });
        break;
      case 'dry':
        this.tone(o, t, { dur: 0.03, freq: 1500, type: 'square', peak: 0.12 });
        break;
      case 'hit':
        this.tone(o, t, { dur: 0.07, freq: 1700, peak: 0.25 });
        break;
      case 'kill':
        this.tone(o, t, { dur: 0.12, freq: 1300, peak: 0.3 });
        this.tone(o, t + 0.08, { dur: 0.25, freq: 1950, peak: 0.3 });
        break;
      case 'hurt':
        this.tone(o, t, { dur: 0.18, freq: 120, to: 60, peak: 0.6 });
        this.burst(o, t, { dur: 0.12, type: 'lowpass', freq: 500, peak: 0.4 });
        break;
      case 'step':
        this.burst(o, t, { dur: 0.08, type: 'lowpass', freq: 380, peak: 0.25 });
        break;
      case 'land':
        this.burst(o, t, { dur: 0.14, type: 'lowpass', freq: 300, peak: 0.5 });
        break;
      case 'gong':
        for (const [f, p] of [[196, 0.5], [293, 0.25], [466, 0.12], [587, 0.08]]) this.tone(o, t, { dur: 2.8, freq: f, peak: p, attack: 0.01 });
        break;
      case 'click':
        this.tone(o, t, { dur: 0.06, freq: 820, peak: 0.25 });
        break;
      case 'open':
        this.burst(o, t, { dur: 0.28, freq: 900, sweep: 2600, q: 0.7, peak: 0.18, attack: 0.08 });
        this.tone(o, t + 0.05, { dur: 0.25, freq: 520, to: 780, peak: 0.08 });
        break;
      case 'coin':
        this.tone(o, t, { dur: 0.12, freq: 2100, peak: 0.16 });
        this.tone(o, t + 0.06, { dur: 0.2, freq: 3150, peak: 0.12 });
        break;
      case 'drum':
        for (let i = 0; i < 6; i++) this.tone(o, t + i * 0.12, { dur: 0.16, freq: 110 - i * 4, to: 55, peak: 0.5 + i * 0.05 });
        break;
      case 'reveal':
        this.burst(o, t, { dur: 0.6, freq: 500, sweep: 5000, q: 0.6, peak: 0.25, attack: 0.3 });
        break;
      case 'legend':
        for (const [f, p] of [[196, 0.5], [293, 0.3], [392, 0.2], [587, 0.14], [784, 0.08]]) this.tone(o, t, { dur: 3.2, freq: f, peak: p, attack: 0.01 });
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(o, t + 0.1 + i * 0.09, { dur: 0.8, freq: f, peak: 0.12 }));
        break;
      case 'siren':
        for (let i = 0; i < 6; i++) this.tone(o, t + i * 0.8, { dur: 0.75, freq: 420, to: 640, type: 'sawtooth', peak: 0.12, attack: 0.2 });
        break;
      case 'spawn':
        this.tone(o, t, { dur: 0.5, freq: 330, peak: 0.2, attack: 0.02 });
        this.tone(o, t + 0.12, { dur: 0.6, freq: 495, peak: 0.15, attack: 0.02 });
        break;
    }
  }
}

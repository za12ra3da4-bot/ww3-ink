// 효과음 — WebAudio 로 실시간 합성 (총성, 폭발, 징, 사이렌…)
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

  setVolume(v) {
    this.vol = v;
    if (this.master) this.master.gain.value = v;
  }

  listen(x, y, z, yaw) {
    const L = this.ctx && this.ctx.listener;
    if (!L || !L.positionX) return;
    const t = this.ctx.currentTime;
    L.positionX.setTargetAtTime(x, t, 0.02);
    L.positionY.setTargetAtTime(y, t, 0.02);
    L.positionZ.setTargetAtTime(z, t, 0.02);
    L.forwardX.setTargetAtTime(-Math.sin(yaw), t, 0.02);
    L.forwardY.setTargetAtTime(0, t, 0.02);
    L.forwardZ.setTargetAtTime(-Math.cos(yaw), t, 0.02);
    L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
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

  play(name, pos, gain = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.voices > 40) return;
    this.voices++;
    setTimeout(() => this.voices--, 400);
    const t = this.ctx.currentTime;
    const o = this.out(pos, gain);
    switch (name) {
      case 'rifle':
        this.burst(o, t, { dur: 0.16, freq: 1300, q: 0.7, peak: 0.9 });
        this.tone(o, t, { dur: 0.09, freq: 140, to: 50, peak: 0.8 });
        break;
      case 'smg':
        this.burst(o, t, { dur: 0.1, freq: 1800, q: 0.8, peak: 0.7 });
        this.tone(o, t, { dur: 0.06, freq: 160, to: 60, peak: 0.5 });
        break;
      case 'pistol':
        this.burst(o, t, { dur: 0.11, freq: 2200, q: 1, peak: 0.7 });
        this.tone(o, t, { dur: 0.05, freq: 220, to: 80, peak: 0.4 });
        break;
      case 'sniper':
        this.burst(o, t, { dur: 0.55, freq: 900, q: 0.5, peak: 1 });
        this.tone(o, t, { dur: 0.25, freq: 110, to: 35, peak: 1 });
        this.burst(o, t + 0.18, { dur: 0.6, type: 'lowpass', freq: 700, peak: 0.25 });
        break;
      case 'shotgun':
        this.burst(o, t, { dur: 0.35, type: 'lowpass', freq: 1500, peak: 1 });
        this.tone(o, t, { dur: 0.15, freq: 100, to: 40, peak: 1 });
        break;
      case 'rocket':
        this.burst(o, t, { dur: 0.7, freq: 300, sweep: 2400, q: 1.5, peak: 0.8, attack: 0.05 });
        break;
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

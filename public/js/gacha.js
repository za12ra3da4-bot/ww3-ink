// 먹통 뽑기 연출 — 먹 입자, 봉인 색 예고, 봉인 파쇄, 붓질 섬광, 3D 총 쇼케이스, 10연 카드 뒤집기
import * as THREE from 'three';
import { SKINS, WEAPONS, RARITY, RARITY_ORDER } from '../shared/config.js';
import { buildGun } from './models.js';
import { skinThumb } from './skins.js';

const $ = (id) => document.getElementById(id);
export const RCOL = { common: '#c9c2b3', rare: '#4f98dc', epic: '#b872ea', legendary: '#f2c24c' };
export const VOICE_NAMES = {
  classic: '기본 총성', dry: '건조한 총성', thud: '둔탁한 총성', frost: '서리 울림', crisp: '맑은 총성', heavy: '묵직한 포효',
  wood: '목탁 소리', thunder: '천둥', bell: '풍경 소리', silent: '소음기', phoenix: '봉황의 울음', laser: '뇌전',
  tactical: '전술 기계음', rusty: '녹슨 쇳소리', brush: '붓 휘두르는 소리', feather: '날갯짓', jade: '옥 울림', synth: '신시사이저',
  beast: '맹수의 으르렁', temple: '산사의 범종', spirit: '도깨비 속삭임', shimmer: '자개 반짝임', magma: '끓는 용암', cosmic: '우주의 메아리',
  roar: '백호의 포효', flame: '주작의 불길', abyss: '심연의 파동', harmony: '태극의 화음',
};
const rank = (r) => RARITY_ORDER.indexOf(r);

// ── 2D 입자 (먹 방울, 불티, 금가루) ───────────────
class Particles {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.list = [];
    this.ambient = '#efe7d6';
    this.running = false;
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.c.width = innerWidth * dpr;
    this.c.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  burst(x, y, color, n = 80, speed = 9) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.2 + Math.random());
      this.list.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 0, max: 50 + Math.random() * 70,
        size: 1.5 + Math.random() * 3.5, color, type: Math.random() < 0.35 ? 'ink' : 'spark', drag: 0.94 + Math.random() * 0.04,
      });
    }
  }

  rain(color, n = 3) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        x: Math.random() * innerWidth, y: -10, vx: (Math.random() - 0.5) * 0.6, vy: 1 + Math.random() * 2.5, life: 0, max: 400,
        size: 1 + Math.random() * 2.5, color, type: 'spark', drag: 1, fall: true,
      });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.resize();
    const tick = () => {
      if (!this.running) return;
      requestAnimationFrame(tick);
      const { ctx } = this;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (Math.random() < 0.5) {
        this.list.push({
          x: Math.random() * innerWidth, y: innerHeight + 20, vx: (Math.random() - 0.5) * 0.4, vy: -0.4 - Math.random() * 0.8,
          life: 0, max: 380, size: 20 + Math.random() * 60, color: this.ambient, type: 'mist', drag: 1,
        });
      }
      if (this.gold) this.rain(this.gold, 2);
      ctx.globalCompositeOperation = 'lighter';
      const keep = [];
      for (const p of this.list) {
        p.life++;
        if (p.life > p.max || p.y > innerHeight + 80) continue;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + (p.type === 'ink' ? 0.25 : p.type === 'spark' && !p.fall ? 0.08 : 0);
        p.x += p.vx;
        p.y += p.vy;
        const k = 1 - p.life / p.max;
        if (p.type === 'mist') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, hexA(p.color, 0.05 * Math.sin(k * Math.PI)));
          g.addColorStop(1, hexA(p.color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        } else if (p.type === 'spark') {
          ctx.strokeStyle = hexA(p.color, k);
          ctx.lineWidth = p.size * k;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
          ctx.stroke();
        } else {
          ctx.fillStyle = hexA(p.color, k * 0.9);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, Math.PI * 2);
          ctx.fill();
        }
        keep.push(p);
      }
      ctx.globalCompositeOperation = 'source-over';
      this.list = keep;
    };
    tick();
  }

  stop() {
    this.running = false;
    this.list = [];
    this.gold = null;
    this.ctx.clearRect(0, 0, this.c.width, this.c.height);
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

// ── 3D 총 쇼케이스 ────────────────────────────────
class GunViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 50);
    this.camera.position.set(0, 0.25, 3.2);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xfff6e6, 0x3a3632, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 3, 3);
    this.rim = new THREE.DirectionalLight(0xffffff, 3.2);
    this.rim.position.set(-3, 1, -3);
    const fill = new THREE.PointLight(0xffffff, 3, 8);
    fill.position.set(0, -1.5, 2);
    this.scene.add(key, this.rim, fill);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.t = 0;
    this.running = false;
  }

  show(skinId) {
    const s = SKINS[skinId];
    this.pivot.clear();
    const gun = buildGun(s.weapon, skinId);
    const box = new THREE.Box3().setFromObject(gun);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    gun.position.sub(center);
    const holder = new THREE.Group();
    holder.add(gun);
    holder.scale.setScalar(1.9 / Math.max(size.z, 0.3));
    holder.rotation.y = Math.PI / 2;
    this.pivot.add(holder);
    this.rim.color.set(RCOL[s.rarity]);
    this.t = 0;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
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
      this.t += dt;
      const intro = Math.min(1, this.t / 0.9);
      const ease = 1 - Math.pow(1 - intro, 3);
      this.pivot.rotation.y = (1 - ease) * -2.6 + this.t * 0.55;
      this.pivot.rotation.x = Math.sin(this.t * 0.8) * 0.12;
      this.pivot.position.y = Math.sin(this.t * 1.4) * 0.04;
      this.pivot.scale.setScalar(0.4 + ease * 0.6);
      this.resize();
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
}

// ── 연출 본체 ─────────────────────────────────────
export class GachaFX {
  constructor({ sound, onEquip, onAgain, isEquipped }) {
    this.sound = sound;
    this.onEquip = onEquip;
    this.onAgain = onAgain;
    this.isEquipped = isEquipped;
    this.el = $('gachaFx');
    this.stage = $('gfxStage');
    this.particles = new Particles($('gfxParticles'));
    this.viewer = null;
    this.skip = false;
    this.el.addEventListener('pointerdown', (e) => {
      if (this.busy && !e.target.closest('button')) { this.skip = true; if (this.wake) this.wake(); }
    });
    $('gfxClose').addEventListener('click', () => this.close());
    $('gfxAgain').addEventListener('click', () => { this.close(); this.onAgain(); });
  }

  sleep(ms) {
    return new Promise((resolve) => {
      if (this.skip) return resolve();
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); resolve(); }
      this.wake = done;
    });
  }

  center() { return [innerWidth / 2, innerHeight / 2 - 30]; }

  async run(count, request) {
    this.busy = true;
    this.skip = false;
    this.el.hidden = false;
    this.el.className = 'gfx';
    $('gfxActions').hidden = true;
    $('gfxSkip').hidden = false;
    this.particles.ambient = '#efe7d6';
    this.particles.start();
    this.stage.innerHTML = `
      <div class="gfx-altar">
        <div class="gfx-halo"></div>
        <img class="gfx-scroll" src="assets/ui/scroll.svg" alt="">
        <div class="gfx-seal"><span class="hanja">封</span></div>
        <div class="gfx-shards"></div>
      </div>
      <p class="gfx-caption">${count === 10 ? '열 개의 봉인' : '봉인된 두루마리'}를 여는 중…</p>`;
    this.sound.play('drum');

    const [res] = await Promise.all([request, this.sleep(1000)]);
    if (!res || !res.ok) {
      this.stage.innerHTML = `<p class="gfx-err">${(res && res.error) || '뽑기에 실패했습니다.'}</p>`;
      this.finish();
      return res;
    }
    const thumbs = await Promise.all(res.results.map((r) => skinThumb(r.id, 240, 80)));
    const best = res.results.reduce((a, r) => (rank(r.rarity) > rank(a) ? r.rarity : a), 'common');

    // 봉인 색 예고: 흰 → (희귀 이상이면) 등급 색으로 차오른다
    const altar = this.stage.querySelector('.gfx-altar');
    altar.style.setProperty('--rc', RCOL[best]);
    altar.classList.add('tease', `tease-${best}`);
    this.stage.querySelector('.gfx-caption').textContent = best === 'legendary' ? '두루마리가 금빛으로 타오른다…' : best === 'epic' ? '봉인이 떨리기 시작한다…' : '봉인이 풀린다…';
    this.sound.play('charge');
    if (rank(best) >= 2) this.sound.play('drum');
    await this.sleep(best === 'legendary' ? 1700 : best === 'epic' ? 1300 : 800);

    // 파쇄
    this.shatter(altar);
    this.el.classList.add('burst', `best-${best}`);
    const [cx, cy] = this.center();
    this.particles.burst(cx, cy, RCOL[best], rank(best) >= 2 ? 220 : 110, rank(best) >= 2 ? 14 : 9);
    this.particles.burst(cx, cy, '#1a1816', 60, 7);
    this.particles.ambient = RCOL[best];
    if (best === 'legendary') this.particles.gold = RCOL.legendary;
    this.sound.play('shatter');
    this.sound.play('whoosh');
    this.sound.play(best === 'legendary' ? 'legend' : best === 'epic' ? 'gong' : 'reveal');
    await this.sleep(650);

    if (count === 1) await this.showcase(res.results[0], thumbs[0]);
    else await this.grid(res.results, thumbs);
    this.finish();
    return res;
  }

  shatter(altar) {
    const box = altar.querySelector('.gfx-shards');
    let html = '';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3, d = 180 + Math.random() * 260;
      html += `<i style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rot:${Math.random() * 720 - 360}deg;--s:${0.5 + Math.random()}"></i>`;
    }
    box.innerHTML = html;
    altar.classList.add('broken');
  }

  async showcase(r, thumb, back = false) {
    const s = SKINS[r.id], R = RARITY[r.rarity];
    this.stage.innerHTML = `
      <div class="gshow r-${r.rarity}" style="--rc:${RCOL[r.rarity]}">
        <div class="gs-left">
          <div class="gs-glow"></div>
          <canvas id="gfx3d" class="gs-3d"></canvas>
          <img class="gs-thumb" src="${thumb}" alt="">
        </div>
        <div class="gs-info">
          <div class="gs-stamp"><img src="assets/ui/seal.svg" alt=""><b class="hanja">${R.hanja}</b></div>
          <div class="gs-rarity">${R.name} 등급</div>
          <h2 class="gs-name">${s.name}</h2>
          <p class="gs-weapon">${WEAPONS[s.weapon].name} 스킨 · 총소리 「${VOICE_NAMES[s.sound]}」</p>
          <p class="gs-state ${r.dup ? 'dup' : 'new'}">${r.dup ? `이미 가진 스킨 · 코인 ${R.refund} 환급` : '새 스킨 획득'}</p>
          <div class="gs-btns">
            <button class="brush-btn small" data-act="equip">${this.isEquipped(r.id) ? '장착 중' : '장 착'}</button>
            <button class="link-btn" data-act="sound">총소리 듣기</button>
            ${back ? '<button class="link-btn" data-act="back">목록으로</button>' : ''}
          </div>
        </div>
      </div>`;
    const canvas = $('gfx3d');
    if (!this.viewer) {
      try { this.viewer = new GunViewer(canvas); } catch { this.viewer = false; }
    } else {
      this.viewer.renderer.dispose();
      try { this.viewer = new GunViewer(canvas); } catch { this.viewer = false; }
    }
    if (this.viewer) {
      this.stage.querySelector('.gs-thumb').hidden = true;
      this.viewer.show(r.id);
      this.viewer.start();
    }
    const box = this.stage.querySelector('.gshow');
    const equipBtn = box.querySelector('[data-act=equip]');
    if (this.isEquipped(r.id)) equipBtn.disabled = true;
    equipBtn.addEventListener('click', () => {
      this.onEquip(r.id);
      equipBtn.textContent = '장착 중';
      equipBtn.disabled = true;
      this.sound.play('coin');
    });
    box.querySelector('[data-act=sound]').addEventListener('click', () => this.sound.gun(s.weapon, s.sound));
    const backBtn = box.querySelector('[data-act=back]');
    if (backBtn) backBtn.addEventListener('click', () => this.grid(this.lastResults, this.lastThumbs, true));
    await this.sleep(500);
    this.sound.gun(s.weapon, s.sound);
  }

  async grid(results, thumbs, instant = false) {
    this.lastResults = results;
    this.lastThumbs = thumbs;
    if (this.viewer) this.viewer.stop();
    this.stage.innerHTML = `<div class="ggrid">${results.map((r, i) => {
      const s = SKINS[r.id];
      return `<button class="gflip r-${r.rarity}${instant ? ' flipped' : ''}" data-i="${i}" style="--rc:${RCOL[r.rarity]};--i:${i}">
        <div class="gf-inner">
          <div class="gf-back"><img src="assets/ui/enso.svg" alt=""><b class="hanja">封</b></div>
          <div class="gf-front">
            <div class="gf-rar"><b class="hanja">${RARITY[r.rarity].hanja}</b>${RARITY[r.rarity].name}</div>
            <img src="${thumbs[i]}" alt="">
            <strong>${s.name}</strong>
            <small>${WEAPONS[s.weapon].name}</small>
            <em class="${r.dup ? '' : 'new'}">${r.dup ? `+${r.refund} 코인` : '새 스킨'}</em>
          </div>
        </div>
      </button>`;
    }).join('')}</div><p class="gfx-caption">카드를 누르면 3D로 자세히 볼 수 있습니다</p>`;
    const cards = [...this.stage.querySelectorAll('.gflip')];
    cards.forEach((c) => c.addEventListener('click', () => {
      if (!c.classList.contains('flipped')) return;
      const i = +c.dataset.i;
      this.showcase(results[i], thumbs[i], true);
    }));
    if (instant) return;
    // 등급 낮은 것부터 뒤집어 긴장감을 쌓는다
    const order = results.map((r, i) => i).sort((a, b) => rank(results[a].rarity) - rank(results[b].rarity) || a - b);
    await this.sleep(300);
    for (const i of order) {
      const c = cards[i], r = results[i], big = rank(r.rarity) >= 2;
      if (big && !this.skip) {
        c.classList.add('charging');
        this.sound.play('charge');
        await this.sleep(r.rarity === 'legendary' ? 900 : 600);
      }
      c.classList.remove('charging');
      c.classList.add('flipped');
      const rect = c.getBoundingClientRect();
      if (!this.skip || big) this.particles.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, RCOL[r.rarity], big ? 120 : 24, big ? 11 : 5);
      this.sound.play(big ? (r.rarity === 'legendary' ? 'legend' : 'gong') : rank(r.rarity) === 1 ? 'sparkle' : 'flip');
      await this.sleep(big ? 500 : 170);
    }
  }

  finish() {
    this.busy = false;
    $('gfxSkip').hidden = true;
    $('gfxActions').hidden = false;
  }

  close() {
    this.el.hidden = true;
    this.stage.innerHTML = '';
    this.particles.stop();
    if (this.viewer) this.viewer.stop();
  }
}

// 로비 — 3D 병사 미리보기, 출전(방 만들기/참가), 병사 꾸미기, 무기고(스킨 장착), 먹통 뽑기
import * as THREE from 'three';
import {
  LOOKS, LOOK_PARTS, SKIN_STYLES, SKINS, WEAPONS, WEAPON_IDS, RARITY, RARITY_ORDER, GACHA, GACHA_POOL, MAPS, MODES, COIN,
  defaultSkin, cleanLook, randomLook,
} from '../shared/config.js';
import { buildSoldier, buildGun } from './models.js';
import { buildProps } from './props.js';
import { tex, bannerTexture, mapThumb } from './assets.js';
import { skinThumb } from './skins.js';
import { previewMap } from './hud.js';
import { GachaFX, VOICE_NAMES } from './gacha.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export { VOICE_NAMES };

export class Lobby {
  constructor(game, handlers) {
    this.g = game;
    this.h = handlers;
    this.tab = 'play';
    this.weapon = 'rifle';
    this.preview = null;
    this.map = 'random';
    this.mode = 'tdm';
    this.difficulty = 'normal';
    this.rotY = Math.PI - 0.45;
    this.spin = 0;
    this.built = false;
    this.bindUI();
  }

  // ── 3D 무대 ─────────────────────────────────────
  build() {
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0xffffff);
    this.camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 900);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x77736d, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-6, 10, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    const geo = new THREE.PlaneGeometry(240, 240);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 17, uv.getY(i) * 17);
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex.ground, color: 0xe2ded6 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const props = new THREE.Group();
    buildProps(props, {
      boxes: [],
      props: [
        { kind: 'sandbags', x: -3.4, z: -2.8, rot: 0.35, len: 3.2, s: 0.3 },
        { kind: 'crate', x: 3.4, z: -3.8, rot: 0.4, y: 0, s: 0.1 },
        { kind: 'crate', x: 4.7, z: -3.4, rot: 0.2, y: 0, s: 0.2 },
        { kind: 'barrel', x: 2.4, z: -2.4, s: 0.3, red: true },
        { kind: 'pine', x: 9, z: -22, h: 10, s: 0.41 },
        { kind: 'pine', x: -12, z: -20, h: 11, s: 0.77 },
        { kind: 'deadtree', x: -5.8, z: -6.5, h: 5.5, s: 0.52 },
        { kind: 'tank', x: -9, z: -16, rot: 0.6, wreck: true, s: 0.5 },
        { kind: 'wire', x: -1, z: -10, rot: 0.15, len: 14, s: 0.3 },
        { kind: 'crater', x: -1.2, z: -4, r: 2.2, s: 0.6 },
        { kind: 'rock', x: -4.2, z: -4.6, size: 0.8, s: 0.2 },
      ],
    });
    scene.add(props);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 5.5, 8), new THREE.MeshLambertMaterial({ color: 0x2b2a28 }));
    pole.position.set(3.2, 2.75, -7);
    pole.castShadow = true;
    const clothGeo = new THREE.PlaneGeometry(1.9, 2.8, 10, 4);
    clothGeo.translate(0.95, 0, 0);
    this.flag = new THREE.Mesh(clothGeo, new THREE.MeshLambertMaterial({ map: bannerTexture(0), side: THREE.DoubleSide }));
    this.flag.position.set(3.25, 3.9, -7);
    this.flag.castShadow = true;
    this.flagBase = clothGeo.attributes.position.array.slice();
    scene.add(pole, this.flag);

    tex.mountains.repeat.set(3, 1);
    const mountains = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 130, 64, 1, true), new THREE.MeshBasicMaterial({ map: tex.mountains, transparent: true, side: THREE.BackSide, depthWrite: false }));
    mountains.position.y = 42;
    mountains.renderOrder = -2;
    scene.add(mountains);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.sun, depthWrite: false }));
    sunSprite.scale.set(60, 60, 1);
    sunSprite.position.set(-120, 70, -260);
    sunSprite.renderOrder = -3;
    scene.add(sunSprite);

    this.holder = new THREE.Group();
    scene.add(this.holder);
    this.built = true;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.rebuildCharacter();
  }

  rebuildCharacter() {
    if (!this.built) return;
    const p = this.g.profile;
    const look = cleanLook(p && p.look);
    const lookKey = JSON.stringify(look);
    if (lookKey !== this.lookKey) {
      this.lookKey = lookKey;
      this.holder.clear();
      this.rig = buildSoldier(look, 0);
      this.holder.add(this.rig.root);
      this.gunKey = null;
    }
    const w = this.tab === 'armory' ? this.weapon : 'rifle';
    const skin = this.tab === 'armory' && this.preview ? this.preview : this.g.skinFor(w);
    const key = `${w}|${skin}`;
    if (key !== this.gunKey) {
      this.gunKey = key;
      this.rig.gunMount.clear();
      this.rig.gunMount.add(buildGun(w, skin));
    }
  }

  resize() {
    const a = innerWidth / innerHeight;
    this.camera.aspect = a;
    const wide = a > 1.15;
    const off = wide ? -1.35 : 0;
    this.camera.position.set(off, 1.42, wide ? 6.3 : 7.6);
    this.camera.lookAt(off, 0.98, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt, t) {
    if (!this.built) return;
    if (this.camera.aspect !== innerWidth / innerHeight) this.resize();
    if (!this.dragging) this.rotY += this.spin * dt;
    this.spin *= Math.pow(0.1, dt);
    const R = this.rig;
    if (R) {
      R.root.rotation.y = this.rotY + Math.sin(t * 0.4) * 0.06;
      const breathe = Math.sin(t * 1.6);
      R.torso.rotation.x = -0.05 + breathe * 0.015;
      R.head.rotation.x = -0.05 + Math.sin(t * 0.7) * 0.04;
      R.head.rotation.y = Math.sin(t * 0.33) * 0.2;
      // 무기고에서는 총이 잘 보이도록 가슴 앞에 가로로 든다
      const show = this.tab === 'armory';
      const pistol = show && this.weapon === 'pistol';
      R.arms[1].sh.rotation.set(pistol ? 1.2 : show ? 1.25 : 0.95, -0.12, 0);
      R.arms[1].elbow.rotation.x = pistol ? 0.2 : show ? 0.9 : 0.65;
      R.arms[0].sh.rotation.set(pistol ? 1.1 : show ? 1.35 : 1.05, pistol ? 0.3 : 0.6, 0);
      R.arms[0].elbow.rotation.x = pistol ? 0.3 : show ? 1.0 : 0.85;
      R.gunMount.rotation.set(show ? -0.08 : -0.5, show ? -0.5 : 0, 0);
      R.gunMount.position.set(show ? 0.02 : 0.08, show ? 0.36 : 0.3, show ? -0.34 : -0.28);
      R.legs[0].thigh.rotation.x = 0.05;
      R.legs[1].thigh.rotation.x = -0.08;
    }
    if (this.flag) {
      const pos = this.flag.geometry.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const x = this.flagBase[v * 3];
        pos.setZ(v, Math.sin(t * 2.6 + x * 2.4) * 0.12 * x);
      }
      pos.needsUpdate = true;
    }
  }

  // ── UI ─────────────────────────────────────────
  bindUI() {
    document.querySelectorAll('.lobby-nav button').forEach((b) => b.addEventListener('click', () => {
      this.g.sound.init();
      if (b.dataset.tab === 'settings') { this.h.settings(); return; }
      this.showTab(b.dataset.tab);
      this.g.sound.play('click');
    }));

    // 출전
    const seg = (id, cb) => {
      const btns = $(id).querySelectorAll('button');
      btns.forEach((b) => b.addEventListener('click', () => {
        btns.forEach((x) => x.classList.toggle('on', x === b));
        cb(b.dataset.v);
      }));
    };
    seg('modeSeg', (v) => { this.mode = v; $('modeDesc').textContent = MODES[v].desc; });
    seg('diffSeg', (v) => { this.difficulty = v; });
    $('modeDesc').textContent = MODES.tdm.desc;
    $('fillRange').addEventListener('input', () => { $('fillVal').textContent = $('fillRange').value; });
    document.querySelectorAll('.play-tabs button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.play-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      $('play-create').hidden = b.dataset.p !== 'create';
      $('play-join').hidden = b.dataset.p !== 'join';
      if (b.dataset.p === 'join') this.h.refreshRooms();
    }));
    $('createBtn').addEventListener('click', () => this.h.create({
      mode: this.mode, difficulty: this.difficulty, map: this.map, fill: +$('fillRange').value, isPublic: $('publicCheck').checked,
    }));
    $('joinBtn').addEventListener('click', () => this.h.join($('codeInput').value));
    $('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.h.join($('codeInput').value); });
    $('refreshBtn').addEventListener('click', () => this.h.refreshRooms());

    // 병사
    $('lookRandom').addEventListener('click', () => {
      this.setLook(randomLook());
      this.g.sound.play('open');
    });

    // 뽑기
    $('pull1').addEventListener('click', () => this.pull(1));
    $('pull10').addEventListener('click', () => this.pull(10));
    this.fx = new GachaFX({
      sound: this.g.sound,
      onEquip: (id) => this.h.equip(id),
      onAgain: () => this.pull(this.lastCount || 1),
      isEquipped: (id) => this.g.skinFor(SKINS[id].weapon) === id,
    });

    // 3D 무대 돌리기
    const stage = $('stage');
    let lastX = 0, lastT = 0;
    stage.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      lastX = e.clientX;
      lastT = performance.now();
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - lastX, now = performance.now();
      this.rotY += dx * 0.012;
      this.spin = (dx * 0.012) / Math.max(0.008, (now - lastT) / 1000);
      lastX = e.clientX;
      lastT = now;
    });
    const up = () => { this.dragging = false; };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
  }

  showTab(tab) {
    this.tab = tab;
    document.querySelectorAll('.lobby-nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    for (const t of ['play', 'soldier', 'armory', 'gacha']) {
      const el = $(`lp-${t}`);
      el.hidden = t !== tab;
      if (t === tab) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
    }
    if (tab !== 'armory') this.preview = null;
    this.refresh();
  }

  refresh() {
    const p = this.g.profile;
    $('coinCount').textContent = p ? p.coins.toLocaleString('ko-KR') : '—';
    $('pull1').disabled = !p || p.coins < GACHA.cost;
    $('pull10').disabled = !p || p.coins < GACHA.cost10;
    this.renderMaps();
    if (this.tab === 'soldier') this.renderLook();
    if (this.tab === 'armory') this.renderArmory();
    if (this.tab === 'gacha') this.renderGacha();
    this.rebuildCharacter();
  }

  renderMaps() {
    const box = $('mapPick');
    if (box.dataset.ready) {
      box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.map === this.map));
      return;
    }
    box.dataset.ready = '1';
    box.innerHTML = `<button data-map="random" class="on"><img src="assets/ui/i_map.svg" alt=""><span>무작위</span></button>` +
      MAPS.map((M) => `<button data-map="${M.id}" title="${M.desc}"><img src="${mapThumb(previewMap(M.id), 120)}" alt=""><span>${M.name}</span></button>`).join('');
    box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      this.map = b.dataset.map;
      const M = MAPS.find((m) => m.id === this.map);
      $('mapDesc').textContent = M ? `${M.hanja} · ${M.desc}` : '다섯 전장 중 하나를 무작위로';
      this.g.sound.play('click');
      this.renderMaps();
    }));
    $('mapDesc').textContent = '다섯 전장 중 하나를 무작위로';
  }

  setLook(look) {
    const p = this.g.profile;
    if (!p) return;
    p.look = cleanLook(look);
    this.renderLook();
    this.rebuildCharacter();
    clearTimeout(this.lookTimer);
    this.lookTimer = setTimeout(() => this.h.look(p.look), 350);
  }

  renderLook() {
    const p = this.g.profile, look = cleanLook(p && p.look);
    $('lookRows').innerHTML = LOOK_PARTS.map(([key, label]) => {
      const list = LOOKS[key], i = list.findIndex((o) => o.id === look[key]), cur = list[i];
      const sw = key === 'accent' ? `<i class="swatch" style="background:${cur.color}"></i>` : '';
      return `<div class="look-row" data-key="${key}"><span class="lr-label">${label}</span>
        <button class="arrow" data-d="-1" aria-label="이전">‹</button>
        <span class="lr-value">${sw}${cur.name}<small>${i + 1}/${list.length}</small></span>
        <button class="arrow" data-d="1" aria-label="다음">›</button></div>`;
    }).join('');
    $('lookRows').querySelectorAll('.arrow').forEach((b) => b.addEventListener('click', () => {
      const key = b.closest('.look-row').dataset.key, list = LOOKS[key];
      const cur = cleanLook(this.g.profile.look);
      const i = (list.findIndex((o) => o.id === cur[key]) + Number(b.dataset.d) + list.length) % list.length;
      this.setLook({ ...cur, [key]: list[i].id });
      this.g.sound.play('click');
    }));
  }

  renderArmory() {
    const p = this.g.profile;
    $('weaponTabs').innerHTML = WEAPON_IDS.map((w) => `<button data-w="${w}" class="${w === this.weapon ? 'on' : ''}" title="${WEAPONS[w].name}"><img src="assets/ui/${WEAPONS[w].icon}.svg" alt=""><span>${WEAPONS[w].name}</span></button>`).join('');
    $('weaponTabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      this.weapon = b.dataset.w;
      this.preview = null;
      this.g.sound.play('click');
      this.renderArmory();
      this.rebuildCharacter();
    }));
    const equipped = this.g.skinFor(this.weapon);
    const list = SKIN_STYLES.map((st) => SKINS[`${this.weapon}.${st.id}`]);
    const grid = $('skinGrid');
    grid.innerHTML = list.map((s) => {
      const owned = s.starter || (p && p.owned.includes(s.id));
      const cls = ['skin-card', `r-${s.rarity}`, owned ? '' : 'locked', s.id === equipped ? 'equipped' : '', s.id === (this.preview || equipped) ? 'sel' : ''].join(' ');
      return `<button class="${cls}" data-id="${s.id}"><img alt=""><b>${s.name}</b><small>${RARITY[s.rarity].name}</small>${s.id === equipped ? '<em>장착 중</em>' : owned ? '' : '<em class="lock">미보유</em>'}</button>`;
    }).join('');
    grid.querySelectorAll('.skin-card').forEach((c) => {
      skinThumb(c.dataset.id, 160, 54).then((url) => { const im = c.querySelector('img'); if (im) im.src = url; });
      c.addEventListener('click', () => {
        this.preview = c.dataset.id;
        this.g.sound.gun(this.weapon, SKINS[c.dataset.id].sound);
        this.renderArmory();
        this.rebuildCharacter();
      });
    });
    const s = SKINS[this.preview || equipped];
    const owned = s.starter || (p && p.owned.includes(s.id));
    const ownedCount = list.filter((x) => !x.starter && p && p.owned.includes(x.id)).length;
    $('skinInfo').innerHTML = `
      <div class="si-head"><span class="rar r-${s.rarity}"><b class="hanja">${RARITY[s.rarity].hanja}</b>${RARITY[s.rarity].name}</span><h3>${s.fullName}</h3></div>
      <p>총소리 · ${VOICE_NAMES[s.sound]} <button id="siSound" class="link-btn">다시 듣기</button></p>
      <div class="si-actions">${s.id === equipped ? '<span class="si-on">장착 중</span>' : owned ? '<button id="siEquip" class="brush-btn small">장 착</button>' : '<span class="si-lock">뽑기에서 얻을 수 있습니다</span>'}
      <span class="si-count">이 무기 스킨 ${ownedCount} / ${list.length - 1}</span></div>`;
    $('siSound').addEventListener('click', () => this.g.sound.gun(this.weapon, s.sound));
    const eq = $('siEquip');
    if (eq) eq.addEventListener('click', () => { this.h.equip(s.id); this.g.sound.play('coin'); });
  }

  renderGacha() {
    const p = this.g.profile;
    const owned = p ? p.owned.length : 0;
    $('collection').innerHTML = `수집 <b>${owned}</b> / ${GACHA_POOL.length}`;
    $('rates').innerHTML = RARITY_ORDER.slice().reverse().map((r) => {
      const R = RARITY[r], total = RARITY_ORDER.reduce((a, k) => a + RARITY[k].weight, 0);
      return `<tr class="r-${r}"><td><b class="hanja">${R.hanja}</b> ${R.name}</td><td>${((R.weight / total) * 100).toFixed(1)}%</td><td>중복 시 +${R.refund}</td></tr>`;
    }).join('');
    $('earnHint').textContent = `코인 얻기 — 처치 ${COIN.kill} · 헤드샷 +${COIN.headshot} · 도움 ${COIN.assist} · 거점 점령 ${COIN.capture} · 승리 ${COIN.win} · 패배 ${COIN.lose}`;
  }

  // ── 뽑기 ───────────────────────────────────────
  async pull(count) {
    const p = this.g.profile;
    const cost = count === 10 ? GACHA.cost10 : GACHA.cost;
    if (this.fx.busy) return;
    if (!p || p.coins < cost) {
      $('menuError').textContent = p ? `코인이 부족합니다. (${cost} 필요) 전투에서 모아 오세요.` : '서버에 연결되어야 뽑을 수 있습니다.';
      return;
    }
    $('menuError').textContent = '';
    this.lastCount = count;
    this.g.sound.init();
    const res = await this.fx.run(count, this.h.gacha(count));
    if (res && res.ok) this.h.setProfile(res.profile);
    $('gfxAgain').disabled = !this.g.profile || this.g.profile.coins < cost;
  }

  closeGacha() {
    this.fx.close();
  }

}

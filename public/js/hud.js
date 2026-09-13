// 전투 화면 UI — 체력, 탄약, 킬 로그, 미니맵, 점수판, 사망/종료 화면
import { WEAPONS, STREAKS, CLASSES, TEAMS, MODES, MAP_HALF } from '../shared/config.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const KILL_ICON = {
  rifle: 'w_rifle', smg: 'w_smg', sniper: 'w_sniper', shotgun: 'w_shotgun', pistol: 'w_pistol',
  rocket: 'w_rocket', grenade: 'w_grenade', shell: 's_artillery', nuke: 's_nuke',
};
const CLS = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class HUD {
  constructor(game) {
    this.g = game;
    this.mm = $('minimap').getContext('2d');
    this.mmAt = 0;
    this.topAt = 0;
    this.ptEls = [];
    this.staticMap = null;
    this.lastHp = -1;
  }

  setMap(map, mode) {
    const c = document.createElement('canvas');
    c.width = c.height = MAP_HALF * 4;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.translate(MAP_HALF, MAP_HALF);
    ctx.fillStyle = '#e8dfca';
    ctx.fillRect(-MAP_HALF, -MAP_HALF, MAP_HALF * 2, MAP_HALF * 2);
    for (const b of map.boxes) {
      if (b.max[1] < 0.9) continue;
      ctx.fillStyle = b.kind === 'building' ? 'rgba(27,26,24,0.85)' : b.max[1] > 2 ? 'rgba(27,26,24,0.55)' : 'rgba(27,26,24,0.28)';
      ctx.fillRect(b.min[0], b.min[2], b.max[0] - b.min[0], b.max[2] - b.min[2]);
    }
    ctx.strokeStyle = 'rgba(27,26,24,0.7)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-MAP_HALF, -MAP_HALF, MAP_HALF * 2, MAP_HALF * 2);
    this.staticMap = c;

    const wrap = $('points');
    wrap.innerHTML = '';
    this.ptEls = [];
    wrap.hidden = mode !== 'dom';
    if (mode === 'dom') {
      for (const P of map.points) {
        const d = document.createElement('div');
        d.className = 'pt';
        d.innerHTML = `<i></i><span>${P.label}</span>`;
        wrap.appendChild(d);
        this.ptEls.push(d);
      }
    }
    $('goal').textContent = `목표 ${MODES[mode].scoreLimit}`;
  }

  weapon(p) {
    const W = p.weapon, c = p.cur;
    if (!c) return;
    const icon = `assets/ui/${W.icon}.svg`;
    if (!$('weaponIcon').src.endsWith(icon)) $('weaponIcon').src = icon;
    $('weaponName').textContent = W.name;
    $('ammoMag').textContent = c.mag;
    $('ammoRes').textContent = c.reserve;
    $('ammo').classList.toggle('empty', c.mag === 0);
    $('reloadHint').textContent = p.reloading ? '재장전 중…' : c.mag <= Math.ceil(W.mag * 0.25) ? (c.reserve > 0 ? 'R 재장전' : '탄약 없음') : '';
    $('grenadeCount').textContent = p.grenades;
  }

  streaks(p) {
    const me = this.g.roster.get(this.g.me.nid), st = me ? me.st : 0;
    $('streaks').innerHTML = [...STREAKS].reverse().map((s) => {
      const ready = p.rewards.includes(s.id);
      return `<div class="sk ${ready ? 'ready' : ''}"><img src="assets/ui/s_${s.id}.svg" alt=""><kbd>${STREAKS.indexOf(s) + 3}</kbd>` +
        `<span>${s.name}${ready ? '' : ` <small>${Math.min(st, s.kills)}/${s.kills}</small>`}</span></div>`;
    }).join('');
  }

  crosshair(p, ads, scoped) {
    const W = p.weapon;
    const moving = Math.hypot(p.b.vx, p.b.vz) > 1;
    const spread = ((ads ? W.spreadAds : W.spreadHip) + p.bloom) * (moving ? 1.6 : 1) * (p.b.onGround ? 1 : 2.5);
    const px = 4 + (spread * (window.innerHeight / 2)) / Math.tan((p.fov * Math.PI) / 360);
    const ch = $('crosshair');
    ch.style.setProperty('--s', `${px.toFixed(1)}px`);
    ch.classList.toggle('hide', (ads && W.id !== 'shotgun') || p.sprinting || !p.alive);
    $('scope').hidden = !scoped;
  }

  hitmarker(head, kill) {
    const el = $('hitmarker');
    el.classList.remove('show');
    el.classList.toggle('kill', !!kill);
    void el.offsetWidth;
    el.classList.add('show');
  }

  hurt(src) {
    const g = this.g;
    if (!src) return;
    const dx = src[0] - g.camera.position.x, dz = src[1] - g.camera.position.z;
    if (Math.hypot(dx, dz) < 0.5) return;
    const ang = Math.atan2(-dx, -dz) - g.player.yaw;
    const d = document.createElement('div');
    d.className = 'dmg';
    d.style.transform = `rotate(${-ang}rad) translateY(-150px)`;
    $('dmgRing').appendChild(d);
    void d.offsetWidth;
    d.style.opacity = '0';
    setTimeout(() => d.remove(), 1000);
  }

  stamp(text, sub) {
    const n = $('notice');
    const el = document.createElement('div');
    el.innerHTML = `<div class="stamp"><img src="assets/ui/seal.svg" alt=""><span>${text}</span></div><div class="stamp-sub">${esc(sub)}</div>`;
    n.appendChild(el);
    while (n.children.length > 2) n.firstChild.remove();
    setTimeout(() => el.remove(), 1500);
  }

  announce(text, sub = '', red = false) {
    const el = $('announce');
    el.innerHTML = `${esc(text)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}`;
    el.className = red ? 'red' : '';
    void el.offsetWidth;
    el.classList.add('show');
  }

  killfeed({ k, v, w, h }) {
    if (w === 'team') return;
    const g = this.g, K = g.roster.get(k), V = g.roster.get(v);
    if (!V) return;
    const row = document.createElement('div');
    row.className = 'kf' + (k === g.me.nid || v === g.me.nid ? ' me' : '');
    row.innerHTML = (K && k !== v ? `<span class="c${K.team}">${esc(K.name)}</span>` : '') +
      `<img src="assets/ui/${KILL_ICON[w] || 'w_rifle'}.svg" alt="">` +
      (h ? '<img class="hs" src="assets/ui/headshot.svg" alt="">' : '') +
      `<span class="c${V.team}">${esc(V.name)}</span>`;
    const feed = $('killfeed');
    feed.appendChild(row);
    while (feed.children.length > 6) feed.firstChild.remove();
    setTimeout(() => row.classList.add('fade'), 5000);
    setTimeout(() => row.remove(), 6000);
  }

  chat(m) {
    const row = document.createElement('div');
    row.className = 'chat-line' + (m.sys ? ' sys' : '');
    row.innerHTML = m.sys ? esc(m.text) : `<b class="c${m.team}">${esc(m.name)}</b> ${esc(m.text)}`;
    const log = $('chatLog');
    log.appendChild(row);
    while (log.children.length > 9) log.firstChild.remove();
    setTimeout(() => row.classList.add('old'), 9000);
  }

  health(hp) {
    hp = Math.max(0, Math.ceil(hp));
    if (hp === this.lastHp) return;
    this.lastHp = hp;
    $('hpFill').style.transform = `scaleX(${hp / 100})`;
    $('hpText').textContent = hp;
    $('hpBox').classList.toggle('low', hp <= 35);
  }

  top() {
    const g = this.g;
    $('score0').textContent = g.scores[0];
    $('score1').textContent = g.scores[1];
    $('timer').textContent = mmss(g.timeLeft);
    document.querySelector('.team-score.t0').classList.toggle('mine', g.me.team === 0);
    document.querySelector('.team-score.t1').classList.toggle('mine', g.me.team === 1);
    if (!g.cp) return;
    g.cp.forEach(([owner, prog, contested], i) => {
      const el = this.ptEls[i];
      if (!el) return;
      el.className = `pt${owner >= 0 ? ` o${owner}` : ''}${contested ? ' contested' : ''}`;
      el.firstChild.style.transform = `scale(${Math.abs(prog)})`;
      el.firstChild.style.background = prog < 0 ? '#151412' : '#b3301c';
    });
  }

  minimap() {
    const g = this.g, ctx = this.mm, R = 120, s = 120 / 70;
    const cam = g.camera.position, yaw = g.player.alive ? g.player.yaw : g.camera.rotation.y;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 240, 240);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#d9cfb8';
    ctx.fillRect(0, 0, 240, 240);
    ctx.translate(R, R);
    ctx.rotate(yaw);
    ctx.scale(s, s);
    ctx.translate(-cam.x, -cam.z);
    if (this.staticMap) ctx.drawImage(this.staticMap, -MAP_HALF, -MAP_HALF, MAP_HALF * 2, MAP_HALF * 2);
    if (g.mode === 'dom' && g.map) {
      g.map.points.forEach((P, i) => {
        const owner = g.cp ? g.cp[i][0] : -1;
        ctx.beginPath();
        ctx.arc(P.x, P.z, P.r, 0, Math.PI * 2);
        ctx.fillStyle = owner === 0 ? 'rgba(21,20,18,.4)' : owner === 1 ? 'rgba(179,48,28,.45)' : 'rgba(21,20,18,.12)';
        ctx.fill();
        ctx.save();
        ctx.translate(P.x, P.z);
        ctx.rotate(-yaw);
        ctx.fillStyle = owner === 1 ? '#8a1f10' : '#151412';
        ctx.font = "8px 'Song Myung', serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(P.label, 0, 0.5);
        ctx.restore();
      });
    }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#b3301c';
    for (const st of g.strikes) {
      ctx.beginPath();
      ctx.arc(st.x, st.z, 9, 0, Math.PI * 2);
      ctx.moveTo(st.x - 5, st.z - 5); ctx.lineTo(st.x + 5, st.z + 5);
      ctx.moveTo(st.x + 5, st.z - 5); ctx.lineTo(st.x - 5, st.z + 5);
      ctx.stroke();
    }
    const uav = g.uav && g.uav[g.me.team] > 0;
    for (const sd of g.soldiers.values()) {
      const st = sd.state;
      if (!st.alive) continue;
      const mate = sd.team === g.me.team;
      if (!mate && !uav && !(st.flags & 256)) continue;
      ctx.beginPath();
      ctx.arc(st.x, st.z, mate ? 1.7 : 2.1, 0, Math.PI * 2);
      ctx.fillStyle = mate ? '#151412' : '#b3301c';
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = '#efe7d6';
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = g.me.team ? '#b3301c' : '#151412';
    ctx.beginPath();
    ctx.moveTo(R, R - 9); ctx.lineTo(R + 6, R + 7); ctx.lineTo(R, R + 3); ctx.lineTo(R - 6, R + 7);
    ctx.closePath();
    ctx.fill();
  }

  scoreboard(show) {
    const el = $('scoreboard');
    el.hidden = !show;
    if (!show) return;
    const g = this.g;
    const teams = [0, 1].map((t) => [...g.roster.values()].filter((r) => r.team === t).sort((a, b) => b.sc - a.sc));
    el.innerHTML = `<div class="sb-grid">${teams.map((list, t) => `
      <div class="sb-team t${t}"><h3><span>${TEAMS[t].hanja} ${TEAMS[t].name}</span><span>${g.scores[t]}</span></h3>
      <table><tr><th>이름</th><th>병과</th><th>처치</th><th>전사</th><th>도움</th><th>점수</th></tr>
      ${list.map((r) => {
        const s = g.soldiers.get(r.nid);
        const dead = r.nid === g.me.nid ? !g.player.alive : !!(s && !s.state.alive);
        return `<tr class="${r.nid === g.me.nid ? 'me' : ''}${dead ? ' dead' : ''}"><td>${esc(r.name)}</td><td>${CLS[r.cls] ? CLS[r.cls].name : ''}</td><td>${r.k}</td><td>${r.d}</td><td>${r.a}</td><td>${r.sc}</td></tr>`;
      }).join('')}</table></div>`).join('')}</div>
      <p style="text-align:center;margin:14px 0 0;color:var(--ink-2)">방 코드 <b style="color:var(--red);letter-spacing:3px;font-size:20px">${g.code}</b> · ${MODES[g.mode].name}</p>`;
  }

  classCards(el, current, onPick) {
    el.innerHTML = CLASSES.map((c, i) => `<button class="cls${c.id === current ? ' on' : ''}" data-cls="${c.id}"><kbd>${i + 1}</kbd>` +
      `<img src="assets/ui/${WEAPONS[c.primary].icon}.svg" alt=""><b>${c.name}</b><small>${c.desc}</small></button>`).join('');
    el.querySelectorAll('.cls').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.cls)));
  }

  end(m) {
    const g = this.g, mine = g.me.team;
    const draw = m.winner === -1, win = m.winner === mine;
    const t = $('endTitle');
    t.textContent = draw ? '和' : win ? '勝' : '敗';
    t.className = `hanja${win ? ' win' : ''}`;
    $('endSub').textContent = `${TEAMS[0].name} ${m.scores[0]} : ${m.scores[1]} ${TEAMS[1].name}` + (draw ? ' — 무승부' : ` — ${TEAMS[m.winner].name} 승리`);
    const top = [...m.roster].sort((a, b) => b.sc - a.sc).slice(0, 8);
    $('endTable').innerHTML = `<div class="sb-team"><table><tr><th>순위</th><th>이름</th><th>처치</th><th>전사</th><th>도움</th><th>점수</th></tr>${top.map((r, i) =>
      `<tr class="${r.nid === g.me.nid ? 'me' : ''}"><td>${i + 1}</td><td class="c${r.team}">${esc(r.name)}</td><td>${r.k}</td><td>${r.d}</td><td>${r.a}</td><td>${r.sc}</td></tr>`).join('')}</table></div>`;
    $('endScreen').hidden = false;
  }

  frame() {
    const g = this.g, t = g.time;
    if (t - this.topAt > 0.2) { this.topAt = t; this.top(); }
    if (t - this.mmAt > 0.08) { this.mmAt = t; this.minimap(); }
    this.health(g.player.alive ? g.meHp : 0);
    if (!$('deathScreen').hidden) $('respawnTimer').textContent = g.respawnAt > t ? `${Math.ceil(g.respawnAt - t)}초 후 출진 · 1~4 키로 병과 선택` : '곧 출진';
    if (g.nuke) {
      const left = Math.ceil(g.nuke.at - t);
      if (left !== this.nukeLeft && left >= 0) {
        this.nukeLeft = left;
        this.announce(`전술핵 ${left}`, g.nuke.team === g.me.team ? '아군 핵 투하 대기' : '적의 핵이 떨어진다 — 숨을 곳은 없다', true);
      }
    }
    if (!$('endScreen').hidden) $('endNext').textContent = `${Math.max(0, Math.ceil(g.nextMatchAt - t))}초 후 다음 전투`;
  }
}

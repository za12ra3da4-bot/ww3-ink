// 설정 저장 + 설정 창 (감도·시야각·조준점·음량·그래픽·서버 주소)
const KEY = 'mukjeon.settings';

export const DEFAULTS = {
  sens: 1, adsMul: 1, scopeMul: 1, invertY: false, fov: 75,
  xhColor: 'ink', xhSize: 1, vol: 0.7, quality: 'medium', server: '',
};
export const XH_COLORS = { ink: '#151412', red: '#c0301a', blue: '#2c6db5', white: '#f7f1e3', green: '#3a8a52' };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } },
};

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(store.get(KEY) || '{}') || {}; } catch { s = {}; }
  const out = { ...DEFAULTS, ...s };
  if (s.sens === undefined && store.get('sens')) out.sens = +store.get('sens') || 1;
  if (s.vol === undefined && store.get('vol')) out.vol = +store.get('vol');
  return out;
}

export function saveSettings(s) {
  store.set(KEY, JSON.stringify(s));
}

const $ = (id) => document.getElementById(id);

// 설정 창을 연다. apply(s) 는 값이 바뀔 때마다 즉시 호출된다.
export function openSettings(settings, apply, onClose) {
  const modal = $('settingsModal');
  const body = $('settingsBody');
  const slider = (key, label, min, max, step, fmt = (v) => v) => `
    <div class="set-row"><label for="set-${key}">${label}</label>
      <input type="range" id="set-${key}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}">
      <input type="number" class="set-num" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${fmt(settings[key])}">
    </div>`;
  const seg = (key, label, opts) => `
    <div class="set-row"><label>${label}</label><div class="seg" data-key="${key}">
      ${opts.map(([v, t]) => `<button data-v="${v}" class="${String(settings[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}
    </div></div>`;
  body.innerHTML = `
    <div class="set-group"><h4>조준</h4>
      ${slider('sens', '마우스 감도', 0.1, 5, 0.05)}
      ${slider('adsMul', '정조준 감도 배율', 0.2, 2, 0.05)}
      ${slider('scopeMul', '조준경 감도 배율', 0.2, 2, 0.05)}
      ${seg('invertY', '상하 반전', [['false', '끔'], ['true', '켬']])}
      ${slider('fov', '시야각 (FOV)', 60, 105, 1)}
    </div>
    <div class="set-group"><h4>조준점</h4>
      <div class="set-row"><label>색</label><div class="swatches" data-key="xhColor">
        ${Object.entries(XH_COLORS).map(([k, c]) => `<button data-v="${k}" class="${settings.xhColor === k ? 'on' : ''}" style="--c:${c}"></button>`).join('')}
      </div></div>
      ${slider('xhSize', '크기', 0.6, 2, 0.05)}
      <div class="xh-preview"><div class="xh-demo"><i></i><i></i><i></i><i></i><b></b></div></div>
    </div>
    <div class="set-group"><h4>소리 · 화면</h4>
      ${slider('vol', '음량', 0, 1, 0.05)}
      ${seg('quality', '그래픽 품질', [['low', '낮음'], ['medium', '보통'], ['high', '높음']])}
    </div>
    <div class="set-group"><h4>게임 서버 <small>(비워 두면 이 페이지와 같은 곳)</small></h4>
      <div class="set-row wide"><input id="set-server" placeholder="예: https://mukjeon.onrender.com" value="${settings.server || ''}"><button id="set-server-apply" class="link-btn">적용 후 새로고침</button></div>
    </div>`;

  const preview = () => {
    const demo = body.querySelector('.xh-demo');
    demo.style.setProperty('--xh', XH_COLORS[settings.xhColor] || XH_COLORS.ink);
    demo.style.setProperty('--xhk', settings.xhSize);
  };
  const set = (key, v) => {
    settings[key] = v;
    saveSettings(settings);
    apply(settings);
    preview();
  };
  body.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => {
    body.querySelector(`.set-num[data-key="${r.dataset.key}"]`).value = r.value;
    set(r.dataset.key, +r.value);
  }));
  body.querySelectorAll('.set-num').forEach((n) => n.addEventListener('change', () => {
    const v = Math.max(+n.min, Math.min(+n.max, +n.value || +n.min));
    n.value = v;
    body.querySelector(`input[type=range][data-key="${n.dataset.key}"]`).value = v;
    set(n.dataset.key, v);
  }));
  body.querySelectorAll('.seg[data-key], .swatches[data-key]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    const key = g.dataset.key;
    set(key, key === 'invertY' ? b.dataset.v === 'true' : b.dataset.v);
  })));
  $('set-server-apply').addEventListener('click', () => {
    settings.server = $('set-server').value.trim().replace(/\/+$/, '');
    saveSettings(settings);
    location.reload();
  });
  preview();

  modal.hidden = false;
  modal.classList.remove('closing');
  const close = () => {
    modal.hidden = true;
    $('settingsClose').removeEventListener('click', close);
    modal.removeEventListener('mousedown', outside);
    if (onClose) onClose();
  };
  const outside = (e) => { if (e.target === modal) close(); };
  $('settingsClose').addEventListener('click', close);
  modal.addEventListener('mousedown', outside);
  return close;
}

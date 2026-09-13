// 플레이어 프로필(코인·스킨·생김새) 저장소
// - 서버: data/profiles.json 에 저장 (토큰 = 브라우저 localStorage 의 무작위 값)
// - 클라이언트: 서명된 사본을 localStorage 에 보관 → 서버가 초기화돼도(Render 재시작 등) 복구된다
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GACHA, SKINS, WEAPON_IDS, RARITY, cleanLook, defaultSkin, rollSkin } from '../public/shared/config.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const FILE = path.join(DATA_DIR, 'profiles.json');
const SECRET = process.env.PROFILE_SECRET || 'mukjeon-ink-wash-2026';
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

let db = {};
let dirty = false;

function load() {
  try {
    if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
  } catch (err) {
    console.error('프로필 파일을 읽지 못해 백업 후 새로 시작합니다:', err.message);
    try { fs.renameSync(FILE, `${FILE}.broken-${Date.now()}`); } catch { /* 무시 */ }
    db = {};
  }
}

export function saveNow() {
  if (!dirty) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
    dirty = false;
  } catch (err) {
    console.error('프로필 저장 실패:', err.message);
  }
}

load();
setInterval(saveNow, 3000).unref();

const fresh = () => ({ coins: GACHA.startCoins, owned: [], equip: {}, look: cleanLook(null), pulls: 0 });

function sanitize(p) {
  const out = fresh();
  if (!p || typeof p !== 'object') return out;
  out.coins = Math.max(0, Math.min(10_000_000, Math.floor(Number(p.coins)) || 0));
  out.owned = [...new Set(Array.isArray(p.owned) ? p.owned.filter((id) => SKINS[id] && !SKINS[id].starter) : [])];
  out.pulls = Math.max(0, Math.floor(Number(p.pulls)) || 0);
  out.look = cleanLook(p.look);
  for (const w of WEAPON_IDS) {
    const id = p.equip && p.equip[w];
    if (id && SKINS[id] && SKINS[id].weapon === w && out.owned.includes(id)) out.equip[w] = id;
  }
  return out;
}

const canonical = (d) => JSON.stringify({ coins: d.coins, owned: [...d.owned].sort(), equip: WEAPON_IDS.map((w) => d.equip[w] || ''), look: d.look, pulls: d.pulls });
const sign = (d) => crypto.createHmac('sha256', SECRET).update(canonical(d)).digest('base64url');

export function getProfile(token, backup) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  if (!db[token]) {
    let restored = null;
    if (backup && backup.data && typeof backup.sig === 'string') {
      const data = sanitize(backup.data);
      const a = Buffer.from(sign(data)), b = Buffer.from(backup.sig);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) restored = data;
    }
    db[token] = restored || fresh();
    dirty = true;
  }
  db[token] = sanitize(db[token]);
  return db[token];
}

export function packet(p) {
  const data = sanitize(p);
  return { data, sig: sign(data) };
}

export function skinsOf(p) {
  const out = {};
  for (const w of WEAPON_IDS) out[w] = (p && p.equip[w]) || defaultSkin(w);
  return out;
}

export function addCoins(p, n) {
  if (!p || !n) return;
  p.coins = Math.max(0, p.coins + Math.round(n));
  dirty = true;
}

export function pull(p, count) {
  const cost = count === 10 ? GACHA.cost10 : GACHA.cost;
  if (p.coins < cost) return { ok: false, error: `코인이 부족합니다. (${cost} 필요)` };
  p.coins -= cost;
  const results = [];
  for (let i = 0; i < count; i++) {
    // 10연속 뽑기 마지막 칸은 희귀 이상 보장
    const guarantee = count === 10 && i === 9 && !results.some((r) => r.rarity !== 'common');
    const s = rollSkin(Math.random, guarantee ? 'rare' : 'common');
    const dup = p.owned.includes(s.id);
    const refund = dup ? RARITY[s.rarity].refund : 0;
    if (dup) p.coins += refund;
    else p.owned.push(s.id);
    results.push({ id: s.id, rarity: s.rarity, dup, refund });
  }
  p.pulls += count;
  dirty = true;
  return { ok: true, results };
}

export function equip(p, skinId) {
  const s = SKINS[skinId];
  if (!s) return false;
  if (s.starter) delete p.equip[s.weapon];
  else if (p.owned.includes(skinId)) p.equip[s.weapon] = skinId;
  else return false;
  dirty = true;
  return true;
}

export function setLook(p, look) {
  p.look = cleanLook(look);
  dirty = true;
}

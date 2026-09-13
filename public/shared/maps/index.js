// 전장 목록 — 같은 (맵, seed) 면 서버와 모든 클라이언트가 똑같은 전장을 만든다.
import { city } from './city.js';
import { palace } from './palace.js';
import { harbor } from './harbor.js';
import { snow } from './snow.js';
import { bamboo } from './bamboo.js';

const GEN = { city, palace, harbor, snow, bamboo };

// 클라이언트 그림 설정 (서버는 쓰지 않음)
export const THEMES = {
  city: { ground: 0xe0dcd3, groundTex: 'ground', mist: [24, 160], sunColor: 0xb3301c, snow: false },
  palace: { ground: 0xe6e1d4, groundTex: 'ground', mist: [30, 180], sunColor: 0xb3301c, snow: false },
  harbor: { ground: 0xd9d6cf, groundTex: 'ground', mist: [20, 150], sunColor: 0xc05a2a, snow: false },
  snow: { ground: 0xfbfbfa, groundTex: 'snowfield', mist: [16, 120], sunColor: 0x9aa7b3, snow: true },
  bamboo: { ground: 0xdcdccb, groundTex: 'ground', mist: [18, 140], sunColor: 0xb3301c, snow: false },
};

export function generateMap(id, seed) {
  const key = GEN[id] ? id : 'city';
  const map = GEN[key](seed >>> 0);
  map.id = key;
  return map;
}

export { buildNav } from './kit.js';

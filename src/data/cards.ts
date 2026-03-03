import type { CardDef } from './types.ts';

export const CARD_DATA: Record<string, CardDef> = {
  // === ドリンクカード（攻撃） ===
  beer: {
    id: 'beer', name: 'ビール', emoji: '🍺', type: 'drink',
    damage: 1, description: '安定の軽い一杯', rarity: 1, price: 100
  },
  wine: {
    id: 'wine', name: 'ワイン', emoji: '🍷', type: 'drink',
    damage: 2, description: 'バランス型', rarity: 2, price: 300
  },
  whiskey: {
    id: 'whiskey', name: 'ウイスキー', emoji: '🥃', type: 'drink',
    damage: 3, description: '重い一撃', rarity: 3, price: 500
  },
  baijiu: {
    id: 'baijiu', name: '白酒', emoji: '🍶', type: 'drink',
    damage: 4, description: '中国酒。最強のドリンク', rarity: 4, price: 800
  },
  cocktail: {
    id: 'cocktail', name: 'カクテル', emoji: '🧊', type: 'drink',
    damage: -1, // ランダム(1~3)
    description: 'ランダムダメージ（ロシアンルーレット感）', rarity: 2, price: 400
  },

  // === つまみカード（防御・回復） ===
  nuts: {
    id: 'nuts', name: 'ナッツ', emoji: '🥜', type: 'food',
    heal: 1, description: '軽いつまみ', rarity: 1, price: 100
  },
  yakitori: {
    id: 'yakitori', name: '焼き鳥', emoji: '🍖', type: 'food',
    heal: 2, description: 'がっつり系', rarity: 2, price: 300
  },
  ramen: {
    id: 'ramen', name: 'ラーメン', emoji: '🍜', type: 'food',
    heal: 3, description: '〆の一杯。大回復', rarity: 3, price: 600
  },
  ukon: {
    id: 'ukon', name: 'ウコン', emoji: '💊', type: 'food',
    heal: 99, description: 'クロージャ限定販売。ぶっ壊れ', rarity: 5, price: 1200
  },

  // === 一気飲みカード（ハイリスク） ===
  chug: {
    id: 'chug', name: '一気飲み', emoji: '🍻', type: 'chug',
    effect: 'chug', enemyDamage: 3, selfDamage: 1,
    description: '相手に酔い3ダメージ、自分にも酔い1ダメージ', rarity: 3, price: 800
  },
  toast: {
    id: 'toast', name: '乾杯強制', emoji: '🥂', type: 'chug',
    effect: 'toast', enemyDamage: 2, selfDamage: 1,
    description: '相手に酔い2ダメージ+次ラウンド相手の手札1枚破棄、自分も酔い1ダメージ',
    rarity: 3, price: 700
  },
  spill: {
    id: 'spill', name: 'こぼし', emoji: '🫗', type: 'chug',
    effect: 'spill',
    description: '相手の出したカード無効化。次ラウンド自分の手札が3枚に減る',
    rarity: 2, price: 500
  },

  // === セクハラカード（特殊・CG発動） ===
  shoulder_lean: {
    id: 'shoulder_lean', name: '肩を寄せる', emoji: '💋', type: 'harassment',
    requiredDrunkLevel: 1, drunkDamage: 1,
    description: '酔いLv.1以上で発動。酔い+1 & CG再生', rarity: 4, price: 1500
  },
  headpat: {
    id: 'headpat', name: '頭ポンポン', emoji: '🫳', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 1,
    description: '酔いLv.2以上で発動。酔い+1 & CG再生', rarity: 4, price: 1500
  },
  gaze: {
    id: 'gaze', name: '見つめる', emoji: '👀', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 2,
    description: '酔いLv.2以上で発動。酔い+2 & CG再生', rarity: 4, price: 2000
  },
  lap_pillow: {
    id: 'lap_pillow', name: '膝枕する', emoji: '💕', type: 'harassment',
    requiredDrunkLevel: 3, drunkDamage: 2,
    description: '酔いLv.3以上で発動。酔い+2 & CG再生', rarity: 5, price: 3000
  },
  kiss: {
    id: 'kiss', name: 'キス', emoji: '💋', type: 'harassment',
    requiredDrunkLevel: 3, instantWin: true,
    description: '酔いLv.3以上で発動。即酔い潰し(勝利) & CG再生', rarity: 6, price: 5000
  }
};

export function getCardDamage(card: CardDef): number {
  if (card.damage === -1) {
    return Math.floor(Math.random() * 3) + 1;
  }
  return card.damage ?? 0;
}

export const DEFAULT_DECK: string[] = [
  'beer', 'beer', 'beer', 'beer',
  'wine', 'wine',
  'nuts', 'nuts', 'nuts',
  'yakitori',
  'whiskey',
  'chug'
];

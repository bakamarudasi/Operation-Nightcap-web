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
    id: 'shoulder_lean', name: '耳元でささやく', emoji: '💋', type: 'harassment',
    requiredDrunkLevel: 1, drunkDamage: 1,
    description: '肩を寄せて耳元に唇を近づける。酔いLv.1以上で発動。酔い+1 & CG再生', rarity: 4, price: 1500
  },
  headpat: {
    id: 'headpat', name: 'うなじを撫でる', emoji: '🫳', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 1,
    description: '髪をかき上げてうなじに指を這わせる。酔いLv.2以上で発動。酔い+1 & CG再生', rarity: 4, price: 1500
  },
  gaze: {
    id: 'gaze', name: '唇を見つめる', emoji: '👀', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 2,
    description: '顎を持ち上げて濡れた唇をじっと見つめる。酔いLv.2以上で発動。酔い+2 & CG再生', rarity: 4, price: 2000
  },
  lap_pillow: {
    id: 'lap_pillow', name: '太ももに誘う', emoji: '💕', type: 'harassment',
    requiredDrunkLevel: 3, drunkDamage: 2,
    description: '膝枕させて髪を指に絡めながら耳を甘噛み。酔いLv.3以上で発動。酔い+2 & CG再生', rarity: 5, price: 3000
  },
  breast_touch: {
    id: 'breast_touch', name: '胸に触れる', emoji: '🫦', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 3,
    description: '「酔ってるから」を口実にそっと胸に手を伸ばす。酔いLv.2以上で発動。酔い+3 & CG再生', rarity: 5, price: 4000
  },
  hip_touch: {
    id: 'hip_touch', name: 'お尻をなでる', emoji: '🍑', type: 'harassment',
    requiredDrunkLevel: 2, drunkDamage: 2,
    description: '隣に座ったまま大胆にお尻に手を滑らせる。酔いLv.2以上で発動。酔い+2 & CG再生', rarity: 5, price: 3500
  },
  ear_bite: {
    id: 'ear_bite', name: '耳を甘噛み', emoji: '👅', type: 'harassment',
    requiredDrunkLevel: 3, drunkDamage: 3,
    description: '耳たぶをそっと唇で挟む。酔いLv.3以上で発動。酔い+3 & CG再生', rarity: 5, price: 4500
  },
  kiss: {
    id: 'kiss', name: 'ディープキス', emoji: '💋', type: 'harassment',
    requiredDrunkLevel: 3, instantWin: true,
    description: '腰を引き寄せて深く口づけ。酔いLv.3以上で発動。即KO & CG再生', rarity: 6, price: 5000
  },

  // === 逆セクハラカード（相手→プレイヤーへの理性攻撃） ===
  foot_tease: {
    id: 'foot_tease', name: 'テーブルの下の足首', emoji: '🦶', type: 'harassment',
    requiredDrunkLevel: 2, sanityDamage: 3,
    applyBuffs: [{ id: 'atk_down', duration: 1, value: 0.5 }],
    description: '素足がテーブルの下でドクターの股間をゆっくり擦り上げる。酔いLv.2以上。理性+3 & 攻撃半減1T & CG再生',
    rarity: 5, price: 3000
  },
  dirty_talk: {
    id: 'dirty_talk', name: '淫らな耳元囁き', emoji: '👄', type: 'harassment',
    requiredDrunkLevel: 2, sanityDamage: 2,
    corruptHand: 2,
    description: '「今夜は最後まで帰さないから…」手札2枚を発情状態に。酔いLv.2以上。理性+2 & 手札汚染 & CG再生',
    rarity: 5, price: 3500
  },
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

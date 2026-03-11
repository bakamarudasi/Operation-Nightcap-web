import { CARD_DATA } from '../data/cards.ts';
import type { Buff } from '../data/types.ts';

// ============================================
// === バフ/デバフID共通定数 ===
// ============================================

/** 「正のバフ」として扱うID一覧（レイジの落雷等で剥がし対象） */
export const POSITIVE_BUFF_IDS: readonly Buff['id'][] = [
  'next_drink_boost', 'next_food_boost', 'drink_dmg_half', 'self_atk_up',
  'negate_next', 'stealth', 'karaoke', 'all_dmg_up',
  'sanity_negate', 'thorns', 'reflect_all',
];

/** デバフとして扱うID一覧（クロージャの錠剤等で除去対象） */
export const DEBUFF_IDS: readonly Buff['id'][] = [
  'dot', 'tipsy', 'blush', 'atk_down', 'stun', 'no_food', 'corrupted_hand',
];

// ============================================
// === 共通ヘルパー ===
// ============================================

/**
 * 手札の中で最も「強い」カードのインデックスを返す。
 * damage > enemyDamage > heal の順で評価。
 */
export function findHighestValueCardIndex(hand: string[]): number {
  let maxVal = -1;
  let maxIdx = 0;
  for (let i = 0; i < hand.length; i++) {
    const c = CARD_DATA[hand[i]];
    const val = c?.damage ?? c?.enemyDamage ?? c?.heal ?? 0;
    if (val > maxVal) { maxVal = val; maxIdx = i; }
  }
  return maxIdx;
}

export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomPick<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

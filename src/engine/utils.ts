import { CARD_DATA } from '../data/cards.ts';
import type { Buff } from '../data/types.ts';
import i18n from '../i18n/index.ts';

// ============================================
// === バフメタデータ（単一ソース） ===
// ============================================

export interface BuffMeta {
  icon: string;
  labelKey: string;  // translation key like 'buff.stun'
  positive: boolean;
  /** バフ付与時のメッセージテンプレート（nullなら非表示） */
  message?: ((buff: Buff) => string) | null;
}

export const BUFF_META: Record<Buff['id'], BuffMeta> = {
  stun:             { icon: '💫', labelKey: 'buff.stun',             positive: false, message: () => i18n.t('buffMessage.stun') },
  atk_down:         { icon: '⬇️', labelKey: 'buff.atk_down',         positive: false, message: () => i18n.t('buffMessage.atk_down') },
  dot:              { icon: '🩸', labelKey: 'buff.dot',              positive: false, message: (b) => i18n.t('buffMessage.dot', { value: b.value ?? 0 }) },
  no_food:          { icon: '🚫', labelKey: 'buff.no_food',          positive: false, message: () => i18n.t('buffMessage.no_food') },
  corrupted_hand:   { icon: '💋', labelKey: 'buff.corrupted_hand',   positive: false },
  tipsy:            { icon: '🍺', labelKey: 'buff.tipsy',            positive: false, message: () => i18n.t('buffMessage.tipsy') },
  blush:            { icon: '😳', labelKey: 'buff.blush',            positive: false, message: () => i18n.t('buffMessage.blush') },
  alone:            { icon: '🚷', labelKey: 'buff.alone',            positive: false, message: () => i18n.t('buffMessage.alone') },
  karaoke:          { icon: '🎤', labelKey: 'buff.karaoke',          positive: true,  message: () => i18n.t('buffMessage.karaoke') },
  dimlight:         { icon: '🕯️', labelKey: 'buff.dimlight',         positive: false, message: () => i18n.t('buffMessage.dimlight') },
  excuse:           { icon: '🛡️', labelKey: 'buff.excuse',           positive: true,  message: () => i18n.t('buffMessage.excuse') },
  drink_dmg_half:   { icon: '🛡️', labelKey: 'buff.drink_dmg_half',   positive: true,  message: () => i18n.t('buffMessage.drink_dmg_half') },
  next_drink_boost: { icon: '⚔️', labelKey: 'buff.next_drink_boost', positive: true,  message: (b) => i18n.t('buffMessage.next_drink_boost', { value: b.value ?? 0 }) },
  next_food_boost:  { icon: '💚', labelKey: 'buff.next_food_boost',  positive: true,  message: (b) => i18n.t('buffMessage.next_food_boost', { value: b.value ?? 0 }) },
  negate_next:      { icon: '🚫', labelKey: 'buff.negate_next',      positive: true,  message: () => i18n.t('buffMessage.negate_next') },
  stealth:          { icon: '👻', labelKey: 'buff.stealth',          positive: true,  message: () => i18n.t('buffMessage.stealth') },
  self_atk_up:      { icon: '💪', labelKey: 'buff.self_atk_up',      positive: true,  message: (b) => i18n.t('buffMessage.self_atk_up', { value: b.value ?? 1 }) },
  all_dmg_up:       { icon: '🔥', labelKey: 'buff.all_dmg_up',       positive: true,  message: (b) => i18n.t('buffMessage.all_dmg_up', { value: b.value ?? 0 }) },
  sanity_negate:    { icon: '🧠', labelKey: 'buff.sanity_negate',    positive: true,  message: () => i18n.t('buffMessage.sanity_negate') },
  thorns:           { icon: '🌵', labelKey: 'buff.thorns',           positive: true,  message: (b) => i18n.t('buffMessage.thorns', { value: b.value ?? 0 }) },
  reflect_all:      { icon: '🪞', labelKey: 'buff.reflect_all',      positive: true,  message: () => i18n.t('buffMessage.reflect_all') },
  afterglow:        { icon: '✨', labelKey: 'buff.afterglow',        positive: false, message: () => i18n.t('buffMessage.afterglow') },
  frustration:      { icon: '😤', labelKey: 'buff.frustration',      positive: false, message: null },
  finger_technique: { icon: '🤌', labelKey: 'buff.finger_technique', positive: true,  message: () => i18n.t('buffMessage.finger_technique') },
};

/** バフ付与時のメッセージを取得（nullなら非表示） */
export function getBuffMessage(buff: Buff): string | null {
  const meta = BUFF_META[buff.id];
  if (!meta?.message) return null;
  return meta.message(buff);
}

// ============================================
// === バフ/デバフID共通定数 ===
// ============================================

/** 「正のバフ」として扱うID一覧（レイジの落雷等で剥がし対象） */
export const POSITIVE_BUFF_IDS: readonly Buff['id'][] = [
  'next_drink_boost', 'next_food_boost', 'drink_dmg_half', 'self_atk_up',
  'negate_next', 'stealth', 'karaoke', 'all_dmg_up',
  'sanity_negate', 'thorns', 'reflect_all', 'finger_technique', 'excuse',
];

/** デバフとして扱うID一覧（クロージャの錠剤等で除去対象） */
export const DEBUFF_IDS: readonly Buff['id'][] = [
  'dot', 'tipsy', 'blush', 'atk_down', 'stun', 'no_food', 'corrupted_hand',
  'afterglow', 'frustration', 'dimlight', 'alone',
];

// ============================================
// === 共通ヘルパー ===
// ============================================

/**
 * 手札の中で最も「強い」カードのインデックスを返す。
 * damage > enemyDamage > heal の順で評価。
 */
export function findHighestValueCardIndex(hand: string[]): number {
  if (hand.length === 0) return -1;
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

/** 配列のランダムなインデックスを返す */
export function randomIndex(arr: unknown[]): number {
  return Math.floor(Math.random() * arr.length);
}

/** 酔い値から酔いレベル(0~4)を算出 */
export function getDrunkLevel(drunkValue: number): number {
  if (drunkValue >= 10) return 4;
  if (drunkValue >= 7) return 3;
  if (drunkValue >= 4) return 2;
  if (drunkValue >= 2) return 1;
  return 0;
}

/** バフがアクティブかチェック */
export function hasBuff(buffs: { id: string }[], id: string): boolean {
  return buffs.some(b => b.id === id);
}

/** 汚染スロットをランダム生成 */


/** 酔いLvから肝力を算出 */
export function getKanryoku(drunkLevel: number): number {
  if (drunkLevel <= 1) return 2;
  if (drunkLevel === 2) return 3;
  return 4;
}

/** 現在の酔い値でカードが使用可能か判定 */
export function canPlayCard(card: { cost: number }, drunkValue: number): boolean {
  const drunkLevel = getDrunkLevel(drunkValue);
  return card.cost <= getKanryoku(drunkLevel);
}

/** 酔いLvに応じた隠しスロット数 */
export function getHiddenSlotCount(drunkLevel: number): number {
  if (drunkLevel >= 3) return 2;
  if (drunkLevel >= 2) return 1;
  return 0;
}

/** 暴走判定（Lv3以上で20%） */
export function shouldMisplay(drunkLevel: number): boolean {
  return drunkLevel >= 3 && Math.random() < 0.2;
}

/** food封印判定（Lv3以上） */
export function isFoodDisabled(drunkLevel: number): boolean {
  return drunkLevel >= 3;
}

export function buildCorruptedSlots(handSize: number, corruptCount: number): boolean[] {
  const slots = Array(handSize).fill(false);
  const indices = Array.from({ length: handSize }, (_, i) => i);
  shuffleArray(indices);
  for (let i = 0; i < Math.min(corruptCount, handSize); i++) {
    slots[indices[i]] = true;
  }
  return slots;
}

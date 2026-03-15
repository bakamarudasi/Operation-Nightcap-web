import { CARD_DATA } from '../data/cards.ts';
import type { Buff } from '../data/types.ts';

// ============================================
// === バフメタデータ（単一ソース） ===
// ============================================

export interface BuffMeta {
  icon: string;
  label: string;
  positive: boolean;
  /** バフ付与時のメッセージテンプレート（nullなら非表示） */
  message?: ((buff: Buff) => string) | null;
}

export const BUFF_META: Record<Buff['id'], BuffMeta> = {
  stun:             { icon: '💫', label: 'スタン',       positive: false, message: () => '😵 スタン付与！次のターン行動不能…！' },
  atk_down:         { icon: '⬇️', label: '攻撃力低下',   positive: false, message: () => '⬇️ 攻撃力低下！次のターン、酒のダメージが半減…' },
  dot:              { icon: '🩸', label: '継続ダメージ', positive: false, message: (b) => `💔 持続ダメージ付与！毎ターン酔いが${b.value ?? 0}ずつ回る…` },
  no_food:          { icon: '🚫', label: '食べ物封印',   positive: false, message: () => '🚫 つまみ封じ！防御カードが使用不可に…！' },
  corrupted_hand:   { icon: '💋', label: '手札汚染',     positive: false },
  tipsy:            { icon: '🍺', label: 'ほろ酔い',     positive: false, message: () => '😳 ほろ酔い状態！ドリンクダメージが1.5倍に…' },
  blush:            { icon: '😳', label: '頬染め',       positive: false, message: () => '😶‍🌫️ 動揺状態！セクハラが効きやすくなった…' },
  alone:            { icon: '🚷', label: '孤立',         positive: false, message: () => '🌙 二人きり…セクハラのダメージが2倍に…' },
  karaoke:          { icon: '🎤', label: 'カラオケ',     positive: true,  message: () => '🎤 カラオケ突入！ドリンクダメージ+1！' },
  dimlight:         { icon: '🕯️', label: '薄暗い照明',   positive: false, message: () => '🕯️ 照明が暗い…セクハラの条件が緩和…' },
  excuse:           { icon: '🛡️', label: '言い訳',       positive: true,  message: () => '🙈 「酔ってるから」…次のセクハラの条件緩和！' },
  drink_dmg_half:   { icon: '🛡️', label: 'ダメージ半減', positive: true,  message: () => '🫖 冷静…被ドリンクダメージ半減！' },
  next_drink_boost: { icon: '⚔️', label: '次攻撃強化',   positive: true,  message: (b) => `🏆 勢いが止まらない！次のドリンクダメージ+${b.value ?? 0}！` },
  next_food_boost:  { icon: '💚', label: '次回復強化',   positive: true,  message: (b) => `🍰 じんわり…次のフード回復+${b.value ?? 0}！` },
  negate_next:      { icon: '🚫', label: '次ダメ無効',   positive: true,  message: () => '🃏 ポーカーフェイス…相手の次のカード効果を無効化！' },
  stealth:          { icon: '👻', label: 'ステルス',     positive: true,  message: () => '👻 隠密状態…セクハラを回避！' },
  self_atk_up:      { icon: '💪', label: '攻撃力UP',     positive: true,  message: (b) => `💉 攻撃バフ！ドリンクダメージ${b.value ?? 1}倍！` },
  all_dmg_up:       { icon: '🔥', label: '全ダメUP',     positive: true,  message: (b) => `💮 全ダメージ+${b.value ?? 0}！場の空気が重い…` },
  sanity_negate:    { icon: '🧠', label: '理性ガード',   positive: true,  message: () => '✨ 加護展開！理性ダメージを無効化！' },
  thorns:           { icon: '🌵', label: '反撃',         positive: true,  message: (b) => `⚖️ 裁きの棘！ダメージを受けると${b.value ?? 0}反射！` },
  reflect_all:      { icon: '🪞', label: '全反射',       positive: true,  message: () => '🛡️ 酒壁展開！全ダメージを跳ね返す！' },
  afterglow:        { icon: '✨', label: '余韻',         positive: false, message: () => '✨ 余韻…次のセクハラが効きやすい' },
  frustration:      { icon: '😤', label: '焦らし',       positive: false, message: null },
  finger_technique: { icon: '🤌', label: '指先テク',     positive: true,  message: () => '🤌 指先のテクニック！セクハラダメージ1.5倍！' },
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
  'afterglow', 'frustration',
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

import type { CardType } from './types.ts';

/** カードタイプの日本語ラベル */
export const CARD_TYPE_LABELS: Record<CardType | 'all', string> = {
  all: '全て',
  drink: '酒',
  food: '食事',
  chug: '一気',
  harassment: 'ハラスメント',
  strategy: '策略',
  environment: '環境',
  status: '状態',
};

/** カードタイプの絵文字アイコン */
export const CARD_TYPE_ICONS: Record<CardType, string> = {
  drink: '🍺',
  food: '🥜',
  chug: '🍻',
  harassment: '💋',
  strategy: '🃏',
  environment: '🌐',
  status: '💫',
};

/** レアリティのCSSクラス */
export const RARITY_CLASS: Record<number, string> = {
  1: 'rarity-common',
  2: 'rarity-uncommon',
  3: 'rarity-rare',
  4: 'rarity-epic',
  5: 'rarity-legendary',
  6: 'rarity-mythic',
};

/** インベントリのカードIDを枚数マップに変換 */
export function buildCardCountMap(inventory: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const id of inventory) {
    map[id] = (map[id] ?? 0) + 1;
  }
  return map;
}

/** ゲージのパーセンテージ計算（0~100） */
export function gaugePercent(value: number, max: number): number {
  return Math.min(value / max, 1) * 100;
}

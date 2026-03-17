import type { CardType } from './types.ts';

/** カードタイプの翻訳キー */
export const CARD_TYPE_LABELS: Record<CardType | 'all', string> = {
  all: 'cardType.all',
  drink: 'cardType.drink',
  food: 'cardType.food',
  chug: 'cardType.chug',
  harassment: 'cardType.harassment',
  strategy: 'cardType.strategy',
  environment: 'cardType.environment',
  status: 'cardType.status',
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

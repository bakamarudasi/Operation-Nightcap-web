import { CARD_DATA } from './cards.ts';

/** レアリティ別排出率（合計100%） */
export const GACHA_RATE_TABLE: { rarity: number; weight: number }[] = [
  { rarity: 1, weight: 45 },
  { rarity: 2, weight: 25 },
  { rarity: 3, weight: 17 },
  { rarity: 4, weight: 9 },
  { rarity: 5, weight: 3.5 },
  { rarity: 6, weight: 0.5 },
];

/** ダブり時の龍門幣変換レート */
export const DUPLICATE_REFUND: Record<number, number> = {
  1: 30,
  2: 80,
  3: 150,
  4: 300,
  5: 600,
  6: 1500,
};

/** ガチャ1回の価格 */
export const GACHA_SINGLE_COST = 300;

/** 10連の価格（1回分お得） */
export const GACHA_MULTI_COST = 2700;

/** 同一カードの所持上限 */
export const CARD_COPY_LIMIT = 3;

/** レアリティ別のカードIDリストを生成 */
export function getCardsByRarity(): Record<number, string[]> {
  const map: Record<number, string[]> = {};
  for (const [id, card] of Object.entries(CARD_DATA)) {
    const r = card.rarity;
    if (!map[r]) map[r] = [];
    map[r].push(id);
  }
  return map;
}

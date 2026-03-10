import { CARD_DATA } from '../data/cards.ts';
import {
  GACHA_RATE_TABLE,
  DUPLICATE_REFUND,
  CARD_COPY_LIMIT,
  getCardsByRarity,
} from '../data/gacha.ts';
import { randomPick } from './utils.ts';
import type { GachaResult } from '../data/types.ts';

const cardsByRarity = getCardsByRarity();

/** 重み付きランダムでレアリティを決定 */
function rollRarity(): number {
  const totalWeight = GACHA_RATE_TABLE.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of GACHA_RATE_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) return entry.rarity;
  }
  // fallback（浮動小数点誤差対策）
  return GACHA_RATE_TABLE[GACHA_RATE_TABLE.length - 1].rarity;
}

/**
 * ガチャを1回引く
 * @param inventory 現在の全所持カードID配列
 */
export function pullOne(inventory: string[]): GachaResult {
  const rarity = rollRarity();
  const pool = cardsByRarity[rarity];
  if (!pool || pool.length === 0) {
    // フォールバック: ★1から排出
    const fallbackPool = cardsByRarity[1];
    const cardId = randomPick(fallbackPool)!;
    return { cardId, rarity: 1, isNew: true, isDuplicate: false, refund: 0 };
  }

  const cardId = randomPick(pool)!;
  const card = CARD_DATA[cardId];
  const ownedCount = inventory.filter(id => id === cardId).length;
  const isNew = ownedCount === 0;
  const isDuplicate = ownedCount >= CARD_COPY_LIMIT;
  const refund = isDuplicate ? (DUPLICATE_REFUND[card.rarity] ?? 30) : 0;

  return { cardId, rarity: card.rarity, isNew, isDuplicate, refund };
}

/**
 * ガチャをN回引く
 * inventoryは各pull後に更新して重複判定に反映する
 */
export function pullMulti(inventory: string[], count: number): GachaResult[] {
  const results: GachaResult[] = [];
  const currentInventory = [...inventory];

  for (let i = 0; i < count; i++) {
    const result = pullOne(currentInventory);
    results.push(result);
    // ダブりじゃなければinventoryに追加（次の判定に反映）
    if (!result.isDuplicate) {
      currentInventory.push(result.cardId);
    }
  }

  return results;
}

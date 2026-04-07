import type { GachaResult } from '../data/types.ts';
import { CARD_DATA, getEnhanceCost, MAX_CARD_LEVEL } from '../data/cards.ts';
import { pullMulti } from '../engine/gachaEngine.ts';
import { GACHA_SINGLE_COST, GACHA_MULTI_COST } from '../data/gacha.ts';
import type { GameStore } from './gameStore.ts';

export const createCommerceSlice = (
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) => ({
  enhanceCard: (cardId: string): boolean => {
    const state = get();
    const card = CARD_DATA[cardId];
    if (!card) return false;
    const currentLevel = state.cardLevels[cardId] ?? 1;
    if (currentLevel >= MAX_CARD_LEVEL) return false;

    // inventoryに3枚以上必要（2枚消費+1枚残す）
    const invCount = state.inventory.filter(id => id === cardId).length;
    if (invCount < 3) return false;

    const cost = getEnhanceCost(cardId, currentLevel);
    if (state.money < cost) return false;

    // inventoryから2枚削除（デッキに入っている分を残すよう、デッキ外の分を優先除去）
    const newInventory = [...state.inventory];
    const deckCount = state.playerDeck.filter(id => id === cardId).length;
    // デッキにない「余剰」枚数を把握
    const allIndices: number[] = [];
    for (let i = newInventory.length - 1; i >= 0; i--) {
      if (newInventory[i] === cardId) allIndices.push(i);
    }
    // 余剰分（デッキ枚数を超える分）を先に削除対象にする
    const surplus = allIndices.slice(0, allIndices.length - deckCount);
    const inDeck = allIndices.slice(allIndices.length - deckCount);
    const removeOrder = [...surplus, ...inDeck]; // 余剰→デッキ内の順で削除

    let removed = 0;
    for (const idx of removeOrder) {
      if (removed >= 2) break;
      newInventory.splice(idx, 1);
      removed++;
    }

    if (removed < 2) return false;

    // デッキからはみ出た分を調整
    const newDeck = [...state.playerDeck];
    const newInvCount = newInventory.filter(id => id === cardId).length;
    const deckCardCount = newDeck.filter(id => id === cardId).length;
    if (deckCardCount > newInvCount) {
      // デッキ内の余剰分を削除
      let excess = deckCardCount - newInvCount;
      for (let i = newDeck.length - 1; i >= 0 && excess > 0; i--) {
        if (newDeck[i] === cardId) {
          newDeck.splice(i, 1);
          excess--;
        }
      }
    }

    set({
      money: state.money - cost,
      inventory: newInventory,
      playerDeck: newDeck,
      cardLevels: { ...state.cardLevels, [cardId]: currentLevel + 1 },
    });
    return true;
  },

  buyCard: (cardId: string): boolean => {
    const state = get();
    const card = CARD_DATA[cardId];
    if (!card) return false;
    if (state.money < card.price) return false;

    const newInventory = [...state.inventory, cardId];
    const newDeck = [...state.playerDeck];
    // デッキに空きがあり、同一カード3枚未満ならデッキにも追加
    const sameCount = newDeck.filter(id => id === cardId).length;
    if (newDeck.length < 12 && sameCount < 3) {
      newDeck.push(cardId);
    }

    set({
      money: state.money - card.price,
      inventory: newInventory,
      playerDeck: newDeck,
    });
    return true;
  },

  sellCard: (index: number): boolean => {
    const state = get();
    if (index < 0 || index >= state.playerDeck.length) return false;
    if (state.playerDeck.length <= 4) return false;

    const cardId = state.playerDeck[index];
    const card = CARD_DATA[cardId];
    const refund = Math.floor((card?.price ?? 0) / 2);

    const newDeck = [...state.playerDeck];
    newDeck.splice(index, 1);

    // インベントリからも1枚除去（売却 = 所有権放棄）
    const newInventory = [...state.inventory];
    const invIdx = newInventory.indexOf(cardId);
    if (invIdx >= 0) newInventory.splice(invIdx, 1);

    set({
      money: state.money + refund,
      inventory: newInventory,
      playerDeck: newDeck,
    });
    return true;
  },

  pullGacha: (count: 1 | 10): GachaResult[] | null => {
    const state = get();
    const cost = count === 10 ? GACHA_MULTI_COST : GACHA_SINGLE_COST;
    if (state.money < cost) return null;

    const results = pullMulti(state.inventory, count);

    // 結果を反映
    let moneyDelta = -cost;
    const newInventory = [...state.inventory];
    const newDeck = [...state.playerDeck];
    for (const r of results) {
      if (r.isDuplicate) {
        moneyDelta += r.refund;
      } else {
        newInventory.push(r.cardId);
        // デッキに空きがあれば追加（最大12枚）
        if (newDeck.length < 12) {
          newDeck.push(r.cardId);
        }
      }
    }

    set({
      money: state.money + moneyDelta,
      inventory: newInventory,
      playerDeck: newDeck,
    });

    return results;
  },

  addToDeck: (cardId: string): boolean => {
    const state = get();
    if (state.playerDeck.length >= 12) return false;
    // インベントリにあるかチェック（デッキに入ってない分）
    const deckCount = state.playerDeck.filter((id: string) => id === cardId).length;
    const invCount = state.inventory.filter((id: string) => id === cardId).length;
    if (deckCount >= invCount) return false;
    // 同じカードは最大3枚まで
    if (deckCount >= 3) return false;
    set({ playerDeck: [...state.playerDeck, cardId] });
    return true;
  },

  removeFromDeck: (index: number): boolean => {
    const state = get();
    if (index < 0 || index >= state.playerDeck.length) return false;
    if (state.playerDeck.length <= 4) return false; // 最低4枚は維持
    const newDeck = [...state.playerDeck];
    newDeck.splice(index, 1);
    set({ playerDeck: newDeck });
    return true;
  },
});

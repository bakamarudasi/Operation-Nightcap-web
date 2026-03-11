import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pullOne, pullMulti } from '../engine/gachaEngine.ts';
import { CARD_DATA } from '../data/cards.ts';
import { GACHA_RATE_TABLE, CARD_COPY_LIMIT, DUPLICATE_REFUND } from '../data/gacha.ts';

describe('pullOne', () => {
  it('有効なカードIDを返す', () => {
    const result = pullOne([]);
    expect(result.cardId).toBeTruthy();
    expect(CARD_DATA[result.cardId]).toBeDefined();
  });

  it('レアリティがGACHA_RATE_TABLEの範囲内', () => {
    const validRarities = GACHA_RATE_TABLE.map(r => r.rarity);
    for (let i = 0; i < 20; i++) {
      const result = pullOne([]);
      expect(validRarities).toContain(result.rarity);
    }
  });

  it('新規カードはisNew=true, isDuplicate=false', () => {
    const result = pullOne([]);
    // 空インベントリなら必ず新規
    expect(result.isNew).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.refund).toBe(0);
  });

  it('CARD_COPY_LIMIT以上所持でisDuplicate=trueかつrefund > 0', () => {
    // 特定カードをCARD_COPY_LIMIT回持つインベントリを作る
    // Math.randomを固定して最初のレアリティ＆カードを選ばせる
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const firstResult = pullOne([]);
    vi.restoreAllMocks();

    const cardId = firstResult.cardId;
    const inventory = Array(CARD_COPY_LIMIT).fill(cardId);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = pullOne(inventory);
    vi.restoreAllMocks();

    expect(result.cardId).toBe(cardId);
    expect(result.isDuplicate).toBe(true);
    expect(result.refund).toBeGreaterThan(0);
    const card = CARD_DATA[cardId];
    expect(result.refund).toBe(DUPLICATE_REFUND[card.rarity] ?? 30);
  });
});

describe('pullMulti', () => {
  it('指定回数分の結果を返す', () => {
    const results = pullMulti([], 10);
    expect(results).toHaveLength(10);
  });

  it('各結果が有効なカードIDを持つ', () => {
    const results = pullMulti([], 5);
    for (const r of results) {
      expect(CARD_DATA[r.cardId]).toBeDefined();
    }
  });

  it('連続pullで重複判定が更新される', () => {
    // Math.randomを固定して同じカードを引き続ける
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const results = pullMulti([], CARD_COPY_LIMIT + 2);
    vi.restoreAllMocks();

    // CARD_COPY_LIMIT+1枚目以降はダブり扱い
    const lastResults = results.slice(CARD_COPY_LIMIT);
    for (const r of lastResults) {
      expect(r.isDuplicate).toBe(true);
    }
  });
});

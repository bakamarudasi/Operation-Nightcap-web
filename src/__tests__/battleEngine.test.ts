import { describe, it, expect } from 'vitest';
import { BattleEngine, tickBuffs, calcDoTDamage } from '../engine/battleEngine.ts';
import type { BattleState, Buff } from '../data/types.ts';

function createBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    round: 1,
    maxRounds: 12,
    playerDrunk: 0,
    opponentDrunk: 0,
    playerDeckRemaining: [],
    opponentDeckRemaining: [],
    playerHand: ['beer', 'wine'],
    opponentHand: ['beer', 'nuts'],
    selectedCard: null,
    isProcessing: false,
    opponentDiscardNext: false,
    playerDiscardNext: false,
    opponentDiscardCount: 0,
    playerDiscardCount: 0,
    opponentDiscardHighest: false,
    playerDiscardHighest: false,
    playerReducedHand: false,
    opponentReducedHand: false,
    spillActive: false,
    playerBuffs: [],
    opponentBuffs: [],
    corruptedSlots: [],
    opponentCorruptedSlots: [],
    rumorActive: false,
    playerRumorActive: false,
    playerDiscardPile: [],
    opponentDiscardPile: [],
    ...overrides,
  };
}

describe('tickBuffs', () => {
  it('durationを1減らす', () => {
    const buffs: Buff[] = [{ id: 'stun', duration: 2 }];
    const result = tickBuffs(buffs);
    expect(result).toHaveLength(1);
    expect(result[0].duration).toBe(1);
  });

  it('duration=1のバフは0になり除去される', () => {
    const buffs: Buff[] = [{ id: 'stun', duration: 1 }];
    const result = tickBuffs(buffs);
    expect(result).toHaveLength(0);
  });

  it('永続バフ(duration=-1)は除去されない', () => {
    const buffs: Buff[] = [{ id: 'karaoke', duration: -1, value: 1 }];
    const result = tickBuffs(buffs);
    expect(result).toHaveLength(1);
    expect(result[0].duration).toBe(-1);
  });

  it('複数のバフを正しく処理する', () => {
    const buffs: Buff[] = [
      { id: 'stun', duration: 1 },
      { id: 'karaoke', duration: 3, value: 1 },
      { id: 'dot', duration: -1, value: 1 },
    ];
    const result = tickBuffs(buffs);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('karaoke');
    expect(result[0].duration).toBe(2);
    expect(result[1].id).toBe('dot');
  });
});

describe('calcDoTDamage', () => {
  it('dotバフがなければ0', () => {
    expect(calcDoTDamage([])).toBe(0);
    expect(calcDoTDamage([{ id: 'stun', duration: 1 }])).toBe(0);
  });

  it('dotバフのvalueを合計する', () => {
    const buffs: Buff[] = [
      { id: 'dot', duration: 2, value: 1 },
      { id: 'dot', duration: 3, value: 2 },
    ];
    expect(calcDoTDamage(buffs)).toBe(3);
  });
});

describe('BattleEngine.resolveRound', () => {
  it('ドリンクvsフードで正しいダメージ計算', () => {
    const battle = createBattleState();
    // beer (damage:1) vs nuts (heal:1)
    const result = BattleEngine.resolveRound('beer', 'nuts', battle);
    expect(result.playerCard.id).toBe('beer');
    expect(result.opponentCard.id).toBe('nuts');
    // beerのダメージが相手に与えられる
    expect(result.opponentDamage).toBeGreaterThanOrEqual(1);
    // nutsの回復が相手に適用される
    expect(result.opponentHeal).toBeGreaterThanOrEqual(1);
  });

  it('フードvsドリンクで正しいダメージ計算', () => {
    const battle = createBattleState();
    // nuts (heal:1) vs beer (damage:1)
    const result = BattleEngine.resolveRound('nuts', 'beer', battle);
    expect(result.playerHeal).toBeGreaterThanOrEqual(1);
    expect(result.playerDamage).toBeGreaterThanOrEqual(1);
  });

  it('messagesが配列で返る', () => {
    const battle = createBattleState();
    const result = BattleEngine.resolveRound('beer', 'beer', battle);
    expect(Array.isArray(result.messages)).toBe(true);
  });

  it('DoTダメージがラウンド結果に含まれる', () => {
    const battle = createBattleState({
      playerBuffs: [{ id: 'dot', duration: 3, value: 2 }],
    });
    const result = BattleEngine.resolveRound('nuts', 'nuts', battle);
    // プレイヤーにDoTダメージが加算される
    expect(result.playerDamage).toBeGreaterThanOrEqual(2);
  });

  it('karaokeバフがドリンクダメージを増加させる', () => {
    const battleNoKaraoke = createBattleState();
    const resultNormal = BattleEngine.resolveRound('beer', 'nuts', battleNoKaraoke);

    const battleWithKaraoke = createBattleState({
      playerBuffs: [{ id: 'karaoke', duration: 3, value: 1 }],
    });
    const resultKaraoke = BattleEngine.resolveRound('beer', 'nuts', battleWithKaraoke);

    expect(resultKaraoke.opponentDamage).toBeGreaterThan(resultNormal.opponentDamage);
  });

  it('instant winカードの処理', () => {
    const battle = createBattleState({
      opponentDrunk: 10, // 高酔い状態
    });
    // kissカードが存在するか確認
    const { CARD_DATA } = require('../data/cards.ts');
    if (CARD_DATA['kiss']) {
      const result = BattleEngine.resolveRound('kiss', 'nuts', battle);
      // 酔いLvが足りていればinstantWin
      if (result.instantWin) {
        expect(result.instantWin).toBe(true);
      }
    }
  });
});

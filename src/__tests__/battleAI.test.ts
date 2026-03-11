import { describe, it, expect, vi, afterEach } from 'vitest';
import { BattleAI } from '../engine/battleAI.ts';
import { CARD_DATA } from '../data/cards.ts';
import type { BattleState, CharacterDef, DeckAI, BattleLines, CharacterTheme, DrunkLevel, CostumeState } from '../data/types.ts';

function createMockCharacter(personality: 'aggressive' | 'defensive' | 'balanced'): CharacterDef {
  return {
    id: 'test',
    name: 'テスト',
    nameEn: 'Test',
    subtitle: 'テスト用',
    theme: { color: '#000', colorDark: '#111', colorGlow: '#222', icon: '🧪' } as CharacterTheme,
    drunkType: 'test',
    drunkMax: 12,
    drunkLevels: [] as DrunkLevel[],
    costumeStates: [] as CostumeState[],
    battleLines: {
      playDrink: [], playFood: [], playChug: [],
      takeDamage: [], dealDamage: [],
      harassmentSuccess: [], harassmentFail: [],
      winLine: '', loseLine: '',
    } as BattleLines,
    deck_ai: { personality, defaultDeck: [] } as DeckAI,
    cgEvents: [],
    afterEvents: [],
  };
}

function createBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    round: 1, maxRounds: 12,
    playerDrunk: 0, opponentDrunk: 0,
    playerDeckRemaining: [], opponentDeckRemaining: [],
    playerHand: [], opponentHand: [],
    selectedCard: null, isProcessing: false,
    opponentDiscardNext: false, playerDiscardNext: false,
    opponentDiscardCount: 0, playerDiscardCount: 0,
    opponentDiscardHighest: false, playerDiscardHighest: false,
    playerReducedHand: false, opponentReducedHand: false,
    spillActive: false,
    playerBuffs: [], opponentBuffs: [],
    corruptedSlots: [], opponentCorruptedSlots: [],
    rumorActive: false, playerRumorActive: false,
    playerDiscardPile: [], opponentDiscardPile: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BattleAI.selectCard', () => {
  it('空の手札ならnullを返す', () => {
    const char = createMockCharacter('balanced');
    const battle = createBattleState();
    expect(BattleAI.selectCard([], char, battle)).toBeNull();
  });

  it('手札の中からカードを選ぶ', () => {
    const hand = ['beer', 'wine', 'nuts'];
    const char = createMockCharacter('balanced');
    const battle = createBattleState();
    const selected = BattleAI.selectCard(hand, char, battle);
    expect(selected).not.toBeNull();
    expect(hand).toContain(selected);
  });

  it('酔いLvが高いときにハラスメントカードを優先する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const hand = ['beer', 'shoulder_lean'];
    const char = createMockCharacter('balanced');
    const battle = createBattleState({ opponentDrunk: 10 }); // drunkLv 4
    const selected = BattleAI.selectCard(hand, char, battle);
    expect(selected).toBe('shoulder_lean');
  });

  it('自分の酔いが高いときにフードを優先する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const hand = ['beer', 'ramen'];
    const char = createMockCharacter('balanced');
    const battle = createBattleState({ opponentDrunk: 5 }); // drunkLv 2
    const selected = BattleAI.selectCard(hand, char, battle);
    // ramen(heal:3)が選ばれるはず
    expect(selected).toBe('ramen');
  });
});

describe('BattleAI.pickBestDrink', () => {
  it('空配列ならnullを返す', () => {
    expect(BattleAI.pickBestDrink([])).toBeNull();
  });

  it('ダメージが最大のドリンクを選ぶ', () => {
    const drinks = ['beer', 'wine', 'whiskey'];
    const result = BattleAI.pickBestDrink(drinks);
    expect(result).toBe('whiskey'); // damage: 3
  });
});

describe('BattleAI.pickBestFood', () => {
  it('空配列ならnullを返す', () => {
    expect(BattleAI.pickBestFood([])).toBeNull();
  });

  it('回復量が最大のフードを選ぶ', () => {
    const foods = ['nuts', 'yakitori', 'ramen'];
    const result = BattleAI.pickBestFood(foods);
    expect(result).toBe('ramen'); // heal: 3
  });
});

describe('BattleAI.pickStrongestHarassment', () => {
  it('空配列ならnullを返す', () => {
    expect(BattleAI.pickStrongestHarassment([])).toBeNull();
  });

  it('ハラスメントスコアが最大のカードを選ぶ', () => {
    // shoulder_lean と kiss があればkissが強い（instantWin = 10ポイント）
    if (CARD_DATA['kiss'] && CARD_DATA['shoulder_lean']) {
      const cards = ['shoulder_lean', 'kiss'];
      const result = BattleAI.pickStrongestHarassment(cards);
      expect(result).toBe('kiss');
    }
  });
});

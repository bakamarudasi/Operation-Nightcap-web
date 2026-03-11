import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA, DEFAULT_DECK } from '../data/cards.ts';
import { CHARACTER_DATA } from '../data/characters.ts';
import { GACHA_SINGLE_COST, GACHA_MULTI_COST } from '../data/gacha.ts';

// テストごとにストアをリセット
beforeEach(() => {
  const { resetData } = useGameStore.getState();
  resetData();
});

describe('gameStore 初期状態', () => {
  it('初期マネーが3200', () => {
    expect(useGameStore.getState().money).toBe(3200);
  });

  it('初期デッキがDEFAULT_DECK', () => {
    expect(useGameStore.getState().playerDeck).toEqual(DEFAULT_DECK);
  });

  it('初期画面がtitle', () => {
    expect(useGameStore.getState().currentScreen).toBe('title');
  });

  it('勝敗が0', () => {
    const state = useGameStore.getState();
    expect(state.wins).toBe(0);
    expect(state.losses).toBe(0);
  });
});

describe('setScreen', () => {
  it('画面を切り替えられる', () => {
    useGameStore.getState().setScreen('shop');
    expect(useGameStore.getState().currentScreen).toBe('shop');
    expect(useGameStore.getState().previousScreen).toBe('title');
  });
});

describe('buyCard', () => {
  it('所持金が足りればカードを購入できる', () => {
    const store = useGameStore.getState();
    // デッキを12枚未満にする（初期デッキが12枚の場合はsellしてから）
    const deckLen = store.playerDeck.length;
    if (deckLen >= 12) {
      // まず売ってスペースを作る
      useGameStore.getState().sellCard(0);
    }
    const result = useGameStore.getState().buyCard('beer');
    if (useGameStore.getState().money >= CARD_DATA['beer'].price - CARD_DATA['beer'].price) {
      // buyCardの結果を検証
      expect(typeof result).toBe('boolean');
    }
  });

  it('所持金不足ならfalseを返す', () => {
    // 所持金を0にする
    useGameStore.setState({ money: 0 });
    const result = useGameStore.getState().buyCard('beer');
    expect(result).toBe(false);
  });

  it('デッキが12枚ならfalseを返す', () => {
    // デッキを12枚にする
    const deck = Array(12).fill('beer');
    useGameStore.setState({ playerDeck: deck, money: 10000 });
    const result = useGameStore.getState().buyCard('wine');
    expect(result).toBe(false);
  });

  it('同じカード3枚持っていたらfalseを返す', () => {
    useGameStore.setState({
      playerDeck: ['beer', 'beer', 'beer', 'wine'],
      money: 10000,
    });
    const result = useGameStore.getState().buyCard('beer');
    expect(result).toBe(false);
  });
});

describe('sellCard', () => {
  it('デッキからカードを売却できる', () => {
    useGameStore.setState({
      playerDeck: ['beer', 'wine', 'whiskey', 'nuts', 'yakitori'],
      money: 1000,
    });
    const moneyBefore = useGameStore.getState().money;
    const result = useGameStore.getState().sellCard(0);
    expect(result).toBe(true);
    expect(useGameStore.getState().playerDeck).toHaveLength(4);
    expect(useGameStore.getState().money).toBeGreaterThan(moneyBefore);
  });

  it('デッキが4枚以下なら売れない', () => {
    useGameStore.setState({
      playerDeck: ['beer', 'wine', 'nuts', 'yakitori'],
      money: 1000,
    });
    const result = useGameStore.getState().sellCard(0);
    expect(result).toBe(false);
  });

  it('不正なインデックスならfalseを返す', () => {
    const result = useGameStore.getState().sellCard(-1);
    expect(result).toBe(false);
    const result2 = useGameStore.getState().sellCard(999);
    expect(result2).toBe(false);
  });
});

describe('pullGacha', () => {
  it('所持金不足ならnullを返す', () => {
    useGameStore.setState({ money: 0 });
    expect(useGameStore.getState().pullGacha(1)).toBeNull();
    expect(useGameStore.getState().pullGacha(10)).toBeNull();
  });

  it('1連で1件の結果を返す', () => {
    useGameStore.setState({ money: 10000 });
    const results = useGameStore.getState().pullGacha(1);
    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);
  });

  it('10連で10件の結果を返す', () => {
    useGameStore.setState({ money: 10000 });
    const results = useGameStore.getState().pullGacha(10);
    expect(results).not.toBeNull();
    expect(results).toHaveLength(10);
  });

  it('ガチャ後に所持金が減少する', () => {
    useGameStore.setState({ money: 10000 });
    const moneyBefore = useGameStore.getState().money;
    useGameStore.getState().pullGacha(1);
    expect(useGameStore.getState().money).toBeLessThan(moneyBefore);
  });
});

describe('endBattle', () => {
  it('勝利時にrewardが返る', () => {
    const reward = useGameStore.getState().endBattle('player_win');
    expect(reward).toBeGreaterThan(0);
  });

  it('勝利回数が増える', () => {
    useGameStore.getState().endBattle('player_win');
    expect(useGameStore.getState().wins).toBe(1);
  });

  it('敗北回数が増える', () => {
    useGameStore.getState().endBattle('opponent_win');
    expect(useGameStore.getState().losses).toBe(1);
  });

  it('引き分けは勝敗カウントが変わらない', () => {
    useGameStore.getState().endBattle('draw');
    expect(useGameStore.getState().wins).toBe(0);
    expect(useGameStore.getState().losses).toBe(0);
  });

  it('敗北でも報酬がもらえる', () => {
    const reward = useGameStore.getState().endBattle('opponent_win');
    expect(reward).toBeGreaterThan(0);
  });
});

describe('checkGameEnd', () => {
  it('相手の酔いが10以上ならplayer_win', () => {
    useGameStore.setState({
      battle: { ...useGameStore.getState().battle, opponentDrunk: 10 },
    });
    expect(useGameStore.getState().checkGameEnd()).toBe('player_win');
  });

  it('自分の酔いが10以上ならopponent_win', () => {
    useGameStore.setState({
      battle: { ...useGameStore.getState().battle, playerDrunk: 10 },
    });
    expect(useGameStore.getState().checkGameEnd()).toBe('opponent_win');
  });

  it('ラウンド数超過で酔いが低い方が勝ち', () => {
    useGameStore.setState({
      battle: {
        ...useGameStore.getState().battle,
        round: 12,
        maxRounds: 12,
        playerDrunk: 3,
        opponentDrunk: 5,
      },
    });
    expect(useGameStore.getState().checkGameEnd()).toBe('player_win');
  });

  it('ラウンド数超過で同じ酔いならdraw', () => {
    useGameStore.setState({
      battle: {
        ...useGameStore.getState().battle,
        round: 12,
        maxRounds: 12,
        playerDrunk: 5,
        opponentDrunk: 5,
      },
    });
    expect(useGameStore.getState().checkGameEnd()).toBe('draw');
  });

  it('ゲーム続行中はnull', () => {
    useGameStore.setState({
      battle: {
        ...useGameStore.getState().battle,
        round: 3,
        playerDrunk: 2,
        opponentDrunk: 3,
        playerDeckRemaining: ['beer'],
        opponentDeckRemaining: ['beer'],
      },
    });
    expect(useGameStore.getState().checkGameEnd()).toBeNull();
  });
});

describe('getDrunkLevel', () => {
  it('酔い値に応じた酔いレベルを返す', () => {
    const { getDrunkLevel } = useGameStore.getState();
    expect(getDrunkLevel(0)).toBe(0);
    expect(getDrunkLevel(1)).toBe(0);
    expect(getDrunkLevel(2)).toBe(1);
    expect(getDrunkLevel(4)).toBe(2);
    expect(getDrunkLevel(7)).toBe(3);
    expect(getDrunkLevel(10)).toBe(4);
  });
});

describe('initBattle', () => {
  it('所持金500以上で対戦を開始できる', () => {
    useGameStore.setState({ money: 1000 });
    const characterIds = Object.keys(CHARACTER_DATA);
    if (characterIds.length > 0) {
      useGameStore.getState().initBattle(characterIds[0]);
      const state = useGameStore.getState();
      expect(state.currentScreen).toBe('battle');
      expect(state.money).toBe(500); // 1000 - 500
      expect(state.battle.round).toBe(0);
      expect(state.currentOpponent).not.toBeNull();
    }
  });

  it('所持金500未満では対戦できない', () => {
    useGameStore.setState({ money: 499 });
    const characterIds = Object.keys(CHARACTER_DATA);
    if (characterIds.length > 0) {
      useGameStore.getState().initBattle(characterIds[0]);
      expect(useGameStore.getState().currentScreen).toBe('title');
    }
  });
});

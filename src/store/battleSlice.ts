import type { CharacterDef, CGEvent } from '../data/types.ts';
import { shuffleArray } from '../engine/utils.ts';
import { computeDrawHands } from '../engine/handManager.ts';
import { computeRoundResult, buildNextBattleState } from '../engine/roundProcessor.ts';
import { getAffinityBonus } from '../data/affinity.ts';
import type { GameStore } from './gameStore.ts';
import { initialBattle } from './gameStore.ts';

export const createBattleSlice = (
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) => ({
  initBattle: (opponentId: string, characterData: Record<string, CharacterDef>) => {
    const char = characterData[opponentId];
    if (!char) return;
    const state = get();
    if (state.money < 500) return;
    const playerDeckShuffled = [...state.playerDeck];
    const opponentDeckShuffled = [...char.deck_ai.defaultDeck];
    shuffleArray(playerDeckShuffled);
    shuffleArray(opponentDeckShuffled);

    set({
      money: state.money - 500,
      currentOpponent: char,
      currentScreen: 'battle',
      battle: {
        ...initialBattle,
        playerDeckRemaining: playerDeckShuffled,
        opponentDeckRemaining: opponentDeckShuffled,
        // デバッグモード: 相手が最初から酔いLv3（値7）で開始
        opponentDrunk: state.debugMode ? 7 : 0,
        opponentSanity: char.sanityMax ?? 10,
        playerCardLevels: { ...state.cardLevels },
      },
    });
  },

  drawHands: () => {
    set((state) => ({
      battle: { ...state.battle, ...computeDrawHands(state.battle) },
    }));
  },

  selectCard: (cardId: string) => {
    set((state) => ({
      battle: { ...state.battle, selectedCard: cardId },
    }));
  },

  playRound: (): { messages: string[]; cgEvent: CGEvent | null; opponentCgEvent: CGEvent | null; instantWin: boolean; opponentCardId: string; playerCardId: string; playerDamage: number; opponentDamage: number; playerHeal: number; opponentHeal: number; revealedHand?: string[]; rumorActive?: boolean; playerMisplay: boolean; opponentMisplay: boolean; playerMatchup?: 'advantage' | 'disadvantage' | 'neutral' } | null => {
    const state = get();
    const computed = computeRoundResult({
      battle: state.battle,
      currentOpponent: state.currentOpponent,
      unlockedCGs: state.unlockedCGs,
    });
    if (!computed) return null;

    // CG unlock
    if (computed.newUnlockedCGs.length !== state.unlockedCGs.length) {
      set({ unlockedCGs: computed.newUnlockedCGs });
    }

    set((state) => ({
      battle: {
        ...state.battle,
        ...buildNextBattleState(state.battle, computed, state.currentOpponent),
      },
    }));

    return {
      messages: computed.result.messages,
      cgEvent: computed.result.cgEvent,
      opponentCgEvent: computed.opponentCgEvent,
      instantWin: computed.result.instantWin,
      opponentCardId: computed.opponentCardId,
      playerCardId: computed.resolvedPlayerCardId,
      playerMisplay: computed.playerMisplay,
      opponentMisplay: computed.opponentMisplay,
      playerMatchup: computed.result.playerMatchup,
      playerDamage: computed.result.playerDamage,
      opponentDamage: computed.result.opponentDamage,
      playerHeal: computed.result.playerHeal,
      opponentHeal: computed.result.opponentHeal,
      revealedHand: computed.result.revealedHand,
      rumorActive: computed.result.rumorActive,
    };
  },

  checkGameEnd: (): 'player_win' | 'opponent_win' | 'draw' | null => {
    const b = get().battle;
    // 二軸勝敗: 酔いMAX or 理性ゼロ、どちらか先に達した方で決着
    if (b.opponentDrunk >= 10 || b.opponentSanity <= 0) return 'player_win';
    if (b.playerDrunk >= 10 || b.playerSanity <= 0) return 'opponent_win';
    // デッキ・捨て札・手札が全て空なら強制終了（詰み防止）
    const playerOutOfCards = b.playerDeckRemaining.length === 0 && b.playerDiscardPile.length === 0 && b.playerHand.length === 0;
    const opponentOutOfCards = b.opponentDeckRemaining.length === 0 && b.opponentDiscardPile.length === 0 && b.opponentHand.length === 0;
    if (playerOutOfCards || opponentOutOfCards || b.round >= b.maxRounds) {
      if (b.playerDrunk < b.opponentDrunk) return 'player_win';
      if (b.playerDrunk > b.opponentDrunk) return 'opponent_win';
      // タイブレーク: 酔い同値なら理性が低い方が負け
      if (b.playerSanity > b.opponentSanity) return 'player_win';
      if (b.playerSanity < b.opponentSanity) return 'opponent_win';
      return 'draw';
    }
    return null;
  },

  endBattle: (result: 'player_win' | 'opponent_win' | 'draw'): number => {
    const state = get();
    let reward = 0;
    if (result === 'player_win') {
      reward = state.battle.playerDrunk === 0 ? 1000 : 700;
    } else if (result === 'opponent_win') {
      reward = 200;
    } else {
      reward = 300;
    }

    // キャラ別勝利数と好感度ボーナス
    const charId = state.currentOpponent?.id;
    const newWinsByChar = { ...state.winsByCharacter };
    if (result === 'player_win' && charId) {
      newWinsByChar[charId] = (newWinsByChar[charId] ?? 0) + 1;
      reward += getAffinityBonus(newWinsByChar[charId]);
    }

    set({
      money: state.money + reward,
      wins: result === 'player_win' ? state.wins + 1 : state.wins,
      losses: result === 'opponent_win' ? state.losses + 1 : state.losses,
      winsByCharacter: newWinsByChar,
    });
    return reward;
  },
});

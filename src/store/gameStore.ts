import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreenId, BattleState, CharacterDef, CGEvent } from '../data/types.ts';
import { DEFAULT_DECK, CARD_DATA } from '../data/cards.ts';
import { CHARACTER_DATA } from '../data/characters.ts';
import { shuffleArray, randomPick } from '../engine/utils.ts';
import { BattleEngine } from '../engine/battleEngine.ts';
import { BattleAI } from '../engine/battleAI.ts';

interface GameStore {
  // 永続データ
  money: number;
  playerDeck: string[];
  unlockedCGs: string[];
  wins: number;
  losses: number;

  // UI状態
  currentScreen: ScreenId;
  currentOpponent: CharacterDef | null;

  // バトル状態
  battle: BattleState;

  // CGオーバーレイ
  activeCG: CGEvent | null;
  cgDialogueIndex: number;

  // 画面遷移
  setScreen: (screen: ScreenId) => void;

  // バトル
  initBattle: (opponentId: string) => void;
  drawHands: () => void;
  selectCard: (cardId: string) => void;
  playRound: () => { messages: string[]; cgEvent: CGEvent | null; instantWin: boolean; opponentCardId: string; playerDamage: number; opponentDamage: number; playerHeal: number; opponentHeal: number } | null;
  checkGameEnd: () => 'player_win' | 'opponent_win' | 'draw' | null;
  endBattle: (result: 'player_win' | 'opponent_win' | 'draw') => number;

  // ショップ
  buyCard: (cardId: string) => boolean;
  sellCard: (index: number) => boolean;

  // CG
  showCG: (cg: CGEvent) => void;
  advanceCG: () => void;
  closeCG: () => void;

  // 設定
  resetData: () => void;

  // ユーティリティ
  getDrunkLevel: (drunkValue: number) => number;
}

const initialBattle: BattleState = {
  round: 0,
  maxRounds: 12,
  playerDrunk: 0,
  opponentDrunk: 0,
  playerDeckRemaining: [],
  opponentDeckRemaining: [],
  playerHand: [],
  opponentHand: [],
  selectedCard: null,
  isProcessing: false,
  opponentDiscardNext: false,
  playerReducedHand: false,
  opponentReducedHand: false,
  spillActive: false,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // 永続データ
      money: 3200,
      playerDeck: [...DEFAULT_DECK],
      unlockedCGs: [],
      wins: 0,
      losses: 0,

      // UI状態
      currentScreen: 'title',
      currentOpponent: null,

      // バトル
      battle: { ...initialBattle },

      // CG
      activeCG: null,
      cgDialogueIndex: 0,

      setScreen: (screen) => set({ currentScreen: screen }),

      initBattle: (opponentId) => {
        const char = CHARACTER_DATA[opponentId];
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
          },
        });
      },

      drawHands: () => {
        set((state) => {
          const b = { ...state.battle };
          const handSize = b.playerReducedHand ? 3 : 4;
          b.playerReducedHand = false;

          // プレイヤー手札
          const pRemaining = [...b.playerDeckRemaining];
          const pHand: string[] = [];
          const pCount = Math.min(handSize, pRemaining.length);
          for (let i = 0; i < pCount; i++) {
            pHand.push(pRemaining.shift()!);
          }

          // 相手手札
          const oHandSize = b.opponentReducedHand ? 3 : 4;
          b.opponentReducedHand = false;
          const oRemaining = [...b.opponentDeckRemaining];
          const oHand: string[] = [];
          const oCount = Math.min(oHandSize, oRemaining.length);
          for (let i = 0; i < oCount; i++) {
            oHand.push(oRemaining.shift()!);
          }

          // 乾杯強制の効果（破棄したカードはデッキの底に戻す）
          if (b.opponentDiscardNext && oHand.length > 1) {
            const discardIdx = Math.floor(Math.random() * oHand.length);
            const [discardedCard] = oHand.splice(discardIdx, 1);
            oRemaining.push(discardedCard);
          }

          return {
            battle: {
              ...b,
              playerDeckRemaining: pRemaining,
              opponentDeckRemaining: oRemaining,
              playerHand: pHand,
              opponentHand: oHand,
              selectedCard: null,
              isProcessing: false,
              opponentDiscardNext: false,
            },
          };
        });
      },

      selectCard: (cardId) => {
        set((state) => ({
          battle: { ...state.battle, selectedCard: cardId },
        }));
      },

      playRound: () => {
        const state = get();
        const b = state.battle;
        if (!b.selectedCard || b.isProcessing) return null;

        const opponentCardId = BattleAI.selectCard(b.opponentHand, state.currentOpponent!, b);
        if (!opponentCardId) return null;

        const result = BattleEngine.resolveRound(b.selectedCard, opponentCardId, b);

        // セクハラカード成功時にCGイベント検索
        const pCard = CARD_DATA[b.selectedCard];
        if (pCard?.type === 'harassment' && !result.spillNullified && state.currentOpponent) {
          const targetDrunk = b.opponentDrunk;
          const targetLevel = get().getDrunkLevel(targetDrunk);
          if (targetLevel >= (pCard.requiredDrunkLevel ?? 0)) {
            const cgEvent = state.currentOpponent.cgEvents.find(e => e.triggerCard === b.selectedCard);
            if (cgEvent) {
              result.cgEvent = cgEvent;
            }
          }
        }

        // CG解放
        if (result.cgEvent) {
          const cgs = [...state.unlockedCGs];
          if (!cgs.includes(result.cgEvent.id)) {
            cgs.push(result.cgEvent.id);
          }
          set({ unlockedCGs: cgs });
        }

        set((state) => ({
          battle: {
            ...state.battle,
            round: state.battle.round + 1,
            playerDrunk: Math.max(0, Math.min(10, state.battle.playerDrunk + result.playerDamage - result.playerHeal)),
            opponentDrunk: Math.max(0, Math.min(10, state.battle.opponentDrunk + result.opponentDamage - result.opponentHeal)),
            playerHand: [],
            opponentHand: [],
            selectedCard: null,
            isProcessing: true,
            opponentDiscardNext: result.opponentDiscardNext ?? state.battle.opponentDiscardNext,
            playerReducedHand: result.playerReducedHand ?? state.battle.playerReducedHand,
            opponentReducedHand: result.opponentReducedHand ?? state.battle.opponentReducedHand,
            spillActive: result.spillNullified,
          },
        }));

        return {
          messages: result.messages,
          cgEvent: result.cgEvent,
          instantWin: result.instantWin,
          opponentCardId,
          playerDamage: result.playerDamage,
          opponentDamage: result.opponentDamage,
          playerHeal: result.playerHeal,
          opponentHeal: result.opponentHeal,
        };
      },

      checkGameEnd: () => {
        const b = get().battle;
        if (b.opponentDrunk >= 10) return 'player_win';
        if (b.playerDrunk >= 10) return 'opponent_win';
        if (b.round >= b.maxRounds) {
          if (b.playerDrunk < b.opponentDrunk) return 'player_win';
          if (b.playerDrunk > b.opponentDrunk) return 'opponent_win';
          return 'draw';
        }
        return null;
      },

      endBattle: (result) => {
        const state = get();
        let reward = 0;
        if (result === 'player_win') {
          reward = state.battle.playerDrunk === 0 ? 800 : 500;
        } else if (result === 'opponent_win') {
          reward = 100;
        } else {
          reward = 200;
        }
        set({
          money: state.money + reward,
          wins: result === 'player_win' ? state.wins + 1 : state.wins,
          losses: result === 'opponent_win' ? state.losses + 1 : state.losses,
        });
        return reward;
      },

      buyCard: (cardId) => {
        const state = get();
        const card = CARD_DATA[cardId];
        if (!card) return false;
        if (state.money < card.price) return false;
        if (state.playerDeck.length >= 12) return false;
        // 同じカードは最大3枚まで
        const sameCount = state.playerDeck.filter(id => id === cardId).length;
        if (sameCount >= 3) return false;

        set({
          money: state.money - card.price,
          playerDeck: [...state.playerDeck, cardId],
        });
        return true;
      },

      sellCard: (index) => {
        const state = get();
        if (index < 0 || index >= state.playerDeck.length) return false;
        if (state.playerDeck.length <= 4) return false;

        const cardId = state.playerDeck[index];
        const card = CARD_DATA[cardId];
        const refund = Math.floor((card?.price ?? 0) / 2);

        const newDeck = [...state.playerDeck];
        newDeck.splice(index, 1);

        set({
          money: state.money + refund,
          playerDeck: newDeck,
        });
        return true;
      },

      showCG: (cg) => set({ activeCG: cg, cgDialogueIndex: 0 }),

      advanceCG: () => {
        const state = get();
        if (!state.activeCG) return;
        if (state.cgDialogueIndex < state.activeCG.dialogue.length - 1) {
          set({ cgDialogueIndex: state.cgDialogueIndex + 1 });
        } else {
          set({ activeCG: null, cgDialogueIndex: 0 });
        }
      },

      closeCG: () => set({ activeCG: null, cgDialogueIndex: 0 }),

      resetData: () => {
        set({
          money: 3200,
          playerDeck: [...DEFAULT_DECK],
          unlockedCGs: [],
          wins: 0,
          losses: 0,
          currentScreen: 'title',
          currentOpponent: null,
          battle: { ...initialBattle },
        });
      },

      getDrunkLevel: (drunkValue) => {
        if (drunkValue >= 10) return 4;
        if (drunkValue >= 7) return 3;
        if (drunkValue >= 4) return 2;
        if (drunkValue >= 2) return 1;
        return 0;
      },
    }),
    {
      name: 'closures_bar_save',
      partialize: (state) => ({
        money: state.money,
        playerDeck: state.playerDeck,
        unlockedCGs: state.unlockedCGs,
        wins: state.wins,
        losses: state.losses,
      }),
    }
  )
);

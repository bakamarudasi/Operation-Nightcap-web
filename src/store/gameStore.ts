import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreenId, BattleState, CharacterDef, CGEvent, AfterEvent, Buff, GachaResult, CardType } from '../data/types.ts';
import { DEFAULT_DECK } from '../data/cards.ts';
import { createBattleSlice } from './battleSlice.ts';
import { createCommerceSlice } from './commerceSlice.ts';

export interface GameStore {
  // 永続データ
  money: number;
  inventory: string[];
  playerDeck: string[];
  unlockedCGs: string[];
  unlockedAfterEvents: string[];
  wins: number;
  losses: number;
  /** カードIDごとの強化レベル（未登録=Lv1） */
  cardLevels: Record<string, number>;
  /** キャラIDごとの勝利数 */
  winsByCharacter: Record<string, number>;

  // UI状態
  currentScreen: ScreenId;
  previousScreen: ScreenId | null;
  currentOpponent: CharacterDef | null;

  // バトル状態
  battle: BattleState;

  // CGオーバーレイ
  activeCG: CGEvent | null;
  cgDialogueIndex: number;

  // 勝利後イベント
  activeAfterEvent: AfterEvent | null;
  afterEventDialogueIndex: number;

  // 画面遷移
  setScreen: (screen: ScreenId) => void;

  // バトル
  updateCurrentOpponent: (char: CharacterDef) => void;
  initBattle: (opponentId: string, characterData: Record<string, CharacterDef>) => void;
  drawHands: () => void;
  selectCard: (cardId: string) => void;
  playRound: () => { messages: string[]; cgEvent: CGEvent | null; opponentCgEvent: CGEvent | null; instantWin: boolean; opponentCardId: string; playerCardId: string; playerDamage: number; opponentDamage: number; playerHeal: number; opponentHeal: number; revealedHand?: string[]; rumorActive?: boolean; playerMisplay: boolean; opponentMisplay: boolean; playerMatchup?: 'advantage' | 'disadvantage' | 'neutral' } | null;
  checkGameEnd: () => 'player_win' | 'opponent_win' | 'draw' | null;
  endBattle: (result: 'player_win' | 'opponent_win' | 'draw') => number;

  // 強化
  enhanceCard: (cardId: string) => boolean;

  // ショップ
  buyCard: (cardId: string) => boolean;
  sellCard: (index: number) => boolean;

  // ガチャ
  pullGacha: (count: 1 | 10) => GachaResult[] | null;

  // CG
  showCG: (cg: CGEvent) => void;
  advanceCG: () => void;
  closeCG: () => void;

  // 勝利後イベント
  checkAfterEvent: () => AfterEvent | null;
  showAfterEvent: (event: AfterEvent) => void;
  advanceAfterEvent: () => void;
  closeAfterEvent: () => void;

  // デッキ管理
  addToDeck: (cardId: string) => boolean;
  removeFromDeck: (index: number) => boolean;

  // 設定
  resetData: () => void;

  // デバッグ
  debugMode: boolean;
  loadDebugPreset: () => void;

}

export const initialBattle: BattleState = {
  round: 0,
  maxRounds: 12,
  playerDrunk: 0,
  opponentDrunk: 0,
  playerDeckRemaining: [],
  opponentDeckRemaining: [],
  playerHand: [],
  opponentHand: [],
  selectedCard: null,
  playerHiddenSlots: [],
  opponentHiddenSlots: [],
  playerBlurredSlot: -1,
  opponentBlurredSlot: -1,
  playerMisplay: false,
  opponentMisplay: false,
  playerCardHistory: [],
  opponentCardHistory: [],
  isProcessing: false,
  opponentDiscardNext: false,
  playerDiscardNext: false,
  opponentDiscardCount: 0,
  playerDiscardCount: 0,
  opponentDiscardHighest: false,
  playerDiscardHighest: false,
  playerReducedHand: false,
  opponentReducedHand: false,
  playerBuffs: [],
  opponentBuffs: [],
  corruptedSlots: [],
  opponentCorruptedSlots: [],
  rumorActive: false,
  playerRumorActive: false,
  playerDiscardPile: [],
  opponentDiscardPile: [],
  swapHandsNextRound: false,
  playerExtraCards: [],
  opponentExtraCards: [],
  playerTransformCard: null,
  opponentTransformCard: null,
  playerSanity: 10,
  opponentSanity: 10,
  playerCardLevels: {},
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // 永続データ
      money: 3200,
      inventory: [...DEFAULT_DECK],
      playerDeck: [...DEFAULT_DECK],
      unlockedCGs: [],
      unlockedAfterEvents: [],
      wins: 0,
      losses: 0,
      cardLevels: {},
      winsByCharacter: {},

      // UI状態
      currentScreen: 'title',
      previousScreen: null,
      currentOpponent: null,

      // バトル
      battle: { ...initialBattle },

      // デバッグ
      debugMode: false,

      // CG
      activeCG: null,
      cgDialogueIndex: 0,

      // 勝利後イベント
      activeAfterEvent: null,
      afterEventDialogueIndex: 0,

      setScreen: (screen) => set((state) => ({
        currentScreen: screen,
        previousScreen: state.currentScreen,
      })),

      updateCurrentOpponent: (char) => set({ currentOpponent: char }),

      // Battle slice (initBattle, drawHands, selectCard, playRound, checkGameEnd, endBattle)
      ...createBattleSlice(set, get),

      // Commerce slice (enhanceCard, buyCard, sellCard, pullGacha, addToDeck, removeFromDeck)
      ...createCommerceSlice(set, get),

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

      // 勝利後イベント
      checkAfterEvent: () => {
        const state = get();
        if (!state.currentOpponent) return null;
        const char = state.currentOpponent;
        const totalCGs = char.cgEvents.length;
        if (totalCGs === 0) return null;
        const cgSet = new Set(state.unlockedCGs);
        const unlockedCount = char.cgEvents.filter(e => cgSet.has(e.id)).length;
        const cgRate = unlockedCount / totalCGs;

        // 条件を満たす未解放の勝利後イベントを探す（最も条件が高いものを優先）
        const charWins = state.winsByCharacter[char.id] ?? 0;
        const afterEventSet = new Set(state.unlockedAfterEvents);
        const eligible = char.afterEvents
          .filter(ae =>
            cgRate >= ae.requiredCGRate &&
            charWins >= ae.requiredWins &&
            !afterEventSet.has(ae.id)
          )
          .sort((a, b) => b.requiredCGRate - a.requiredCGRate);

        return eligible[0] ?? null;
      },

      showAfterEvent: (event) => {
        const state = get();
        const afterEventSet = new Set(state.unlockedAfterEvents);
        afterEventSet.add(event.id);
        set({
          activeAfterEvent: event,
          afterEventDialogueIndex: 0,
          unlockedAfterEvents: afterEventSet.size !== state.unlockedAfterEvents.length
            ? [...afterEventSet]
            : state.unlockedAfterEvents,
        });
      },

      advanceAfterEvent: () => {
        const state = get();
        if (!state.activeAfterEvent) return;
        if (state.afterEventDialogueIndex < state.activeAfterEvent.dialogue.length - 1) {
          set({ afterEventDialogueIndex: state.afterEventDialogueIndex + 1 });
        } else {
          set({ activeAfterEvent: null, afterEventDialogueIndex: 0 });
        }
      },

      closeAfterEvent: () => set({ activeAfterEvent: null, afterEventDialogueIndex: 0 }),

      resetData: () => {
        set({
          money: 3200,
          inventory: [...DEFAULT_DECK],
          playerDeck: [...DEFAULT_DECK],
          unlockedCGs: [],
          unlockedAfterEvents: [],
          wins: 0,
          losses: 0,
          cardLevels: {},
          winsByCharacter: {},
          currentScreen: 'title',
          currentOpponent: null,
          battle: { ...initialBattle },
          debugMode: false,
        });
      },

      loadDebugPreset: () => {
        // セクハラカード全種 + サポートカード
        const harassmentCards = [
          'shoulder_lean', 'headpat', 'breast_touch', 'hip_touch',
          'ear_bite', 'kiss', 'hand_hold', 'doctor_coat',
          'wall_pin', 'piggyback', 'oripathy_check',
        ];
        // デッキ: ハラスメント全種(11) + ペンギンVIPルーム(1) = 12枚
        const debugDeck = [...harassmentCards, 'penguin_vip'];
        // インベントリ: デッキ分 + 追加サポートカード
        const debugInventory = [
          ...debugDeck,
          'excuse', 'dimlight', 'penguin_vip', 'penguin_vip',
          'beer', 'beer', 'beer', 'wine', 'wine', 'whiskey',
        ];
        set({
          money: 99999,
          inventory: debugInventory,
          playerDeck: debugDeck,
          wins: 50,
          cardLevels: { beer: 3, wine: 2, whiskey: 2 },
          debugMode: true,
        });
      },

    }),
    {
      name: 'closures_bar_save',
      partialize: (state) => ({
        money: state.money,
        inventory: state.inventory,
        playerDeck: state.playerDeck,
        unlockedCGs: state.unlockedCGs,
        unlockedAfterEvents: state.unlockedAfterEvents,
        wins: state.wins,
        losses: state.losses,
        cardLevels: state.cardLevels,
        winsByCharacter: state.winsByCharacter,
        debugMode: state.debugMode,
      }),
    }
  )
);

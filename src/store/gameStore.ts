import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreenId, BattleState, CharacterDef, CGEvent, AfterEvent, Buff, GachaResult, CardType } from '../data/types.ts';
import { DEFAULT_DECK, CARD_DATA, getEnhanceCost, MAX_CARD_LEVEL } from '../data/cards.ts';
import { getAffinityLevel, getAffinityBonus } from '../data/affinity.ts';
import { shuffleArray, randomPick, getDrunkLevel, hasBuff, buildCorruptedSlots, shouldMisplay, isFoodDisabled, canPlayCard } from '../engine/utils.ts';
import { computeDrawHands } from '../engine/handManager.ts';
import { BattleEngine, type ExtendedResult } from '../engine/battleEngine.ts';
import { BattleAI } from '../engine/battleAI.ts';
import { applyCorruptedSlotDamage, lookupCGEvents, processRoundBuffs, computeRoundResult, buildNextBattleState } from '../engine/roundProcessor.ts';
import { pullMulti } from '../engine/gachaEngine.ts';
import { GACHA_SINGLE_COST, GACHA_MULTI_COST } from '../data/gacha.ts';

interface GameStore {
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

      initBattle: (opponentId, characterData) => {
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

      selectCard: (cardId) => {
        set((state) => ({
          battle: { ...state.battle, selectedCard: cardId },
        }));
      },

      playRound: () => {
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

      checkGameEnd: () => {
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

      endBattle: (result) => {
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

      enhanceCard: (cardId) => {
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

      buyCard: (cardId) => {
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

      sellCard: (index) => {
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

      pullGacha: (count) => {
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

      addToDeck: (cardId: string) => {
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

      removeFromDeck: (index: number) => {
        const state = get();
        if (index < 0 || index >= state.playerDeck.length) return false;
        if (state.playerDeck.length <= 4) return false; // 最低4枚は維持
        const newDeck = [...state.playerDeck];
        newDeck.splice(index, 1);
        set({ playerDeck: newDeck });
        return true;
      },

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

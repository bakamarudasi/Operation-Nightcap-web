import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreenId, BattleState, CharacterDef, CGEvent, AfterEvent, Buff, GachaResult } from '../data/types.ts';
import { DEFAULT_DECK, CARD_DATA } from '../data/cards.ts';
import { CHARACTER_DATA } from '../data/characters.ts';
import { shuffleArray, randomPick } from '../engine/utils.ts';
import { BattleEngine, tickBuffs, type ExtendedResult } from '../engine/battleEngine.ts';
import { BattleAI } from '../engine/battleAI.ts';
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
  initBattle: (opponentId: string) => void;
  drawHands: () => void;
  selectCard: (cardId: string) => void;
  playRound: () => { messages: string[]; cgEvent: CGEvent | null; opponentCgEvent: CGEvent | null; instantWin: boolean; opponentCardId: string; playerDamage: number; opponentDamage: number; playerHeal: number; opponentHeal: number; revealedHand?: string[]; rumorActive?: boolean } | null;
  checkGameEnd: () => 'player_win' | 'opponent_win' | 'draw' | null;
  endBattle: (result: 'player_win' | 'opponent_win' | 'draw') => number;

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
  playerDiscardNext: false,
  playerReducedHand: false,
  opponentReducedHand: false,
  spillActive: false,
  playerBuffs: [],
  opponentBuffs: [],
  corruptedSlots: [],
  opponentCorruptedSlots: [],
  rumorActive: false,
  playerRumorActive: false,
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

      // UI状態
      currentScreen: 'title',
      previousScreen: null,
      currentOpponent: null,

      // バトル
      battle: { ...initialBattle },

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

          // プレイヤー側の手札破棄
          if (b.playerDiscardNext && pHand.length > 1) {
            const discardIdx = Math.floor(Math.random() * pHand.length);
            const [discardedCard] = pHand.splice(discardIdx, 1);
            pRemaining.push(discardedCard);
          }

          // rumor: 相手の手札1枚をデッキからランダムに差し替え
          if (b.rumorActive && oHand.length > 0 && oRemaining.length > 0) {
            const replaceIdx = Math.floor(Math.random() * oHand.length);
            const replacedCard = oHand[replaceIdx];
            const newCardIdx = Math.floor(Math.random() * oRemaining.length);
            oHand[replaceIdx] = oRemaining[newCardIdx];
            oRemaining[newCardIdx] = replacedCard;
          }

          // playerRumor: プレイヤーの手札1枚をデッキからランダムに差し替え
          if (b.playerRumorActive && pHand.length > 0 && pRemaining.length > 0) {
            const replaceIdx = Math.floor(Math.random() * pHand.length);
            const replacedCard = pHand[replaceIdx];
            const newCardIdx = Math.floor(Math.random() * pRemaining.length);
            pHand[replaceIdx] = pRemaining[newCardIdx];
            pRemaining[newCardIdx] = replacedCard;
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
              playerDiscardNext: false,
              rumorActive: false,
              playerRumorActive: false,
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

        // BUG-006: 汚染カード使用時の自分へのダメージ処理（プレイヤー）
        const selectedIdx = b.playerHand.indexOf(b.selectedCard);
        if (selectedIdx >= 0 && b.corruptedSlots[selectedIdx]) {
          result.playerDamage += 1;
          result.messages.push('🔥 発情状態のカードを使った…自分に酔い+1！');
        }

        // 汚染カード使用時の自傷ダメージ（相手）
        const opSelectedIdx = b.opponentHand.indexOf(opponentCardId);
        if (opSelectedIdx >= 0 && b.opponentCorruptedSlots[opSelectedIdx]) {
          result.opponentDamage += 1;
          result.messages.push('🔥 相手が発情状態のカードを使った…相手に酔い+1！');
        }

        // === プレイヤーのセクハラ成功時 → CGイベント検索 ===
        const pCard = CARD_DATA[b.selectedCard];
        if (pCard?.type === 'harassment' && !result.spillNullified && state.currentOpponent) {
          const targetDrunk = b.opponentDrunk;
          const targetLevel = get().getDrunkLevel(targetDrunk);
          // バフによる必要Lv補正を考慮
          let adjustedRequired = pCard.requiredDrunkLevel ?? 0;
          if (b.playerBuffs.some(bf => bf.id === 'dimlight')) adjustedRequired = Math.max(0, adjustedRequired - 1);
          if (b.playerBuffs.some(bf => bf.id === 'excuse')) adjustedRequired = Math.max(0, adjustedRequired - 1);
          if (targetLevel >= adjustedRequired) {
            const cgEvent = state.currentOpponent.cgEvents.find(e => e.triggerCard === b.selectedCard);
            if (cgEvent) {
              result.cgEvent = cgEvent;
            }
          }
        }

        // === 相手の逆セクハラ成功時 → CGイベント検索 ===
        const oCard = CARD_DATA[opponentCardId];
        let opponentCgEvent: CGEvent | null = null;
        if (oCard?.type === 'harassment' && !result.spillNullified && state.currentOpponent) {
          // BUG-012修正: 相手のセクハラはプレイヤーの酔い度で判定
          const playerDrunk = b.playerDrunk;
          const playerLevel = get().getDrunkLevel(playerDrunk);
          // バフによる必要Lv補正を考慮
          let adjustedRequired = oCard.requiredDrunkLevel ?? 0;
          if (b.opponentBuffs.some(bf => bf.id === 'dimlight')) adjustedRequired = Math.max(0, adjustedRequired - 1);
          if (b.opponentBuffs.some(bf => bf.id === 'excuse')) adjustedRequired = Math.max(0, adjustedRequired - 1);
          if (playerLevel >= adjustedRequired) {
            const cgEvent = state.currentOpponent.cgEvents.find(e => e.triggerCard === opponentCardId);
            if (cgEvent) {
              opponentCgEvent = cgEvent;
            }
          }
        }

        // CG解放（プレイヤー側 + 相手側の両方）
        const cgs = [...state.unlockedCGs];
        if (result.cgEvent && !cgs.includes(result.cgEvent.id)) {
          cgs.push(result.cgEvent.id);
        }
        if (opponentCgEvent && !cgs.includes(opponentCgEvent.id)) {
          cgs.push(opponentCgEvent.id);
        }
        if (cgs.length !== state.unlockedCGs.length) {
          set({ unlockedCGs: cgs });
        }

        // === バフ処理 ===
        // 既存バフのtick（duration減少）
        let newPlayerBuffs = tickBuffs([...b.playerBuffs]);
        let newOpponentBuffs = tickBuffs([...b.opponentBuffs]);

        // 消費型バフの除去（next_drink_boost, next_food_boost, negate_next等）
        const extResult = result as ExtendedResult;
        if (extResult.consumePlayerBuffs) {
          for (const buffId of extResult.consumePlayerBuffs) {
            const idx = newPlayerBuffs.findIndex(bf => bf.id === buffId);
            if (idx >= 0) newPlayerBuffs.splice(idx, 1);
          }
        }
        if (extResult.consumeOpponentBuffs) {
          for (const buffId of extResult.consumeOpponentBuffs) {
            const idx = newOpponentBuffs.findIndex(bf => bf.id === buffId);
            if (idx >= 0) newOpponentBuffs.splice(idx, 1);
          }
        }

        // デバフ除去（クロージャの錠剤等）
        if (extResult.playerCleanseSelf && extResult.playerCleanseSelf > 0) {
          const debuffIds = ['dot', 'tipsy', 'blush', 'atk_down', 'stun', 'no_food', 'corrupted_hand'] as const;
          let remaining = extResult.playerCleanseSelf;
          for (const debuffId of debuffIds) {
            if (remaining <= 0) break;
            const idx = newPlayerBuffs.findIndex(bf => bf.id === debuffId);
            if (idx >= 0) {
              newPlayerBuffs.splice(idx, 1);
              remaining--;
            }
          }
        }

        // dot除去（ガヴィルの薬草スープ等）
        if (extResult.playerCleanseDot) {
          newPlayerBuffs = newPlayerBuffs.filter(bf => bf.id !== 'dot');
        }

        // 今回のラウンドで付与されたバフを追加
        if (result.newPlayerBuffs) {
          newPlayerBuffs = [...newPlayerBuffs, ...result.newPlayerBuffs];
        }
        if (result.newOpponentBuffs) {
          newOpponentBuffs = [...newOpponentBuffs, ...result.newOpponentBuffs];
        }

        // === 手札汚染処理（プレイヤー側） ===
        let corruptedSlots = [...b.corruptedSlots];
        if (result.corruptCount && result.corruptCount > 0) {
          corruptedSlots = [false, false, false, false];
          const indices = [0, 1, 2, 3];
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          for (let i = 0; i < Math.min(result.corruptCount, 4); i++) {
            corruptedSlots[indices[i]] = true;
          }
        }

        // === 手札汚染処理（相手側） ===
        let opponentCorruptedSlots = [...b.opponentCorruptedSlots];
        if (extResult.opponentCorruptCount && extResult.opponentCorruptCount > 0) {
          opponentCorruptedSlots = [false, false, false, false];
          const indices = [0, 1, 2, 3];
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
          }
          for (let i = 0; i < Math.min(extResult.opponentCorruptCount, 4); i++) {
            opponentCorruptedSlots[indices[i]] = true;
          }
        }

        // 使用済みカードを1枚だけ除いた残り手札をデッキに戻す
        const unusedPlayerCards = [...b.playerHand];
        const pIdx = unusedPlayerCards.indexOf(b.selectedCard!);
        if (pIdx >= 0) unusedPlayerCards.splice(pIdx, 1);
        const unusedOpponentCards = [...b.opponentHand];
        const oIdx = unusedOpponentCards.indexOf(opponentCardId);
        if (oIdx >= 0) unusedOpponentCards.splice(oIdx, 1);

        // === 酔いLv入れ替え（プロジェクト・レッドの奇襲） ===
        const shouldSwap = extResult.swapDrunk ?? false;

        // === maxRounds減少（危機契約発令） ===
        const roundReduction = extResult.reduceMaxRounds ?? 0;

        // === 手札破棄フラグ ===
        const discardEnemyCount = extResult.discardEnemyHandCount ?? 0;
        const shouldDiscardHighest = extResult.discardHighest ?? false;
        const discardPlayerCount = extResult.discardPlayerHandCount ?? 0;
        const shouldDiscardPlayerHighest = extResult.discardPlayerHighest ?? false;

        set((state) => {
          const pDeckReturn = [...state.battle.playerDeckRemaining, ...unusedPlayerCards];
          const oDeckReturn = [...state.battle.opponentDeckRemaining, ...unusedOpponentCards];
          shuffleArray(pDeckReturn);
          shuffleArray(oDeckReturn);

          // 酔いLv計算
          let newPlayerDrunk = state.battle.playerDrunk + result.playerDamage - result.playerHeal;
          let newOpponentDrunk = state.battle.opponentDrunk + result.opponentDamage - result.opponentHeal;

          // swap_drunk: 入れ替え（ダメージ適用後に入れ替え）
          if (shouldSwap) {
            [newPlayerDrunk, newOpponentDrunk] = [newOpponentDrunk, newPlayerDrunk];
          }

          newPlayerDrunk = Math.max(0, Math.min(10, newPlayerDrunk));
          newOpponentDrunk = Math.max(0, Math.min(10, newOpponentDrunk));

          // maxRounds減少
          const newMaxRounds = Math.max(state.battle.round + 1, state.battle.maxRounds - roundReduction);

          // opponentDiscardNext: 通常の乾杯強制 or 手札破棄系
          const opDiscard = (result.opponentDiscardNext ?? state.battle.opponentDiscardNext)
            || discardEnemyCount > 0
            || shouldDiscardHighest;

          // playerDiscardNext: 相手の効果でプレイヤーの手札を破棄
          const plDiscard = state.battle.playerDiscardNext
            || discardPlayerCount > 0
            || shouldDiscardPlayerHighest;

          return {
            battle: {
              ...state.battle,
              round: state.battle.round + 1,
              maxRounds: newMaxRounds,
              playerDrunk: newPlayerDrunk,
              opponentDrunk: newOpponentDrunk,
              playerDeckRemaining: pDeckReturn,
              opponentDeckRemaining: oDeckReturn,
              playerHand: [],
              opponentHand: [],
              selectedCard: null,
              isProcessing: true,
              opponentDiscardNext: opDiscard,
              playerDiscardNext: plDiscard,
              playerReducedHand: result.playerReducedHand ?? state.battle.playerReducedHand,
              opponentReducedHand: result.opponentReducedHand ?? state.battle.opponentReducedHand,
              spillActive: result.spillNullified,
              playerBuffs: newPlayerBuffs,
              opponentBuffs: newOpponentBuffs,
              corruptedSlots,
              opponentCorruptedSlots,
              rumorActive: result.rumorActive ?? false,
              playerRumorActive: extResult.playerRumorActive ?? false,
            },
          };
        });

        return {
          messages: result.messages,
          cgEvent: result.cgEvent,
          opponentCgEvent,
          instantWin: result.instantWin,
          opponentCardId,
          playerDamage: result.playerDamage,
          opponentDamage: result.opponentDamage,
          playerHeal: result.playerHeal,
          opponentHeal: result.opponentHeal,
          revealedHand: result.revealedHand,
          rumorActive: result.rumorActive,
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
          reward = state.battle.playerDrunk === 0 ? 1000 : 700;
        } else if (result === 'opponent_win') {
          reward = 200;
        } else {
          reward = 300;
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
        const unlockedCount = char.cgEvents.filter(e => state.unlockedCGs.includes(e.id)).length;
        const cgRate = unlockedCount / totalCGs;

        // 条件を満たす未解放の勝利後イベントを探す（最も条件が高いものを優先）
        const eligible = char.afterEvents
          .filter(ae =>
            cgRate >= ae.requiredCGRate &&
            state.wins >= ae.requiredWins &&
            !state.unlockedAfterEvents.includes(ae.id)
          )
          .sort((a, b) => b.requiredCGRate - a.requiredCGRate);

        return eligible[0] ?? null;
      },

      showAfterEvent: (event) => {
        const state = get();
        const unlocked = [...state.unlockedAfterEvents];
        if (!unlocked.includes(event.id)) {
          unlocked.push(event.id);
        }
        set({
          activeAfterEvent: event,
          afterEventDialogueIndex: 0,
          unlockedAfterEvents: unlocked,
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
        inventory: state.inventory,
        playerDeck: state.playerDeck,
        unlockedCGs: state.unlockedCGs,
        unlockedAfterEvents: state.unlockedAfterEvents,
        wins: state.wins,
        losses: state.losses,
      }),
    }
  )
);

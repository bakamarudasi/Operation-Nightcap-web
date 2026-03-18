import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreenId, BattleState, CharacterDef, CGEvent, AfterEvent, Buff, GachaResult, CardType } from '../data/types.ts';
import { DEFAULT_DECK, CARD_DATA, getEnhanceCost, MAX_CARD_LEVEL } from '../data/cards.ts';
import { getAffinityLevel, getAffinityBonus } from '../data/affinity.ts';
import { shuffleArray, randomPick, POSITIVE_BUFF_IDS, DEBUFF_IDS, findHighestValueCardIndex, getDrunkLevel, hasBuff, buildCorruptedSlots, getHiddenSlotCount, shouldMisplay, isFoodDisabled, canPlayCard } from '../engine/utils.ts';
import { BattleEngine, tickBuffs, getAdjustedRequiredLevel, type ExtendedResult } from '../engine/battleEngine.ts';
import { BattleAI } from '../engine/battleAI.ts';
import { pullMulti } from '../engine/gachaEngine.ts';
import { GACHA_SINGLE_COST, GACHA_MULTI_COST } from '../data/gacha.ts';

/** デバフをN個除去するヘルパー */
function cleanseDebuffs(buffs: Buff[], count: number): Buff[] {
  const result = [...buffs];
  let remaining = count;
  for (const debuffId of DEBUFF_IDS) {
    if (remaining <= 0) break;
    const idx = result.findIndex(bf => bf.id === debuffId);
    if (idx >= 0) {
      result.splice(idx, 1);
      remaining--;
    }
  }
  return result;
}

/** デッキ→手札を引く共通処理 */
function drawFromDeck(
  remaining: string[],
  discard: string[],
  handSize: number,
): { hand: string[]; remaining: string[]; discard: string[] } {
  let rem = [...remaining];
  let disc = [...discard];
  if (rem.length < handSize && disc.length > 0) {
    shuffleArray(disc);
    rem = [...rem, ...disc];
    disc = [];
  }
  const hand: string[] = [];
  const count = Math.min(handSize, rem.length);
  for (let i = 0; i < count; i++) {
    hand.push(rem.shift()!);
  }
  return { hand, remaining: rem, discard: disc };
}

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
        set((state) => {
          const b = { ...state.battle };
          const handSize = b.playerReducedHand ? 3 : 4;
          b.playerReducedHand = false;

          // プレイヤー手札
          const pDraw = drawFromDeck(b.playerDeckRemaining, b.playerDiscardPile, handSize);
          const pHand = pDraw.hand;
          let pRemaining = pDraw.remaining;
          let pDiscard = pDraw.discard;

          // 相手手札
          const oHandSize = b.opponentReducedHand ? 3 : 4;
          b.opponentReducedHand = false;
          const oDraw = drawFromDeck(b.opponentDeckRemaining, b.opponentDiscardPile, oHandSize);
          const oHand = oDraw.hand;
          let oRemaining = oDraw.remaining;
          let oDiscard = oDraw.discard;

          // 手札からランダムN枚を破棄して捨て札へ移す
          const discardRandom = (hand: string[], discard: string[], count: number) => {
            for (let n = 0; n < count && hand.length > 1; n++) {
              const idx = Math.floor(Math.random() * hand.length);
              discard.push(...hand.splice(idx, 1));
            }
          };

          // --- 相手の手札破棄処理（破棄カードは捨て札へ） ---
          if (b.opponentDiscardHighest && oHand.length > 1) {
            oDiscard.push(...oHand.splice(findHighestValueCardIndex(oHand), 1));
          }
          if (b.opponentDiscardCount > 0) discardRandom(oHand, oDiscard, b.opponentDiscardCount);
          if (b.opponentDiscardNext) discardRandom(oHand, oDiscard, 1);

          // --- プレイヤーの手札破棄処理（破棄カードは捨て札へ） ---
          if (b.playerDiscardHighest && pHand.length > 1) {
            pDiscard.push(...pHand.splice(findHighestValueCardIndex(pHand), 1));
          }
          if (b.playerDiscardCount > 0) discardRandom(pHand, pDiscard, b.playerDiscardCount);
          if (b.playerDiscardNext) discardRandom(pHand, pDiscard, 1);

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

          // 手札入れ替え（クロワッサンの手札交換）
          if (b.swapHandsNextRound) {
            const tempHand = [...pHand];
            pHand.length = 0;
            pHand.push(...oHand);
            oHand.length = 0;
            oHand.push(...tempHand);
          }

          // カード変身（ディープカラーの彩筆）— 最強カードを変身
          if (b.opponentTransformCard && oHand.length > 0) {
            oHand[findHighestValueCardIndex(oHand)] = b.opponentTransformCard;
          }
          if (b.playerTransformCard && pHand.length > 0) {
            pHand[findHighestValueCardIndex(pHand)] = b.playerTransformCard;
          }

          // トークンカード追加（Mon3tr等）
          for (const extraId of b.playerExtraCards) {
            pHand.push(extraId);
          }
          for (const extraId of b.opponentExtraCards) {
            oHand.push(extraId);
          }

          const playerDrunkLv = getDrunkLevel(b.playerDrunk);
          const opponentDrunkLv = getDrunkLevel(b.opponentDrunk);
          const playerHiddenCount = getHiddenSlotCount(playerDrunkLv);
          const opponentHiddenCount = getHiddenSlotCount(opponentDrunkLv);
          const pickSlots = (size: number, count: number) => {
            const indices = Array.from({ length: size }, (_, i) => i);
            shuffleArray(indices);
            return indices.slice(0, Math.min(size, count));
          };

          const pHiddenSlots = pickSlots(pHand.length, playerHiddenCount);
          const oHiddenSlots = pickSlots(oHand.length, opponentHiddenCount);

          // ぼやけスロット: hidden以外からランダム1枚
          const pickBlurred = (handLen: number, drunkLv: number, hiddenSlots: number[]): number => {
            if (drunkLv < 1) return -1;
            const avail = Array.from({ length: handLen }, (_, i) => i).filter(i => !hiddenSlots.includes(i));
            return avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : -1;
          };
          const pBlurredSlot = pickBlurred(pHand.length, playerDrunkLv, pHiddenSlots);
          const oBlurredSlot = pickBlurred(oHand.length, opponentDrunkLv, oHiddenSlots);

          // 汚染スロットを実際の手札サイズに合わせる（デッキ枯渇で手札が少ない場合）
          let adjustedCorrupted = b.corruptedSlots;
          if (adjustedCorrupted.length > pHand.length) {
            adjustedCorrupted = adjustedCorrupted.slice(0, pHand.length);
          }
          let adjustedOppCorrupted = b.opponentCorruptedSlots;
          if (adjustedOppCorrupted.length > oHand.length) {
            adjustedOppCorrupted = adjustedOppCorrupted.slice(0, oHand.length);
          }

          return {
            battle: {
              ...b,
              playerDeckRemaining: pRemaining,
              opponentDeckRemaining: oRemaining,
              playerHand: pHand,
              opponentHand: oHand,
              corruptedSlots: adjustedCorrupted,
              opponentCorruptedSlots: adjustedOppCorrupted,
              selectedCard: null,
              playerHiddenSlots: pHiddenSlots,
              opponentHiddenSlots: oHiddenSlots,
              playerBlurredSlot: pBlurredSlot,
              opponentBlurredSlot: oBlurredSlot,
              playerMisplay: false,
              opponentMisplay: false,
              isProcessing: false,
              opponentDiscardNext: false,
              playerDiscardNext: false,
              opponentDiscardCount: 0,
              playerDiscardCount: 0,
              opponentDiscardHighest: false,
              playerDiscardHighest: false,
              rumorActive: false,
              playerRumorActive: false,
              playerDiscardPile: pDiscard,
              opponentDiscardPile: oDiscard,
              swapHandsNextRound: false,
              playerExtraCards: [],
              opponentExtraCards: [],
              playerTransformCard: null,
              opponentTransformCard: null,
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

        const selectedCard = CARD_DATA[b.selectedCard];
        if (!selectedCard) return null;

        const playerDrunkLevel = getDrunkLevel(b.playerDrunk);
        if (!canPlayCard(selectedCard, b.playerDrunk)) return null;
        if (isFoodDisabled(playerDrunkLevel) && selectedCard.type === 'food') return null;

        const aiPick = BattleAI.selectCard(b.opponentHand, state.currentOpponent!, b);
        const opponentCardId = aiPick.cardId;
        if (!opponentCardId) return null;

        let resolvedPlayerCardId = b.selectedCard;
        let playerMisplay = false;
        if (shouldMisplay(playerDrunkLevel) && b.playerHand.length > 1) {
          const alt = b.playerHand.filter(id => id !== b.selectedCard);
          const picked = randomPick(alt);
          if (picked) {
            resolvedPlayerCardId = picked;
            playerMisplay = true;
          }
        }

        const result = BattleEngine.resolveRound(resolvedPlayerCardId, opponentCardId, b);

        // BUG-006: 汚染カード使用時の自分へのダメージ処理（プレイヤー）
        const selectedIdx = b.playerHand.indexOf(resolvedPlayerCardId);
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
        const pCard = CARD_DATA[resolvedPlayerCardId];
        if (pCard?.type === 'harassment') {
          const targetDrunk = b.opponentDrunk;
          const targetLevel = getDrunkLevel(targetDrunk);
          const adjustedRequired = getAdjustedRequiredLevel(pCard.requiredDrunkLevel ?? 0, b.playerBuffs, b.opponentBuffs, !!pCard.instantWin);
          const hasCgEvent = state.currentOpponent?.cgEvents.some(e => e.triggerCard === resolvedPlayerCardId);
          console.log('[CG判定:プレイヤー]', {
            card: resolvedPlayerCardId,
            spillNullified: result.spillNullified,
            targetDrunk, targetLevel, adjustedRequired,
            conditionMet: targetLevel >= adjustedRequired,
            hasCgEvent,
            opponent: state.currentOpponent?.id,
          });
          if (!result.spillNullified && state.currentOpponent) {
            if (targetLevel >= adjustedRequired) {
              const cgEvent = state.currentOpponent.cgEvents.find(e => e.triggerCard === resolvedPlayerCardId);
              if (cgEvent) {
                result.cgEvent = cgEvent;
              }
            }
          }
        }

        // === 相手の逆セクハラ成功時 → CGイベント検索 ===
        const oCard = CARD_DATA[opponentCardId];
        let opponentCgEvent: CGEvent | null = null;
        if (oCard?.type === 'harassment') {
          const playerDrunk = b.playerDrunk;
          const playerLevel = getDrunkLevel(playerDrunk);
          const adjustedRequired = getAdjustedRequiredLevel(oCard.requiredDrunkLevel ?? 0, b.opponentBuffs, b.playerBuffs, !!oCard.instantWin);
          const hasCgEvent = state.currentOpponent?.cgEvents.some(e => e.triggerCard === opponentCardId);
          console.log('[CG判定:相手]', {
            card: opponentCardId,
            spillNullified: result.spillNullified,
            playerDrunk, playerLevel, adjustedRequired,
            conditionMet: playerLevel >= adjustedRequired,
            hasCgEvent,
          });
          if (!result.spillNullified && state.currentOpponent) {
            if (playerLevel >= adjustedRequired) {
              const cgEvent = state.currentOpponent.cgEvents.find(e => e.triggerCard === opponentCardId);
              if (cgEvent) {
                opponentCgEvent = cgEvent;
              }
            }
          }
        }

        // CG解放（プレイヤー側 + 相手側の両方）
        const cgSet = new Set(state.unlockedCGs);
        if (result.cgEvent) cgSet.add(result.cgEvent.id);
        if (opponentCgEvent) cgSet.add(opponentCgEvent.id);
        if (cgSet.size !== state.unlockedCGs.length) {
          set({ unlockedCGs: [...cgSet] });
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
          newPlayerBuffs = cleanseDebuffs(newPlayerBuffs, extResult.playerCleanseSelf);
        }
        if (extResult.playerCleanseDot) {
          newPlayerBuffs = newPlayerBuffs.filter(bf => bf.id !== 'dot');
        }

        // 相手側のデバフ除去
        if (extResult.opponentCleanseSelf && extResult.opponentCleanseSelf > 0) {
          newOpponentBuffs = cleanseDebuffs(newOpponentBuffs, extResult.opponentCleanseSelf);
        }
        if (extResult.opponentCleanseDot) {
          newOpponentBuffs = newOpponentBuffs.filter(bf => bf.id !== 'dot');
        }

        // 敵バフ全除去（レイジの落雷）
        if (extResult.clearAllOpponentBuffs) {
          newOpponentBuffs = newOpponentBuffs.filter(bf => !(POSITIVE_BUFF_IDS as readonly string[]).includes(bf.id));
        }
        if (extResult.clearAllPlayerBuffs) {
          newPlayerBuffs = newPlayerBuffs.filter(bf => !(POSITIVE_BUFF_IDS as readonly string[]).includes(bf.id));
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
          const nextHandSize = (result.playerReducedHand ?? b.playerReducedHand) ? 3 : 4;
          corruptedSlots = buildCorruptedSlots(nextHandSize, result.corruptCount);
        }

        // === 手札汚染処理（相手側） ===
        let opponentCorruptedSlots = [...b.opponentCorruptedSlots];
        if (extResult.opponentCorruptCount && extResult.opponentCorruptCount > 0) {
          const nextOHandSize = (result.opponentReducedHand ?? b.opponentReducedHand) ? 3 : 4;
          opponentCorruptedSlots = buildCorruptedSlots(nextOHandSize, extResult.opponentCorruptCount);
        }

        // 使用済みカードを1枚だけ除いた残り手札をデッキに戻す
        const unusedPlayerCards = [...b.playerHand];
        const pIdx = unusedPlayerCards.indexOf(resolvedPlayerCardId);
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

          // 使用したカードを捨て札に追加
          const pDiscardPile = [...state.battle.playerDiscardPile, resolvedPlayerCardId];
          const oDiscardPile = [...state.battle.opponentDiscardPile, opponentCardId];

          // breast_touch: デッキ内のDrink1枚を捨て札へ送り、Harassment1枚を先頭に移動（枚数維持）
          if (extResult.swapDrinkForHarassment) {
            const harassIdx = pDeckReturn.findIndex(id => CARD_DATA[id]?.type === 'harassment');
            if (harassIdx >= 0) {
              // Harassmentをデッキの先頭に移動（次の手札で引きやすく）
              const [harassCard] = pDeckReturn.splice(harassIdx, 1);
              pDeckReturn.unshift(harassCard);
              // Drinkを1枚捨て札へ移動（デッキ総枚数を維持）
              const drinkIdx = pDeckReturn.findIndex(id => CARD_DATA[id]?.type === 'drink');
              if (drinkIdx >= 0) {
                const [drinkCard] = pDeckReturn.splice(drinkIdx, 1);
                pDiscardPile.push(drinkCard);
              }
            }
          }

          // 酔いLv計算
          let newPlayerDrunk = state.battle.playerDrunk + result.playerDamage - result.playerHeal;
          let newOpponentDrunk = state.battle.opponentDrunk + result.opponentDamage - result.opponentHeal;

          // swap_drunk: 入れ替え（ダメージ適用後に入れ替え）
          if (shouldSwap) {
            [newPlayerDrunk, newOpponentDrunk] = [newOpponentDrunk, newPlayerDrunk];
          }

          newPlayerDrunk = Math.max(0, Math.min(10, newPlayerDrunk));
          newOpponentDrunk = Math.max(0, Math.min(10, newOpponentDrunk));

          // 理性計算
          const charSanityMax = state.currentOpponent?.sanityMax ?? 10;
          let newPlayerSanity = state.battle.playerSanity - result.playerSanityDamage + result.playerSanityHeal;
          let newOpponentSanity = state.battle.opponentSanity - result.opponentSanityDamage + result.opponentSanityHeal;
          newPlayerSanity = Math.max(0, Math.min(10, newPlayerSanity));
          newOpponentSanity = Math.max(0, Math.min(charSanityMax, newOpponentSanity));

          // maxRounds減少
          const newMaxRounds = Math.max(state.battle.round + 1, state.battle.maxRounds - roundReduction);

          // 乾杯強制（toast効果のランダム1枚破棄）
          const opToastDiscard = result.opponentDiscardNext ?? state.battle.opponentDiscardNext;
          const plToastDiscard = result.playerDiscardNext ?? state.battle.playerDiscardNext;

          return {
            battle: {
              ...state.battle,
              round: state.battle.round + 1,
              maxRounds: newMaxRounds,
              playerDrunk: newPlayerDrunk,
              opponentDrunk: newOpponentDrunk,
              playerSanity: newPlayerSanity,
              opponentSanity: newOpponentSanity,
              playerDeckRemaining: pDeckReturn,
              opponentDeckRemaining: oDeckReturn,
              playerHand: [],
              opponentHand: [],
              selectedCard: null,
              isProcessing: true,
              opponentDiscardNext: opToastDiscard,
              playerDiscardNext: plToastDiscard,
              opponentDiscardCount: discardEnemyCount,
              playerDiscardCount: discardPlayerCount,
              opponentDiscardHighest: shouldDiscardHighest,
              playerDiscardHighest: shouldDiscardPlayerHighest,
              playerReducedHand: result.playerReducedHand ?? state.battle.playerReducedHand,
              opponentReducedHand: result.opponentReducedHand ?? state.battle.opponentReducedHand,
              playerBuffs: newPlayerBuffs,
              opponentBuffs: newOpponentBuffs,
              corruptedSlots,
              opponentCorruptedSlots,
              rumorActive: result.rumorActive ?? false,
              playerRumorActive: extResult.playerRumorActive ?? false,
              playerDiscardPile: pDiscardPile,
              opponentDiscardPile: oDiscardPile,
              swapHandsNextRound: extResult.swapHandsNextRound ?? state.battle.swapHandsNextRound,
              playerExtraCards: extResult.playerExtraCard
                ? [...state.battle.playerExtraCards, extResult.playerExtraCard]
                : state.battle.playerExtraCards,
              opponentExtraCards: extResult.opponentExtraCard
                ? [...state.battle.opponentExtraCards, extResult.opponentExtraCard]
                : state.battle.opponentExtraCards,
              playerTransformCard: extResult.transformPlayerCard ?? state.battle.playerTransformCard,
              opponentTransformCard: extResult.transformEnemyCard ?? state.battle.opponentTransformCard,
              playerMisplay,
              opponentMisplay: aiPick.misplay,
              playerCardHistory: [...state.battle.playerCardHistory, CARD_DATA[resolvedPlayerCardId]?.type].filter((x): x is CardType => !!x).slice(-3),
              opponentCardHistory: [...state.battle.opponentCardHistory, CARD_DATA[opponentCardId]?.type].filter((x): x is CardType => !!x).slice(-3),
            },
          };
        });

        return {
          messages: result.messages,
          cgEvent: result.cgEvent,
          opponentCgEvent,
          instantWin: result.instantWin,
          opponentCardId,
          playerCardId: resolvedPlayerCardId,
          playerMisplay,
          opponentMisplay: aiPick.misplay,
          playerMatchup: result.playerMatchup,
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

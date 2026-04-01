/**
 * playRound() から切り出したラウンド後処理ユーティリティ。
 * バフ処理、CG検索、汚染ダメージなど、
 * gameStoreのplayRound内で304行にわたって混在していたロジックを分離。
 */
import { CARD_DATA } from '../data/cards.ts';
import { POSITIVE_BUFF_IDS, DEBUFF_IDS, getDrunkLevel, shouldMisplay, randomPick, isFoodDisabled, canPlayCard, buildCorruptedSlots, shuffleArray } from './utils.ts';
import { BattleEngine, tickBuffs, getAdjustedRequiredLevel, type ExtendedResult } from './battleEngine.ts';
import { BattleAI } from './battleAI.ts';
import type { Buff, BattleState, CGEvent, CharacterDef, RoundResult, CardType } from '../data/types.ts';

// ──────────────────────────────────────────────
// 1. 汚染スロットダメージ
// ──────────────────────────────────────────────

/** 汚染カード使用時の自傷ダメージを result に反映する */
export function applyCorruptedSlotDamage(
  result: RoundResult,
  playerCardId: string,
  opponentCardId: string,
  battle: BattleState,
): void {
  // プレイヤー側
  const selectedIdx = battle.playerHand.indexOf(playerCardId);
  if (selectedIdx >= 0 && battle.corruptedSlots[selectedIdx]) {
    result.playerDamage += 1;
    result.messages.push('🔥 発情状態のカードを使った…自分に酔い+1！');
  }

  // 相手側
  const opSelectedIdx = battle.opponentHand.indexOf(opponentCardId);
  if (opSelectedIdx >= 0 && battle.opponentCorruptedSlots[opSelectedIdx]) {
    result.opponentDamage += 1;
    result.messages.push('🔥 相手が発情状態のカードを使った…相手に酔い+1！');
  }
}

// ──────────────────────────────────────────────
// 2. CG イベント検索
// ──────────────────────────────────────────────

export interface CGLookupResult {
  playerCgEvent: CGEvent | null;
  opponentCgEvent: CGEvent | null;
}

/** プレイヤー・相手のセクハラカードに対応するCGイベントを検索 */
export function lookupCGEvents(
  result: RoundResult,
  playerCardId: string,
  opponentCardId: string,
  battle: BattleState,
  currentOpponent: CharacterDef | null,
): CGLookupResult {
  let playerCgEvent: CGEvent | null = null;
  let opponentCgEvent: CGEvent | null = null;

  if (!currentOpponent) return { playerCgEvent, opponentCgEvent };

  // プレイヤーのセクハラ成功時
  const pCard = CARD_DATA[playerCardId];
  if (pCard?.type === 'harassment' && !result.spillNullified) {
    const targetLevel = getDrunkLevel(battle.opponentDrunk);
    const adjustedRequired = getAdjustedRequiredLevel(
      pCard.requiredDrunkLevel ?? 0,
      battle.playerBuffs,
      battle.opponentBuffs,
      !!pCard.instantWin,
    );
    if (targetLevel >= adjustedRequired) {
      playerCgEvent = currentOpponent.cgEvents.find(e => e.triggerCard === playerCardId) ?? null;
    }
  }

  // 相手のセクハラ成功時
  const oCard = CARD_DATA[opponentCardId];
  if (oCard?.type === 'harassment' && !result.spillNullified) {
    const playerLevel = getDrunkLevel(battle.playerDrunk);
    const adjustedRequired = getAdjustedRequiredLevel(
      oCard.requiredDrunkLevel ?? 0,
      battle.opponentBuffs,
      battle.playerBuffs,
      !!oCard.instantWin,
    );
    if (playerLevel >= adjustedRequired) {
      opponentCgEvent = currentOpponent.cgEvents.find(e => e.triggerCard === opponentCardId) ?? null;
    }
  }

  return { playerCgEvent, opponentCgEvent };
}

// ──────────────────────────────────────────────
// 3. バフ処理
// ──────────────────────────────────────────────

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

export interface ProcessedBuffs {
  playerBuffs: Buff[];
  opponentBuffs: Buff[];
}

/**
 * ラウンド結果に基づいてバフを一括処理する。
 * 1. 既存バフのtick（duration減少）
 * 2. 消費型バフの除去
 * 3. デバフ除去（クレンズ）
 * 4. 全バフ除去
 * 5. 新規バフの付与
 */
export function processRoundBuffs(
  result: RoundResult,
  currentPlayerBuffs: Buff[],
  currentOpponentBuffs: Buff[],
): ProcessedBuffs {
  const extResult = result as ExtendedResult;

  // 1. 既存バフのtick
  let playerBuffs = tickBuffs([...currentPlayerBuffs]);
  let opponentBuffs = tickBuffs([...currentOpponentBuffs]);

  // 2. 消費型バフの除去
  if (extResult.consumePlayerBuffs) {
    for (const buffId of extResult.consumePlayerBuffs) {
      const idx = playerBuffs.findIndex(bf => bf.id === buffId);
      if (idx >= 0) playerBuffs.splice(idx, 1);
    }
  }
  if (extResult.consumeOpponentBuffs) {
    for (const buffId of extResult.consumeOpponentBuffs) {
      const idx = opponentBuffs.findIndex(bf => bf.id === buffId);
      if (idx >= 0) opponentBuffs.splice(idx, 1);
    }
  }

  // 3. デバフ除去
  if (extResult.playerCleanseSelf && extResult.playerCleanseSelf > 0) {
    playerBuffs = cleanseDebuffs(playerBuffs, extResult.playerCleanseSelf);
  }
  if (extResult.playerCleanseDot) {
    playerBuffs = playerBuffs.filter(bf => bf.id !== 'dot');
  }
  if (extResult.opponentCleanseSelf && extResult.opponentCleanseSelf > 0) {
    opponentBuffs = cleanseDebuffs(opponentBuffs, extResult.opponentCleanseSelf);
  }
  if (extResult.opponentCleanseDot) {
    opponentBuffs = opponentBuffs.filter(bf => bf.id !== 'dot');
  }

  // 4. 全バフ除去
  if (extResult.clearAllOpponentBuffs) {
    opponentBuffs = opponentBuffs.filter(bf => !(POSITIVE_BUFF_IDS as readonly string[]).includes(bf.id));
  }
  if (extResult.clearAllPlayerBuffs) {
    playerBuffs = playerBuffs.filter(bf => !(POSITIVE_BUFF_IDS as readonly string[]).includes(bf.id));
  }

  // 5. 新規バフ付与
  if (result.newPlayerBuffs) {
    playerBuffs = [...playerBuffs, ...result.newPlayerBuffs];
  }
  if (result.newOpponentBuffs) {
    opponentBuffs = [...opponentBuffs, ...result.newOpponentBuffs];
  }

  return { playerBuffs, opponentBuffs };
}

// ──────────────────────────────────────────────
// 4. computeRoundResult — 純粋なラウンド計算
// ──────────────────────────────────────────────

export interface RoundComputeInput {
  battle: BattleState;
  currentOpponent: CharacterDef | null;
  unlockedCGs: string[];
}

export interface RoundComputeOutput {
  result: ExtendedResult;
  resolvedPlayerCardId: string;
  opponentCardId: string;
  playerMisplay: boolean;
  opponentMisplay: boolean;
  corruptedSlots: boolean[];
  opponentCorruptedSlots: boolean[];
  playerCgEvent: CGEvent | null;
  opponentCgEvent: CGEvent | null;
  newUnlockedCGs: string[];
  unusedPlayerCards: string[];
  unusedOpponentCards: string[];
  newPlayerBuffs: Buff[];
  newOpponentBuffs: Buff[];
}

/**
 * playRound のオーケストレーション前半: 検証→AI選択→resolveRound→
 * 汚染ダメージ→CG検索→バフ処理→汚染スロット計算→未使用カード計算。
 * 検証失敗時は null を返す。
 */
export function computeRoundResult(input: RoundComputeInput): RoundComputeOutput | null {
  const { battle: b, currentOpponent, unlockedCGs } = input;

  if (!b.selectedCard || b.isProcessing) return null;

  const selectedCard = CARD_DATA[b.selectedCard];
  if (!selectedCard) return null;

  const playerDrunkLevel = getDrunkLevel(b.playerDrunk);
  if (!canPlayCard(selectedCard, b.playerDrunk)) return null;
  if (isFoodDisabled(playerDrunkLevel) && selectedCard.type === 'food') return null;

  const aiPick = BattleAI.selectCard(b.opponentHand, currentOpponent!, b);
  const opponentCardId = aiPick.cardId;
  if (!opponentCardId) return null;

  // ミスプレイ判定
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

  // ラウンド解決
  const result = BattleEngine.resolveRound(resolvedPlayerCardId, opponentCardId, b);

  // 汚染スロットの自傷ダメージ適用
  applyCorruptedSlotDamage(result, resolvedPlayerCardId, opponentCardId, b);

  // CGイベント検索
  const cgLookup = lookupCGEvents(result, resolvedPlayerCardId, opponentCardId, b, currentOpponent);
  if (cgLookup.playerCgEvent) result.cgEvent = cgLookup.playerCgEvent;
  const opponentCgEvent = cgLookup.opponentCgEvent;

  // CG解放
  const cgSet = new Set(unlockedCGs);
  if (result.cgEvent) cgSet.add(result.cgEvent.id);
  if (opponentCgEvent) cgSet.add(opponentCgEvent.id);
  const newUnlockedCGs = cgSet.size !== unlockedCGs.length ? [...cgSet] : unlockedCGs;

  // バフ一括処理
  const { playerBuffs: newPlayerBuffs, opponentBuffs: newOpponentBuffs } =
    processRoundBuffs(result, b.playerBuffs, b.opponentBuffs);
  const extResult = result as ExtendedResult;

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

  return {
    result: extResult,
    resolvedPlayerCardId,
    opponentCardId,
    playerMisplay,
    opponentMisplay: aiPick.misplay,
    corruptedSlots,
    opponentCorruptedSlots,
    playerCgEvent: cgLookup.playerCgEvent,
    opponentCgEvent,
    newUnlockedCGs,
    unusedPlayerCards,
    unusedOpponentCards,
    newPlayerBuffs,
    newOpponentBuffs,
  };
}

// ──────────────────────────────────────────────
// 5. buildNextBattleState — set()内の状態構築を純粋関数化
// ──────────────────────────────────────────────

/**
 * computeRoundResult の結果から、次ラウンドの BattleState 差分を構築する。
 * shuffleArray は副作用を持つが、デッキ順序のランダム化のみ。
 */
export function buildNextBattleState(
  currentBattle: BattleState,
  computed: RoundComputeOutput,
  currentOpponent: CharacterDef | null,
): Partial<BattleState> {
  const { result, resolvedPlayerCardId, opponentCardId, unusedPlayerCards, unusedOpponentCards,
    playerMisplay, opponentMisplay, corruptedSlots, opponentCorruptedSlots,
    newPlayerBuffs, newOpponentBuffs } = computed;

  const pDeckReturn = [...currentBattle.playerDeckRemaining, ...unusedPlayerCards];
  const oDeckReturn = [...currentBattle.opponentDeckRemaining, ...unusedOpponentCards];
  shuffleArray(pDeckReturn);
  shuffleArray(oDeckReturn);

  // 使用したカードを捨て札に追加
  const pDiscardPile = [...currentBattle.playerDiscardPile, resolvedPlayerCardId];
  const oDiscardPile = [...currentBattle.opponentDiscardPile, opponentCardId];

  // breast_touch: デッキ内のDrink1枚を捨て札へ送り、Harassment1枚を先頭に移動
  if (result.swapDrinkForHarassment) {
    const harassIdx = pDeckReturn.findIndex(id => CARD_DATA[id]?.type === 'harassment');
    if (harassIdx >= 0) {
      const [harassCard] = pDeckReturn.splice(harassIdx, 1);
      pDeckReturn.unshift(harassCard);
      const drinkIdx = pDeckReturn.findIndex(id => CARD_DATA[id]?.type === 'drink');
      if (drinkIdx >= 0) {
        const [drinkCard] = pDeckReturn.splice(drinkIdx, 1);
        pDiscardPile.push(drinkCard);
      }
    }
  }

  // 酔いLv計算
  let newPlayerDrunk = currentBattle.playerDrunk + result.playerDamage - result.playerHeal;
  let newOpponentDrunk = currentBattle.opponentDrunk + result.opponentDamage - result.opponentHeal;

  // swap_drunk: 入れ替え（ダメージ適用後に入れ替え）
  const shouldSwap = result.swapDrunk ?? false;
  if (shouldSwap) {
    [newPlayerDrunk, newOpponentDrunk] = [newOpponentDrunk, newPlayerDrunk];
  }

  newPlayerDrunk = Math.max(0, Math.min(10, newPlayerDrunk));
  newOpponentDrunk = Math.max(0, Math.min(10, newOpponentDrunk));

  // 理性計算
  const charSanityMax = currentOpponent?.sanityMax ?? 10;
  let newPlayerSanity = currentBattle.playerSanity - result.playerSanityDamage + result.playerSanityHeal;
  let newOpponentSanity = currentBattle.opponentSanity - result.opponentSanityDamage + result.opponentSanityHeal;
  newPlayerSanity = Math.max(0, Math.min(10, newPlayerSanity));
  newOpponentSanity = Math.max(0, Math.min(charSanityMax, newOpponentSanity));

  // maxRounds減少
  const roundReduction = result.reduceMaxRounds ?? 0;
  const newMaxRounds = Math.max(currentBattle.round + 1, currentBattle.maxRounds - roundReduction);

  // 手札破棄フラグ
  const discardEnemyCount = result.discardEnemyHandCount ?? 0;
  const shouldDiscardHighest = result.discardHighest ?? false;
  const discardPlayerCount = result.discardPlayerHandCount ?? 0;
  const shouldDiscardPlayerHighest = result.discardPlayerHighest ?? false;

  // 乾杯強制
  const opToastDiscard = result.opponentDiscardNext ?? currentBattle.opponentDiscardNext;
  const plToastDiscard = result.playerDiscardNext ?? currentBattle.playerDiscardNext;

  return {
    round: currentBattle.round + 1,
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
    playerReducedHand: result.playerReducedHand ?? currentBattle.playerReducedHand,
    opponentReducedHand: result.opponentReducedHand ?? currentBattle.opponentReducedHand,
    playerBuffs: newPlayerBuffs,
    opponentBuffs: newOpponentBuffs,
    corruptedSlots,
    opponentCorruptedSlots,
    rumorActive: result.rumorActive ?? false,
    playerRumorActive: result.playerRumorActive ?? false,
    playerDiscardPile: pDiscardPile,
    opponentDiscardPile: oDiscardPile,
    swapHandsNextRound: result.swapHandsNextRound ?? currentBattle.swapHandsNextRound,
    playerExtraCards: result.playerExtraCard
      ? [...currentBattle.playerExtraCards, result.playerExtraCard]
      : currentBattle.playerExtraCards,
    opponentExtraCards: result.opponentExtraCard
      ? [...currentBattle.opponentExtraCards, result.opponentExtraCard]
      : currentBattle.opponentExtraCards,
    playerTransformCard: result.transformPlayerCard ?? currentBattle.playerTransformCard,
    opponentTransformCard: result.transformEnemyCard ?? currentBattle.opponentTransformCard,
    playerMisplay,
    opponentMisplay,
    playerCardHistory: [...currentBattle.playerCardHistory, CARD_DATA[resolvedPlayerCardId]?.type].filter((x): x is CardType => !!x).slice(-3),
    opponentCardHistory: [...currentBattle.opponentCardHistory, CARD_DATA[opponentCardId]?.type].filter((x): x is CardType => !!x).slice(-3),
  };
}

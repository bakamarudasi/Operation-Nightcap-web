import type { BattleState } from '../data/types.ts';
import { shuffleArray, randomPick, randomIndex, findHighestValueCardIndex, getDrunkLevel, getHiddenSlotCount } from './utils.ts';

// ============================================
// === drawHands 純粋関数ヘルパー群 ===
// ============================================

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

/** 手札からランダムN枚を破棄して捨て札へ移す */
function discardRandomCards(hand: string[], discard: string[], count: number): void {
  for (let n = 0; n < count && hand.length > 1; n++) {
    const idx = randomIndex(hand);
    discard.push(...hand.splice(idx, 1));
  }
}

/** 手札の破棄処理（最強カード破棄 / N枚破棄 / 乾杯破棄）を適用 */
function applyDiscards(
  hand: string[],
  discard: string[],
  opts: { discardHighest: boolean; discardCount: number; discardNext: boolean },
): void {
  if (opts.discardHighest && hand.length > 1) {
    discard.push(...hand.splice(findHighestValueCardIndex(hand), 1));
  }
  if (opts.discardCount > 0) discardRandomCards(hand, discard, opts.discardCount);
  if (opts.discardNext) discardRandomCards(hand, discard, 1);
}

/** rumor / swap / transform / extraCards の手札変更を適用 */
function applyHandModifications(
  pHand: string[], oHand: string[],
  pRemaining: string[], oRemaining: string[],
  battle: BattleState,
): void {
  // rumor: 相手の手札1枚をデッキからランダムに差し替え
  if (battle.rumorActive && oHand.length > 0 && oRemaining.length > 0) {
    const replaceIdx = randomIndex(oHand);
    const replacedCard = oHand[replaceIdx];
    const newCardIdx = randomIndex(oRemaining);
    oHand[replaceIdx] = oRemaining[newCardIdx];
    oRemaining[newCardIdx] = replacedCard;
  }

  // playerRumor: プレイヤーの手札1枚をデッキからランダムに差し替え
  if (battle.playerRumorActive && pHand.length > 0 && pRemaining.length > 0) {
    const replaceIdx = randomIndex(pHand);
    const replacedCard = pHand[replaceIdx];
    const newCardIdx = randomIndex(pRemaining);
    pHand[replaceIdx] = pRemaining[newCardIdx];
    pRemaining[newCardIdx] = replacedCard;
  }

  // 手札入れ替え（クロワッサンの手札交換）
  if (battle.swapHandsNextRound) {
    const tempHand = [...pHand];
    pHand.length = 0;
    pHand.push(...oHand);
    oHand.length = 0;
    oHand.push(...tempHand);
  }

  // カード変身（ディープカラーの彩筆）— 最強カードを変身
  if (battle.opponentTransformCard && oHand.length > 0) {
    oHand[findHighestValueCardIndex(oHand)] = battle.opponentTransformCard;
  }
  if (battle.playerTransformCard && pHand.length > 0) {
    pHand[findHighestValueCardIndex(pHand)] = battle.playerTransformCard;
  }

  // トークンカード追加（Mon3tr等）
  for (const extraId of battle.playerExtraCards) {
    pHand.push(extraId);
  }
  for (const extraId of battle.opponentExtraCards) {
    oHand.push(extraId);
  }
}

/** hidden / blurred / corrupted スロットを計算 */
function calculateVisibilitySlots(
  hand: string[],
  drunkLevel: number,
  corruptedSlots: boolean[],
): { hiddenSlots: number[]; blurredSlot: number; adjustedCorrupted: boolean[] } {
  const hiddenCount = getHiddenSlotCount(drunkLevel);
  const indices = Array.from({ length: hand.length }, (_, i) => i);
  shuffleArray(indices);
  const hiddenSlots = indices.slice(0, Math.min(hand.length, hiddenCount));

  // ぼやけスロット: hidden以外からランダム1枚
  let blurredSlot = -1;
  if (drunkLevel >= 1) {
    const avail = Array.from({ length: hand.length }, (_, i) => i).filter(i => !hiddenSlots.includes(i));
    blurredSlot = avail.length > 0 ? (randomPick(avail) ?? -1) : -1;
  }

  // 汚染スロットを実際の手札サイズに合わせる
  const adjustedCorrupted = corruptedSlots.length > hand.length
    ? corruptedSlots.slice(0, hand.length)
    : corruptedSlots;

  return { hiddenSlots, blurredSlot, adjustedCorrupted };
}

/** drawHands の純粋関数版: BattleState を受け取り、新しい手札関連の差分を返す */
export function computeDrawHands(battle: BattleState): Partial<BattleState> {
  const b = { ...battle };

  // ステップ1: デッキから手札を引く
  const pHandSize = b.playerReducedHand ? 3 : 4;
  const oHandSize = b.opponentReducedHand ? 3 : 4;
  const pDraw = drawFromDeck(b.playerDeckRemaining, b.playerDiscardPile, pHandSize);
  const oDraw = drawFromDeck(b.opponentDeckRemaining, b.opponentDiscardPile, oHandSize);
  const pHand = pDraw.hand;
  const oHand = oDraw.hand;
  const pRemaining = pDraw.remaining;
  const oRemaining = oDraw.remaining;
  const pDiscard = pDraw.discard;
  const oDiscard = oDraw.discard;

  // ステップ2: 手札の破棄処理
  applyDiscards(oHand, oDiscard, {
    discardHighest: b.opponentDiscardHighest,
    discardCount: b.opponentDiscardCount,
    discardNext: b.opponentDiscardNext,
  });
  applyDiscards(pHand, pDiscard, {
    discardHighest: b.playerDiscardHighest,
    discardCount: b.playerDiscardCount,
    discardNext: b.playerDiscardNext,
  });

  // ステップ3: rumor / swap / transform / extra cards
  applyHandModifications(pHand, oHand, pRemaining, oRemaining, b);

  // ステップ4: 視認性スロット計算
  const pVis = calculateVisibilitySlots(pHand, getDrunkLevel(b.playerDrunk), b.corruptedSlots);
  const oVis = calculateVisibilitySlots(oHand, getDrunkLevel(b.opponentDrunk), b.opponentCorruptedSlots);

  return {
    playerDeckRemaining: pRemaining,
    opponentDeckRemaining: oRemaining,
    playerHand: pHand,
    opponentHand: oHand,
    corruptedSlots: pVis.adjustedCorrupted,
    opponentCorruptedSlots: oVis.adjustedCorrupted,
    selectedCard: null,
    playerHiddenSlots: pVis.hiddenSlots,
    opponentHiddenSlots: oVis.hiddenSlots,
    playerBlurredSlot: pVis.blurredSlot,
    opponentBlurredSlot: oVis.blurredSlot,
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
    playerReducedHand: false,
    opponentReducedHand: false,
  };
}

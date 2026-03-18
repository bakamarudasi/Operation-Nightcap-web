/**
 * playRound() から切り出したラウンド後処理ユーティリティ。
 * バフ処理、CG検索、汚染ダメージなど、
 * gameStoreのplayRound内で304行にわたって混在していたロジックを分離。
 */
import { CARD_DATA } from '../data/cards.ts';
import { POSITIVE_BUFF_IDS, DEBUFF_IDS, getDrunkLevel } from './utils.ts';
import { tickBuffs, getAdjustedRequiredLevel, type ExtendedResult } from './battleEngine.ts';
import type { Buff, BattleState, CGEvent, CharacterDef, RoundResult } from '../data/types.ts';

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

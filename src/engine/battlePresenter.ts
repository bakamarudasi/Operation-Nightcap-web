/**
 * BattleScreen用のプレゼンテーションヘルパー
 * コンポーネントからCARD_DATAへの直接依存を削減し、
 * カード表示情報の構築ロジックを一箇所に集約する。
 */
import { CARD_DATA } from '../data/cards.ts';
import type { TFunction } from 'i18next';

export interface CardDisplayInfo {
  id: string;
  emoji: string;
  name: string;
  val: string;
}

/** カードIDからフィールド表示用の情報を構築 */
export function buildCardDisplayInfo(cardId: string, t: TFunction): CardDisplayInfo | null {
  const card = CARD_DATA[cardId];
  if (!card) return null;

  let val: string;
  switch (card.type) {
    case 'food':
      val = card.heal === 99 ? '+MAX' : `+${card.heal ?? 0}`;
      break;
    case 'drink':
      val = card.damage === -1 ? '1~3' : `${card.damage}`;
      break;
    default:
      val = '';
  }

  return {
    id: cardId,
    emoji: card.emoji,
    name: t(`cards.${card.id}.name`, card.name),
    val,
  };
}

/** 相手カード表示用（ダメージ表示が ? になる等の違い） */
export function buildOpponentCardDisplayInfo(cardId: string, t: TFunction): CardDisplayInfo | null {
  const card = CARD_DATA[cardId];
  if (!card) return null;

  let val: string;
  switch (card.type) {
    case 'food':
      val = card.heal === 99 ? '+MAX' : `+${card.heal ?? 0}`;
      break;
    case 'drink':
      val = card.damage === -1 ? '?' : `${card.damage}`;
      break;
    case 'chug':
    case 'harassment':
      val = t('battle.special');
      break;
    default:
      val = '';
  }

  return {
    id: cardId,
    emoji: card.emoji,
    name: t(`cards.${card.id}.name`, card.name),
    val,
  };
}

export interface RoundOutcome {
  oppNetDamage: number;
  plNetDamage: number;
  roundResultType: 'win' | 'lose' | 'draw';
  reaction: string | null;
}

/** ラウンド結果の数値からUI表示用のアウトカムを計算 */
export function computeRoundOutcome(result: {
  opponentDamage: number;
  opponentHeal: number;
  playerDamage: number;
  playerHeal: number;
}): RoundOutcome {
  const oppNetDamage = result.opponentDamage - result.opponentHeal;
  const plNetDamage = result.playerDamage - result.playerHeal;

  let roundResultType: 'win' | 'lose' | 'draw';
  if (oppNetDamage > plNetDamage) {
    roundResultType = 'win';
  } else if (plNetDamage > oppNetDamage) {
    roundResultType = 'lose';
  } else {
    roundResultType = 'draw';
  }

  let reaction: string | null = null;
  if (oppNetDamage > 0 && oppNetDamage >= plNetDamage) {
    reaction = '😵';
  } else if (plNetDamage > 0) {
    reaction = '😏';
  }

  return { oppNetDamage, plNetDamage, roundResultType, reaction };
}

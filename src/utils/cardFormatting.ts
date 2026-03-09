import type { CardDef } from '../data/types.ts';
import { FULL_HEAL } from '../data/cards.ts';

/** カードの攻撃力を表示用にフォーマット */
export function formatDamage(damage: number | undefined): string {
  if (damage === undefined) return '';
  return damage === -1 ? '1~3' : String(damage);
}

/** カードの回復力を表示用にフォーマット */
export function formatHeal(heal: number | undefined): string {
  if (heal === undefined) return '';
  return heal === FULL_HEAL ? 'MAX' : String(heal);
}

/** カードの概要テキストを取得（デッキ画面・手札用） */
export function formatCardStat(card: CardDef): string {
  switch (card.type) {
    case 'drink':
      return `攻${formatDamage(card.damage)}`;
    case 'food':
      return `回${formatHeal(card.heal)}`;
    case 'harassment':
      return `Lv${card.requiredDrunkLevel}`;
    default:
      return '特殊';
  }
}

/** カードの値テキストを取得（バトル手札表示用） */
export function formatCardValue(card: CardDef): string {
  switch (card.type) {
    case 'food':
      return card.heal === FULL_HEAL ? 'MAX回復' : `回復 ${card.heal}`;
    case 'drink':
      return formatDamage(card.damage);
    case 'chug':
    case 'harassment':
      return '特殊';
    default:
      return '';
  }
}

/** カードのフィールド表示テキスト（プレイヤーカード用） */
export function formatFieldValue(card: CardDef): string {
  switch (card.type) {
    case 'food':
      return card.heal === FULL_HEAL ? '+MAX' : `+${card.heal ?? 0}`;
    case 'drink':
      return formatDamage(card.damage);
    default:
      return '';
  }
}

/** カードのフィールド表示テキスト（相手カード用） */
export function formatOppFieldValue(card: CardDef): string {
  switch (card.type) {
    case 'food':
      return card.heal === FULL_HEAL ? '+MAX' : `+${card.heal ?? 0}`;
    case 'drink':
      return card.damage === -1 ? '?' : String(card.damage);
    case 'chug':
    case 'harassment':
      return '特殊';
    default:
      return '';
  }
}

/** インベントリ表示用の説明テキスト */
export function formatInventoryDesc(card: CardDef): string {
  switch (card.type) {
    case 'drink':
      return `攻撃 ${formatDamage(card.damage)}`;
    case 'food':
      return `回復 ${formatHeal(card.heal)}`;
    case 'harassment':
      return `酔Lv${card.requiredDrunkLevel} 酔+${card.drunkDamage ?? 0}`;
    default:
      return card.description.substring(0, 20);
  }
}

/** 公開カードの種別テキスト */
export function formatRevealedType(card: CardDef): string {
  switch (card.type) {
    case 'drink':
      return `攻撃 ${formatDamage(card.damage)}`;
    case 'food':
      return `回復 ${card.heal}`;
    case 'chug':
      return '一気飲み';
    case 'harassment':
      return 'セクハラ';
    case 'strategy':
      return '戦略';
    case 'environment':
      return '環境';
    default:
      return '状態異常';
  }
}

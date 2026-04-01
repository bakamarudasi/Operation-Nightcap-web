import type { CardDef } from '../data/types.ts';

/**
 * カードのダメージ値を表示用文字列に変換する。
 * damage === -1 はランダム1~3を意味する。
 */
export function formatDamage(card: Pick<CardDef, 'damage'>): string {
  return card.damage === -1 ? '1~3' : `${card.damage ?? 0}`;
}

/**
 * カードの回復値を表示用文字列に変換する。
 * heal === 99 は全回復(MAX)を意味する。
 */
export function formatHeal(card: Pick<CardDef, 'heal'>): string {
  return card.heal === 99 ? 'MAX' : `${card.heal ?? 0}`;
}

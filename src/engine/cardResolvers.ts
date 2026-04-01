import type { Buff, CardDef } from '../data/types.ts';
import { getCardDamage } from '../data/cards.ts';
import { hasBuff, getBuffMessage } from './utils.ts';
import { t, cn } from './battleTypes.ts';
import type { ExtendedResult, CardResolveContext, UtilityContext } from './battleTypes.ts';
import { applyDrinkBuffs, applyFoodBuffs, applyCardExtras, trackBuffConsumption } from './buffSystem.ts';

/**
 * ドリンクカード1枚の効果を解決する。
 * ダメージ計算 → result に加算 → メッセージ追加 → 追加効果 → バフ消費記録。
 * @returns 計算後のダメージ値（drink vs drink の差分計算に使用）
 */
export function resolveDrinkCard(ctx: CardResolveContext): number {
  const { card, user, result, battle, halvesDrink } = ctx;
  const isPlayer = user === 'player';
  const attackerBuffs = isPlayer ? battle.playerBuffs : battle.opponentBuffs;
  const defenderBuffs = isPlayer ? battle.opponentBuffs : battle.playerBuffs;
  let dmg = applyDrinkBuffs(getCardDamage(card), attackerBuffs, defenderBuffs);
  if (halvesDrink) dmg = Math.floor(dmg * 0.5);

  if (isPlayer) {
    result.opponentDamage += dmg;
  } else {
    result.playerDamage += dmg;
  }
  result.messages.push(t('engine.drink.damage', { emoji: card.emoji, name: cn(card), value: dmg }));
  applyCardExtras(card, result, user);
  if (hasBuff(attackerBuffs, 'next_drink_boost')) {
    trackBuffConsumption(result, user, 'next_drink_boost');
  }
  return dmg;
}

/**
 * フードカード1枚の効果を解決する。
 * no_food チェック → 回復量計算 → result に加算 → メッセージ追加 → 追加効果。
 * @param incomingDamage ドリンクとの対戦時、受けたダメージを加味した完全回復計算用
 * @param msgKey メッセージの翻訳キー（相手フードなど区別用）
 */
export function resolveFoodCard(ctx: CardResolveContext, incomingDamage: number = 0, msgKey: string = 'engine.food.heal'): boolean {
  const { card, user, result, battle, halvesFood } = ctx;
  const isPlayer = user === 'player';
  const userBuffs = isPlayer ? battle.playerBuffs : battle.opponentBuffs;

  if (hasBuff(userBuffs, 'no_food')) {
    const blockedKey = isPlayer ? 'engine.food.blocked.self' : 'engine.food.blocked.opponent';
    result.messages.push(t(blockedKey, { emoji: card.emoji, name: cn(card) }));
    return false; // フード効果なし
  }

  const drunkVal = isPlayer ? battle.playerDrunk : battle.opponentDrunk;
  let heal = card.heal === 99 ? Math.max(0, drunkVal + incomingDamage) : (card.heal ?? 0);
  heal = applyFoodBuffs(heal, userBuffs);
  if (halvesFood) heal = Math.floor(heal * 0.5);

  if (isPlayer) {
    result.playerHeal += heal;
  } else {
    result.opponentHeal += heal;
  }
  result.messages.push(t(msgKey, { emoji: card.emoji, name: cn(card), value: heal }));
  applyCardExtras(card, result, user);
  if (hasBuff(userBuffs, 'next_food_boost')) {
    trackBuffConsumption(result, user, 'next_food_boost');
  }
  return true;
}

/** フラグ駆動カード効果のハンドラーマップ（実行順序 = 配列順序） */
export const UTILITY_FLAG_HANDLERS: Array<{
  key: keyof CardDef;
  handle: (ctx: UtilityContext) => void;
}> = [
  {
    key: 'revealHand',
    handle: ({ isPlayer, result, battle }) => {
      if (isPlayer) {
        result.revealedHand = [...battle.opponentHand];
        result.messages.push(t('engine.utility.revealHand.player'));
      } else {
        result.messages.push(t('engine.utility.revealHand.opponent'));
      }
    },
  },
  {
    key: 'triggerRumor',
    handle: ({ isPlayer, result }) => {
      if (isPlayer) {
        result.rumorActive = true;
        result.messages.push(t('engine.utility.rumor.player'));
      } else {
        result.playerRumorActive = true;
        result.messages.push(t('engine.utility.rumor.opponent'));
      }
    },
  },
  {
    key: 'swapDrunk',
    handle: ({ result }) => {
      result.swapDrunk = true;
      result.messages.push(t('engine.utility.swapDrunk'));
    },
  },
  {
    key: 'discardHighest',
    handle: ({ isPlayer, result }) => {
      if (isPlayer) {
        result.discardHighest = true;
        result.messages.push(t('engine.utility.discardHighest.player'));
      } else {
        result.discardPlayerHighest = true;
        result.messages.push(t('engine.utility.discardHighest.opponent'));
      }
    },
  },
  {
    key: 'discardEnemyHand',
    handle: ({ card, isPlayer, result }) => {
      if (isPlayer) {
        result.discardEnemyHandCount = (result.discardEnemyHandCount ?? 0) + card.discardEnemyHand!;
      } else {
        result.discardPlayerHandCount = (result.discardPlayerHandCount ?? 0) + card.discardEnemyHand!;
      }
      result.messages.push(isPlayer ? t('engine.utility.discardEnemyHand.player', { count: card.discardEnemyHand }) : t('engine.utility.discardEnemyHand.opponent', { count: card.discardEnemyHand }));
    },
  },
  {
    key: 'reduceMaxRounds',
    handle: ({ card, result }) => {
      result.reduceMaxRounds = card.reduceMaxRounds;
      result.messages.push(t('engine.utility.reduceMaxRounds', { value: card.reduceMaxRounds }));
    },
  },
  {
    key: 'applyBuffs',
    handle: ({ card, targetBuffs, result }) => {
      targetBuffs.push(...card.applyBuffs!);
      for (const buff of card.applyBuffs!) {
        const label = getBuffMessage(buff);
        if (label) result.messages.push(label);
      }
    },
  },
  {
    key: 'applySelfBuffs',
    handle: ({ card, selfBuffs, result }) => {
      selfBuffs.push(...card.applySelfBuffs!);
      for (const buff of card.applySelfBuffs!) {
        const label = getBuffMessage(buff);
        if (label) result.messages.push(label);
      }
    },
  },
  {
    key: 'applyBothBuffs',
    handle: ({ card, result }) => {
      for (const buff of card.applyBothBuffs!) {
        result.newPlayerBuffs!.push({ ...buff, source: card.id });
        result.newOpponentBuffs!.push({ ...buff, source: card.id });
        const label = getBuffMessage(buff);
        if (label) result.messages.push(label);
      }
    },
  },
  {
    key: 'selfHeal',
    handle: ({ card, isPlayer, result }) => {
      if (isPlayer) {
        result.playerHeal += card.selfHeal!;
      } else {
        result.opponentHeal += card.selfHeal!;
      }
      result.messages.push(t('engine.utility.selfHeal', { value: card.selfHeal }));
    },
  },
  {
    key: 'selfDamage',
    handle: ({ card, isPlayer, result }) => {
      if (isPlayer) {
        result.playerDamage += card.selfDamage!;
      } else {
        result.opponentDamage += card.selfDamage!;
      }
      result.messages.push(t('engine.utility.selfDamage', { value: card.selfDamage }));
    },
  },
  {
    key: 'corruptHand',
    handle: ({ card, isPlayer, result }) => {
      if (isPlayer) {
        result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + card.corruptHand!;
        result.messages.push(t('engine.utility.corruptHand.player', { count: card.corruptHand }));
      } else {
        result.corruptCount = (result.corruptCount ?? 0) + card.corruptHand!;
        result.messages.push(t('engine.utility.corruptHand.opponent', { count: card.corruptHand }));
      }
    },
  },
  {
    key: 'cleanseSelf',
    handle: ({ card, isPlayer, result }) => {
      if (isPlayer) {
        result.playerCleanseSelf = (result.playerCleanseSelf ?? 0) + card.cleanseSelf!;
        result.messages.push(t('engine.utility.cleanseSelf.player', { name: cn(card), count: card.cleanseSelf }));
      } else {
        result.opponentCleanseSelf = (result.opponentCleanseSelf ?? 0) + card.cleanseSelf!;
        result.messages.push(t('engine.utility.cleanseSelf.opponent', { name: cn(card), count: card.cleanseSelf }));
      }
    },
  },
  {
    key: 'cleanseDot',
    handle: ({ card, isPlayer, result }) => {
      if (isPlayer) {
        result.playerCleanseDot = true;
        result.messages.push(t('engine.utility.cleanseDot.player', { name: cn(card) }));
      } else {
        result.opponentCleanseDot = true;
        result.messages.push(t('engine.utility.cleanseDot.opponent', { name: cn(card) }));
      }
    },
  },
];

import type { Buff, CardDef } from '../data/types.ts';
import { hasBuff, getBuffMessage } from './utils.ts';
import { t, cn, getBuffValue } from './battleTypes.ts';
import type { ExtendedResult, HarassmentSpecialContext } from './battleTypes.ts';

export const HARASSMENT_SPECIAL_HANDLERS: Record<string, (ctx: HarassmentSpecialContext) => void> = {
  wall_pin: (ctx) => {
    ctx.result.clearAllOpponentBuffs = true;
    ctx.result.messages.push(t('engine.harassment.wallPin'));
  },
  ear_bite: (ctx) => {
    const stealBuff = ctx.targetBuffs.find(b => b.id === 'next_drink_boost');
    if (stealBuff) {
      ctx.result.consumeOpponentBuffs = [...(ctx.result.consumeOpponentBuffs ?? []), 'next_drink_boost'];
      ctx.result.newPlayerBuffs = [...(ctx.result.newPlayerBuffs ?? []), { id: 'next_drink_boost', duration: stealBuff.duration, value: stealBuff.value }];
      ctx.result.messages.push(t('engine.harassment.earBite'));
    }
  },
  breast_touch: (ctx) => {
    ctx.result.swapDrinkForHarassment = true;
    ctx.result.messages.push(t('engine.harassment.breastTouch'));
  },
};

/** 共通バフ適用（all_dmg_up など両カードタイプで共有） */
export function applyCommonBuffs(dmg: number, attackerBuffs: Buff[], _defenderBuffs: Buff[]): number {
  // all_dmg_up: 全カードdmg+N（バベルの残響）
  if (hasBuff(attackerBuffs, 'all_dmg_up')) {
    dmg += getBuffValue(attackerBuffs, 'all_dmg_up', 0);
  }
  return dmg;
}

/** ドリンクダメージにバフ効果を適用 */
export function applyDrinkBuffs(baseDmg: number, attackerBuffs: Buff[], defenderBuffs: Buff[]): number {
  let dmg = baseDmg;

  // karaoke: ドリンクダメージ+N（環境効果は両方に付与されるためmax取得）
  const karaokeVal = Math.max(
    getBuffValue(attackerBuffs, 'karaoke', 0),
    getBuffValue(defenderBuffs, 'karaoke', 0)
  );
  if (karaokeVal > 0) {
    dmg += karaokeVal;
  }

  // 共通バフ適用（all_dmg_up等）
  dmg = applyCommonBuffs(dmg, attackerBuffs, defenderBuffs);

  // next_drink_boost: 次のドリンクダメージ+N（消費型）
  if (hasBuff(attackerBuffs, 'next_drink_boost')) {
    dmg += getBuffValue(attackerBuffs, 'next_drink_boost', 0);
  }

  // self_atk_up: 自分のドリンクダメージ倍率（アーク注射）
  if (hasBuff(attackerBuffs, 'self_atk_up')) {
    dmg = Math.floor(dmg * getBuffValue(attackerBuffs, 'self_atk_up', 1));
  }

  // atk_down: ダメージ倍率
  if (hasBuff(attackerBuffs, 'atk_down')) {
    dmg = Math.floor(dmg * getBuffValue(attackerBuffs, 'atk_down', 1));
  }

  // drink_dmg_half: 被ドリンクダメージ半減（シルバーアッシュ茶）
  if (hasBuff(defenderBuffs, 'drink_dmg_half')) {
    dmg = Math.floor(dmg * 0.5);
  }

  // tipsy: 受け手がほろ酔い → ダメージ1.5倍
  if (hasBuff(defenderBuffs, 'tipsy')) {
    dmg = Math.floor(dmg * 1.5);
  }

  return dmg;
}

/** ハラスメントの必要酔いLvを環境バフで補正（即勝利カードは最低Lv2） */
export function getAdjustedRequiredLevel(requiredLevel: number, userBuffs: Buff[], targetBuffs: Buff[], isInstantWin?: boolean): number {
  let lv = requiredLevel;
  if (hasBuff(userBuffs, 'dimlight')) lv = Math.max(0, lv - 1);
  if (hasBuff(userBuffs, 'excuse')) lv = Math.max(0, lv - 1);
  // alone + 即勝利カード（Kiss等）: Lv2で発動可能
  if (isInstantWin && (hasBuff(userBuffs, 'alone') || hasBuff(targetBuffs, 'alone'))) {
    lv = Math.max(0, lv - 1);
  }
  // 余韻（afterglow）: 前ターンのセクハラ成功で条件緩和
  if (hasBuff(targetBuffs, 'afterglow')) lv = Math.max(0, lv - 1);
  // 即勝利カード（Kiss等）はバフで下げても最低Lv2を要求
  if (isInstantWin) lv = Math.max(2, lv);
  return lv;
}

/** ハラスメントのダメージにバフ効果を適用 */
export function applyHarassmentBuffs(baseDmg: number, attackerBuffs: Buff[], defenderBuffs: Buff[]): number {
  let dmg = baseDmg;
  // blush: 動揺中 → drunkDamage +1
  if (hasBuff(defenderBuffs, 'blush')) {
    dmg += 1;
  }
  // alone: 二人きり → ダメージ2倍
  if (hasBuff(attackerBuffs, 'alone') || hasBuff(defenderBuffs, 'alone')) {
    dmg *= 2;
  }
  // 共通バフ適用（all_dmg_up等）
  dmg = applyCommonBuffs(dmg, attackerBuffs, defenderBuffs);
  // finger_technique: セクハラダメージ1.5倍
  if (hasBuff(attackerBuffs, 'finger_technique')) {
    dmg = Math.ceil(dmg * 1.5);
  }
  return dmg;
}

/**
 * ドリンク・フード共通の追加効果処理（統合版）
 * applyBuffs, applySelfBuffs, selfHeal, selfDamage, cleanseSelf, cleanseDot,
 * corruptHand, discardEnemyHand を全カードタイプで処理する。
 */
export function applyCardExtras(card: CardDef, result: ExtendedResult, user: 'player' | 'opponent'): void {
  const isPlayer = user === 'player';

  // applyBuffs → 相手にバフ付与
  if (card.applyBuffs) {
    const target = isPlayer ? result.newOpponentBuffs! : result.newPlayerBuffs!;
    target.push(...card.applyBuffs);
    for (const buff of card.applyBuffs) {
      const label = getBuffMessage(buff);
      if (label) result.messages.push(label);
    }
  }

  // applySelfBuffs → 自分にバフ付与
  if (card.applySelfBuffs) {
    const self = isPlayer ? result.newPlayerBuffs! : result.newOpponentBuffs!;
    self.push(...card.applySelfBuffs);
    for (const buff of card.applySelfBuffs) {
      const label = getBuffMessage(buff);
      if (label) result.messages.push(label);
    }
  }

  // selfHeal → ドレイン効果（自分回復）
  if (card.selfHeal) {
    if (isPlayer) {
      result.playerHeal += card.selfHeal;
      result.messages.push(t('engine.extras.selfHeal', { name: cn(card), value: card.selfHeal }));
    } else {
      result.opponentHeal += card.selfHeal;
    }
  }

  // selfDamage → 自傷ダメージ
  if (card.selfDamage) {
    if (isPlayer) {
      result.playerDamage += card.selfDamage;
      result.messages.push(t('engine.extras.selfDamage', { name: cn(card), value: card.selfDamage }));
    } else {
      result.opponentDamage += card.selfDamage;
    }
  }

  // cleanseSelf → デバフ除去
  if (card.cleanseSelf) {
    if (isPlayer) {
      result.playerCleanseSelf = (result.playerCleanseSelf ?? 0) + card.cleanseSelf;
      result.messages.push(t('engine.extras.cleanseSelf', { name: cn(card), count: card.cleanseSelf }));
    } else {
      result.opponentCleanseSelf = (result.opponentCleanseSelf ?? 0) + card.cleanseSelf;
      result.messages.push(t('engine.extras.cleanseSelfOpponent', { name: cn(card), count: card.cleanseSelf }));
    }
  }

  // cleanseDot → dot除去
  if (card.cleanseDot) {
    if (isPlayer) {
      result.playerCleanseDot = true;
      result.messages.push(t('engine.extras.cleanseDot', { name: cn(card) }));
    } else {
      result.opponentCleanseDot = true;
      result.messages.push(t('engine.extras.cleanseDotOpponent', { name: cn(card) }));
    }
  }

  // corruptHand → 敵の手札汚染
  if (card.corruptHand) {
    if (isPlayer) {
      result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + card.corruptHand;
      result.messages.push(t('engine.extras.corruptHandPlayer', { name: cn(card), count: card.corruptHand }));
    } else {
      result.corruptCount = (result.corruptCount ?? 0) + card.corruptHand;
      result.messages.push(t('engine.extras.corruptHandOpponent', { name: cn(card), count: card.corruptHand }));
    }
  }

  // discardEnemyHand → 敵の手札破棄（次のドロー時処理）
  if (card.discardEnemyHand) {
    if (isPlayer) {
      result.discardEnemyHandCount = (result.discardEnemyHandCount ?? 0) + card.discardEnemyHand;
      result.messages.push(t('engine.extras.discardEnemyHandPlayer', { name: cn(card), count: card.discardEnemyHand }));
    } else {
      result.discardPlayerHandCount = (result.discardPlayerHandCount ?? 0) + card.discardEnemyHand;
      result.messages.push(t('engine.extras.discardEnemyHandOpponent', { name: cn(card), count: card.discardEnemyHand }));
    }
  }
}

/** next_drink_boost / next_food_boost の消費を記録 */
export function trackBuffConsumption(result: ExtendedResult, user: 'player' | 'opponent', buffId: string): void {
  if (user === 'player') {
    if (!result.consumePlayerBuffs) result.consumePlayerBuffs = [];
    result.consumePlayerBuffs.push(buffId);
  } else {
    if (!result.consumeOpponentBuffs) result.consumeOpponentBuffs = [];
    result.consumeOpponentBuffs.push(buffId);
  }
}

/** フードの回復量にバフ効果を適用 */
export function applyFoodBuffs(baseHeal: number, userBuffs: Buff[]): number {
  let heal = baseHeal;
  if (hasBuff(userBuffs, 'next_food_boost')) {
    heal += getBuffValue(userBuffs, 'next_food_boost', 0);
  }
  return heal;
}

/**
 * effects[]使用カードの後方互換: applySelfBuffs / applyBuffs をresultに反映。
 * effects[] 内で apply_buff を使っているカードでは呼ばない（二重付与防止）。
 */
export function applyLegacyBuffs(card: CardDef, isPlayer: boolean, result: ExtendedResult): void {
  if (card.applySelfBuffs) {
    for (const buff of card.applySelfBuffs) {
      if (isPlayer) {
        result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), { ...buff }];
      } else {
        result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), { ...buff }];
      }
    }
  }
  if (card.applyBuffs) {
    for (const buff of card.applyBuffs) {
      if (isPlayer) {
        result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), { ...buff }];
      } else {
        result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), { ...buff }];
      }
    }
  }
}

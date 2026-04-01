import type { BattleState, EffectDef } from '../data/types.ts';
import { CARD_DATA } from '../data/cards.ts';
import { POSITIVE_BUFF_IDS } from './utils.ts';
import { t, cn } from './battleTypes.ts';
import type { ExtendedResult, EffectContext } from './battleTypes.ts';

/**
 * EffectDef 配列を順番に処理する。
 * カードの effects フィールドに定義を並べるだけで、
 * エンジンのコードを変更せずに新カード効果が動く。
 */
export function processEffects(
  effects: EffectDef[],
  cardName: string,
  cardEmoji: string,
  isPlayer: boolean,
  result: ExtendedResult,
  battle: BattleState,
): void {
  for (const fx of effects) {
    processEffect(fx, cardName, cardEmoji, isPlayer, result, battle);
  }
}

const EFFECT_HANDLERS: Record<string, (fx: EffectDef, ctx: EffectContext) => void> = {
  // --- ダメージ ---
  damage: (fx, { cardEmoji, cardName, isPlayer, result }) => {
    const v = fx.value;
    if (fx.target === 'enemy' || fx.target === 'both') {
      if (isPlayer) result.opponentDamage += v;
      else result.playerDamage += v;
    }
    if (fx.target === 'self' || fx.target === 'both') {
      if (isPlayer) result.playerDamage += v;
      else result.opponentDamage += v;
    }
    if (fx.target === 'both') {
      result.messages.push(t('engine.effect.damage.both', { emoji: cardEmoji, name: cardName, value: v }));
    } else if (fx.target === 'enemy') {
      result.messages.push(t('engine.effect.damage.enemy', { emoji: cardEmoji, name: cardName, value: v, target: isPlayer ? t('engine.target.opponent') : t('engine.target.us') }));
    } else {
      result.messages.push(t('engine.effect.damage.self', { emoji: cardEmoji, name: cardName, value: v }));
    }
  },

  // --- 回復 ---
  heal: (fx, { cardEmoji, cardName, isPlayer, result }) => {
    const v = fx.value;
    if (fx.target === 'self') {
      if (isPlayer) result.playerHeal += v;
      else result.opponentHeal += v;
    } else {
      if (isPlayer) result.opponentHeal += v;
      else result.playerHeal += v;
    }
    result.messages.push(t('engine.effect.heal', { emoji: cardEmoji, name: cardName, value: v }));
  },

  // --- バフ付与 ---
  apply_buff: (fx, { isPlayer, result }) => {
    const buff = { ...fx.buff };
    if (fx.target === 'self') {
      if (isPlayer) {
        result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), buff];
      } else {
        result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), buff];
      }
    } else {
      if (isPlayer) {
        result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), buff];
      } else {
        result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), buff];
      }
    }
  },

  // --- 敵バフ全除去 ---
  cleanse_enemy_buffs: (_fx, { cardEmoji, isPlayer, result, battle }) => {
    const enemyBuffs = isPlayer ? battle.opponentBuffs : battle.playerBuffs;
    const count = enemyBuffs.filter(b => (POSITIVE_BUFF_IDS as readonly string[]).includes(b.id)).length;
    if (count > 0) {
      if (isPlayer) {
        result.clearAllOpponentBuffs = true;
        result.opponentDamage += count;
      } else {
        result.clearAllPlayerBuffs = true;
        result.playerDamage += count;
      }
      result.messages.push(t('engine.effect.cleanseEnemyBuffs.success', { emoji: cardEmoji, count }));
    } else {
      result.messages.push(t('engine.effect.cleanseEnemyBuffs.noBuff', { emoji: cardEmoji }));
    }
  },

  // --- 自己デバフ除去 ---
  cleanse_self: (fx, { cardEmoji, isPlayer, result }) => {
    if (isPlayer) {
      result.playerCleanseSelf = (result.playerCleanseSelf ?? 0) + fx.count;
    } else {
      result.opponentCleanseSelf = (result.opponentCleanseSelf ?? 0) + fx.count;
    }
    result.messages.push(t('engine.effect.cleanseSelf', { emoji: cardEmoji, count: fx.count }));
  },

  // --- DoT除去 ---
  cleanse_dot: (_fx, { cardEmoji, isPlayer, result }) => {
    if (isPlayer) result.playerCleanseDot = true;
    else result.opponentCleanseDot = true;
    result.messages.push(t('engine.effect.cleanseDot', { emoji: cardEmoji }));
  },

  // --- 手札入れ替え ---
  swap_hands: (_fx, { cardEmoji, cardName, result }) => {
    result.swapHandsNextRound = true;
    result.messages.push(t('engine.effect.swapHands', { emoji: cardEmoji, name: cardName }));
  },

  // --- 酔いLv入れ替え ---
  swap_drunk: (_fx, { cardEmoji, cardName, result }) => {
    result.swapDrunk = true;
    result.messages.push(t('engine.effect.swapDrunk', { emoji: cardEmoji, name: cardName }));
  },

  // --- カード変身 ---
  transform_card: (fx, { cardEmoji, cardName, isPlayer, result }) => {
    if (isPlayer) {
      result.transformEnemyCard = fx.cardId;
      result.messages.push(t('engine.effect.transformCard.player', { emoji: cardEmoji, name: cardName }));
    } else {
      result.transformPlayerCard = fx.cardId;
      result.messages.push(t('engine.effect.transformCard.opponent', { emoji: cardEmoji, name: cardName }));
    }
  },

  // --- トークンカード追加 ---
  grant_card: (fx, { cardEmoji, cardName, isPlayer, result }) => {
    const cardTarget = fx.target === 'self' ? isPlayer : !isPlayer;
    if (cardTarget) {
      result.playerExtraCard = fx.cardId;
    } else {
      result.opponentExtraCard = fx.cardId;
    }
    const tokenCard = CARD_DATA[fx.cardId];
    const tokenName = tokenCard ? cn(tokenCard) : fx.cardId;
    result.messages.push(t('engine.effect.grantCard', { emoji: cardEmoji, name: cardName, tokenName }));
  },

  // --- 手札破棄 ---
  discard_hand: (fx, { cardEmoji, isPlayer, result }) => {
    if (isPlayer) {
      result.discardEnemyHandCount = (result.discardEnemyHandCount ?? 0) + fx.count;
    } else {
      result.discardPlayerHandCount = (result.discardPlayerHandCount ?? 0) + fx.count;
    }
    result.messages.push(t('engine.effect.discardHand', { emoji: cardEmoji, count: fx.count }));
  },

  // --- 最強カード破棄 ---
  discard_highest: (_fx, { cardEmoji, isPlayer, result }) => {
    if (isPlayer) result.discardHighest = true;
    else result.discardPlayerHighest = true;
    result.messages.push(t('engine.effect.discardHighest', { emoji: cardEmoji }));
  },

  // --- 手札公開 ---
  reveal_hand: (_fx, { cardEmoji, isPlayer, result, battle }) => {
    if (isPlayer) {
      result.revealedHand = [...battle.opponentHand];
      result.messages.push(t('engine.effect.revealHand.player', { emoji: cardEmoji }));
    } else {
      result.messages.push(t('engine.effect.revealHand.opponent', { emoji: cardEmoji }));
    }
  },

  // --- 噂話 ---
  rumor: (_fx, { cardEmoji, isPlayer, result }) => {
    if (isPlayer) {
      result.rumorActive = true;
      result.messages.push(t('engine.effect.rumor.player', { emoji: cardEmoji }));
    } else {
      result.playerRumorActive = true;
      result.messages.push(t('engine.effect.rumor.opponent', { emoji: cardEmoji }));
    }
  },

  // --- maxRounds減少 ---
  reduce_max_rounds: (fx, { cardEmoji, result }) => {
    result.reduceMaxRounds = (result.reduceMaxRounds ?? 0) + fx.value;
    result.messages.push(t('engine.effect.reduceMaxRounds', { emoji: cardEmoji, value: fx.value }));
  },

  // --- 手札汚染 ---
  corrupt_hand: (fx, { cardEmoji, isPlayer, result }) => {
    if (isPlayer) {
      result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + fx.count;
    } else {
      result.corruptCount = (result.corruptCount ?? 0) + fx.count;
    }
    result.messages.push(t('engine.effect.corruptHand', { emoji: cardEmoji, count: fx.count }));
  },

  // --- 手札枚数削減 ---
  reduce_hand: (fx, { cardEmoji, isPlayer, result }) => {
    if (fx.target === 'self') {
      if (isPlayer) result.playerReducedHand = true;
      else result.opponentReducedHand = true;
    } else {
      if (isPlayer) result.opponentReducedHand = true;
      else result.playerReducedHand = true;
    }
    result.messages.push(t('engine.effect.reduceHand', { emoji: cardEmoji }));
  },

  // --- 即勝利 ---
  instant_win: (_fx, { cardEmoji, cardName, isPlayer, result }) => {
    if (isPlayer) {
      result.instantWin = true;
      result.messages.push(t('engine.effect.instantWin.player', { emoji: cardEmoji, name: cardName }));
    } else {
      result.playerDamage += 99;
      result.messages.push(t('engine.effect.instantWin.opponent', { emoji: cardEmoji, name: cardName }));
    }
  },

  // --- ルーレット（再帰的に子効果を処理） ---
  roulette: (fx, { cardEmoji, cardName, isPlayer, result, battle }) => {
    const roll = Math.random();
    if (roll < fx.chance) {
      result.messages.push(t('engine.effect.roulette.hit', { name: cardName }));
      processEffects(fx.success, cardName, cardEmoji, isPlayer, result, battle);
    } else {
      result.messages.push(t('engine.effect.roulette.miss', { name: cardName }));
      processEffects(fx.failure, cardName, cardEmoji, isPlayer, result, battle);
    }
  },
};

function processEffect(
  fx: EffectDef,
  cardName: string,
  cardEmoji: string,
  isPlayer: boolean,
  result: ExtendedResult,
  battle: BattleState,
): void {
  const handler = EFFECT_HANDLERS[fx.type];
  if (handler) handler(fx, { cardName, cardEmoji, isPlayer, result, battle });
}

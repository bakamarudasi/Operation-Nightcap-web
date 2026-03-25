import { CARD_DATA, getCardDamage, getEnhancedCard } from '../data/cards.ts';
import type { BattleState, RoundResult, CGEvent, CharacterDef, Buff, CardDef, EffectDef } from '../data/types.ts';
import { randomPick, POSITIVE_BUFF_IDS, getDrunkLevel, hasBuff, getBuffMessage } from './utils.ts';
import i18n from '../i18n/index.ts';

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
/** Localized card name helper */
const cn = (card: { id: string; name: string }) => t(`cards.${card.id}.name`, { defaultValue: card.name }) as string;

export interface ExtendedResult extends RoundResult {
  opponentDiscardNext?: boolean;
  playerDiscardNext?: boolean;
  playerReducedHand?: boolean;
  opponentReducedHand?: boolean;
  /** rumor: 相手の次ラウンド手札をランダム差替 */
  rumorActive?: boolean;
  /** rumor: プレイヤーの次ラウンド手札をランダム差替 */
  playerRumorActive?: boolean;
  /** distract: 相手の手札を公開 */
  revealedHand?: string[];
  /** swap_drunk: 酔いLv入れ替えフラグ */
  swapDrunk?: boolean;
  /** reduceMaxRounds: maxRounds減少量 */
  reduceMaxRounds?: number;
  /** discardEnemyHand: 相手の次の手札からN枚破棄 */
  discardEnemyHandCount?: number;
  /** discardPlayerHand: プレイヤーの次の手札からN枚破棄 */
  discardPlayerHandCount?: number;
  /** discardHighest: 相手の最高dmgカードを破棄 */
  discardHighest?: boolean;
  /** discardPlayerHighest: プレイヤーの最高dmgカードを破棄 */
  discardPlayerHighest?: boolean;
  /** 相手の手札を汚染（相手側corruptedSlots） */
  opponentCorruptCount?: number;
  /** プレイヤーのデバフ除去数 */
  playerCleanseSelf?: number;
  /** プレイヤーのdot除去フラグ */
  playerCleanseDot?: boolean;
  /** 相手のデバフ除去数 */
  opponentCleanseSelf?: number;
  /** 相手のdot除去フラグ */
  opponentCleanseDot?: boolean;
  /** 消費するプレイヤーバフID（使い切り系） */
  consumePlayerBuffs?: string[];
  /** 消費する相手バフID（使い切り系） */
  consumeOpponentBuffs?: string[];
  /** 相手のバフを全除去（レイジの落雷） */
  clearAllOpponentBuffs?: boolean;
  /** プレイヤーのバフを全除去 */
  clearAllPlayerBuffs?: boolean;
  /** 次ラウンドで手札入れ替え */
  swapHandsNextRound?: boolean;
  /** プレイヤーの次ラウンド手札にカード追加 */
  playerExtraCard?: string;
  /** 相手の次ラウンド手札にカード追加 */
  opponentExtraCard?: string;
  /** 次ラウンドで相手の手札1枚を変身 */
  transformEnemyCard?: string;
  /** 次ラウンドでプレイヤーの手札1枚を変身 */
  transformPlayerCard?: string;
  /** breast_touch: プレイヤーの手札Drink→Harassment交換 */
  swapDrinkForHarassment?: boolean;
}

interface HarassmentSpecialContext {
  result: ExtendedResult;
  targetBuffs: Buff[];
}

const HARASSMENT_SPECIAL_HANDLERS: Record<string, (ctx: HarassmentSpecialContext) => void> = {
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

export function getMatchupResult(playerType: CardDef['type'], opponentType: CardDef['type']): 'advantage' | 'disadvantage' | 'neutral' {
  if (playerType === 'drink' && opponentType === 'harassment') return 'advantage';
  if (playerType === 'harassment' && opponentType === 'drink') return 'disadvantage';
  if (playerType === 'harassment' && opponentType === 'food') return 'advantage';
  if (playerType === 'food' && opponentType === 'harassment') return 'disadvantage';
  if (playerType === 'food' && opponentType === 'drink') return 'advantage';
  if (playerType === 'drink' && opponentType === 'food') return 'disadvantage';
  return 'neutral';
}

/** strategy / environment / status を「ユーティリティ」として判定 */
function isUtilityType(type: string): boolean {
  return type === 'strategy' || type === 'environment' || type === 'status';
}


/** 特定バフの最大値を取得（同一IDが複数ある場合は最大を採用） */
function getBuffValue(buffs: Buff[], id: string, defaultVal: number): number {
  let max = defaultVal;
  let found = false;
  for (const b of buffs) {
    if (b.id === id) {
      const v = b.value ?? defaultVal;
      if (!found || v > max) { max = v; found = true; }
    }
  }
  return max;
}

/** duration を1減らし、0以下を除去。-1（永続）はそのまま */
export function tickBuffs(buffs: Buff[]): Buff[] {
  return buffs
    .map(b => b.duration === -1 ? b : { ...b, duration: b.duration - 1 })
    .filter(b => b.duration !== 0);
}

/** DoTバフのダメージを計算 */
export function calcDoTDamage(buffs: Buff[]): number {
  return buffs
    .filter(b => b.id === 'dot')
    .reduce((sum, b) => sum + (b.value ?? 0), 0);
}

/** 共通バフ適用（all_dmg_up など両カードタイプで共有） */
function applyCommonBuffs(dmg: number, attackerBuffs: Buff[], _defenderBuffs: Buff[]): number {
  // all_dmg_up: 全カードdmg+N（バベルの残響）
  if (hasBuff(attackerBuffs, 'all_dmg_up')) {
    dmg += getBuffValue(attackerBuffs, 'all_dmg_up', 0);
  }
  return dmg;
}

/** ドリンクダメージにバフ効果を適用 */
function applyDrinkBuffs(baseDmg: number, attackerBuffs: Buff[], defenderBuffs: Buff[]): number {
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
function applyHarassmentBuffs(baseDmg: number, attackerBuffs: Buff[], defenderBuffs: Buff[]): number {
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
function applyCardExtras(card: CardDef, result: ExtendedResult, user: 'player' | 'opponent'): void {
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
function trackBuffConsumption(result: ExtendedResult, user: 'player' | 'opponent', buffId: string): void {
  if (user === 'player') {
    if (!result.consumePlayerBuffs) result.consumePlayerBuffs = [];
    result.consumePlayerBuffs.push(buffId);
  } else {
    if (!result.consumeOpponentBuffs) result.consumeOpponentBuffs = [];
    result.consumeOpponentBuffs.push(buffId);
  }
}

/** フードの回復量にバフ効果を適用 */
function applyFoodBuffs(baseHeal: number, userBuffs: Buff[]): number {
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
function applyLegacyBuffs(card: CardDef, isPlayer: boolean, result: ExtendedResult): void {
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

// ============================================
// === 宣言的効果処理システム ===
// ============================================

/**
 * EffectDef 配列を順番に処理する。
 * カードの effects フィールドに定義を並べるだけで、
 * エンジンのコードを変更せずに新カード効果が動く。
 */
function processEffects(
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

interface EffectContext {
  cardName: string;
  cardEmoji: string;
  isPlayer: boolean;
  result: ExtendedResult;
  battle: BattleState;
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

// ============================================
// === ドリンク / フード 共通解決ヘルパー ===
// ============================================

interface CardResolveContext {
  card: CardDef;
  user: 'player' | 'opponent';
  result: ExtendedResult;
  battle: BattleState;
  /** 相手のフードで半減するか */
  halvesDrink: boolean;
  /** 相手のハラスメントで半減するか */
  halvesFood: boolean;
}

/**
 * ドリンクカード1枚の効果を解決する。
 * ダメージ計算 → result に加算 → メッセージ追加 → 追加効果 → バフ消費記録。
 * @returns 計算後のダメージ値（drink vs drink の差分計算に使用）
 */
function resolveDrinkCard(ctx: CardResolveContext): number {
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
function resolveFoodCard(ctx: CardResolveContext, incomingDamage: number = 0, msgKey: string = 'engine.food.heal'): boolean {
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

/** resolveUtilityCard のハンドラーに渡すコンテキスト */
interface UtilityContext {
  card: CardDef;
  isPlayer: boolean;
  result: ExtendedResult;
  battle: BattleState;
  selfBuffs: Buff[];
  targetBuffs: Buff[];
}

/** フラグ駆動カード効果のハンドラーマップ（実行順序 = 配列順序） */
const UTILITY_FLAG_HANDLERS: Array<{
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

export const BattleEngine = {
  resolveRound(playerCardId: string, opponentCardId: string, battle: BattleState, currentOpponent?: CharacterDef | null): ExtendedResult {
    const result = this._resolveRoundCore(playerCardId, opponentCardId, battle, currentOpponent);
    return this.applyPostEffects(result, battle);
  },

  /** thorns / reflect_all のダメージ後処理 */
  applyPostEffects(result: ExtendedResult, battle: BattleState): ExtendedResult {
    // reflect前のダメージを記録（thorns判定に使用）
    const playerDamageBefore = result.playerDamage;
    const opponentDamageBefore = result.opponentDamage;

    // reflect_all: 受けたダメージを全て相手に跳ね返す（DoT除外）
    // 両者同時判定: 反射前のダメージをスナップショットして同時処理
    const playerDoT = calcDoTDamage(battle.playerBuffs);
    const opponentDoT = calcDoTDamage(battle.opponentBuffs);
    const playerReflectable = hasBuff(battle.playerBuffs, 'reflect_all')
      ? Math.max(0, result.playerDamage - playerDoT) : 0;
    const opponentReflectable = hasBuff(battle.opponentBuffs, 'reflect_all')
      ? Math.max(0, result.opponentDamage - opponentDoT) : 0;

    if (playerReflectable > 0) {
      result.opponentDamage += playerReflectable;
      result.playerDamage -= playerReflectable;
      result.messages.push(t('engine.post.reflectAll.player', { value: playerReflectable }));
    }
    if (opponentReflectable > 0) {
      result.playerDamage += opponentReflectable;
      result.opponentDamage -= opponentReflectable;
      result.messages.push(t('engine.post.reflectAll.opponent', { value: opponentReflectable }));
    }

    // thorns: ダメージを受けたら固定値を反射（reflect前のダメージで判定）
    if (playerDamageBefore > 0 && hasBuff(battle.playerBuffs, 'thorns')) {
      const thornsVal = getBuffValue(battle.playerBuffs, 'thorns', 0);
      if (thornsVal > 0) {
        result.opponentDamage += thornsVal;
        result.messages.push(t('engine.post.thorns.player', { value: thornsVal }));
      }
    }
    if (opponentDamageBefore > 0 && hasBuff(battle.opponentBuffs, 'thorns')) {
      const thornsVal = getBuffValue(battle.opponentBuffs, 'thorns', 0);
      if (thornsVal > 0) {
        result.playerDamage += thornsVal;
        result.messages.push(t('engine.post.thorns.opponent', { value: thornsVal }));
      }
    }

    return result;
  },

  _resolveRoundCore(playerCardId: string, opponentCardId: string, battle: BattleState, currentOpponent?: CharacterDef | null): ExtendedResult {
    const pCardLevel = battle.playerCardLevels?.[playerCardId] ?? 1;
    const pCard = getEnhancedCard(playerCardId, pCardLevel);
    const oCard = CARD_DATA[opponentCardId];
    const result: ExtendedResult = {
      playerCard: pCard,
      opponentCard: oCard,
      playerDamage: 0,
      opponentDamage: 0,
      playerHeal: 0,
      opponentHeal: 0,
      messages: [],
      cgEvent: null,
      instantWin: false,
      spillNullified: false,
      playerMatchup: 'neutral',
      opponentMatchup: 'neutral',
      newPlayerBuffs: [],
      newOpponentBuffs: [],
      corruptCount: 0,
      playerSanityDamage: 0,
      opponentSanityDamage: 0,
      playerSanityHeal: 0,
      opponentSanityHeal: 0,
    };

    const playerMatchup = getMatchupResult(pCard.type, oCard.type);
    const opponentMatchup = getMatchupResult(oCard.type, pCard.type);
    result.playerMatchup = playerMatchup;
    result.opponentMatchup = opponentMatchup;

    const playerNullifiesHarassment = pCard.type === 'drink' && oCard.type === 'harassment';
    const opponentNullifiesHarassment = oCard.type === 'drink' && pCard.type === 'harassment';
    const playerHalvesDrink = pCard.type === 'food' && oCard.type === 'drink';
    const opponentHalvesDrink = oCard.type === 'food' && pCard.type === 'drink';
    const playerHalvesFood = pCard.type === 'harassment' && oCard.type === 'food';
    const opponentHalvesFood = oCard.type === 'harassment' && pCard.type === 'food';

    if (playerMatchup === 'advantage') result.messages.push(t('engine.matchup.advantage'));
    else if (playerMatchup === 'disadvantage') result.messages.push(t('engine.matchup.disadvantage'));

    // === フェーズ0: DoTバフのtick処理 ===
    const playerDoT = calcDoTDamage(battle.playerBuffs);
    if (playerDoT > 0) {
      result.playerDamage += playerDoT;
      result.messages.push(t('engine.dot.self', { value: playerDoT }));
    }
    const opponentDoT = calcDoTDamage(battle.opponentBuffs);
    if (opponentDoT > 0) {
      result.opponentDamage += opponentDoT;
      result.messages.push(t('engine.dot.opponent', { value: opponentDoT }));
    }

    // === フェーズ0.5: negate_nextチェック ===
    // プレイヤーがnegate_next → 相手のカード効果を完全無効化
    const opponentNegated = hasBuff(battle.playerBuffs, 'negate_next');
    // 相手がnegate_next → プレイヤーのカード効果を完全無効化
    const playerNegated = hasBuff(battle.opponentBuffs, 'negate_next');
    if (opponentNegated) {
      result.messages.push(t('engine.negate.player', { emoji: oCard.emoji, name: cn(oCard) }));
      trackBuffConsumption(result, 'player', 'negate_next');
    }
    if (playerNegated) {
      result.messages.push(t('engine.negate.opponent', { emoji: pCard.emoji, name: cn(pCard) }));
      trackBuffConsumption(result, 'opponent', 'negate_next');
    }

    // 両方無効化なら何も起きない
    if (playerNegated && opponentNegated) {
      return result;
    }

    // 片方だけ無効化：無効化されてない側のカードだけ通す
    if (playerNegated) {
      // プレイヤーのカード無効 → 相手のカードだけ処理
      return this.resolveSingleCard(oCard, pCard, result, 'opponent', battle);
    }
    if (opponentNegated) {
      // 相手のカード無効 → プレイヤーのカードだけ処理
      return this.resolveSingleCard(pCard, oCard, result, 'player', battle);
    }

    // === フェーズ0.5: スタンチェック ===
    const playerStunned = hasBuff(battle.playerBuffs, 'stun');
    const opponentStunned = hasBuff(battle.opponentBuffs, 'stun');

    if (playerStunned) {
      result.messages.push(t('engine.stun.self'));
      // スタン中でも相手のカードは通常通り処理（food/utilityも有効）
      return this.resolveSingleCard(oCard, pCard, result, 'opponent', battle);
    }

    if (opponentStunned) {
      result.messages.push(t('engine.stun.opponent'));
      // スタン中でも自分のカードは通常通り処理（food/utilityも有効）
      return this.resolveSingleCard(pCard, oCard, result, 'player', battle);
    }

    // === フェーズ1: 戦略・環境・状態異常カードを先に処理 ===
    // プレイヤー側
    if (isUtilityType(pCard.type)) {
      this.resolveUtilityCard(pCard, result, 'player', battle);
    }
    // 相手側
    if (isUtilityType(oCard.type)) {
      this.resolveUtilityCard(oCard, result, 'opponent', battle);
    }

    // 両方ユーティリティなら処理完了
    if (isUtilityType(pCard.type) && isUtilityType(oCard.type)) {
      return result;
    }

    // 片方がユーティリティ、もう片方が戦闘カードの場合 → 戦闘カード側だけ効果適用
    if (isUtilityType(pCard.type)) {
      // プレイヤーがユーティリティ → 相手の攻撃だけ通る
      if (oCard.type === 'drink') {
        resolveDrinkCard({ card: oCard, user: 'opponent', result, battle, halvesDrink: playerHalvesDrink, halvesFood: false });
      } else if (oCard.type === 'chug') {
        return this.resolveChugCard(oCard, pCard, result, 'opponent', battle);
      } else if (oCard.type === 'harassment') {
        return this.resolveHarassmentCard(oCard, pCard, result, 'opponent', battle);
      }
      return result;
    }
    if (isUtilityType(oCard.type)) {
      if (pCard.type === 'drink') {
        resolveDrinkCard({ card: pCard, user: 'player', result, battle, halvesDrink: opponentHalvesDrink, halvesFood: false });
      } else if (pCard.type === 'chug') {
        return this.resolveChugCard(pCard, oCard, result, 'player', battle);
      } else if (pCard.type === 'harassment') {
        return this.resolveHarassmentCard(pCard, oCard, result, 'player', battle);
      }
      return result;
    }

    // === 一気飲み系カード処理 ===
    if (pCard.type === 'chug' && oCard.type === 'chug') {
      this.resolveChugCard(pCard, oCard, result, 'player', battle);
      this.resolveChugCard(oCard, pCard, result, 'opponent', battle);
      return result;
    }
    if (pCard.type === 'chug') {
      return this.resolveChugCard(pCard, oCard, result, 'player', battle);
    }
    if (oCard.type === 'chug') {
      return this.resolveChugCard(oCard, pCard, result, 'opponent', battle);
    }

    // === セクハラカード処理（プレイヤー・相手 双方向対応） ===
    if (opponentNullifiesHarassment && pCard.type === 'harassment') {
      result.spillNullified = true;
      result.messages.push(t('engine.harassment.nullified.player'));
      return this.resolveSingleCard(oCard, pCard, result, 'opponent', battle);
    }
    if (playerNullifiesHarassment && oCard.type === 'harassment') {
      result.spillNullified = true;
      result.messages.push(t('engine.harassment.nullified.opponent'));
      return this.resolveSingleCard(pCard, oCard, result, 'player', battle);
    }

    if (pCard.type === 'harassment' && oCard.type === 'harassment') {
      this.resolveHarassmentCard(pCard, oCard, result, 'player', battle);
      this.resolveHarassmentCard(oCard, pCard, result, 'opponent', battle);
      return result;
    }
    if (pCard.type === 'harassment') {
      return this.resolveHarassmentCard(pCard, oCard, result, 'player', battle);
    }
    if (oCard.type === 'harassment') {
      return this.resolveHarassmentCard(oCard, pCard, result, 'opponent', battle);
    }

    // === ドリンク vs ドリンク ===
    if (pCard.type === 'drink' && oCard.type === 'drink') {
      this.resolveDrinkVsDrink(pCard, oCard, result, battle);
    }
    // === ドリンク vs つまみ / つまみ vs ドリンク ===
    else if (pCard.type === 'drink' && oCard.type === 'food') {
      this.resolveDrinkVsFood(pCard, oCard, result, 'player', battle, opponentHalvesDrink, playerHalvesFood);
    }
    else if (pCard.type === 'food' && oCard.type === 'drink') {
      this.resolveDrinkVsFood(oCard, pCard, result, 'opponent', battle, playerHalvesDrink, opponentHalvesFood);
    }
    // === つまみ vs つまみ ===
    else if (pCard.type === 'food' && oCard.type === 'food') {
      resolveFoodCard(
        { card: pCard, user: 'player', result, battle, halvesDrink: false, halvesFood: opponentHalvesFood },
      );
      resolveFoodCard(
        { card: oCard, user: 'opponent', result, battle, halvesDrink: false, halvesFood: playerHalvesFood },
        0, 'engine.food.healOpponent',
      );
      result.messages.push(t('engine.food.peacefulRound'));
    }

    return result;
  },

  /** ドリンク vs ドリンク: 差分ダメージ計算 + 追加効果 */
  resolveDrinkVsDrink(pCard: CardDef, oCard: CardDef, result: ExtendedResult, battle: BattleState): void {
    const pDmg = applyDrinkBuffs(getCardDamage(pCard), battle.playerBuffs, battle.opponentBuffs);
    const oDmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);

    if (hasBuff(battle.playerBuffs, 'atk_down')) {
      result.messages.push(t('engine.atkDown.self'));
    }
    if (hasBuff(battle.opponentBuffs, 'atk_down')) {
      result.messages.push(t('engine.atkDown.opponent'));
    }

    if (pDmg > oDmg) {
      result.opponentDamage += pDmg - oDmg;
      result.messages.push(t('engine.drinkVsDrink.playerWins', { pEmoji: pCard.emoji, pName: cn(pCard), pDmg, oEmoji: oCard.emoji, oName: cn(oCard), oDmg, diff: pDmg - oDmg }));
    } else if (oDmg > pDmg) {
      result.playerDamage += oDmg - pDmg;
      result.messages.push(t('engine.drinkVsDrink.opponentWins', { oEmoji: oCard.emoji, oName: cn(oCard), oDmg, pEmoji: pCard.emoji, pName: cn(pCard), pDmg, diff: oDmg - pDmg }));
    } else {
      result.messages.push(t('engine.drinkVsDrink.tie', { pEmoji: pCard.emoji, oEmoji: oCard.emoji }));
    }

    // ドリンク追加効果
    applyCardExtras(pCard, result, 'player');
    applyCardExtras(oCard, result, 'opponent');
    if (hasBuff(battle.playerBuffs, 'next_drink_boost')) {
      trackBuffConsumption(result, 'player', 'next_drink_boost');
    }
    if (hasBuff(battle.opponentBuffs, 'next_drink_boost')) {
      trackBuffConsumption(result, 'opponent', 'next_drink_boost');
    }
  },

  /**
   * ドリンク vs つまみ: ドリンク側がダメージ、フード側が回復。
   * @param drinkCard ドリンクカード
   * @param foodCard  つまみカード
   * @param drinkUser ドリンクを出した側 ('player' | 'opponent')
   */
  resolveDrinkVsFood(drinkCard: CardDef, foodCard: CardDef, result: ExtendedResult, drinkUser: 'player' | 'opponent', battle: BattleState, halvesDrink: boolean, halvesFood: boolean): void {
    const foodUser: 'player' | 'opponent' = drinkUser === 'player' ? 'opponent' : 'player';

    // ドリンクのダメージ適用
    const dmg = resolveDrinkCard({ card: drinkCard, user: drinkUser, result, battle, halvesDrink, halvesFood: false });

    // フードの回復適用（受けたダメージを加味）
    resolveFoodCard({ card: foodCard, user: foodUser, result, battle, halvesDrink: false, halvesFood }, dmg);
  },

  /**
   * 片方のカードだけ解決（negate_nextで相手が無効化された場合）
   */
  resolveSingleCard(activeCard: CardDef, _nullifiedCard: CardDef, result: ExtendedResult, user: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    if (isUtilityType(activeCard.type)) {
      this.resolveUtilityCard(activeCard, result, user, battle);
    } else if (activeCard.type === 'drink') {
      resolveDrinkCard({ card: activeCard, user, result, battle, halvesDrink: false, halvesFood: false });
    } else if (activeCard.type === 'food') {
      resolveFoodCard({ card: activeCard, user, result, battle, halvesDrink: false, halvesFood: false });
    } else if (activeCard.type === 'chug') {
      this.resolveChugCard(activeCard, _nullifiedCard, result, user, battle);
    } else if (activeCard.type === 'harassment') {
      this.resolveHarassmentCard(activeCard, _nullifiedCard, result, user, battle);
    }

    return result;
  },

  /**
   * 戦略・環境・状態異常カードの汎用解決
   * switchなし。カードデータのフラグを読んで動的に処理する。
   * 新カード追加時はカードデータ定義だけでOK。
   */
  resolveUtilityCard(card: CardDef, result: ExtendedResult, user: 'player' | 'opponent', battle: BattleState): void {
    const isPlayer = user === 'player';
    const selfBuffs = isPlayer ? result.newPlayerBuffs! : result.newOpponentBuffs!;
    const targetBuffs = isPlayer ? result.newOpponentBuffs! : result.newPlayerBuffs!;

    // === 宣言的効果システム（effects配列があればそちらを優先） ===
    if (card.effects && card.effects.length > 0) {
      result.messages.push(t('engine.utility.cardPlay', { emoji: card.emoji, name: cn(card) }));
      processEffects(card.effects, cn(card), card.emoji, isPlayer, result, battle);
      // effects[]内にapply_buffがある場合はlegacyバフ適用をスキップ（二重付与防止）
      const hasApplyBuff = card.effects.some(e => e.type === 'apply_buff');
      if (!hasApplyBuff) applyLegacyBuffs(card, isPlayer, result);
      return;
    }

    result.messages.push(t('engine.utility.cardPlay', { emoji: card.emoji, name: cn(card) }));

    // --- フラグ駆動の効果処理（ハンドラーマップ） ---
    const ctx: UtilityContext = { card, isPlayer, result, battle, selfBuffs, targetBuffs };
    for (const { key, handle } of UTILITY_FLAG_HANDLERS) {
      if (card[key]) handle(ctx);
    }
  },

  resolveChugCard(chugCard: CardDef, otherCard: CardDef, result: ExtendedResult, chugUser: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    // === 宣言的効果システム ===
    if (chugCard.effects && chugCard.effects.length > 0) {
      const isPlayer = chugUser === 'player';
      processEffects(chugCard.effects, cn(chugCard), chugCard.emoji, isPlayer, result, battle);
      const hasApplyBuff = chugCard.effects.some(e => e.type === 'apply_buff');
      if (!hasApplyBuff) applyLegacyBuffs(chugCard, isPlayer, result);
      // 相手のカードも処理（spillで無効化されていなければ）
      this._resolveOtherCard(otherCard, chugCard, result, chugUser, battle);
      return result;
    }

    if (chugCard.effect === 'chug') {
      if (chugUser === 'player') {
        result.opponentDamage += chugCard.enemyDamage ?? 0;
        result.playerDamage += chugCard.selfDamage ?? 0;
        result.messages.push(t('engine.chug.player', { name: cn(chugCard), enemyDmg: chugCard.enemyDamage, selfDmg: chugCard.selfDamage }));
      } else {
        result.playerDamage += chugCard.enemyDamage ?? 0;
        result.opponentDamage += chugCard.selfDamage ?? 0;
        result.messages.push(t('engine.chug.opponent', { name: cn(chugCard), value: chugCard.enemyDamage }));
      }
      // 一気飲みカードの追加バフ（ウルサス式度胸試し等）
      if (chugCard.applyBuffs) {
        const target = chugUser === 'player' ? result.newOpponentBuffs! : result.newPlayerBuffs!;
        target.push(...chugCard.applyBuffs);
      }
      if (chugCard.applySelfBuffs) {
        const self = chugUser === 'player' ? result.newPlayerBuffs! : result.newOpponentBuffs!;
        self.push(...chugCard.applySelfBuffs);
      }
    }
    else if (chugCard.effect === 'toast') {
      if (chugUser === 'player') {
        result.opponentDamage += chugCard.enemyDamage ?? 0;
        result.playerDamage += chugCard.selfDamage ?? 0;
        result.opponentDiscardNext = true;
        result.messages.push(t('engine.toast.player', { value: chugCard.enemyDamage }));
      } else {
        result.playerDamage += chugCard.enemyDamage ?? 0;
        result.opponentDamage += chugCard.selfDamage ?? 0;
        result.playerDiscardNext = true;
        result.messages.push(t('engine.toast.opponent', { value: chugCard.enemyDamage }));
      }
    }
    else if (chugCard.effect === 'spill') {
      result.spillNullified = true;
      if (chugUser === 'player') {
        result.playerReducedHand = true;
        result.messages.push(t('engine.spill.player'));
      } else {
        result.opponentReducedHand = true;
        result.messages.push(t('engine.spill.opponent'));
      }
    }
    else if (chugCard.effect === 'roulette') {
      // 確率分岐ダメージ（ロドス闇鍋酒等）
      const [chance, successDmg, failDmg] = chugCard.rouletteDmg ?? [0.5, 4, 3];
      const roll = Math.random();
      if (roll < chance) {
        if (chugUser === 'player') {
          result.opponentDamage += successDmg;
          result.messages.push(t('engine.roulette.hit.player', { name: cn(chugCard), value: successDmg }));
        } else {
          result.playerDamage += successDmg;
          result.messages.push(t('engine.roulette.hit.opponent', { name: cn(chugCard), value: successDmg }));
        }
      } else {
        // 失敗: 自分にダメージ
        if (chugUser === 'player') {
          result.playerDamage += failDmg;
          result.messages.push(t('engine.roulette.miss.player', { name: cn(chugCard), value: failDmg }));
        } else {
          result.opponentDamage += failDmg;
          result.messages.push(t('engine.roulette.miss.opponent', { name: cn(chugCard), value: failDmg }));
        }
      }
    }

    // 相手のカードも処理（spillで無効化されていなければ）
    this._resolveOtherCard(otherCard, chugCard, result, chugUser, battle);

    return result;
  },

  /**
   * chugカード解決後に相手のカードを処理する共通ヘルパー。
   * spillで無効化されていなければ、相手のdrink/food/utility効果を適用する。
   * （chug vs chug の場合は呼ばれない — 両方のchugが個別に解決される）
   */
  _resolveOtherCard(otherCard: CardDef, _chugCard: CardDef, result: ExtendedResult, chugUser: 'player' | 'opponent', battle: BattleState): void {
    if (result.spillNullified) return;
    if (otherCard.type === 'chug') return;

    const otherUser: 'player' | 'opponent' = chugUser === 'player' ? 'opponent' : 'player';

    if (otherCard.type === 'drink') {
      resolveDrinkCard({ card: otherCard, user: otherUser, result, battle, halvesDrink: false, halvesFood: false });
    } else if (otherCard.type === 'food') {
      resolveFoodCard({ card: otherCard, user: otherUser, result, battle, halvesDrink: false, halvesFood: false });
    } else if (isUtilityType(otherCard.type)) {
      this.resolveUtilityCard(otherCard, result, otherUser, battle);
    }
  },

  resolveHarassmentCard(hCard: CardDef, otherCard: CardDef, result: ExtendedResult, user: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    // 判定: 相手の酔い度で判定
    const triggerDrunk = user === 'player' ? battle.opponentDrunk : battle.playerDrunk;
    const triggerLevel = getDrunkLevel(triggerDrunk);

    // バフによる必要Lv補正
    const userBuffs = user === 'player' ? battle.playerBuffs : battle.opponentBuffs;
    const targetBuffs = user === 'player' ? battle.opponentBuffs : battle.playerBuffs;
    const adjustedRequired = getAdjustedRequiredLevel(hCard.requiredDrunkLevel ?? 0, userBuffs, targetBuffs, !!hCard.instantWin);

    // stealth: 相手にstealthバフがある場合、ハラスメント不発
    if (hasBuff(targetBuffs, 'stealth')) {
      result.messages.push(t('engine.harassment.stealth', { name: cn(hCard) }));
    } else if (triggerLevel >= adjustedRequired) {
      // === 成功 ===
      // afterglow ダメージボーナス
      const hasAfterglow = hasBuff(targetBuffs, 'afterglow');
      if (user === 'player') {
        if (hCard.instantWin) {
          result.instantWin = true;
          result.messages.push(t('engine.harassment.instantWin', { emoji: hCard.emoji, name: cn(hCard) }));
        } else {
          let dmg = hCard.drunkDamage ?? 0;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
          if (hasAfterglow) { dmg += 2; result.messages.push(t('engine.harassment.afterglow')); }
          // カード個別特殊効果
          HARASSMENT_SPECIAL_HANDLERS[hCard.id]?.({ result, targetBuffs });
          result.opponentDamage += dmg;
          result.messages.push(t('engine.harassment.success', { emoji: hCard.emoji, name: cn(hCard), value: dmg }));
        }
        // プレイヤーのハラスメント成功時もバフ付与を処理
        if (hCard.applyBuffs) {
          result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), ...hCard.applyBuffs];
          for (const buff of hCard.applyBuffs) {
            const label = getBuffMessage(buff);
            if (label) result.messages.push(label);
          }
        }
        if (hCard.applySelfBuffs) {
          result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), ...hCard.applySelfBuffs];
        }
        // 余韻付与: 次のセクハラが入りやすくなる
        result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), { id: 'afterglow', duration: 1 }];
        // ハラスメント成功時はフラストレーション（連続不発カウント）をリセット
        if (targetBuffs.some(b => b.id === 'frustration')) {
          result.consumeOpponentBuffs = [...(result.consumeOpponentBuffs ?? []), 'frustration'];
        }
      } else {
        // === 相手の逆セクハラ → プレイヤーに理性ダメージ ===
        if (hCard.sanityDamage) {
          // sanity_negate: 理性ダメージ無効化
          if (hasBuff(targetBuffs, 'sanity_negate')) {
            result.messages.push(t('engine.harassment.sanityNegate', { name: cn(hCard) }));
          } else {
            let dmg = hCard.sanityDamage;
            dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
            if (hasAfterglow) { dmg += 2; result.messages.push(t('engine.harassment.afterglowSanity')); }
            result.playerSanityDamage += dmg;
            result.messages.push(t('engine.harassment.sanityDamage', { emoji: hCard.emoji, name: cn(hCard), value: dmg }));
          }
        } else if (hCard.drunkDamage) {
          let dmg = hCard.drunkDamage;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
          if (hasAfterglow) { dmg += 2; result.messages.push(t('engine.harassment.afterglow')); }
          result.playerDamage += dmg;
          result.messages.push(t('engine.harassment.drunkDamage', { emoji: hCard.emoji, name: cn(hCard), value: dmg }));
        }

        // バフ付与
        if (hCard.applyBuffs) {
          result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), ...hCard.applyBuffs];
          for (const buff of hCard.applyBuffs) {
            const label = getBuffMessage(buff);
            if (label) result.messages.push(label);
          }
        }
        if (hCard.applySelfBuffs) {
          result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), ...hCard.applySelfBuffs];
        }

        // 手札汚染
        if (hCard.corruptHand) {
          result.corruptCount = (result.corruptCount ?? 0) + hCard.corruptHand;
          result.messages.push(t('engine.harassment.corruptHand', { count: hCard.corruptHand }));
        }
        // 余韻付与: 次の逆セクハラが入りやすくなる
        result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), { id: 'afterglow', duration: 1 }];
        // 逆セクハラ成功時もフラストレーション（連続不発カウント）をリセット
        if (targetBuffs.some(b => b.id === 'frustration')) {
          result.consumePlayerBuffs = [...(result.consumePlayerBuffs ?? []), 'frustration'];
        }
      }
    } else {
      // === 不発 → 焦らし（Frustration）変換 ===
      if (user === 'player') {
        result.messages.push(t('engine.harassment.fail.player', { emoji: hCard.emoji, name: cn(hCard) }));
        // 焦らし: 不発でも相手にフラストレーション蓄積
        const existing = targetBuffs.find(b => b.id === 'frustration');
        const stacks = (existing?.value ?? 0) + 1;
        if (stacks >= 2) {
          // 2スタックで酔い+1 & リセット
          result.opponentDamage += 1;
          result.consumeOpponentBuffs = [...(result.consumeOpponentBuffs ?? []), 'frustration'];
          result.messages.push(t('engine.harassment.frustration.full.player'));
        } else {
          result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), { id: 'frustration', duration: -1, value: stacks }];
          result.messages.push(t('engine.harassment.frustration.building.player', { stacks }));
        }
      } else {
        result.messages.push(t('engine.harassment.fail.opponent', { emoji: hCard.emoji, name: cn(hCard) }));
        // 逆セクハラ不発でもプレイヤーにフラストレーション蓄積
        const existing = targetBuffs.find(b => b.id === 'frustration');
        const stacks = (existing?.value ?? 0) + 1;
        if (stacks >= 2) {
          result.playerDamage += 1;
          result.consumePlayerBuffs = [...(result.consumePlayerBuffs ?? []), 'frustration'];
          result.messages.push(t('engine.harassment.frustration.full.opponent'));
        } else {
          result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), { id: 'frustration', duration: -1, value: stacks }];
          result.messages.push(t('engine.harassment.frustration.building.opponent', { stacks }));
        }
      }
    }

    // 相手のカードも処理（spillで無効化されていなければ）
    if (!result.spillNullified) {
      const otherUser: 'player' | 'opponent' = user === 'player' ? 'opponent' : 'player';
      if (otherCard.type === 'drink') {
        resolveDrinkCard({ card: otherCard, user: otherUser, result, battle, halvesDrink: false, halvesFood: false });
      } else if (otherCard.type === 'food') {
        resolveFoodCard({ card: otherCard, user: otherUser, result, battle, halvesDrink: false, halvesFood: false });
      } else if (otherCard.type === 'chug') {
        this.resolveChugCard(otherCard, hCard, result, otherUser, battle);
      } else if (isUtilityType(otherCard.type)) {
        this.resolveUtilityCard(otherCard, result, otherUser, battle);
      }
    }

    return result;
  },
};


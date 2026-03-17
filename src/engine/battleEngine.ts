import { CARD_DATA, getCardDamage, getEnhancedCard } from '../data/cards.ts';
import type { BattleState, RoundResult, CGEvent, CharacterDef, Buff, CardDef, EffectDef } from '../data/types.ts';
import { randomPick, POSITIVE_BUFF_IDS, getDrunkLevel, hasBuff, getBuffMessage } from './utils.ts';
import i18n from '../i18n/index.ts';

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

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

  // all_dmg_up: 全カードdmg+N（バベルの残響）
  if (hasBuff(attackerBuffs, 'all_dmg_up')) {
    dmg += getBuffValue(attackerBuffs, 'all_dmg_up', 0);
  }

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
  // all_dmg_up: 全ダメージ+N
  if (hasBuff(attackerBuffs, 'all_dmg_up')) {
    dmg += getBuffValue(attackerBuffs, 'all_dmg_up', 0);
  }
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
      result.messages.push(t('engine.extras.selfHeal', { name: card.name, value: card.selfHeal }));
    } else {
      result.opponentHeal += card.selfHeal;
    }
  }

  // selfDamage → 自傷ダメージ
  if (card.selfDamage) {
    if (isPlayer) {
      result.playerDamage += card.selfDamage;
      result.messages.push(t('engine.extras.selfDamage', { name: card.name, value: card.selfDamage }));
    } else {
      result.opponentDamage += card.selfDamage;
    }
  }

  // cleanseSelf → デバフ除去
  if (card.cleanseSelf) {
    if (isPlayer) {
      result.playerCleanseSelf = (result.playerCleanseSelf ?? 0) + card.cleanseSelf;
      result.messages.push(t('engine.extras.cleanseSelf', { name: card.name, count: card.cleanseSelf }));
    } else {
      result.opponentCleanseSelf = (result.opponentCleanseSelf ?? 0) + card.cleanseSelf;
      result.messages.push(t('engine.extras.cleanseSelfOpponent', { name: card.name, count: card.cleanseSelf }));
    }
  }

  // cleanseDot → dot除去
  if (card.cleanseDot) {
    if (isPlayer) {
      result.playerCleanseDot = true;
      result.messages.push(t('engine.extras.cleanseDot', { name: card.name }));
    } else {
      result.opponentCleanseDot = true;
      result.messages.push(t('engine.extras.cleanseDotOpponent', { name: card.name }));
    }
  }

  // corruptHand → 敵の手札汚染
  if (card.corruptHand) {
    if (isPlayer) {
      result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + card.corruptHand;
      result.messages.push(t('engine.extras.corruptHandPlayer', { name: card.name, count: card.corruptHand }));
    } else {
      result.corruptCount = (result.corruptCount ?? 0) + card.corruptHand;
      result.messages.push(t('engine.extras.corruptHandOpponent', { name: card.name, count: card.corruptHand }));
    }
  }

  // discardEnemyHand → 敵の手札破棄（次のドロー時処理）
  if (card.discardEnemyHand) {
    if (isPlayer) {
      result.discardEnemyHandCount = (result.discardEnemyHandCount ?? 0) + card.discardEnemyHand;
      result.messages.push(t('engine.extras.discardEnemyHandPlayer', { name: card.name, count: card.discardEnemyHand }));
    } else {
      result.discardPlayerHandCount = (result.discardPlayerHandCount ?? 0) + card.discardEnemyHand;
      result.messages.push(t('engine.extras.discardEnemyHandOpponent', { name: card.name, count: card.discardEnemyHand }));
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

function processEffect(
  fx: EffectDef,
  cardName: string,
  cardEmoji: string,
  isPlayer: boolean,
  result: ExtendedResult,
  battle: BattleState,
): void {
  switch (fx.type) {
    // --- ダメージ ---
    case 'damage': {
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
      break;
    }

    // --- 回復 ---
    case 'heal': {
      const v = fx.value;
      if (fx.target === 'self') {
        if (isPlayer) result.playerHeal += v;
        else result.opponentHeal += v;
      } else {
        if (isPlayer) result.opponentHeal += v;
        else result.playerHeal += v;
      }
      result.messages.push(t('engine.effect.heal', { emoji: cardEmoji, name: cardName, value: v }));
      break;
    }

    // --- バフ付与 ---
    case 'apply_buff': {
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
      break;
    }

    // --- 敵バフ全除去 ---
    case 'cleanse_enemy_buffs': {
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
      break;
    }

    // --- 自己デバフ除去 ---
    case 'cleanse_self': {
      if (isPlayer) {
        result.playerCleanseSelf = (result.playerCleanseSelf ?? 0) + fx.count;
      } else {
        result.opponentCleanseSelf = (result.opponentCleanseSelf ?? 0) + fx.count;
      }
      result.messages.push(t('engine.effect.cleanseSelf', { emoji: cardEmoji, count: fx.count }));
      break;
    }

    // --- DoT除去 ---
    case 'cleanse_dot': {
      if (isPlayer) result.playerCleanseDot = true;
      else result.opponentCleanseDot = true;
      result.messages.push(t('engine.effect.cleanseDot', { emoji: cardEmoji }));
      break;
    }

    // --- 手札入れ替え ---
    case 'swap_hands': {
      result.swapHandsNextRound = true;
      result.messages.push(t('engine.effect.swapHands', { emoji: cardEmoji, name: cardName }));
      break;
    }

    // --- 酔いLv入れ替え ---
    case 'swap_drunk': {
      result.swapDrunk = true;
      result.messages.push(t('engine.effect.swapDrunk', { emoji: cardEmoji, name: cardName }));
      break;
    }

    // --- カード変身 ---
    case 'transform_card': {
      if (isPlayer) {
        result.transformEnemyCard = fx.cardId;
        result.messages.push(t('engine.effect.transformCard.player', { emoji: cardEmoji, name: cardName }));
      } else {
        result.transformPlayerCard = fx.cardId;
        result.messages.push(t('engine.effect.transformCard.opponent', { emoji: cardEmoji, name: cardName }));
      }
      break;
    }

    // --- トークンカード追加 ---
    case 'grant_card': {
      const cardTarget = fx.target === 'self' ? isPlayer : !isPlayer;
      if (cardTarget) {
        result.playerExtraCard = fx.cardId;
      } else {
        result.opponentExtraCard = fx.cardId;
      }
      const tokenCard = CARD_DATA[fx.cardId];
      const tokenName = tokenCard?.name ?? fx.cardId;
      result.messages.push(t('engine.effect.grantCard', { emoji: cardEmoji, name: cardName, tokenName }));
      break;
    }

    // --- 手札破棄 ---
    case 'discard_hand': {
      if (isPlayer) {
        result.discardEnemyHandCount = (result.discardEnemyHandCount ?? 0) + fx.count;
      } else {
        result.discardPlayerHandCount = (result.discardPlayerHandCount ?? 0) + fx.count;
      }
      result.messages.push(t('engine.effect.discardHand', { emoji: cardEmoji, count: fx.count }));
      break;
    }

    // --- 最強カード破棄 ---
    case 'discard_highest': {
      if (isPlayer) result.discardHighest = true;
      else result.discardPlayerHighest = true;
      result.messages.push(t('engine.effect.discardHighest', { emoji: cardEmoji }));
      break;
    }

    // --- 手札公開 ---
    case 'reveal_hand': {
      if (isPlayer) {
        result.revealedHand = [...battle.opponentHand];
        result.messages.push(t('engine.effect.revealHand.player', { emoji: cardEmoji }));
      } else {
        result.messages.push(t('engine.effect.revealHand.opponent', { emoji: cardEmoji }));
      }
      break;
    }

    // --- 噂話 ---
    case 'rumor': {
      if (isPlayer) {
        result.rumorActive = true;
        result.messages.push(t('engine.effect.rumor.player', { emoji: cardEmoji }));
      } else {
        result.playerRumorActive = true;
        result.messages.push(t('engine.effect.rumor.opponent', { emoji: cardEmoji }));
      }
      break;
    }

    // --- maxRounds減少 ---
    case 'reduce_max_rounds': {
      result.reduceMaxRounds = (result.reduceMaxRounds ?? 0) + fx.value;
      result.messages.push(t('engine.effect.reduceMaxRounds', { emoji: cardEmoji, value: fx.value }));
      break;
    }

    // --- 手札汚染 ---
    case 'corrupt_hand': {
      if (isPlayer) {
        result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + fx.count;
      } else {
        result.corruptCount = (result.corruptCount ?? 0) + fx.count;
      }
      result.messages.push(t('engine.effect.corruptHand', { emoji: cardEmoji, count: fx.count }));
      break;
    }

    // --- 手札枚数削減 ---
    case 'reduce_hand': {
      if (fx.target === 'self') {
        if (isPlayer) result.playerReducedHand = true;
        else result.opponentReducedHand = true;
      } else {
        if (isPlayer) result.opponentReducedHand = true;
        else result.playerReducedHand = true;
      }
      result.messages.push(t('engine.effect.reduceHand', { emoji: cardEmoji }));
      break;
    }

    // --- 即勝利 ---
    case 'instant_win': {
      if (isPlayer) {
        result.instantWin = true;
        result.messages.push(t('engine.effect.instantWin.player', { emoji: cardEmoji, name: cardName }));
      } else {
        result.playerDamage += 99;
        result.messages.push(t('engine.effect.instantWin.opponent', { emoji: cardEmoji, name: cardName }));
      }
      break;
    }

    // --- ルーレット（再帰的に子効果を処理） ---
    case 'roulette': {
      const roll = Math.random();
      if (roll < fx.chance) {
        result.messages.push(t('engine.effect.roulette.hit', { name: cardName }));
        processEffects(fx.success, cardName, cardEmoji, isPlayer, result, battle);
      } else {
        result.messages.push(t('engine.effect.roulette.miss', { name: cardName }));
        processEffects(fx.failure, cardName, cardEmoji, isPlayer, result, battle);
      }
      break;
    }
  }
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
        result.messages.push(t('engine.utility.cleanseSelf.player', { name: card.name, count: card.cleanseSelf }));
      } else {
        result.opponentCleanseSelf = (result.opponentCleanseSelf ?? 0) + card.cleanseSelf!;
        result.messages.push(t('engine.utility.cleanseSelf.opponent', { name: card.name, count: card.cleanseSelf }));
      }
    },
  },
  {
    key: 'cleanseDot',
    handle: ({ card, isPlayer, result }) => {
      if (isPlayer) {
        result.playerCleanseDot = true;
        result.messages.push(t('engine.utility.cleanseDot.player', { name: card.name }));
      } else {
        result.opponentCleanseDot = true;
        result.messages.push(t('engine.utility.cleanseDot.opponent', { name: card.name }));
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
      result.messages.push(t('engine.negate.player', { emoji: oCard.emoji, name: oCard.name }));
      trackBuffConsumption(result, 'player', 'negate_next');
    }
    if (playerNegated) {
      result.messages.push(t('engine.negate.opponent', { emoji: pCard.emoji, name: pCard.name }));
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
        let dmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        if (playerHalvesDrink) dmg = Math.floor(dmg * 0.5);
        result.playerDamage += dmg;
        result.messages.push(t('engine.drink.damage', { emoji: oCard.emoji, name: oCard.name, value: dmg }));
        applyCardExtras(oCard, result, 'opponent');
        if (hasBuff(battle.opponentBuffs, 'next_drink_boost')) {
          trackBuffConsumption(result, 'opponent', 'next_drink_boost');
        }
      } else if (oCard.type === 'chug') {
        return this.resolveChugCard(oCard, pCard, result, 'opponent', battle);
      } else if (oCard.type === 'harassment') {
        return this.resolveHarassmentCard(oCard, pCard, result, 'opponent', battle);
      }
      return result;
    }
    if (isUtilityType(oCard.type)) {
      if (pCard.type === 'drink') {
        let dmg = applyDrinkBuffs(getCardDamage(pCard), battle.playerBuffs, battle.opponentBuffs);
        if (opponentHalvesDrink) dmg = Math.floor(dmg * 0.5);
        result.opponentDamage += dmg;
        result.messages.push(t('engine.drink.damage', { emoji: pCard.emoji, name: pCard.name, value: dmg }));
        applyCardExtras(pCard, result, 'player');
        if (hasBuff(battle.playerBuffs, 'next_drink_boost')) {
          trackBuffConsumption(result, 'player', 'next_drink_boost');
        }
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
      let pDmg = applyDrinkBuffs(getCardDamage(pCard), battle.playerBuffs, battle.opponentBuffs);
      let oDmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);

      if (hasBuff(battle.playerBuffs, 'atk_down')) {
        result.messages.push(t('engine.atkDown.self'));
      }
      if (hasBuff(battle.opponentBuffs, 'atk_down')) {
        result.messages.push(t('engine.atkDown.opponent'));
      }

      if (pDmg > oDmg) {
        result.opponentDamage += pDmg - oDmg;
        result.messages.push(t('engine.drinkVsDrink.playerWins', { pEmoji: pCard.emoji, pName: pCard.name, pDmg, oEmoji: oCard.emoji, oName: oCard.name, oDmg, diff: pDmg - oDmg }));
      } else if (oDmg > pDmg) {
        result.playerDamage += oDmg - pDmg;
        result.messages.push(t('engine.drinkVsDrink.opponentWins', { oEmoji: oCard.emoji, oName: oCard.name, oDmg, pEmoji: pCard.emoji, pName: pCard.name, pDmg, diff: oDmg - pDmg }));
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
    }
    // === ドリンク vs つまみ ===
    else if (pCard.type === 'drink' && oCard.type === 'food') {
      let pDmg = applyDrinkBuffs(getCardDamage(pCard), battle.playerBuffs, battle.opponentBuffs);
      if (opponentHalvesDrink) pDmg = Math.floor(pDmg * 0.5);
      result.opponentDamage += pDmg;
      if (hasBuff(battle.opponentBuffs, 'no_food')) {
        result.messages.push(t('engine.drink.damage', { emoji: pCard.emoji, name: pCard.name, value: pDmg }));
        result.messages.push(t('engine.food.blocked.opponent', { emoji: oCard.emoji, name: oCard.name }));
      } else {
        let heal = oCard.heal === 99 ? Math.max(0, battle.opponentDrunk + pDmg) : (oCard.heal ?? 0);
        heal = applyFoodBuffs(heal, battle.opponentBuffs);
        if (playerHalvesFood) heal = Math.floor(heal * 0.5);
        result.opponentHeal += heal;
        result.messages.push(t('engine.drink.damage', { emoji: pCard.emoji, name: pCard.name, value: pDmg }));
        result.messages.push(t('engine.food.heal', { emoji: oCard.emoji, name: oCard.name, value: heal }));
        applyCardExtras(oCard, result, 'opponent');
        if (hasBuff(battle.opponentBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, 'opponent', 'next_food_boost');
        }
      }
      applyCardExtras(pCard, result, 'player');
      if (hasBuff(battle.playerBuffs, 'next_drink_boost')) {
        trackBuffConsumption(result, 'player', 'next_drink_boost');
      }
    }
    else if (pCard.type === 'food' && oCard.type === 'drink') {
      if (hasBuff(battle.playerBuffs, 'no_food')) {
        result.messages.push(t('engine.food.blocked.self', { emoji: pCard.emoji, name: pCard.name }));
        let oDmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        if (playerHalvesDrink) oDmg = Math.floor(oDmg * 0.5);
        result.playerDamage += oDmg;
        result.messages.push(t('engine.drink.damage', { emoji: oCard.emoji, name: oCard.name, value: oDmg }));
      } else {
        let oDmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        if (playerHalvesDrink) oDmg = Math.floor(oDmg * 0.5);
        result.playerDamage += oDmg;
        let heal = pCard.heal === 99 ? Math.max(0, battle.playerDrunk + oDmg) : (pCard.heal ?? 0);
        heal = applyFoodBuffs(heal, battle.playerBuffs);
        if (opponentHalvesFood) heal = Math.floor(heal * 0.5);
        result.playerHeal += heal;
        result.messages.push(t('engine.drink.damage', { emoji: oCard.emoji, name: oCard.name, value: oDmg }));
        result.messages.push(t('engine.food.heal', { emoji: pCard.emoji, name: pCard.name, value: heal }));
        applyCardExtras(pCard, result, 'player');
        if (hasBuff(battle.playerBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, 'player', 'next_food_boost');
        }
      }
      applyCardExtras(oCard, result, 'opponent');
      if (hasBuff(battle.opponentBuffs, 'next_drink_boost')) {
        trackBuffConsumption(result, 'opponent', 'next_drink_boost');
      }
    }
    // === つまみ vs つまみ ===
    else if (pCard.type === 'food' && oCard.type === 'food') {
      if (hasBuff(battle.playerBuffs, 'no_food')) {
        result.messages.push(t('engine.food.blocked.self', { emoji: pCard.emoji, name: pCard.name }));
      } else {
        let heal = pCard.heal === 99 ? Math.max(0, battle.playerDrunk) : (pCard.heal ?? 0);
        heal = applyFoodBuffs(heal, battle.playerBuffs);
        if (opponentHalvesFood) heal = Math.floor(heal * 0.5);
        result.playerHeal += heal;
        result.messages.push(t('engine.food.heal', { emoji: pCard.emoji, name: pCard.name, value: heal }));
        applyCardExtras(pCard, result, 'player');
        if (hasBuff(battle.playerBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, 'player', 'next_food_boost');
        }
      }
      if (hasBuff(battle.opponentBuffs, 'no_food')) {
        result.messages.push(t('engine.food.blocked.opponentAlso', { emoji: oCard.emoji, name: oCard.name }));
      } else {
        let heal = oCard.heal === 99 ? Math.max(0, battle.opponentDrunk) : (oCard.heal ?? 0);
        heal = applyFoodBuffs(heal, battle.opponentBuffs);
        if (playerHalvesFood) heal = Math.floor(heal * 0.5);
        result.opponentHeal += heal;
        result.messages.push(t('engine.food.healOpponent', { emoji: oCard.emoji, name: oCard.name, value: heal }));
        applyCardExtras(oCard, result, 'opponent');
        if (hasBuff(battle.opponentBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, 'opponent', 'next_food_boost');
        }
      }
      result.messages.push(t('engine.food.peacefulRound'));
    }

    return result;
  },

  /**
   * 片方のカードだけ解決（negate_nextで相手が無効化された場合）
   */
  resolveSingleCard(activeCard: CardDef, _nullifiedCard: CardDef, result: ExtendedResult, user: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    const isPlayer = user === 'player';

    if (isUtilityType(activeCard.type)) {
      this.resolveUtilityCard(activeCard, result, user, battle);
    } else if (activeCard.type === 'drink') {
      const attackerBuffs = isPlayer ? battle.playerBuffs : battle.opponentBuffs;
      const defenderBuffs = isPlayer ? battle.opponentBuffs : battle.playerBuffs;
      const dmg = applyDrinkBuffs(getCardDamage(activeCard), attackerBuffs, defenderBuffs);
      if (isPlayer) {
        result.opponentDamage += dmg;
        result.messages.push(t('engine.drink.damage', { emoji: activeCard.emoji, name: activeCard.name, value: dmg }));
      } else {
        result.playerDamage += dmg;
        result.messages.push(t('engine.drink.damage', { emoji: activeCard.emoji, name: activeCard.name, value: dmg }));
      }
      applyCardExtras(activeCard, result, user);
      if (hasBuff(attackerBuffs, 'next_drink_boost')) {
        trackBuffConsumption(result, user, 'next_drink_boost');
      }
    } else if (activeCard.type === 'food') {
      const userBuffs = isPlayer ? battle.playerBuffs : battle.opponentBuffs;
      if (hasBuff(userBuffs, 'no_food')) {
        result.messages.push(t('engine.food.blocked.self', { emoji: activeCard.emoji, name: activeCard.name }));
      } else {
        const drunkVal = isPlayer ? battle.playerDrunk : battle.opponentDrunk;
        let heal = activeCard.heal === 99 ? Math.max(0, drunkVal) : (activeCard.heal ?? 0);
        heal = applyFoodBuffs(heal, userBuffs);
        if (isPlayer) {
          result.playerHeal += heal;
        } else {
          result.opponentHeal += heal;
        }
        result.messages.push(t('engine.food.heal', { emoji: activeCard.emoji, name: activeCard.name, value: heal }));
        applyCardExtras(activeCard, result, user);
        if (hasBuff(userBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, user, 'next_food_boost');
        }
      }
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
      result.messages.push(t('engine.utility.cardPlay', { emoji: card.emoji, name: card.name }));
      processEffects(card.effects, card.name, card.emoji, isPlayer, result, battle);
      // effects[]内にapply_buffがある場合はlegacyバフ適用をスキップ（二重付与防止）
      const hasApplyBuff = card.effects.some(e => e.type === 'apply_buff');
      if (!hasApplyBuff) applyLegacyBuffs(card, isPlayer, result);
      return;
    }

    result.messages.push(t('engine.utility.cardPlay', { emoji: card.emoji, name: card.name }));

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
      processEffects(chugCard.effects, chugCard.name, chugCard.emoji, isPlayer, result, battle);
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
        result.messages.push(t('engine.chug.player', { name: chugCard.name, enemyDmg: chugCard.enemyDamage, selfDmg: chugCard.selfDamage }));
      } else {
        result.playerDamage += chugCard.enemyDamage ?? 0;
        result.opponentDamage += chugCard.selfDamage ?? 0;
        result.messages.push(t('engine.chug.opponent', { name: chugCard.name, value: chugCard.enemyDamage }));
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
          result.messages.push(t('engine.roulette.hit.player', { name: chugCard.name, value: successDmg }));
        } else {
          result.playerDamage += successDmg;
          result.messages.push(t('engine.roulette.hit.opponent', { name: chugCard.name, value: successDmg }));
        }
      } else {
        // 失敗: 自分にダメージ
        if (chugUser === 'player') {
          result.playerDamage += failDmg;
          result.messages.push(t('engine.roulette.miss.player', { name: chugCard.name, value: failDmg }));
        } else {
          result.opponentDamage += failDmg;
          result.messages.push(t('engine.roulette.miss.opponent', { name: chugCard.name, value: failDmg }));
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
    // chug vs chug の場合は各chugが個別解決されるので、ここでは何もしない
    if (otherCard.type === 'chug') return;

    const otherUser: 'player' | 'opponent' = chugUser === 'player' ? 'opponent' : 'player';
    const isOtherPlayer = otherUser === 'player';

    if (otherCard.type === 'drink') {
      const attackerBuffs = isOtherPlayer ? battle.playerBuffs : battle.opponentBuffs;
      const defenderBuffs = isOtherPlayer ? battle.opponentBuffs : battle.playerBuffs;
      const dmg = applyDrinkBuffs(getCardDamage(otherCard), attackerBuffs, defenderBuffs);
      if (isOtherPlayer) {
        result.opponentDamage += dmg;
        result.messages.push(t('engine.drink.damageToOpponent', { emoji: otherCard.emoji, name: otherCard.name, value: dmg }));
      } else {
        result.playerDamage += dmg;
        result.messages.push(t('engine.drink.damageFromOpponent', { emoji: otherCard.emoji, name: otherCard.name, value: dmg }));
      }
      applyCardExtras(otherCard, result, otherUser);
      if (hasBuff(attackerBuffs, 'next_drink_boost')) {
        trackBuffConsumption(result, otherUser, 'next_drink_boost');
      }
    } else if (otherCard.type === 'food') {
      const userBuffs = isOtherPlayer ? battle.playerBuffs : battle.opponentBuffs;
      if (hasBuff(userBuffs, 'no_food')) {
        result.messages.push(t('engine.food.blocked.self', { emoji: otherCard.emoji, name: otherCard.name }));
      } else {
        const drunkVal = isOtherPlayer ? battle.playerDrunk : battle.opponentDrunk;
        let heal = otherCard.heal === 99 ? Math.max(0, drunkVal) : (otherCard.heal ?? 0);
        heal = applyFoodBuffs(heal, userBuffs);
        if (isOtherPlayer) {
          result.playerHeal += heal;
        } else {
          result.opponentHeal += heal;
        }
        result.messages.push(t('engine.food.heal', { emoji: otherCard.emoji, name: otherCard.name, value: heal }));
        applyCardExtras(otherCard, result, otherUser);
        if (hasBuff(userBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, otherUser, 'next_food_boost');
        }
      }
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
      result.messages.push(t('engine.harassment.stealth', { name: hCard.name }));
    } else if (triggerLevel >= adjustedRequired) {
      // === 成功 ===
      // afterglow ダメージボーナス
      const hasAfterglow = hasBuff(targetBuffs, 'afterglow');
      if (user === 'player') {
        if (hCard.instantWin) {
          result.instantWin = true;
          result.messages.push(t('engine.harassment.instantWin', { emoji: hCard.emoji, name: hCard.name }));
        } else {
          let dmg = hCard.drunkDamage ?? 0;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
          if (hasAfterglow) { dmg += 2; result.messages.push(t('engine.harassment.afterglow')); }
          // カード個別特殊効果
          if (hCard.id === 'wall_pin') {
            result.clearAllOpponentBuffs = true;
            result.messages.push(t('engine.harassment.wallPin'));
          }
          if (hCard.id === 'ear_bite') {
            // 相手の next_drink_boost を奪う
            const stealBuff = targetBuffs.find(b => b.id === 'next_drink_boost');
            if (stealBuff) {
              result.consumeOpponentBuffs = [...(result.consumeOpponentBuffs ?? []), 'next_drink_boost'];
              result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), { id: 'next_drink_boost', duration: stealBuff.duration, value: stealBuff.value }];
              result.messages.push(t('engine.harassment.earBite'));
            }
          }
          if (hCard.id === 'breast_touch') {
            // 手札のDrink1枚→デッキからHarassment1枚交換
            result.swapDrinkForHarassment = true;
            result.messages.push(t('engine.harassment.breastTouch'));
          }
          result.opponentDamage += dmg;
          result.messages.push(t('engine.harassment.success', { emoji: hCard.emoji, name: hCard.name, value: dmg }));
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
            result.messages.push(t('engine.harassment.sanityNegate', { name: hCard.name }));
          } else {
            let dmg = hCard.sanityDamage;
            dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
            if (hasAfterglow) { dmg += 2; result.messages.push(t('engine.harassment.afterglowSanity')); }
            result.playerSanityDamage += dmg;
            result.messages.push(t('engine.harassment.sanityDamage', { emoji: hCard.emoji, name: hCard.name, value: dmg }));
          }
        } else if (hCard.drunkDamage) {
          let dmg = hCard.drunkDamage;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
          if (hasAfterglow) { dmg += 2; result.messages.push(t('engine.harassment.afterglow')); }
          result.playerDamage += dmg;
          result.messages.push(t('engine.harassment.drunkDamage', { emoji: hCard.emoji, name: hCard.name, value: dmg }));
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
        result.messages.push(t('engine.harassment.fail.player', { emoji: hCard.emoji, name: hCard.name }));
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
        result.messages.push(t('engine.harassment.fail.opponent', { emoji: hCard.emoji, name: hCard.name }));
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

    // 相手のカードも処理
    if (!result.spillNullified) {
      const otherUser: 'player' | 'opponent' = user === 'player' ? 'opponent' : 'player';
      if (otherCard.type === 'drink') {
        const baseDmg = getCardDamage(otherCard);
        if (user === 'player') {
          const dmg = applyDrinkBuffs(baseDmg, battle.opponentBuffs, battle.playerBuffs);
          result.playerDamage += dmg;
          result.messages.push(`相手の${otherCard.emoji}${otherCard.name}で酔い${dmg}ダメージ！`);
          applyCardExtras(otherCard, result, 'opponent');
          if (hasBuff(battle.opponentBuffs, 'next_drink_boost')) {
            trackBuffConsumption(result, 'opponent', 'next_drink_boost');
          }
        } else {
          const dmg = applyDrinkBuffs(baseDmg, battle.playerBuffs, battle.opponentBuffs);
          result.opponentDamage += dmg;
          result.messages.push(`${otherCard.emoji}${otherCard.name}で相手に酔い${dmg}ダメージ！`);
          applyCardExtras(otherCard, result, 'player');
          if (hasBuff(battle.playerBuffs, 'next_drink_boost')) {
            trackBuffConsumption(result, 'player', 'next_drink_boost');
          }
        }
      } else if (otherCard.type === 'food') {
        const foodUserBuffs = user === 'player' ? battle.opponentBuffs : battle.playerBuffs;
        if (hasBuff(foodUserBuffs, 'no_food')) {
          result.messages.push(`🚫 つまみ封じ中！${otherCard.emoji}${otherCard.name}が使えない！`);
        } else {
          const drunkVal = user === 'player' ? battle.opponentDrunk : battle.playerDrunk;
          let heal = otherCard.heal === 99 ? Math.max(0, drunkVal) : (otherCard.heal ?? 0);
          heal = applyFoodBuffs(heal, foodUserBuffs);
          if (otherUser === 'player') {
            result.playerHeal += heal;
          } else {
            result.opponentHeal += heal;
          }
          result.messages.push(`${otherCard.emoji} ${otherCard.name}で${heal}回復！`);
          applyCardExtras(otherCard, result, otherUser);
          if (hasBuff(foodUserBuffs, 'next_food_boost')) {
            trackBuffConsumption(result, otherUser, 'next_food_boost');
          }
        }
      } else if (otherCard.type === 'chug') {
        this.resolveChugCard(otherCard, hCard, result, otherUser, battle);
      } else if (isUtilityType(otherCard.type)) {
        this.resolveUtilityCard(otherCard, result, otherUser, battle);
      }
    }

    return result;
  },
};


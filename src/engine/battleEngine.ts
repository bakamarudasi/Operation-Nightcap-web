import { CARD_DATA, getCardDamage } from '../data/cards.ts';
import type { BattleState, RoundResult, CGEvent, CharacterDef, Buff, CardDef, EffectDef } from '../data/types.ts';
import { randomPick, POSITIVE_BUFF_IDS } from './utils.ts';

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

/** strategy / environment / status を「ユーティリティ」として判定 */
function isUtilityType(type: string): boolean {
  return type === 'strategy' || type === 'environment' || type === 'status';
}

function getDrunkLevel(drunkValue: number): number {
  if (drunkValue >= 10) return 4;
  if (drunkValue >= 7) return 3;
  if (drunkValue >= 4) return 2;
  if (drunkValue >= 2) return 1;
  return 0;
}

/** バフがアクティブかチェック */
function hasBuff(buffs: Buff[], id: string): boolean {
  return buffs.some(b => b.id === id);
}

/** 特定バフの値を取得（なければデフォルト） */
function getBuffValue(buffs: Buff[], id: string, defaultVal: number): number {
  const buff = buffs.find(b => b.id === id);
  return buff?.value ?? defaultVal;
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
function getAdjustedRequiredLevel(requiredLevel: number, userBuffs: Buff[], targetBuffs: Buff[], isInstantWin?: boolean): number {
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
      const label = buffLabel(buff);
      if (label) result.messages.push(label);
    }
  }

  // applySelfBuffs → 自分にバフ付与
  if (card.applySelfBuffs) {
    const self = isPlayer ? result.newPlayerBuffs! : result.newOpponentBuffs!;
    self.push(...card.applySelfBuffs);
    for (const buff of card.applySelfBuffs) {
      const label = buffLabel(buff);
      if (label) result.messages.push(label);
    }
  }

  // selfHeal → ドレイン効果（自分回復）
  if (card.selfHeal) {
    if (isPlayer) {
      result.playerHeal += card.selfHeal;
      result.messages.push(`💚 ${card.name}のドレイン効果！酔い${card.selfHeal}回復！`);
    } else {
      result.opponentHeal += card.selfHeal;
    }
  }

  // selfDamage → 自傷ダメージ
  if (card.selfDamage) {
    if (isPlayer) {
      result.playerDamage += card.selfDamage;
      result.messages.push(`💉 ${card.name}の副作用…自分に${card.selfDamage}ダメージ！`);
    } else {
      result.opponentDamage += card.selfDamage;
    }
  }

  // cleanseSelf → デバフ除去
  if (card.cleanseSelf) {
    if (isPlayer) {
      result.playerCleanseSelf = (result.playerCleanseSelf ?? 0) + card.cleanseSelf;
      result.messages.push(`💊 ${card.name}の効果！デバフ${card.cleanseSelf}つ除去！`);
    } else {
      result.opponentCleanseSelf = (result.opponentCleanseSelf ?? 0) + card.cleanseSelf;
      result.messages.push(`💊 相手の${card.name}でデバフ${card.cleanseSelf}つ除去！`);
    }
  }

  // cleanseDot → dot除去
  if (card.cleanseDot) {
    if (isPlayer) {
      result.playerCleanseDot = true;
      result.messages.push(`🌿 ${card.name}の効果！持続ダメージを除去！`);
    } else {
      result.opponentCleanseDot = true;
      result.messages.push(`🌿 相手の${card.name}で持続ダメージ除去！`);
    }
  }

  // corruptHand → 敵の手札汚染
  if (card.corruptHand) {
    if (isPlayer) {
      result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + card.corruptHand;
      result.messages.push(`🔥 ${card.name}の効果！相手の手札${card.corruptHand}枚が発情状態に！`);
    } else {
      result.corruptCount = (result.corruptCount ?? 0) + card.corruptHand;
      result.messages.push(`🔥 ${card.name}の効果！手札${card.corruptHand}枚が発情状態に…！`);
    }
  }

  // discardEnemyHand → 敵の手札破棄（次のドロー時処理）
  if (card.discardEnemyHand) {
    if (isPlayer) {
      result.discardEnemyHandCount = (result.discardEnemyHandCount ?? 0) + card.discardEnemyHand;
      result.messages.push(`🌌 ${card.name}の効果！相手の手札${card.discardEnemyHand}枚が記憶から消える…`);
    } else {
      result.discardPlayerHandCount = (result.discardPlayerHandCount ?? 0) + card.discardEnemyHand;
      result.messages.push(`🌌 ${card.name}の効果！手札${card.discardEnemyHand}枚が記憶から消える…`);
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
        result.messages.push(`${cardEmoji} ${cardName}！全員に${v}ダメージ！`);
      } else if (fx.target === 'enemy') {
        result.messages.push(`${cardEmoji} ${cardName}！${isPlayer ? '相手' : 'こちら'}に${v}ダメージ！`);
      } else {
        result.messages.push(`${cardEmoji} ${cardName}！自分に${v}ダメージ！`);
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
      result.messages.push(`${cardEmoji} ${cardName}！${v}回復！`);
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
        result.messages.push(`${cardEmoji} ${count}個のバフを剥がし、${count}ダメージ！`);
      } else {
        result.messages.push(`${cardEmoji} …しかし相手にバフがなかった！`);
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
      result.messages.push(`${cardEmoji} デバフを${fx.count}個除去！`);
      break;
    }

    // --- DoT除去 ---
    case 'cleanse_dot': {
      if (isPlayer) result.playerCleanseDot = true;
      else result.opponentCleanseDot = true;
      result.messages.push(`${cardEmoji} 継続ダメージを除去！`);
      break;
    }

    // --- 手札入れ替え ---
    case 'swap_hands': {
      result.swapHandsNextRound = true;
      result.messages.push(`${cardEmoji} ${cardName}！次ラウンドの手札が入れ替わる！`);
      break;
    }

    // --- 酔いLv入れ替え ---
    case 'swap_drunk': {
      result.swapDrunk = true;
      result.messages.push(`${cardEmoji} ${cardName}！酔いレベルが入れ替わった！`);
      break;
    }

    // --- カード変身 ---
    case 'transform_card': {
      if (isPlayer) {
        result.transformEnemyCard = fx.cardId;
        result.messages.push(`${cardEmoji} ${cardName}…相手の手札が変えられる…！`);
      } else {
        result.transformPlayerCard = fx.cardId;
        result.messages.push(`${cardEmoji} ${cardName}…手札の一枚が変えられた…！`);
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
      result.messages.push(`${cardEmoji} ${cardName}…${tokenName}が次ラウンドに参戦！`);
      break;
    }

    // --- 手札破棄 ---
    case 'discard_hand': {
      if (isPlayer) {
        result.discardEnemyHandCount = (result.discardEnemyHandCount ?? 0) + fx.count;
      } else {
        result.discardPlayerHandCount = (result.discardPlayerHandCount ?? 0) + fx.count;
      }
      result.messages.push(`${cardEmoji} 相手の手札を${fx.count}枚破棄！`);
      break;
    }

    // --- 最強カード破棄 ---
    case 'discard_highest': {
      if (isPlayer) result.discardHighest = true;
      else result.discardPlayerHighest = true;
      result.messages.push(`${cardEmoji} 相手の最強カードを破棄！`);
      break;
    }

    // --- 手札公開 ---
    case 'reveal_hand': {
      if (isPlayer) {
        result.revealedHand = [...battle.opponentHand];
        result.messages.push(`${cardEmoji} 相手の手札が見えた！`);
      } else {
        result.messages.push(`${cardEmoji} 手の内が見られている…！`);
      }
      break;
    }

    // --- 噂話 ---
    case 'rumor': {
      if (isPlayer) {
        result.rumorActive = true;
        result.messages.push(`${cardEmoji} 相手の次の手札が乱される！`);
      } else {
        result.playerRumorActive = true;
        result.messages.push(`${cardEmoji} 次の手札が乱された！`);
      }
      break;
    }

    // --- maxRounds減少 ---
    case 'reduce_max_rounds': {
      result.reduceMaxRounds = (result.reduceMaxRounds ?? 0) + fx.value;
      result.messages.push(`${cardEmoji} 残りラウンドが${fx.value}減少！`);
      break;
    }

    // --- 手札汚染 ---
    case 'corrupt_hand': {
      if (isPlayer) {
        result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + fx.count;
      } else {
        result.corruptCount = (result.corruptCount ?? 0) + fx.count;
      }
      result.messages.push(`${cardEmoji} 相手の手札を${fx.count}枚汚染！`);
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
      result.messages.push(`${cardEmoji} 次ラウンドの手札が減る！`);
      break;
    }

    // --- 即勝利 ---
    case 'instant_win': {
      if (isPlayer) {
        result.instantWin = true;
        result.messages.push(`${cardEmoji} ${cardName}…奇跡！即勝利！！`);
      } else {
        result.playerDamage += 99;
        result.messages.push(`${cardEmoji} ${cardName}…一撃で沈められた…！`);
      }
      break;
    }

    // --- ルーレット（再帰的に子効果を処理） ---
    case 'roulette': {
      const roll = Math.random();
      if (roll < fx.chance) {
        result.messages.push(`🎲 ${cardName}…当たり！`);
        processEffects(fx.success, cardName, cardEmoji, isPlayer, result, battle);
      } else {
        result.messages.push(`🎲 ${cardName}…ハズレ！`);
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
        result.messages.push(`相手の手札が見えた！`);
      } else {
        result.messages.push(`手の内が見られている…！`);
      }
    },
  },
  {
    key: 'triggerRumor',
    handle: ({ isPlayer, result }) => {
      if (isPlayer) {
        result.rumorActive = true;
        result.messages.push(`相手の次の手札が乱される！`);
      } else {
        result.playerRumorActive = true;
        result.messages.push(`次の手札が乱された！`);
      }
    },
  },
  {
    key: 'swapDrunk',
    handle: ({ result }) => {
      result.swapDrunk = true;
      result.messages.push(`酔いレベルが入れ替わった！`);
    },
  },
  {
    key: 'discardHighest',
    handle: ({ isPlayer, result }) => {
      if (isPlayer) {
        result.discardHighest = true;
        result.messages.push(`相手の最強カードが没収された！`);
      } else {
        result.discardPlayerHighest = true;
        result.messages.push(`最強のカードが奪われた！`);
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
      result.messages.push(isPlayer ? `相手の手札${card.discardEnemyHand}枚が消える…` : `手札${card.discardEnemyHand}枚が消された…`);
    },
  },
  {
    key: 'reduceMaxRounds',
    handle: ({ card, result }) => {
      result.reduceMaxRounds = card.reduceMaxRounds;
      result.messages.push(`残りラウンドが${card.reduceMaxRounds}減少！決着を急げ！`);
    },
  },
  {
    key: 'applyBuffs',
    handle: ({ card, targetBuffs, result }) => {
      targetBuffs.push(...card.applyBuffs!);
      for (const buff of card.applyBuffs!) {
        const label = buffLabel(buff);
        if (label) result.messages.push(label);
      }
    },
  },
  {
    key: 'applySelfBuffs',
    handle: ({ card, selfBuffs, result }) => {
      selfBuffs.push(...card.applySelfBuffs!);
      for (const buff of card.applySelfBuffs!) {
        const label = buffLabel(buff);
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
        const label = buffLabel(buff);
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
      result.messages.push(`💚 ドレイン効果！${card.selfHeal}回復！`);
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
      result.messages.push(`💉 副作用…${card.selfDamage}ダメージ！`);
    },
  },
  {
    key: 'corruptHand',
    handle: ({ card, isPlayer, result }) => {
      if (isPlayer) {
        result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + card.corruptHand!;
        result.messages.push(`🔥 相手の手札${card.corruptHand}枚が発情状態に！`);
      } else {
        result.corruptCount = (result.corruptCount ?? 0) + card.corruptHand!;
        result.messages.push(`🔥 手札${card.corruptHand}枚が発情状態に…！`);
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
    // reflect_all: 受けたダメージを全て相手に跳ね返す（DoT除外）
    const playerDoT = calcDoTDamage(battle.playerBuffs);
    const opponentDoT = calcDoTDamage(battle.opponentBuffs);

    if (hasBuff(battle.playerBuffs, 'reflect_all')) {
      const reflectable = result.playerDamage - playerDoT;
      if (reflectable > 0) {
        result.opponentDamage += reflectable;
        result.playerDamage -= reflectable;
        result.messages.push(`🛡️ 般若の酒壁！${reflectable}ダメージが全て跳ね返った！`);
      }
    }
    if (hasBuff(battle.opponentBuffs, 'reflect_all')) {
      const reflectable = result.opponentDamage - opponentDoT;
      if (reflectable > 0) {
        result.playerDamage += reflectable;
        result.opponentDamage -= reflectable;
        result.messages.push(`🛡️ 相手の酒壁！${reflectable}ダメージが跳ね返された！`);
      }
    }

    // thorns: ダメージを受けたら固定値を反射
    if (result.playerDamage > 0 && hasBuff(battle.playerBuffs, 'thorns')) {
      const thornsVal = getBuffValue(battle.playerBuffs, 'thorns', 0);
      if (thornsVal > 0) {
        result.opponentDamage += thornsVal;
        result.messages.push(`⚖️ 裁きの反射！相手に${thornsVal}ダメージ！`);
      }
    }
    if (result.opponentDamage > 0 && hasBuff(battle.opponentBuffs, 'thorns')) {
      const thornsVal = getBuffValue(battle.opponentBuffs, 'thorns', 0);
      if (thornsVal > 0) {
        result.playerDamage += thornsVal;
        result.messages.push(`⚖️ 相手の裁き反射！${thornsVal}ダメージ！`);
      }
    }

    return result;
  },

  _resolveRoundCore(playerCardId: string, opponentCardId: string, battle: BattleState, currentOpponent?: CharacterDef | null): ExtendedResult {
    const pCard = CARD_DATA[playerCardId];
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
      newPlayerBuffs: [],
      newOpponentBuffs: [],
      corruptCount: 0,
      playerSanityDamage: 0,
      opponentSanityDamage: 0,
      playerSanityHeal: 0,
      opponentSanityHeal: 0,
    };

    // === フェーズ0: DoTバフのtick処理 ===
    const playerDoT = calcDoTDamage(battle.playerBuffs);
    if (playerDoT > 0) {
      result.playerDamage += playerDoT;
      result.messages.push(`💔 持続ダメージ…酔いが${playerDoT}回る！`);
    }
    const opponentDoT = calcDoTDamage(battle.opponentBuffs);
    if (opponentDoT > 0) {
      result.opponentDamage += opponentDoT;
      result.messages.push(`💔 相手も持続ダメージ…酔い+${opponentDoT}！`);
    }

    // === フェーズ0.5: negate_nextチェック ===
    // プレイヤーがnegate_next → 相手のカード効果を完全無効化
    const opponentNegated = hasBuff(battle.playerBuffs, 'negate_next');
    // 相手がnegate_next → プレイヤーのカード効果を完全無効化
    const playerNegated = hasBuff(battle.opponentBuffs, 'negate_next');
    if (opponentNegated) {
      result.messages.push(`🃏 ポーカーフェイス発動！相手の${oCard.emoji}${oCard.name}を無効化！`);
      trackBuffConsumption(result, 'player', 'negate_next');
    }
    if (playerNegated) {
      result.messages.push(`🃏 相手のポーカーフェイス発動！${pCard.emoji}${pCard.name}が無効化された！`);
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
      result.messages.push('😵 スタン状態！行動できない…！');
      if (oCard.type === 'drink') {
        const dmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        result.playerDamage += dmg;
        result.messages.push(`${oCard.emoji} 無防備なところに${oCard.name}！酔い+${dmg}！`);
        applyCardExtras(oCard, result, 'opponent');
      } else if (oCard.type === 'harassment') {
        return this.resolveHarassmentCard(oCard, pCard, result, 'opponent', battle);
      }
      return result;
    }

    if (opponentStunned) {
      result.messages.push('😵 相手がスタン状態！');
      if (pCard.type === 'drink') {
        const dmg = applyDrinkBuffs(getCardDamage(pCard), battle.playerBuffs, battle.opponentBuffs);
        result.opponentDamage += dmg;
        result.messages.push(`${pCard.emoji} ${pCard.name}が直撃！酔い+${dmg}！`);
        applyCardExtras(pCard, result, 'player');
        if (hasBuff(battle.playerBuffs, 'next_drink_boost')) {
          trackBuffConsumption(result, 'player', 'next_drink_boost');
        }
      } else if (pCard.type === 'harassment') {
        return this.resolveHarassmentCard(pCard, oCard, result, 'player', battle);
      }
      return result;
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
        const dmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        result.playerDamage += dmg;
        result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${dmg}ダメージ！`);
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
        const dmg = applyDrinkBuffs(getCardDamage(pCard), battle.playerBuffs, battle.opponentBuffs);
        result.opponentDamage += dmg;
        result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${dmg}ダメージ！`);
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
        result.messages.push(`⬇️ 攻撃力低下中…ダメージ半減！`);
      }
      if (hasBuff(battle.opponentBuffs, 'atk_down')) {
        result.messages.push(`⬇️ 相手も攻撃力低下中…ダメージ半減！`);
      }

      if (pDmg > oDmg) {
        result.opponentDamage += pDmg - oDmg;
        result.messages.push(`${pCard.emoji} ${pCard.name}(${pDmg}) vs ${oCard.emoji} ${oCard.name}(${oDmg}) → 差分${pDmg - oDmg}ダメージ！`);
      } else if (oDmg > pDmg) {
        result.playerDamage += oDmg - pDmg;
        result.messages.push(`${oCard.emoji} ${oCard.name}(${oDmg}) vs ${pCard.emoji} ${pCard.name}(${pDmg}) → 差分${oDmg - pDmg}ダメージ！`);
      } else {
        result.messages.push(`${pCard.emoji} vs ${oCard.emoji} 同値！相殺！`);
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
      result.opponentDamage += pDmg;
      if (hasBuff(battle.opponentBuffs, 'no_food')) {
        result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${pDmg}ダメージ！`);
        result.messages.push(`🚫 相手はつまみ封じ中！${oCard.emoji}${oCard.name}が使えない！`);
      } else {
        let heal = oCard.heal === 99 ? Math.max(0, battle.opponentDrunk + pDmg) : (oCard.heal ?? 0);
        heal = applyFoodBuffs(heal, battle.opponentBuffs);
        result.opponentHeal = heal;
        result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${pDmg}ダメージ！`);
        result.messages.push(`${oCard.emoji} ${oCard.name}で${result.opponentHeal}回復！`);
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
        result.messages.push(`🚫 つまみ封じ中！${pCard.emoji}${pCard.name}が使えない！`);
        const oDmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        result.playerDamage += oDmg;
        result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${oDmg}ダメージ！`);
      } else {
        const oDmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        result.playerDamage += oDmg;
        let heal = pCard.heal === 99 ? Math.max(0, battle.playerDrunk + oDmg) : (pCard.heal ?? 0);
        heal = applyFoodBuffs(heal, battle.playerBuffs);
        result.playerHeal = heal;
        result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${oDmg}ダメージ！`);
        result.messages.push(`${pCard.emoji} ${pCard.name}で${result.playerHeal}回復！`);
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
        result.messages.push(`🚫 つまみ封じ中！${pCard.emoji}${pCard.name}が使えない！`);
      } else {
        let heal = pCard.heal === 99 ? Math.max(0, battle.playerDrunk) : (pCard.heal ?? 0);
        heal = applyFoodBuffs(heal, battle.playerBuffs);
        result.playerHeal = heal;
        result.messages.push(`${pCard.emoji} ${pCard.name}で${result.playerHeal}回復！`);
        applyCardExtras(pCard, result, 'player');
        if (hasBuff(battle.playerBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, 'player', 'next_food_boost');
        }
      }
      if (hasBuff(battle.opponentBuffs, 'no_food')) {
        result.messages.push(`🚫 相手もつまみ封じ中！${oCard.emoji}${oCard.name}が使えない！`);
      } else {
        let heal = oCard.heal === 99 ? Math.max(0, battle.opponentDrunk) : (oCard.heal ?? 0);
        heal = applyFoodBuffs(heal, battle.opponentBuffs);
        result.opponentHeal = heal;
        result.messages.push(`${oCard.emoji} ${oCard.name}で相手も${result.opponentHeal}回復！`);
        applyCardExtras(oCard, result, 'opponent');
        if (hasBuff(battle.opponentBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, 'opponent', 'next_food_boost');
        }
      }
      result.messages.push('平和なラウンド…お互いつまみを食べた');
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
        result.messages.push(`${activeCard.emoji} ${activeCard.name}で酔い${dmg}ダメージ！`);
      } else {
        result.playerDamage += dmg;
        result.messages.push(`${activeCard.emoji} ${activeCard.name}で酔い${dmg}ダメージ！`);
      }
      applyCardExtras(activeCard, result, user);
      if (hasBuff(attackerBuffs, 'next_drink_boost')) {
        trackBuffConsumption(result, user, 'next_drink_boost');
      }
    } else if (activeCard.type === 'food') {
      const userBuffs = isPlayer ? battle.playerBuffs : battle.opponentBuffs;
      if (hasBuff(userBuffs, 'no_food')) {
        result.messages.push(`🚫 つまみ封じ中！${activeCard.emoji}${activeCard.name}が使えない！`);
      } else {
        const drunkVal = isPlayer ? battle.playerDrunk : battle.opponentDrunk;
        let heal = activeCard.heal === 99 ? Math.max(0, drunkVal) : (activeCard.heal ?? 0);
        heal = applyFoodBuffs(heal, userBuffs);
        if (isPlayer) {
          result.playerHeal = heal;
        } else {
          result.opponentHeal = heal;
        }
        result.messages.push(`${activeCard.emoji} ${activeCard.name}で${heal}回復！`);
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
      result.messages.push(`${card.emoji} ${card.name}！`);
      processEffects(card.effects, card.name, card.emoji, isPlayer, result, battle);
      applyLegacyBuffs(card, isPlayer, result);
      return;
    }

    result.messages.push(`${card.emoji} ${card.name}！`);

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
      applyLegacyBuffs(chugCard, isPlayer, result);
      return result;
    }

    if (chugCard.effect === 'chug') {
      if (chugUser === 'player') {
        result.opponentDamage += chugCard.enemyDamage ?? 0;
        result.playerDamage += chugCard.selfDamage ?? 0;
        result.messages.push(`🍻 ${chugCard.name}！相手に${chugCard.enemyDamage}ダメージ！自分にも${chugCard.selfDamage}ダメージ！`);
      } else {
        result.playerDamage += chugCard.enemyDamage ?? 0;
        result.opponentDamage += chugCard.selfDamage ?? 0;
        result.messages.push(`🍻 相手の${chugCard.name}！${chugCard.enemyDamage}ダメージを受けた！`);
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
        result.messages.push(`🥂 乾杯強制！相手に${chugCard.enemyDamage}ダメージ＋次のラウンド手札1枚破棄！`);
      } else {
        result.playerDamage += chugCard.enemyDamage ?? 0;
        result.opponentDamage += chugCard.selfDamage ?? 0;
        result.playerDiscardNext = true;
        result.messages.push(`🥂 相手が乾杯強制！${chugCard.enemyDamage}ダメージ＋次のラウンド手札1枚破棄！`);
      }
    }
    else if (chugCard.effect === 'spill') {
      result.spillNullified = true;
      if (chugUser === 'player') {
        result.playerReducedHand = true;
        result.messages.push('🫗 こぼし！相手のカードを無効化！（次のラウンド手札3枚）');
      } else {
        result.opponentReducedHand = true;
        result.messages.push('🫗 相手がこぼし！カードが無効化された！（相手の次ラウンド手札3枚）');
      }
    }
    else if (chugCard.effect === 'roulette') {
      // 確率分岐ダメージ（ロドス闇鍋酒等）
      const [chance, successDmg, failDmg] = chugCard.rouletteDmg ?? [0.5, 4, 3];
      const roll = Math.random();
      if (roll < chance) {
        if (chugUser === 'player') {
          result.opponentDamage += successDmg;
          result.messages.push(`🎰 ${chugCard.name}…大当たり！相手に${successDmg}ダメージ！`);
        } else {
          result.playerDamage += successDmg;
          result.messages.push(`🎰 相手の${chugCard.name}…大当たり！${successDmg}ダメージを受けた！`);
        }
      } else {
        // 失敗: 自分にダメージ
        if (chugUser === 'player') {
          result.playerDamage += failDmg;
          result.messages.push(`🎰 ${chugCard.name}…ハズレ！自分に${failDmg}ダメージ！`);
        } else {
          result.opponentDamage += failDmg;
          result.messages.push(`🎰 相手の${chugCard.name}…ハズレ！相手に${failDmg}自爆ダメージ！`);
        }
      }
    }

    return result;
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
      result.messages.push(`👻 隠密状態！${hCard.name}は届かない…！`);
    } else if (triggerLevel >= adjustedRequired) {
      // === 成功 ===
      // afterglow ダメージボーナス
      const hasAfterglow = hasBuff(targetBuffs, 'afterglow');
      if (user === 'player') {
        if (hCard.instantWin) {
          result.instantWin = true;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！`);
        } else {
          let dmg = hCard.drunkDamage ?? 0;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
          if (hasAfterglow) { dmg += 2; result.messages.push(`✨ 余韻が残る体に追い打ち…！+2！`); }
          // カード個別特殊効果
          if (hCard.id === 'wall_pin') {
            result.clearAllOpponentBuffs = true;
            result.messages.push(`🧱 壁ドン…！相手のバフが全て吹き飛んだ！`);
          }
          if (hCard.id === 'ear_bite') {
            // 相手の next_drink_boost を奪う
            const stealBuff = targetBuffs.find(b => b.id === 'next_drink_boost');
            if (stealBuff) {
              result.consumeOpponentBuffs = [...(result.consumeOpponentBuffs ?? []), 'next_drink_boost'];
              result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), { id: 'next_drink_boost', duration: stealBuff.duration, value: stealBuff.value }];
              result.messages.push(`👅 相手のドリンクブーストを奪った！`);
            }
          }
          if (hCard.id === 'breast_touch') {
            // 手札のDrink1枚→デッキからHarassment1枚交換
            result.swapDrinkForHarassment = true;
            result.messages.push(`🫦 酒を捨てて本番に移行…！手札交換！`);
          }
          result.opponentDamage += dmg;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！酔い+${dmg}！`);
        }
        // プレイヤーのハラスメント成功時もバフ付与を処理
        if (hCard.applyBuffs) {
          result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), ...hCard.applyBuffs];
          for (const buff of hCard.applyBuffs) {
            const label = buffLabel(buff);
            if (label) result.messages.push(label);
          }
        }
        if (hCard.applySelfBuffs) {
          result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), ...hCard.applySelfBuffs];
        }
        // 余韻付与: 次のセクハラが入りやすくなる
        result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), { id: 'afterglow', duration: 1 }];
      } else {
        // === 相手の逆セクハラ → プレイヤーに理性ダメージ ===
        if (hCard.sanityDamage) {
          // sanity_negate: 理性ダメージ無効化
          if (hasBuff(targetBuffs, 'sanity_negate')) {
            result.messages.push(`✨ シャイニングの加護！${hCard.name}の理性ダメージを無効化！`);
          } else {
            let dmg = hCard.sanityDamage;
            dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
            if (hasAfterglow) { dmg += 2; result.messages.push(`✨ 余韻が残る体で更に…！理性+2追加！`); }
            result.playerSanityDamage += dmg;
            result.messages.push(`${hCard.emoji} ${hCard.name}…！理性が${dmg}削られた！`);
          }
        } else if (hCard.drunkDamage) {
          let dmg = hCard.drunkDamage;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
          if (hasAfterglow) { dmg += 2; result.messages.push(`✨ 余韻が残る体に追い打ち…！+2！`); }
          result.playerDamage += dmg;
          result.messages.push(`${hCard.emoji} ${hCard.name}…！酔い+${dmg}！`);
        }

        // バフ付与
        if (hCard.applyBuffs) {
          result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), ...hCard.applyBuffs];
          for (const buff of hCard.applyBuffs) {
            const label = buffLabel(buff);
            if (label) result.messages.push(label);
          }
        }
        if (hCard.applySelfBuffs) {
          result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), ...hCard.applySelfBuffs];
        }

        // 手札汚染
        if (hCard.corruptHand) {
          result.corruptCount = (result.corruptCount ?? 0) + hCard.corruptHand;
          result.messages.push(`🔥 手札${hCard.corruptHand}枚が発情状態に…！使うと自分にダメージ！`);
        }
        // 余韻付与: 次の逆セクハラが入りやすくなる
        result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), { id: 'afterglow', duration: 1 }];
      }
    } else {
      // === 不発 → 焦らし（Frustration）変換 ===
      if (user === 'player') {
        result.messages.push(`${hCard.emoji} ${hCard.name}…不発！条件を満たしていない！`);
        // 焦らし: 不発でも相手にフラストレーション蓄積
        const existing = targetBuffs.find(b => b.id === 'frustration');
        const stacks = (existing?.value ?? 0) + 1;
        if (stacks >= 2) {
          // 2スタックで酔い+1 & リセット
          result.opponentDamage += 1;
          result.consumeOpponentBuffs = [...(result.consumeOpponentBuffs ?? []), 'frustration'];
          result.messages.push(`😤 焦らしが溜まった…！相手の酔い+1！`);
        } else {
          result.newOpponentBuffs = [...(result.newOpponentBuffs ?? []), { id: 'frustration', duration: -1, value: stacks }];
          result.messages.push(`😤 焦らし${stacks}/2…相手がムラムラしてきた`);
        }
      } else {
        result.messages.push(`${hCard.emoji} ${hCard.name}…不発！まだそこまで酔ってない！`);
        // 逆セクハラ不発でもプレイヤーにフラストレーション蓄積
        const existing = targetBuffs.find(b => b.id === 'frustration');
        const stacks = (existing?.value ?? 0) + 1;
        if (stacks >= 2) {
          result.playerDamage += 1;
          result.consumePlayerBuffs = [...(result.consumePlayerBuffs ?? []), 'frustration'];
          result.messages.push(`😤 焦らしが溜まった…！酔い+1！`);
        } else {
          result.newPlayerBuffs = [...(result.newPlayerBuffs ?? []), { id: 'frustration', duration: -1, value: stacks }];
          result.messages.push(`😤 焦らし${stacks}/2…ドクターもソワソワしてきた`);
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

function buffLabel(buff: Buff): string | null {
  switch (buff.id) {
    case 'atk_down': return `⬇️ 攻撃力低下！次のターン、酒のダメージが半減…`;
    case 'stun': return `😵 スタン付与！次のターン行動不能…！`;
    case 'dot': return `💔 持続ダメージ付与！毎ターン理性が${buff.value ?? 0}ずつ削られる…`;
    case 'no_food': return `🚫 つまみ封じ！防御カードが使用不可に…！`;
    case 'tipsy': return `😳 ほろ酔い状態！ドリンクダメージが1.5倍に…`;
    case 'blush': return `😶‍🌫️ 動揺状態！セクハラが効きやすくなった…`;
    case 'alone': return `🌙 二人きり…セクハラのダメージが2倍に…`;
    case 'karaoke': return `🎤 カラオケ突入！ドリンクダメージ+1！`;
    case 'dimlight': return `🕯️ 照明が暗い…セクハラの条件が緩和…`;
    case 'excuse': return `🙈 「酔ってるから」…次のセクハラの条件緩和！`;
    case 'drink_dmg_half': return `🫖 冷静…被ドリンクダメージ半減！`;
    case 'next_drink_boost': return `🏆 勢いが止まらない！次のドリンクダメージ+${buff.value ?? 0}！`;
    case 'next_food_boost': return `🍰 じんわり…次のフード回復+${buff.value ?? 0}！`;
    case 'negate_next': return `🃏 ポーカーフェイス…相手の次のカード効果を無効化！`;
    case 'stealth': return `👻 隠密状態…セクハラを回避！`;
    case 'self_atk_up': return `💉 攻撃バフ！ドリンクダメージ${buff.value ?? 1}倍！`;
    case 'all_dmg_up': return `💮 全ダメージ+${buff.value ?? 0}！場の空気が重い…`;
    case 'sanity_negate': return `✨ 加護展開！理性ダメージを無効化！`;
    case 'thorns': return `⚖️ 裁きの棘！ダメージを受けると${buff.value ?? 0}反射！`;
    case 'reflect_all': return `🛡️ 酒壁展開！全ダメージを跳ね返す！`;
    case 'afterglow': return `✨ 余韻…次のセクハラが効きやすい`;
    case 'frustration': return null; // メッセージは付与時に直接出力
    case 'finger_technique': return `🤌 指先のテクニック！セクハラダメージ1.5倍！`;
    default: return null;
  }
}

import type { BattleState, RoundResult, Buff, CardDef } from '../data/types.ts';
import i18n from '../i18n/index.ts';

export const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);
/** Localized card name helper */
export const cn = (card: { id: string; name: string }) => t(`cards.${card.id}.name`, { defaultValue: card.name }) as string;

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

export interface HarassmentSpecialContext {
  result: ExtendedResult;
  targetBuffs: Buff[];
}

export interface EffectContext {
  cardName: string;
  cardEmoji: string;
  isPlayer: boolean;
  result: ExtendedResult;
  battle: BattleState;
}

export interface CardResolveContext {
  card: CardDef;
  user: 'player' | 'opponent';
  result: ExtendedResult;
  battle: BattleState;
  /** 相手のフードで半減するか */
  halvesDrink: boolean;
  /** 相手のハラスメントで半減するか */
  halvesFood: boolean;
}

/** resolveUtilityCard のハンドラーに渡すコンテキスト */
export interface UtilityContext {
  card: CardDef;
  isPlayer: boolean;
  result: ExtendedResult;
  battle: BattleState;
  selfBuffs: Buff[];
  targetBuffs: Buff[];
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
export function isUtilityType(type: string): boolean {
  return type === 'strategy' || type === 'environment' || type === 'status';
}

/** 特定バフの最大値を取得（同一IDが複数ある場合は最大を採用） */
export function getBuffValue(buffs: Buff[], id: string, defaultVal: number): number {
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

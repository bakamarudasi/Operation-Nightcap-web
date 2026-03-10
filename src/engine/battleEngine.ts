import { CARD_DATA, getCardDamage } from '../data/cards.ts';
import type { BattleState, RoundResult, CGEvent, CharacterDef, Buff, CardDef } from '../data/types.ts';
import { randomPick } from './utils.ts';

export interface ExtendedResult extends RoundResult {
  opponentDiscardNext?: boolean;
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

  // karaoke: ドリンクダメージ+1
  if (hasBuff(attackerBuffs, 'karaoke') || hasBuff(defenderBuffs, 'karaoke')) {
    dmg += 1;
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
function getAdjustedRequiredLevel(requiredLevel: number, userBuffs: Buff[], isInstantWin?: boolean): number {
  let lv = requiredLevel;
  if (hasBuff(userBuffs, 'dimlight')) lv = Math.max(0, lv - 1);
  if (hasBuff(userBuffs, 'excuse')) lv = Math.max(0, lv - 1);
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
  return dmg;
}

/** ドリンクカードの追加効果（バフ付与・手札汚染・手札破棄・ドレイン等）を処理 */
function applyDrinkExtras(card: CardDef, result: ExtendedResult, user: 'player' | 'opponent'): void {
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

  // corruptHand → 敵の手札汚染
  if (card.corruptHand) {
    if (isPlayer) {
      // プレイヤーが使う → 相手の手札を汚染
      result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + card.corruptHand;
      result.messages.push(`🔥 ${card.name}の効果！相手の手札${card.corruptHand}枚が発情状態に！`);
    } else {
      // 相手が使う → プレイヤーの手札を汚染
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

/** フードカードの追加効果（デバフ除去・dot除去・バフ付与）を処理 */
function applyFoodExtras(card: CardDef, result: ExtendedResult, user: 'player' | 'opponent'): void {
  const isPlayer = user === 'player';

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

  // applySelfBuffs → 自分にバフ付与
  if (card.applySelfBuffs) {
    const self = isPlayer ? result.newPlayerBuffs! : result.newOpponentBuffs!;
    self.push(...card.applySelfBuffs);
    for (const buff of card.applySelfBuffs) {
      const label = buffLabel(buff);
      if (label) result.messages.push(label);
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

export const BattleEngine = {
  resolveRound(playerCardId: string, opponentCardId: string, battle: BattleState, currentOpponent?: CharacterDef | null): ExtendedResult {
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
    };

    // === フェーズ0: DoTバフのtick処理 ===
    const playerDoT = calcDoTDamage(battle.playerBuffs);
    if (playerDoT > 0) {
      result.playerDamage += playerDoT;
      result.messages.push(`💔 持続ダメージ…理性が${playerDoT}削られる！`);
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
        applyDrinkExtras(oCard, result, 'opponent');
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
        applyDrinkExtras(pCard, result, 'player');
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
    if (pCard.type === 'strategy' || pCard.type === 'environment' || pCard.type === 'status') {
      this.resolveUtilityCard(pCard, result, 'player', battle);
    }
    // 相手側
    if (oCard.type === 'strategy' || oCard.type === 'environment' || oCard.type === 'status') {
      this.resolveUtilityCard(oCard, result, 'opponent', battle);
    }

    // 両方ユーティリティなら処理完了
    if ((pCard.type === 'strategy' || pCard.type === 'environment' || pCard.type === 'status') &&
        (oCard.type === 'strategy' || oCard.type === 'environment' || oCard.type === 'status')) {
      return result;
    }

    // 片方がユーティリティ、もう片方が戦闘カードの場合 → 戦闘カード側だけ効果適用
    if (pCard.type === 'strategy' || pCard.type === 'environment' || pCard.type === 'status') {
      // プレイヤーがユーティリティ → 相手の攻撃だけ通る
      if (oCard.type === 'drink') {
        const dmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        result.playerDamage += dmg;
        result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${dmg}ダメージ！`);
        applyDrinkExtras(oCard, result, 'opponent');
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
    if (oCard.type === 'strategy' || oCard.type === 'environment' || oCard.type === 'status') {
      if (pCard.type === 'drink') {
        const dmg = applyDrinkBuffs(getCardDamage(pCard), battle.playerBuffs, battle.opponentBuffs);
        result.opponentDamage += dmg;
        result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${dmg}ダメージ！`);
        applyDrinkExtras(pCard, result, 'player');
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
      applyDrinkExtras(pCard, result, 'player');
      applyDrinkExtras(oCard, result, 'opponent');
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
        applyFoodExtras(oCard, result, 'opponent');
        if (hasBuff(battle.opponentBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, 'opponent', 'next_food_boost');
        }
      }
      applyDrinkExtras(pCard, result, 'player');
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
        applyFoodExtras(pCard, result, 'player');
        if (hasBuff(battle.playerBuffs, 'next_food_boost')) {
          trackBuffConsumption(result, 'player', 'next_food_boost');
        }
      }
      applyDrinkExtras(oCard, result, 'opponent');
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
        applyFoodExtras(pCard, result, 'player');
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
        applyFoodExtras(oCard, result, 'opponent');
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

    if (activeCard.type === 'strategy' || activeCard.type === 'environment' || activeCard.type === 'status') {
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
      applyDrinkExtras(activeCard, result, user);
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
        applyFoodExtras(activeCard, result, user);
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

    result.messages.push(`${card.emoji} ${card.name}！`);

    // --- フラグ駆動の効果処理 ---

    // 手札公開
    if (card.revealHand) {
      if (isPlayer) {
        result.revealedHand = [...battle.opponentHand];
        result.messages.push(`相手の手札が見えた！`);
      } else {
        result.messages.push(`手の内が見られている…！`);
      }
    }

    // 噂話（次ラウンド手札差替）
    if (card.triggerRumor) {
      if (isPlayer) {
        result.rumorActive = true;
        result.messages.push(`相手の次の手札が乱される！`);
      } else {
        result.playerRumorActive = true;
        result.messages.push(`次の手札が乱された！`);
      }
    }

    // 酔いLv入れ替え
    if (card.swapDrunk) {
      result.swapDrunk = true;
      result.messages.push(`酔いレベルが入れ替わった！`);
    }

    // 最高dmgカード破棄
    if (card.discardHighest) {
      if (isPlayer) {
        result.discardHighest = true;
        result.messages.push(`相手の最強カードが没収された！`);
      } else {
        result.discardPlayerHighest = true;
        result.messages.push(`最強のカードが奪われた！`);
      }
    }

    // 手札破棄（ランダム）
    if (card.discardEnemyHand) {
      if (isPlayer) {
        result.discardEnemyHandCount = (result.discardEnemyHandCount ?? 0) + card.discardEnemyHand;
      } else {
        result.discardPlayerHandCount = (result.discardPlayerHandCount ?? 0) + card.discardEnemyHand;
      }
      result.messages.push(isPlayer ? `相手の手札${card.discardEnemyHand}枚が消える…` : `手札${card.discardEnemyHand}枚が消された…`);
    }

    // maxRounds減少
    if (card.reduceMaxRounds) {
      result.reduceMaxRounds = card.reduceMaxRounds;
      result.messages.push(`残りラウンドが${card.reduceMaxRounds}減少！決着を急げ！`);
    }

    // 相手にバフ/デバフ付与
    if (card.applyBuffs) {
      targetBuffs.push(...card.applyBuffs);
      for (const buff of card.applyBuffs) {
        const label = buffLabel(buff);
        if (label) result.messages.push(label);
      }
    }

    // 自分にバフ付与
    if (card.applySelfBuffs) {
      selfBuffs.push(...card.applySelfBuffs);
      for (const buff of card.applySelfBuffs) {
        const label = buffLabel(buff);
        if (label) result.messages.push(label);
      }
    }

    // 双方にバフ付与（環境効果）
    if (card.applyBothBuffs) {
      for (const buff of card.applyBothBuffs) {
        result.newPlayerBuffs!.push({ ...buff, source: card.id });
        result.newOpponentBuffs!.push({ ...buff, source: card.id });
        const label = buffLabel(buff);
        if (label) result.messages.push(label);
      }
    }

    // ドレイン（自分回復）
    if (card.selfHeal) {
      if (isPlayer) {
        result.playerHeal += card.selfHeal;
      } else {
        result.opponentHeal += card.selfHeal;
      }
      result.messages.push(`💚 ドレイン効果！${card.selfHeal}回復！`);
    }

    // 自傷ダメージ
    if (card.selfDamage) {
      if (isPlayer) {
        result.playerDamage += card.selfDamage;
      } else {
        result.opponentDamage += card.selfDamage;
      }
      result.messages.push(`💉 副作用…${card.selfDamage}ダメージ！`);
    }

    // 手札汚染（使用者の「敵」の手札を汚染）
    if (card.corruptHand) {
      if (isPlayer) {
        // プレイヤーが使う → 相手の手札を汚染
        result.opponentCorruptCount = (result.opponentCorruptCount ?? 0) + card.corruptHand;
        result.messages.push(`🔥 相手の手札${card.corruptHand}枚が発情状態に！`);
      } else {
        // 相手が使う → プレイヤーの手札を汚染
        result.corruptCount = (result.corruptCount ?? 0) + card.corruptHand;
        result.messages.push(`🔥 手札${card.corruptHand}枚が発情状態に…！`);
      }
    }
  },

  resolveChugCard(chugCard: CardDef, otherCard: CardDef, result: ExtendedResult, chugUser: 'player' | 'opponent', battle: BattleState): ExtendedResult {
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
        result.messages.push(`🥂 相手が乾杯強制！${chugCard.enemyDamage}ダメージ！`);
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
      // ロドス深夜の闇鍋酒: 確率分岐ダメージ
      const [chance, successDmg, failDmg] = chugCard.rouletteDmg ?? [0.5, 4, 3];
      const roll = Math.random();
      if (roll < chance) {
        // 成功: 相手にダメージ
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
    const adjustedRequired = getAdjustedRequiredLevel(hCard.requiredDrunkLevel ?? 0, userBuffs, !!hCard.instantWin);

    // stealth: 相手にstealthバフがある場合、ハラスメント不発
    if (hasBuff(targetBuffs, 'stealth')) {
      result.messages.push(`👻 隠密状態！${hCard.name}は届かない…！`);
    } else if (triggerLevel >= adjustedRequired) {
      // === 成功 ===
      if (user === 'player') {
        if (hCard.instantWin) {
          result.instantWin = true;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！`);
        } else {
          let dmg = hCard.drunkDamage ?? 0;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
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
      } else {
        // === 相手の逆セクハラ → プレイヤーに理性ダメージ ===
        if (hCard.sanityDamage) {
          let dmg = hCard.sanityDamage;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
          result.playerDamage += dmg;
          result.messages.push(`${hCard.emoji} ${hCard.name}…！理性が${dmg}削られた！`);
        } else if (hCard.drunkDamage) {
          let dmg = hCard.drunkDamage;
          dmg = applyHarassmentBuffs(dmg, userBuffs, targetBuffs);
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
      }
    } else {
      if (user === 'player') {
        result.messages.push(`${hCard.emoji} ${hCard.name}…不発！条件を満たしていない！`);
      } else {
        result.messages.push(`${hCard.emoji} ${hCard.name}…不発！まだそこまで酔ってない！`);
      }
    }

    // 相手のカードも処理
    if (!result.spillNullified) {
      if (otherCard.type === 'drink') {
        const baseDmg = getCardDamage(otherCard);
        if (user === 'player') {
          const dmg = applyDrinkBuffs(baseDmg, battle.opponentBuffs, battle.playerBuffs);
          result.playerDamage += dmg;
          result.messages.push(`相手の${otherCard.emoji}${otherCard.name}で酔い${dmg}ダメージ！`);
          applyDrinkExtras(otherCard, result, 'opponent');
        } else {
          const dmg = applyDrinkBuffs(baseDmg, battle.playerBuffs, battle.opponentBuffs);
          result.opponentDamage += dmg;
          result.messages.push(`${otherCard.emoji}${otherCard.name}で相手に酔い${dmg}ダメージ！`);
          applyDrinkExtras(otherCard, result, 'player');
        }
      } else if (otherCard.type === 'food') {
        // フードカードの回復も処理
        const otherUser = user === 'player' ? 'opponent' : 'player';
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
          applyFoodExtras(otherCard, result, otherUser);
          if (hasBuff(foodUserBuffs, 'next_food_boost')) {
            trackBuffConsumption(result, otherUser, 'next_food_boost');
          }
        }
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
    default: return null;
  }
}

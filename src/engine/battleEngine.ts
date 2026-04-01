import { CARD_DATA, getCardDamage, getEnhancedCard } from '../data/cards.ts';
import type { BattleState, CharacterDef, CardDef } from '../data/types.ts';
import { getDrunkLevel, hasBuff, getBuffMessage } from './utils.ts';

// --- 新モジュールからのimport ---
import { t, cn, getMatchupResult, isUtilityType, getBuffValue, calcDoTDamage } from './battleTypes.ts';
import type { ExtendedResult, UtilityContext } from './battleTypes.ts';
import { applyDrinkBuffs, applyHarassmentBuffs, applyCardExtras, trackBuffConsumption, applyLegacyBuffs, getAdjustedRequiredLevel, HARASSMENT_SPECIAL_HANDLERS } from './buffSystem.ts';
import { processEffects } from './effectSystem.ts';
import { resolveDrinkCard, resolveFoodCard, UTILITY_FLAG_HANDLERS } from './cardResolvers.ts';

// --- 公開API re-export（consumer変更不要） ---
export type { ExtendedResult } from './battleTypes.ts';
export { getMatchupResult, tickBuffs, calcDoTDamage } from './battleTypes.ts';
export { getAdjustedRequiredLevel } from './buffSystem.ts';


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


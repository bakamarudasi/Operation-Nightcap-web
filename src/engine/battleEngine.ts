import { CARD_DATA, FULL_HEAL, getCardDamage } from '../data/cards.ts';
import type { BattleState, RoundResult, CardDef, Buff } from '../data/types.ts';
import { randomPick } from './utils.ts';
import { getDrunkLevel } from '../utils/drunkLevel.ts';
import {
  hasBuff, calcDoTDamage, applyDrinkBuffs,
  getAdjustedRequiredLevel, applyHarassmentBuffs, buffLabel,
} from './buffUtils.ts';

// re-export for consumers
export { tickBuffs, calcDoTDamage } from './buffUtils.ts';

interface ExtendedResult extends RoundResult {
  opponentDiscardNext?: boolean;
  playerReducedHand?: boolean;
  opponentReducedHand?: boolean;
  /** rumor: 相手の次ラウンド手札をランダム差替 */
  rumorActive?: boolean;
  /** distract: 相手の手札を公開 */
  revealedHand?: string[];
}

export const BattleEngine = {
  resolveRound(playerCardId: string, opponentCardId: string, battle: BattleState): ExtendedResult {
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

    // === フェーズ0.5: スタンチェック ===
    const playerStunned = hasBuff(battle.playerBuffs, 'stun');
    const opponentStunned = hasBuff(battle.opponentBuffs, 'stun');

    if (playerStunned) {
      result.messages.push('😵 スタン状態！行動できない…！');
      if (oCard.type === 'drink') {
        const dmg = applyDrinkBuffs(getCardDamage(oCard), battle.opponentBuffs, battle.playerBuffs);
        result.playerDamage += dmg;
        result.messages.push(`${oCard.emoji} 無防備なところに${oCard.name}！酔い+${dmg}！`);
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
      } else if (pCard.type === 'chug') {
        return this.resolveChugCard(pCard, oCard, result, 'player', battle);
      } else if (pCard.type === 'harassment') {
        return this.resolveHarassmentCard(pCard, oCard, result, 'player', battle);
      }
      return result;
    }

    // === 一気飲み系カード処理 ===
    if (pCard.type === 'chug' && oCard.type === 'chug') {
      // 両者chug: 両方の効果を処理
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
      // 両者harassment: 両方の効果を処理
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
    }
    // === ドリンク vs つまみ ===
    else if (pCard.type === 'drink' && oCard.type === 'food') {
      let pDmg = applyDrinkBuffs(getCardDamage(pCard), battle.playerBuffs, battle.opponentBuffs);
      result.opponentDamage += pDmg;
      if (hasBuff(battle.opponentBuffs, 'no_food')) {
        result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${pDmg}ダメージ！`);
        result.messages.push(`🚫 相手はつまみ封じ中！${oCard.emoji}${oCard.name}が使えない！`);
      } else {
        result.opponentHeal = oCard.heal === FULL_HEAL ? Math.max(0, battle.opponentDrunk + pDmg) : (oCard.heal ?? 0);
        result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${pDmg}ダメージ！`);
        result.messages.push(`${oCard.emoji} ${oCard.name}で${result.opponentHeal}回復！`);
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
        result.playerHeal = pCard.heal === FULL_HEAL ? Math.max(0, battle.playerDrunk + oDmg) : (pCard.heal ?? 0);
        result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${oDmg}ダメージ！`);
        result.messages.push(`${pCard.emoji} ${pCard.name}で${result.playerHeal}回復！`);
      }
    }
    // === つまみ vs つまみ ===
    else if (pCard.type === 'food' && oCard.type === 'food') {
      if (hasBuff(battle.playerBuffs, 'no_food')) {
        result.messages.push(`🚫 つまみ封じ中！${pCard.emoji}${pCard.name}が使えない！`);
      } else {
        result.playerHeal = pCard.heal === FULL_HEAL ? Math.max(0, battle.playerDrunk) : (pCard.heal ?? 0);
        result.messages.push(`${pCard.emoji} ${pCard.name}で${result.playerHeal}回復！`);
      }
      if (hasBuff(battle.opponentBuffs, 'no_food')) {
        result.messages.push(`🚫 相手もつまみ封じ中！${oCard.emoji}${oCard.name}が使えない！`);
      } else {
        result.opponentHeal = oCard.heal === FULL_HEAL ? Math.max(0, battle.opponentDrunk) : (oCard.heal ?? 0);
        result.messages.push(`${oCard.emoji} ${oCard.name}で相手も${result.opponentHeal}回復！`);
      }
      result.messages.push('平和なラウンド…お互いつまみを食べた');
    }

    return result;
  },

  /** 戦略・環境・状態異常カードの解決 */
  resolveUtilityCard(card: CardDef, result: ExtendedResult, user: 'player' | 'opponent', battle: BattleState): void {
    const isPlayer = user === 'player';

    switch (card.effect) {
      // === 戦略カード ===
      case 'rumor':
        // 相手の次ラウンドの手札1枚をランダム差替（ストア側で処理）
        result.rumorActive = true;
        if (isPlayer) {
          result.messages.push(`${card.emoji} ${card.name}！相手の次の手札が乱される！`);
        } else {
          result.messages.push(`${card.emoji} 噂話が飛び交う…次の手札が乱された！`);
        }
        break;

      case 'excuse':
        // 次のハラスメントの必要酔いLv -1（バフとして付与）
        if (isPlayer) {
          result.newPlayerBuffs!.push({ id: 'excuse', duration: 2, source: card.id });
          result.messages.push(`${card.emoji} 「${card.name}」…次のセクハラの条件が緩和！`);
        } else {
          result.newOpponentBuffs!.push({ id: 'excuse', duration: 2, source: card.id });
          result.messages.push(`${card.emoji} 相手が言い訳を始めた…`);
        }
        break;

      case 'distract':
        // 相手の手札を公開（UI側で表示）
        if (isPlayer) {
          result.revealedHand = [...battle.opponentHand];
          result.messages.push(`${card.emoji} ${card.name}！相手の手札が見えた！`);
        } else {
          result.messages.push(`${card.emoji} 話題を逸らされた…手の内が見られている！`);
        }
        break;

      // === 環境カード ===
      case 'karaoke':
        // 全ドリンクダメージ+1を場バフとして付与（両者に適用）
        {
          const dur = card.duration ?? 3;
          result.newPlayerBuffs!.push({ id: 'karaoke', duration: dur, value: 1, source: card.id });
          result.newOpponentBuffs!.push({ id: 'karaoke', duration: dur, value: 1, source: card.id });
          result.messages.push(`${card.emoji} ${card.name}突入！${dur}ターン、全ドリンクのダメージ+1！`);
        }
        break;

      case 'lastorder':
        // 次のターン手札全使用可能 → ドリンクダメージ+2 バフで表現
        {
          if (isPlayer) {
            result.newPlayerBuffs!.push({ id: 'karaoke', duration: 1, value: 2, source: card.id });
          } else {
            result.newOpponentBuffs!.push({ id: 'karaoke', duration: 1, value: 2, source: card.id });
          }
          result.messages.push(`${card.emoji} ${card.name}！閉店間近…次のターン、全力勝負！（ドリンクダメージ+2）`);
        }
        break;

      case 'dimlight':
        // ハラスメント必要酔いLv -1（場バフ）
        {
          const dur = card.duration ?? 2;
          result.newPlayerBuffs!.push({ id: 'dimlight', duration: dur, source: card.id });
          result.newOpponentBuffs!.push({ id: 'dimlight', duration: dur, source: card.id });
          result.messages.push(`${card.emoji} ${card.name}…${dur}ターン、暗がりの中ではセクハラの条件が緩和…`);
        }
        break;

      // === 状態異常カード ===
      case 'tipsy':
        // 相手をほろ酔い状態に（受けるドリンクダメージ1.5倍）
        if (isPlayer) {
          result.newOpponentBuffs!.push({ id: 'tipsy', duration: 3, value: 1.5, source: card.id });
          result.messages.push(`${card.emoji} ${card.name}！相手はほろ酔いに…ドリンクダメージ1.5倍！`);
        } else {
          result.newPlayerBuffs!.push({ id: 'tipsy', duration: 3, value: 1.5, source: card.id });
          result.messages.push(`${card.emoji} ほろ酔い状態に…ドリンクが効きやすくなった！`);
        }
        break;

      case 'blush':
        // 相手を動揺状態に（ハラスメントのdrunkDamage +1）
        if (isPlayer) {
          result.newOpponentBuffs!.push({ id: 'blush', duration: 3, value: 1, source: card.id });
          result.messages.push(`${card.emoji} ${card.name}！相手は動揺状態に…セクハラが効きやすい！`);
        } else {
          result.newPlayerBuffs!.push({ id: 'blush', duration: 3, value: 1, source: card.id });
          result.messages.push(`${card.emoji} 顔が赤い…動揺してセクハラが効きやすくなった！`);
        }
        break;

      case 'alone':
        // 二人きり状態（ハラスメントダメージ2倍）
        {
          result.newPlayerBuffs!.push({ id: 'alone', duration: 2, source: card.id });
          result.newOpponentBuffs!.push({ id: 'alone', duration: 2, source: card.id });
          result.messages.push(`${card.emoji} ${card.name}…2ターン、ハラスメントのダメージが2倍に！`);
        }
        break;
    }
  },

  resolveChugCard(chugCard: CardDef, otherCard: CardDef, result: ExtendedResult, chugUser: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    if (chugCard.effect === 'chug') {
      if (chugUser === 'player') {
        result.opponentDamage += chugCard.enemyDamage;
        result.playerDamage += chugCard.selfDamage;
        result.messages.push(`🍻 一気飲み！相手に${chugCard.enemyDamage}ダメージ！自分にも${chugCard.selfDamage}ダメージ！`);
      } else {
        result.playerDamage += chugCard.enemyDamage;
        result.opponentDamage += chugCard.selfDamage;
        result.messages.push(`🍻 相手が一気飲み！${chugCard.enemyDamage}ダメージを受けた！`);
      }
    }
    else if (chugCard.effect === 'toast') {
      if (chugUser === 'player') {
        result.opponentDamage += chugCard.enemyDamage;
        result.playerDamage += chugCard.selfDamage;
        result.opponentDiscardNext = true;
        result.messages.push(`🥂 乾杯強制！相手に${chugCard.enemyDamage}ダメージ＋次のラウンド手札1枚破棄！`);
      } else {
        result.playerDamage += chugCard.enemyDamage;
        result.opponentDamage += chugCard.selfDamage;
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

    return result;
  },

  resolveHarassmentCard(hCard: CardDef, otherCard: CardDef, result: ExtendedResult, user: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    // 判定: 相手の酔い度で判定（どちら側でも相手の酔いを参照）
    const triggerDrunk = user === 'player' ? battle.opponentDrunk : battle.playerDrunk;
    const triggerLevel = getDrunkLevel(triggerDrunk);

    // バフによる必要Lv補正
    const userBuffs = user === 'player' ? battle.playerBuffs : battle.opponentBuffs;
    const targetBuffs = user === 'player' ? battle.opponentBuffs : battle.playerBuffs;
    const adjustedRequired = getAdjustedRequiredLevel(hCard.requiredDrunkLevel ?? 0, userBuffs);

    if (triggerLevel >= adjustedRequired) {
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
          result.corruptCount = hCard.corruptHand;
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
    if (!result.spillNullified && otherCard.type === 'drink') {
      const baseDmg = getCardDamage(otherCard);
      if (user === 'player') {
        const dmg = applyDrinkBuffs(baseDmg, battle.opponentBuffs, battle.playerBuffs);
        result.playerDamage += dmg;
        result.messages.push(`相手の${otherCard.emoji}${otherCard.name}で酔い${dmg}ダメージ！`);
      } else {
        const dmg = applyDrinkBuffs(baseDmg, battle.playerBuffs, battle.opponentBuffs);
        result.opponentDamage += dmg;
        result.messages.push(`${otherCard.emoji}${otherCard.name}で相手に酔い${dmg}ダメージ！`);
      }
    }

    return result;
  },
};

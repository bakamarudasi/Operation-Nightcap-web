import { CARD_DATA, getCardDamage } from '../data/cards.ts';
import type { BattleState, RoundResult, CGEvent, CharacterDef } from '../data/types.ts';
import { randomPick } from './utils.ts';

interface ExtendedResult extends RoundResult {
  opponentDiscardNext?: boolean;
  playerReducedHand?: boolean;
}

function getDrunkLevel(drunkValue: number): number {
  if (drunkValue >= 10) return 4;
  if (drunkValue >= 7) return 3;
  if (drunkValue >= 4) return 2;
  if (drunkValue >= 2) return 1;
  return 0;
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
    };

    // === 一気飲み系カード処理 ===
    if (pCard.type === 'chug') {
      return this.resolveChugCard(pCard, oCard, result, 'player', battle);
    }
    if (oCard.type === 'chug') {
      return this.resolveChugCard(oCard, pCard, result, 'opponent', battle);
    }

    // === セクハラカード処理 ===
    if (pCard.type === 'harassment') {
      return this.resolveHarassmentCard(pCard, oCard, result, 'player', battle);
    }
    if (oCard.type === 'harassment') {
      return this.resolveHarassmentCard(oCard, pCard, result, 'opponent', battle);
    }

    // === ドリンク vs ドリンク ===
    if (pCard.type === 'drink' && oCard.type === 'drink') {
      const pDmg = getCardDamage(pCard);
      const oDmg = getCardDamage(oCard);
      if (pDmg > oDmg) {
        result.opponentDamage = pDmg - oDmg;
        result.messages.push(`${pCard.emoji} ${pCard.name}(${pDmg}) vs ${oCard.emoji} ${oCard.name}(${oDmg}) → 差分${result.opponentDamage}ダメージ！`);
      } else if (oDmg > pDmg) {
        result.playerDamage = oDmg - pDmg;
        result.messages.push(`${oCard.emoji} ${oCard.name}(${oDmg}) vs ${pCard.emoji} ${pCard.name}(${pDmg}) → 差分${result.playerDamage}ダメージ！`);
      } else {
        result.messages.push(`${pCard.emoji} vs ${oCard.emoji} 同値！相殺！`);
      }
    }
    // === ドリンク vs つまみ ===
    else if (pCard.type === 'drink' && oCard.type === 'food') {
      const pDmg = getCardDamage(pCard);
      result.opponentDamage = pDmg;
      result.opponentHeal = oCard.heal === 99 ? Math.max(0, battle.opponentDrunk + pDmg) : (oCard.heal ?? 0);
      result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${pDmg}ダメージ！`);
      result.messages.push(`${oCard.emoji} ${oCard.name}で${result.opponentHeal}回復！`);
    }
    else if (pCard.type === 'food' && oCard.type === 'drink') {
      const oDmg = getCardDamage(oCard);
      result.playerDamage = oDmg;
      result.playerHeal = pCard.heal === 99 ? Math.max(0, battle.playerDrunk + oDmg) : (pCard.heal ?? 0);
      result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${oDmg}ダメージ！`);
      result.messages.push(`${pCard.emoji} ${pCard.name}で${result.playerHeal}回復！`);
    }
    // === つまみ vs つまみ ===
    else if (pCard.type === 'food' && oCard.type === 'food') {
      result.messages.push('平和なラウンド…お互いつまみを食べた');
    }

    return result;
  },

  resolveChugCard(chugCard: any, otherCard: any, result: ExtendedResult, chugUser: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    if (chugCard.effect === 'chug') {
      if (chugUser === 'player') {
        result.opponentDamage = chugCard.enemyDamage;
        result.playerDamage = chugCard.selfDamage;
        result.messages.push(`🍻 一気飲み！相手に${chugCard.enemyDamage}ダメージ！自分にも${chugCard.selfDamage}ダメージ！`);
      } else {
        result.playerDamage = chugCard.enemyDamage;
        result.opponentDamage = chugCard.selfDamage;
        result.messages.push(`🍻 相手が一気飲み！${chugCard.enemyDamage}ダメージを受けた！`);
      }
    }
    else if (chugCard.effect === 'toast') {
      if (chugUser === 'player') {
        result.opponentDamage = chugCard.enemyDamage;
        result.playerDamage = chugCard.selfDamage;
        result.opponentDiscardNext = true;
        result.messages.push(`🥂 乾杯強制！相手に${chugCard.enemyDamage}ダメージ＋次のラウンド手札1枚破棄！`);
      } else {
        result.playerDamage = chugCard.enemyDamage;
        result.opponentDamage = chugCard.selfDamage;
        result.messages.push(`🥂 相手が乾杯強制！${chugCard.enemyDamage}ダメージ！`);
      }
    }
    else if (chugCard.effect === 'spill') {
      result.spillNullified = true;
      if (chugUser === 'player') {
        result.playerReducedHand = true;
        result.messages.push('🫗 こぼし！相手のカードを無効化！（次のラウンド手札3枚）');
      } else {
        result.messages.push('🫗 相手がこぼし！カードが無効化された！');
      }
    }

    return result;
  },

  resolveHarassmentCard(hCard: any, otherCard: any, result: ExtendedResult, user: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    const targetDrunk = user === 'player' ? battle.opponentDrunk : battle.playerDrunk;
    const targetLevel = getDrunkLevel(targetDrunk);

    if (targetLevel >= (hCard.requiredDrunkLevel ?? 0)) {
      // 成功
      if (user === 'player') {
        if (hCard.instantWin) {
          result.instantWin = true;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！`);
        } else {
          result.opponentDamage = hCard.drunkDamage ?? 0;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！酔い+${hCard.drunkDamage}！`);
        }

        // CGイベント検索 - これはストア側で処理するのでここではcgEventを設定のみ
        // ストアがcurrentOpponentを持っているのでここでは簡易的に
      } else {
        result.messages.push(`${hCard.emoji} 不思議なことが起きた…`);
      }
    } else {
      result.messages.push(`${hCard.emoji} ${hCard.name}…不発！条件を満たしていない！`);
    }

    // 相手のカードも処理
    if (!result.spillNullified && otherCard.type === 'drink') {
      const dmg = getCardDamage(otherCard);
      if (user === 'player') {
        result.playerDamage = dmg;
        result.messages.push(`相手の${otherCard.emoji}${otherCard.name}で酔い${dmg}ダメージ！`);
      } else {
        result.opponentDamage = dmg;
      }
    }

    return result;
  },
};

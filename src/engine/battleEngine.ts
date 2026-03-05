import { CARD_DATA, getCardDamage } from '../data/cards.ts';
import type { BattleState, RoundResult, CGEvent, CharacterDef, Buff } from '../data/types.ts';
import { randomPick } from './utils.ts';

interface ExtendedResult extends RoundResult {
  opponentDiscardNext?: boolean;
  playerReducedHand?: boolean;
  opponentReducedHand?: boolean;
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

    // === フェーズ0.5: スタンチェック ===
    const playerStunned = hasBuff(battle.playerBuffs, 'stun');
    const opponentStunned = hasBuff(battle.opponentBuffs, 'stun');

    if (playerStunned) {
      result.messages.push('😵 スタン状態！行動できない…！');
      // プレイヤーのカードは無効、相手のカードだけ処理
      if (oCard.type === 'drink') {
        result.playerDamage += getCardDamage(oCard);
        result.messages.push(`${oCard.emoji} 無防備なところに${oCard.name}！酔い+${getCardDamage(oCard)}！`);
      } else if (oCard.type === 'harassment') {
        return this.resolveHarassmentCard(oCard, pCard, result, 'opponent', battle);
      }
      return result;
    }

    if (opponentStunned) {
      result.messages.push('😵 相手がスタン状態！');
      if (pCard.type === 'drink') {
        result.opponentDamage += getCardDamage(pCard);
        result.messages.push(`${pCard.emoji} ${pCard.name}が直撃！酔い+${getCardDamage(pCard)}！`);
      } else if (pCard.type === 'harassment') {
        return this.resolveHarassmentCard(pCard, oCard, result, 'player', battle);
      }
      return result;
    }

    // === 一気飲み系カード処理 ===
    if (pCard.type === 'chug') {
      return this.resolveChugCard(pCard, oCard, result, 'player', battle);
    }
    if (oCard.type === 'chug') {
      return this.resolveChugCard(oCard, pCard, result, 'opponent', battle);
    }

    // === セクハラカード処理（プレイヤー・相手 双方向対応） ===
    if (pCard.type === 'harassment') {
      return this.resolveHarassmentCard(pCard, oCard, result, 'player', battle);
    }
    if (oCard.type === 'harassment') {
      return this.resolveHarassmentCard(oCard, pCard, result, 'opponent', battle);
    }

    // === ドリンク vs ドリンク ===
    if (pCard.type === 'drink' && oCard.type === 'drink') {
      let pDmg = getCardDamage(pCard);
      let oDmg = getCardDamage(oCard);

      // atk_downバフ適用
      if (hasBuff(battle.playerBuffs, 'atk_down')) {
        const mult = getBuffValue(battle.playerBuffs, 'atk_down', 1);
        pDmg = Math.floor(pDmg * mult);
        result.messages.push(`⬇️ 攻撃力低下中…ダメージ半減！`);
      }
      if (hasBuff(battle.opponentBuffs, 'atk_down')) {
        const mult = getBuffValue(battle.opponentBuffs, 'atk_down', 1);
        oDmg = Math.floor(oDmg * mult);
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
      let pDmg = getCardDamage(pCard);
      if (hasBuff(battle.playerBuffs, 'atk_down')) {
        pDmg = Math.floor(pDmg * getBuffValue(battle.playerBuffs, 'atk_down', 1));
        result.messages.push(`⬇️ 攻撃力低下中…ダメージ半減！`);
      }
      result.opponentDamage += pDmg;
      result.opponentHeal = oCard.heal === 99 ? Math.max(0, battle.opponentDrunk + pDmg) : (oCard.heal ?? 0);
      result.messages.push(`${pCard.emoji} ${pCard.name}で酔い${pDmg}ダメージ！`);
      result.messages.push(`${oCard.emoji} ${oCard.name}で${result.opponentHeal}回復！`);
    }
    else if (pCard.type === 'food' && oCard.type === 'drink') {
      // no_food バフチェック：プレイヤーがつまみを封じられている場合
      if (hasBuff(battle.playerBuffs, 'no_food')) {
        result.messages.push(`🚫 つまみ封じ中！${pCard.emoji}${pCard.name}が使えない！`);
        const oDmg = getCardDamage(oCard);
        result.playerDamage += oDmg;
        result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${oDmg}ダメージ！`);
      } else {
        const oDmg = getCardDamage(oCard);
        result.playerDamage += oDmg;
        result.playerHeal = pCard.heal === 99 ? Math.max(0, battle.playerDrunk + oDmg) : (pCard.heal ?? 0);
        result.messages.push(`${oCard.emoji} ${oCard.name}で酔い${oDmg}ダメージ！`);
        result.messages.push(`${pCard.emoji} ${pCard.name}で${result.playerHeal}回復！`);
      }
    }
    // === つまみ vs つまみ ===
    else if (pCard.type === 'food' && oCard.type === 'food') {
      if (hasBuff(battle.playerBuffs, 'no_food')) {
        result.messages.push(`🚫 つまみ封じ中！${pCard.emoji}${pCard.name}が使えない！`);
      } else {
        result.messages.push('平和なラウンド…お互いつまみを食べた');
      }
    }

    return result;
  },

  resolveChugCard(chugCard: any, otherCard: any, result: ExtendedResult, chugUser: 'player' | 'opponent', battle: BattleState): ExtendedResult {
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

  resolveHarassmentCard(hCard: any, otherCard: any, result: ExtendedResult, user: 'player' | 'opponent', battle: BattleState): ExtendedResult {
    // プレイヤーのセクハラ → 相手の酔いで判定
    // 相手の逆セクハラ → 相手自身の酔いで判定（酔ってるほど大胆になる）
    const triggerDrunk = user === 'player' ? battle.opponentDrunk : battle.opponentDrunk;
    const triggerLevel = getDrunkLevel(triggerDrunk);

    if (triggerLevel >= (hCard.requiredDrunkLevel ?? 0)) {
      // === 成功 ===
      if (user === 'player') {
        // プレイヤーのセクハラ → 相手に酔いダメージ
        if (hCard.instantWin) {
          result.instantWin = true;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！`);
        } else {
          result.opponentDamage += hCard.drunkDamage ?? 0;
          result.messages.push(`${hCard.emoji} ${hCard.name}…成功！酔い+${hCard.drunkDamage}！`);
        }
      } else {
        // === 相手の逆セクハラ → プレイヤーに理性ダメージ ===
        if (hCard.sanityDamage) {
          result.playerDamage += hCard.sanityDamage;
          result.messages.push(`${hCard.emoji} ${hCard.name}…！理性が${hCard.sanityDamage}削られた！`);
        } else if (hCard.drunkDamage) {
          result.playerDamage += hCard.drunkDamage;
          result.messages.push(`${hCard.emoji} ${hCard.name}…！酔い+${hCard.drunkDamage}！`);
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

        // CG: opponentCgEvent として返す（ストア側で処理）
        // ストア側で cgEvent と同じ仕組みで検索するのでここではフラグのみ
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
      const dmg = getCardDamage(otherCard);
      if (user === 'player') {
        result.playerDamage += dmg;
        result.messages.push(`相手の${otherCard.emoji}${otherCard.name}で酔い${dmg}ダメージ！`);
      } else {
        result.opponentDamage += dmg;
        result.messages.push(`${otherCard.emoji}${otherCard.name}で相手に酔い${dmg}ダメージ！`);
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
    default: return null;
  }
}

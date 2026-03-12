import { CARD_DATA } from '../data/cards.ts';
import type { BattleState, CharacterDef } from '../data/types.ts';
import { randomPick } from './utils.ts';

function getDrunkLevel(drunkValue: number): number {
  if (drunkValue >= 10) return 4;
  if (drunkValue >= 7) return 3;
  if (drunkValue >= 4) return 2;
  if (drunkValue >= 2) return 1;
  return 0;
}

function hasBuff(buffs: { id: string }[], id: string): boolean {
  return buffs.some(b => b.id === id);
}

/** プレイヤーがつまみばかり使っているか判定 */
function isPlayerStalling(battle: BattleState): boolean {
  return battle.round >= 3 && battle.playerDrunk <= 1;
}

export const BattleAI = {
  selectCard(hand: string[], character: CharacterDef, battle: BattleState): string | null {
    if (hand.length === 0) return null;

    const personality = character.deck_ai.personality;
    const myDrunkLevel = getDrunkLevel(battle.opponentDrunk);
    const playerDrunkLevel = getDrunkLevel(battle.playerDrunk);

    const drinks = hand.filter(id => CARD_DATA[id]?.type === 'drink');
    const foods = hand.filter(id => CARD_DATA[id]?.type === 'food');
    const chugs = hand.filter(id => CARD_DATA[id]?.type === 'chug');
    const harassments = hand.filter(id => CARD_DATA[id]?.type === 'harassment');
    const strategies = hand.filter(id => CARD_DATA[id]?.type === 'strategy');
    const environments = hand.filter(id => CARD_DATA[id]?.type === 'environment');
    const statuses = hand.filter(id => CARD_DATA[id]?.type === 'status');

    // === 逆セクハラ条件行動 ===
    // セクハラが成功するためにはプレイヤーの酔いLvが必要条件を満たす必要がある
    // 使用可能なセクハラカード = プレイヤーの酔いLvで発動条件を満たすもの
    const viableHarassments = harassments.filter(id => {
      const card = CARD_DATA[id];
      const required = card.requiredDrunkLevel ?? 0;
      // excuse/dimlight によるLv軽減を考慮
      let adjusted = required;
      if (hasBuff(battle.opponentBuffs, 'dimlight')) adjusted = Math.max(0, adjusted - 1);
      if (hasBuff(battle.opponentBuffs, 'excuse')) adjusted = Math.max(0, adjusted - 1);
      if (card.instantWin) adjusted = Math.max(2, adjusted);
      return playerDrunkLevel >= adjusted;
    });

    // 自分の酔いLvが高い（大胆になっている）→ 確定で逆セクハラを仕掛ける
    if (myDrunkLevel >= 3 && viableHarassments.length > 0) {
      const pick = this.pickStrongestHarassment(viableHarassments, battle);
      if (pick) return pick;
    }

    // プレイヤーが守りに徹している → しびれを切らして逆セクハラ
    if (isPlayerStalling(battle) && viableHarassments.length > 0 && myDrunkLevel >= 2) {
      if (Math.random() < 0.6) {
        return randomPick(viableHarassments);
      }
    }

    // === 環境カード: 序盤に使いたい ===
    if (battle.round <= 3 && environments.length > 0) {
      if (Math.random() < 0.5) {
        return randomPick(environments);
      }
    }

    // === 状態異常カード: ハラスメント前の布石 ===
    if (statuses.length > 0 && (harassments.length > 0 || viableHarassments.length > 0) && myDrunkLevel >= 1) {
      // alone は特に強力 → 積極的に使用
      const aloneCard = statuses.find(id => CARD_DATA[id]?.applyBothBuffs?.some(b => b.id === 'alone'));
      if (aloneCard && !hasBuff(battle.opponentBuffs, 'alone') && Math.random() < 0.7) {
        return aloneCard;
      }
      if (Math.random() < 0.4) {
        return randomPick(statuses);
      }
    }

    // === 戦略カード ===
    if (strategies.length > 0) {
      // excuse: セクハラカードがある時に先使い
      const excuseCard = strategies.find(id => CARD_DATA[id]?.applySelfBuffs?.some(b => b.id === 'excuse'));
      if (excuseCard && harassments.length > 0 && !hasBuff(battle.opponentBuffs, 'excuse')) {
        if (Math.random() < 0.5) {
          return excuseCard;
        }
      }
      // rumor: 相手が強そうな時
      if (playerDrunkLevel <= 1 && Math.random() < 0.3) {
        return randomPick(strategies);
      }
    }

    // === 通常行動 ===
    // 自分の酔いが高い → つまみ優先
    if (myDrunkLevel >= 2 && foods.length > 0) {
      if (Math.random() < 0.7) {
        const pick = this.pickBestFood(foods);
        if (pick) return pick;
      }
    }

    // 相手の酔いが高い → ドリンクで畳みかける
    if (playerDrunkLevel >= 2 && drinks.length > 0) {
      if (Math.random() < 0.7) {
        const pick = this.pickBestDrink(drinks);
        if (pick) return pick;
      }
    }

    // 一気飲みカード判定
    if (chugs.length > 0 && playerDrunkLevel >= 2) {
      if (Math.random() < 0.5) {
        return randomPick(chugs);
      }
    }

    // 逆セクハラ: 成功見込みがあれば低確率で使用
    if (viableHarassments.length > 0 && myDrunkLevel >= 2) {
      if (Math.random() < 0.3) {
        return randomPick(viableHarassments);
      }
    }

    // パーソナリティ別行動
    switch (personality) {
      case 'aggressive':
        if (drinks.length > 0 && Math.random() < 0.7) {
          const pick = this.pickBestDrink(drinks);
          if (pick) return pick;
        }
        break;
      case 'defensive':
        if (foods.length > 0 && Math.random() < 0.6) {
          const pick = this.pickBestFood(foods);
          if (pick) return pick;
        }
        break;
      case 'balanced':
      default:
        if (Math.random() < 0.5 && drinks.length > 0) {
          return randomPick(drinks);
        }
        if (foods.length > 0) {
          return randomPick(foods);
        }
        break;
    }

    // 最終フォールバック: 手札からランダム（手札が空ならnull）
    return hand.length > 0 ? hand[Math.floor(Math.random() * hand.length)] : null;
  },

  pickBestDrink(drinks: string[]): string | null {
    if (drinks.length === 0) return null;
    return drinks.reduce((best, id) => {
      const card = CARD_DATA[id];
      const bestCard = CARD_DATA[best];
      const dmg = card.damage === -1 ? 2 : (card.damage ?? 0);
      const bestDmg = bestCard.damage === -1 ? 2 : (bestCard.damage ?? 0);
      return dmg > bestDmg ? id : best;
    }, drinks[0]);
  },

  pickBestFood(foods: string[]): string | null {
    if (foods.length === 0) return null;
    return foods.reduce((best, id) => {
      const card = CARD_DATA[id];
      const bestCard = CARD_DATA[best];
      return (card.heal ?? 0) > (bestCard.heal ?? 0) ? id : best;
    }, foods[0]);
  },

  /** 最も強力なセクハラカードを選択 */
  pickStrongestHarassment(cards: string[], battle?: BattleState): string | null {
    if (cards.length === 0) return null;
    // プレイヤーの理性が低い時は sanityDamage の重みを上げる
    const sanityWeight = battle && battle.playerSanity <= 3 ? 2.0 : 1.0;
    return cards.reduce((best, id) => {
      const card = CARD_DATA[id];
      const bestCard = CARD_DATA[best];
      const score = (card.sanityDamage ?? 0) * sanityWeight + (card.drunkDamage ?? 0) + (card.instantWin ? 10 : 0);
      const bestScore = (bestCard.sanityDamage ?? 0) * sanityWeight + (bestCard.drunkDamage ?? 0) + (bestCard.instantWin ? 10 : 0);
      return score > bestScore ? id : best;
    }, cards[0]);
  },
};

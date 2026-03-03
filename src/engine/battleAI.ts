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

export const BattleAI = {
  selectCard(hand: string[], character: CharacterDef, battle: BattleState): string | null {
    if (hand.length === 0) return null;

    const personality = character.deck_ai.personality;
    const myDrunkLevel = getDrunkLevel(battle.opponentDrunk);
    const playerDrunkLevel = getDrunkLevel(battle.playerDrunk);

    const drinks = hand.filter(id => CARD_DATA[id]?.type === 'drink');
    const foods = hand.filter(id => CARD_DATA[id]?.type === 'food');
    const chugs = hand.filter(id => CARD_DATA[id]?.type === 'chug');

    // 自分の酔いが高い → つまみ優先
    if (myDrunkLevel >= 2 && foods.length > 0) {
      if (Math.random() < 0.7) {
        return this.pickBestFood(foods);
      }
    }

    // 相手の酔いが高い → ドリンクで畳みかける
    if (playerDrunkLevel >= 2 && drinks.length > 0) {
      if (Math.random() < 0.7) {
        return this.pickBestDrink(drinks);
      }
    }

    // 一気飲みカード判定
    if (chugs.length > 0 && playerDrunkLevel >= 2) {
      if (Math.random() < 0.5) {
        return randomPick(chugs);
      }
    }

    // パーソナリティ別行動
    switch (personality) {
      case 'aggressive':
        if (drinks.length > 0 && Math.random() < 0.7) {
          return this.pickBestDrink(drinks);
        }
        break;
      case 'defensive':
        if (foods.length > 0 && Math.random() < 0.6) {
          return this.pickBestFood(foods);
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

    return randomPick(hand);
  },

  pickBestDrink(drinks: string[]): string {
    return drinks.reduce((best, id) => {
      const card = CARD_DATA[id];
      const bestCard = CARD_DATA[best];
      const dmg = card.damage === -1 ? 2 : (card.damage ?? 0);
      const bestDmg = bestCard.damage === -1 ? 2 : (bestCard.damage ?? 0);
      return dmg > bestDmg ? id : best;
    }, drinks[0]);
  },

  pickBestFood(foods: string[]): string {
    return foods.reduce((best, id) => {
      const card = CARD_DATA[id];
      const bestCard = CARD_DATA[best];
      return (card.heal ?? 0) > (bestCard.heal ?? 0) ? id : best;
    }, foods[0]);
  },
};

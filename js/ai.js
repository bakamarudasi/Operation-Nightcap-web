/**
 * 相手AI
 */
const BattleAI = {
  /**
   * AIのカード選択
   */
  selectCard() {
    const b = GameState.battle;
    const hand = b.opponentHand;
    if (hand.length === 0) return null;

    const char = GameState.currentOpponent;
    const personality = char.deck_ai.personality;
    const myDrunkLevel = GameState.getDrunkLevel(b.opponentDrunk);
    const playerDrunkLevel = GameState.getDrunkLevel(b.playerDrunk);

    // 手札をカテゴリ分け
    const drinks = hand.filter(id => CARD_DATA[id].type === 'drink');
    const foods = hand.filter(id => CARD_DATA[id].type === 'food');
    const chugs = hand.filter(id => CARD_DATA[id].type === 'chug');

    // === 基本AI戦略 ===
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
        // 攻撃的：ドリンク優先
        if (drinks.length > 0 && Math.random() < 0.7) {
          return this.pickBestDrink(drinks);
        }
        break;
      case 'defensive':
        // 防御的：つまみ優先
        if (foods.length > 0 && Math.random() < 0.6) {
          return this.pickBestFood(foods);
        }
        break;
      case 'balanced':
      default:
        // バランス型
        if (Math.random() < 0.5 && drinks.length > 0) {
          return randomPick(drinks);
        }
        if (foods.length > 0) {
          return randomPick(foods);
        }
        break;
    }

    // フォールバック：ランダム
    return randomPick(hand);
  },

  /**
   * 最強のドリンクを選ぶ
   */
  pickBestDrink(drinks) {
    return drinks.reduce((best, id) => {
      const card = CARD_DATA[id];
      const bestCard = CARD_DATA[best];
      const dmg = card.damage === -1 ? 2 : card.damage; // カクテルは期待値2
      const bestDmg = bestCard.damage === -1 ? 2 : bestCard.damage;
      return dmg > bestDmg ? id : best;
    }, drinks[0]);
  },

  /**
   * 最強のつまみを選ぶ
   */
  pickBestFood(foods) {
    return foods.reduce((best, id) => {
      const card = CARD_DATA[id];
      const bestCard = CARD_DATA[best];
      return card.heal > bestCard.heal ? id : best;
    }, foods[0]);
  }
};

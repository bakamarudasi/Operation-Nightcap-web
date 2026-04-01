import { CARD_DATA } from '../data/cards.ts';
import type { BattleState, CardType, CharacterDef } from '../data/types.ts';
import { randomPick, randomIndex, getDrunkLevel, hasBuff, canPlayCard, isFoodDisabled } from './utils.ts';

/** 三すくみカウンタータイプ */
function counterType(t: CardType): CardType {
  if (t === 'harassment') return 'drink';
  if (t === 'food') return 'harassment';
  if (t === 'drink') return 'food';
  return 'drink';
}

/** プレイヤーがつまみばかり使っているか判定 */
function isPlayerStalling(battle: BattleState): boolean {
  return battle.round >= 3 && battle.playerDrunk <= 1;
}

/** セクハラカードの発動条件チェック */
function isHarassmentViable(id: string, playerDrunkLevel: number, opponentBuffs: { id: string }[]): boolean {
  const card = CARD_DATA[id];
  if (!card || card.type !== 'harassment') return false;
  let required = card.requiredDrunkLevel ?? 0;
  if (hasBuff(opponentBuffs, 'dimlight')) required = Math.max(0, required - 1);
  if (hasBuff(opponentBuffs, 'excuse')) required = Math.max(0, required - 1);
  if (card.instantWin) required = Math.max(2, required);
  return playerDrunkLevel >= required;
}

export const BattleAI = {
  selectCard(hand: string[], character: CharacterDef, battle: BattleState): { cardId: string | null; misplay: boolean } {
    if (hand.length === 0) return { cardId: null, misplay: false };

    const personality = character.deck_ai.personality;
    const myDrunkLevel = getDrunkLevel(battle.opponentDrunk);
    const playerDrunkLevel = getDrunkLevel(battle.playerDrunk);

    // === 新メカニクス: コスト制限 & food封印フィルタ ===
    let candidates = hand.filter(id => {
      const card = CARD_DATA[id];
      if (!card) return false;
      if (!canPlayCard(card, battle.opponentDrunk)) return false;
      if (isFoodDisabled(myDrunkLevel) && card.type === 'food') return false;
      return true;
    });
    if (candidates.length === 0) candidates = [...hand];

    // === 新メカニクス: 暴走 (Lv2: ランダム除外, Lv3: 20%完全ランダム) ===
    if (myDrunkLevel >= 2 && candidates.length > 1) {
      const dropIdx = randomIndex(candidates);
      candidates.splice(dropIdx, 1);
    }
    if (myDrunkLevel >= 3 && Math.random() < 0.2) {
      return { cardId: randomPick(candidates), misplay: true };
    }

    // === タイプ別分類 ===
    const drinks: string[] = [];
    const foods: string[] = [];
    const chugs: string[] = [];
    const harassments: string[] = [];
    const strategies: string[] = [];
    const environments: string[] = [];
    const statuses: string[] = [];
    for (const id of candidates) {
      switch (CARD_DATA[id]?.type) {
        case 'drink': drinks.push(id); break;
        case 'food': foods.push(id); break;
        case 'chug': chugs.push(id); break;
        case 'harassment': harassments.push(id); break;
        case 'strategy': strategies.push(id); break;
        case 'environment': environments.push(id); break;
        case 'status': statuses.push(id); break;
      }
    }

    // 発動条件を満たすセクハラカードのみ
    const viableHarassments = harassments.filter(id =>
      isHarassmentViable(id, playerDrunkLevel, battle.opponentBuffs)
    );

    // === 新メカニクス: 三すくみカウンター予測 (30%で発動) ===
    if (Math.random() < 0.3) {
      const history = battle.playerCardHistory.slice(-2);
      if (history.length > 0) {
        const freq: Record<string, number> = {};
        for (const h of history) freq[h] = (freq[h] ?? 0) + 1;
        const major = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] as CardType | undefined;
        if (major) {
          const ct = counterType(major);
          const counterCards = candidates.filter(id => {
            const card = CARD_DATA[id];
            if (!card || card.type !== ct) return false;
            // harassmentカウンターの場合、発動条件チェック
            if (ct === 'harassment') return isHarassmentViable(id, playerDrunkLevel, battle.opponentBuffs);
            return true;
          });
          if (counterCards.length > 0) {
            const pick = ct === 'drink' ? this.pickBestDrink(counterCards)
                       : ct === 'food' ? this.pickBestFood(counterCards)
                       : randomPick(counterCards);
            if (pick) return { cardId: pick, misplay: false };
          }
        }
      }
    }

    // === 逆セクハラ条件行動 ===
    // 自分の酔いLvが高い（大胆になっている）→ 確定で逆セクハラを仕掛ける
    if (myDrunkLevel >= 3 && viableHarassments.length > 0) {
      const pick = this.pickStrongestHarassment(viableHarassments, battle);
      if (pick) return { cardId: pick, misplay: false };
    }

    // プレイヤーが守りに徹している → しびれを切らして逆セクハラ
    if (isPlayerStalling(battle) && viableHarassments.length > 0 && myDrunkLevel >= 2) {
      if (Math.random() < 0.6) {
        return { cardId: randomPick(viableHarassments), misplay: false };
      }
    }

    // === 環境カード: 序盤に使いたい ===
    if (battle.round <= 3 && environments.length > 0) {
      if (Math.random() < 0.5) {
        return { cardId: randomPick(environments), misplay: false };
      }
    }

    // === 状態異常カード: ハラスメント前の布石 ===
    if (statuses.length > 0 && (harassments.length > 0 || viableHarassments.length > 0) && myDrunkLevel >= 1) {
      const aloneCard = statuses.find(id => CARD_DATA[id]?.applyBothBuffs?.some(b => b.id === 'alone'));
      if (aloneCard && !hasBuff(battle.opponentBuffs, 'alone') && Math.random() < 0.7) {
        return { cardId: aloneCard, misplay: false };
      }
      if (Math.random() < 0.4) {
        return { cardId: randomPick(statuses), misplay: false };
      }
    }

    // === 戦略カード ===
    if (strategies.length > 0) {
      const excuseCard = strategies.find(id => CARD_DATA[id]?.applySelfBuffs?.some(b => b.id === 'excuse'));
      if (excuseCard && harassments.length > 0 && !hasBuff(battle.opponentBuffs, 'excuse')) {
        if (Math.random() < 0.5) {
          return { cardId: excuseCard, misplay: false };
        }
      }
      if (playerDrunkLevel <= 1 && Math.random() < 0.3) {
        return { cardId: randomPick(strategies), misplay: false };
      }
    }

    // === 通常行動 ===
    // 自分の酔いが高い → つまみ優先
    if (myDrunkLevel >= 2 && foods.length > 0) {
      if (Math.random() < 0.7) {
        const pick = this.pickBestFood(foods);
        if (pick) return { cardId: pick, misplay: false };
      }
    }

    // 相手の酔いが高い → ドリンクで畳みかける
    if (playerDrunkLevel >= 2 && drinks.length > 0) {
      if (Math.random() < 0.7) {
        const pick = this.pickBestDrink(drinks);
        if (pick) return { cardId: pick, misplay: false };
      }
    }

    // 一気飲みカード判定
    if (chugs.length > 0 && playerDrunkLevel >= 2) {
      if (Math.random() < 0.5) {
        return { cardId: randomPick(chugs), misplay: false };
      }
    }

    // 逆セクハラ: 成功見込みがあれば低確率で使用
    if (viableHarassments.length > 0 && myDrunkLevel >= 2) {
      if (Math.random() < 0.3) {
        return { cardId: randomPick(viableHarassments), misplay: false };
      }
    }

    // パーソナリティ別行動
    switch (personality) {
      case 'aggressive':
        if (drinks.length > 0 && Math.random() < 0.7) {
          const pick = this.pickBestDrink(drinks);
          if (pick) return { cardId: pick, misplay: false };
        }
        break;
      case 'defensive':
        if (foods.length > 0 && Math.random() < 0.6) {
          const pick = this.pickBestFood(foods);
          if (pick) return { cardId: pick, misplay: false };
        }
        break;
      case 'balanced':
      default:
        if (Math.random() < 0.5 && drinks.length > 0) {
          return { cardId: randomPick(drinks), misplay: false };
        }
        if (foods.length > 0) {
          return { cardId: randomPick(foods), misplay: false };
        }
        break;
    }

    // 最終フォールバック
    return { cardId: randomPick(candidates), misplay: false };
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

  pickStrongestHarassment(cards: string[], battle?: BattleState): string | null {
    if (cards.length === 0) return null;
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

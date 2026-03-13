import { CARD_DATA } from '../data/cards.ts';
import type { BattleState, CardType, CharacterDef } from '../data/types.ts';
import { randomPick, getDrunkLevel, hasBuff, canPlayCard, isFoodDisabled } from './utils.ts';

function counterType(t: CardType): CardType {
  if (t === 'harassment') return 'drink';
  if (t === 'food') return 'harassment';
  if (t === 'drink') return 'food';
  return 'drink';
}

function weightedPick<T extends string>(items: T[], scoreMap: Record<string, number>): T | null {
  const scored = items.map((id) => ({ id, w: Math.max(0.05, scoreMap[id] ?? 0.1) }));
  const total = scored.reduce((sum, x) => sum + x.w, 0);
  if (total <= 0) return randomPick(items);
  let roll = Math.random() * total;
  for (const s of scored) {
    roll -= s.w;
    if (roll <= 0) return s.id;
  }
  return scored[scored.length - 1]?.id ?? null;
}

export const BattleAI = {
  selectCard(hand: string[], character: CharacterDef, battle: BattleState): { cardId: string | null; misplay: boolean } {
    if (hand.length === 0) return { cardId: null, misplay: false };

    const personality = character.deck_ai.personality;
    const myDrunkLevel = getDrunkLevel(battle.opponentDrunk);
    const playerDrunkLevel = getDrunkLevel(battle.playerDrunk);

    let candidates = hand.filter((id) => {
      const card = CARD_DATA[id];
      if (!card) return false;
      if (!canPlayCard(card, battle.opponentDrunk)) return false;
      if (isFoodDisabled(myDrunkLevel) && card.type === 'food') return false;
      return true;
    });
    if (candidates.length === 0) candidates = [...hand];

    if (myDrunkLevel >= 2 && candidates.length > 1) {
      const dropIdx = Math.floor(Math.random() * candidates.length);
      candidates.splice(dropIdx, 1);
    }

    if (myDrunkLevel >= 3 && Math.random() < 0.2) {
      return { cardId: randomPick(candidates), misplay: true };
    }

    const scores: Record<string, number> = {};
    for (const id of candidates) scores[id] = 0.1;

    const history = battle.playerCardHistory.slice(-2);
    if (history.length > 0) {
      const freq: Record<string, number> = {};
      for (const h of history) freq[h] = (freq[h] ?? 0) + 1;
      const major = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] as CardType | undefined;
      if (major) {
        const ct = counterType(major);
        for (const id of candidates) {
          if (CARD_DATA[id]?.type === ct) scores[id] += 0.3;
        }
      }
    }

    for (const id of candidates) {
      const card = CARD_DATA[id];
      if (!card) continue;
      if (personality === 'aggressive' && (card.type === 'drink' || card.type === 'harassment')) scores[id] += 0.4;
      if (personality === 'defensive' && card.type === 'food') scores[id] += 0.4;
      if (personality === 'balanced' && (card.type === 'strategy' || card.type === 'status')) scores[id] += 0.2;

      if (myDrunkLevel >= 2 && card.type === 'food') scores[id] += 0.3;
      if (playerDrunkLevel >= 2 && (card.type === 'drink' || card.type === 'harassment')) scores[id] += 0.3;
      if (battle.maxRounds - battle.round <= 2 && (card.type === 'drink' || card.type === 'chug')) scores[id] += 0.3;
      if (card.cost >= 3 && myDrunkLevel >= 2) scores[id] += 0.2;

      // 逆セクハラ発動条件
      if (card.type === 'harassment') {
        let required = card.requiredDrunkLevel ?? 0;
        if (hasBuff(battle.opponentBuffs, 'dimlight')) required = Math.max(0, required - 1);
        if (hasBuff(battle.opponentBuffs, 'excuse')) required = Math.max(0, required - 1);
        if (card.instantWin) required = Math.max(2, required);
        if (playerDrunkLevel < required) scores[id] -= 0.8;
      }
    }

    return { cardId: weightedPick(candidates, scores), misplay: false };
  },
};

import type { RefObject } from 'react';
import type { BattleState } from '../../data/types.ts';
import { CARD_DATA } from '../../data/cards.ts';
import { getDrunkLevel } from '../../engine/utils.ts';
import { canPlayCard, isFoodDisabled } from '../../engine/utils.ts';

interface PlayerHandProps {
  battle: BattleState;
  playingCardIdx: number | null;
  handCardRefs: RefObject<(HTMLDivElement | null)[]>;
  onCardClick: (cardId: string, idx: number) => void;
  t: (key: string, opts?: string | Record<string, unknown>) => string;
}

export function PlayerHand({
  battle,
  playingCardIdx,
  handCardRefs,
  onCardClick,
  t,
}: PlayerHandProps) {
  const playerDrunkLevel = getDrunkLevel(battle.playerDrunk);
  const foodDisabled = isFoodDisabled(playerDrunkLevel);

  return (
    <div className="hand-area" data-card-count={battle.playerHand.length}>
      {battle.playerHand.map((cardId, i) => {
        const card = CARD_DATA[cardId];
        if (!card) return null;
        const isPlaying = playingCardIdx === i;
        const costLocked = !canPlayCard(card, battle.playerDrunk);
        const foodLocked = foodDisabled && card.type === 'food';
        const isDisabled = ((battle.isProcessing || playingCardIdx !== null) && !isPlaying) || costLocked || foodLocked;
        const isSelected = battle.selectedCard === cardId && !isPlaying;
        const isCorrupted = battle.corruptedSlots[i] === true;
        const isHidden = battle.playerHiddenSlots.includes(i);
        const isBlurred = i === battle.playerBlurredSlot && !isHidden;
        const cardLevel = battle.playerCardLevels?.[cardId] ?? 1;
        const levelClass = cardLevel >= 3 ? 'card-lv3' : cardLevel >= 2 ? 'card-lv2' : '';
        const valText = isHidden ? '???' : card.type === 'food' ? (card.heal === 99 ? t('battle.maxHeal') : t('battle.heal', { value: card.heal })) :
                        card.type === 'drink' ? (card.damage === -1 ? '1~3' : `${card.damage}`) :
                        card.type === 'chug' ? t('battle.special') :
                        card.type === 'harassment' ? t('battle.special') : '';

        return (
          <div
            key={`${cardId}-${i}`}
            ref={el => { handCardRefs.current![i] = el; }}
            className={`hand-card type-${card.type} ${levelClass} ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''} ${isDisabled ? 'disabled' : ''} ${isCorrupted ? 'corrupted' : ''} ${isBlurred ? 'card-blurred' : ''} ${isHidden ? 'card-hidden' : ''} ${costLocked ? 'card-cost-locked' : ''} ${foodLocked ? 'card-food-locked' : ''}`}
            onClick={() => onCardClick(cardId, i)}
          >
            {cardLevel >= 2 && !isHidden && (
              <div className="card-level-badge">{'★'.repeat(cardLevel)}</div>
            )}
            <div className="hand-tooltip">
              <div className="tooltip-name">{isHidden ? '???' : t(`cards.${card.id}.name`, card.name)}</div>
              <div className="tooltip-desc">{costLocked ? t('battle.costLocked') : foodLocked ? t('battle.foodLocked') : (isHidden ? t('battle.hiddenCard') : t(`cards.${card.id}.desc`, card.description))}</div>
            </div>
            <div className="hand-cost">{card.cost}</div>
            <div className="hand-icon">{isHidden ? '❓' : card.emoji}</div>
            <div className="hand-name">{isHidden ? '???' : t(`cards.${card.id}.name`, card.name)}</div>
            <div className="hand-val">{valText}</div>
          </div>
        );
      })}
    </div>
  );
}

import type { TFunction } from 'i18next';
import { CARD_DATA } from '../../data/cards.ts';
import { formatDamage } from '../../engine/cardFormat.ts';

interface Props {
  revealedCards: string[];
  t: TFunction;
}

export function RevealedHandOverlay({ revealedCards, t }: Props) {
  return (
    <div className="revealed-hand-overlay">
      <div className="revealed-hand-title">{t('battle.revealedHand')}</div>
      <div className="revealed-hand-cards">
        {revealedCards.map((cardId, i) => {
          const card = CARD_DATA[cardId];
          if (!card) return null;
          return (
            <div key={`reveal-${i}`} className={`revealed-card type-${card.type}`}>
              <div className="revealed-card-emoji">{card.emoji}</div>
              <div className="revealed-card-name">{t(`cards.${card.id}.name`, card.name)}</div>
              <div className="revealed-card-type">
                {card.type === 'drink'
                  ? t('battle.cardTypeAttack', { value: formatDamage(card) })
                  : card.type === 'food'
                  ? t('battle.cardTypeHeal', { value: card.heal })
                  : card.type === 'chug'
                  ? t('battle.cardTypeChug')
                  : card.type === 'harassment'
                  ? t('battle.cardTypeHarassment')
                  : card.type === 'strategy'
                  ? t('battle.cardTypeStrategy')
                  : card.type === 'environment'
                  ? t('battle.cardTypeEnvironment')
                  : t('battle.cardTypeStatus')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

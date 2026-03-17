import { useTranslation } from 'react-i18next';
import { CARD_DATA } from '../data/cards.ts';

interface CardProps {
  cardId: string;
  onClick?: () => void;
  selected?: boolean;
  size?: 'normal' | 'small' | 'deck' | 'table';
  showPrice?: boolean;
  /** カード強化レベル（1=通常, 2=金枠, 3=虹枠） */
  level?: number;
}

export function Card({ cardId, onClick, selected, size = 'normal', showPrice, level = 1 }: CardProps) {
  const { t } = useTranslation();
  const card = CARD_DATA[cardId];
  if (!card) return null;

  const sizeClass = size === 'small' ? 'shop-card' :
                    size === 'deck' ? 'deck-card' :
                    size === 'table' ? 'table-card' : '';

  const typeClass = `card-${card.type}`;
  const levelClass = level >= 3 ? 'card-lv3' : level >= 2 ? 'card-lv2' : '';

  return (
    <div
      className={`card card-face ${typeClass} ${sizeClass} ${levelClass} ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {level >= 2 && (
        <span className="card-level-badge">{'★'.repeat(level)}</span>
      )}
      <span className="card-emoji">{card.emoji}</span>
      <span className="card-name">{card.name}</span>
      {card.type === 'drink' && card.damage !== undefined && (
        <span className="card-value">
          {card.damage === -1 ? '1~3' : card.damage}
        </span>
      )}
      {card.type === 'food' && card.heal !== undefined && (
        <span className="card-value">
          +{card.heal === 99 ? 'MAX' : card.heal}
        </span>
      )}
      {showPrice && (
        <span className="card-price">{card.price}{t('common.currencyIcon')}</span>
      )}
    </div>
  );
}

export function CardBack() {
  return (
    <div className="card card-back">?</div>
  );
}

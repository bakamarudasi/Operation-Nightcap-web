import { CARD_DATA } from '../data/cards.ts';

interface CardProps {
  cardId: string;
  onClick?: () => void;
  selected?: boolean;
  size?: 'normal' | 'small' | 'deck' | 'table';
  showPrice?: boolean;
}

export function Card({ cardId, onClick, selected, size = 'normal', showPrice }: CardProps) {
  const card = CARD_DATA[cardId];
  if (!card) return null;

  const sizeClass = size === 'small' ? 'shop-card' :
                    size === 'deck' ? 'deck-card' :
                    size === 'table' ? 'table-card' : '';

  const typeClass = `card-${card.type}`;

  return (
    <div
      className={`card card-face ${typeClass} ${sizeClass} ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
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
        <span className="card-price">{card.price}龍</span>
      )}
    </div>
  );
}

export function CardBack() {
  return (
    <div className="card card-back">?</div>
  );
}

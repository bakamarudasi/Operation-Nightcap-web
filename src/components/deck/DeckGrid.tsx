import type React from 'react';
import { useTranslation } from 'react-i18next';
import { CARD_DATA } from '../../data/cards.ts';
import type { CardDef } from '../../data/types.ts';

interface AnimCard {
  id: number;
  deckIndex: number;
  type: 'add' | 'remove';
}

interface DragRender {
  source: 'deck' | 'inventory';
  deckIndex?: number;
  active: boolean;
}

interface DeckGridProps {
  playerDeck: string[];
  animCards: AnimCard[];
  isDragActive: boolean;
  dragRender: DragRender | null;
  deckReorderTarget: number | null;
  deckGridRef: React.RefObject<HTMLDivElement | null>;
  onDeckClick: (index: number) => void;
  onMouseDown: (source: 'deck', cardId: string, deckIndex: number, e: React.MouseEvent) => void;
  onTouchStart: (source: 'deck', cardId: string, deckIndex: number, e: React.TouchEvent) => void;
  onCancelLongPress: () => void;
  onShowPreview: (card: CardDef, e: React.MouseEvent) => void;
  onHidePreview: () => void;
  onShowTouchPreview: (card: CardDef, e: React.TouchEvent) => void;
}

export function DeckGrid({
  playerDeck, animCards, isDragActive, dragRender, deckReorderTarget,
  deckGridRef, onDeckClick, onMouseDown, onTouchStart, onCancelLongPress,
  onShowPreview, onHidePreview, onShowTouchPreview,
}: DeckGridProps) {
  const { t } = useTranslation();
  // 同一カードの枚数をカウント
  const cardCounts: Record<string, number> = {};
  for (const id of playerDeck) {
    cardCounts[id] = (cardCounts[id] ?? 0) + 1;
  }
  // 各カードIDの何枚目かを追跡
  const seenCounts: Record<string, number> = {};

  return (
    <div className="deck-grid" ref={deckGridRef}>
      {playerDeck.map((cardId, i) => {
        const card = CARD_DATA[cardId];
        if (!card) return null;

        seenCounts[cardId] = (seenCounts[cardId] ?? 0) + 1;
        const isFirstOfKind = seenCounts[cardId] === 1;
        const count = cardCounts[cardId];

        const isBeingDragged = isDragActive && dragRender?.source === 'deck' && dragRender.deckIndex === i;
        const isReorderTarget = deckReorderTarget === i && isDragActive && dragRender?.source === 'deck' && dragRender.deckIndex !== i;
        const isRemoving = animCards.some(a => a.type === 'remove' && a.deckIndex === i);
        const isAdding = animCards.some(a => a.type === 'add' && a.deckIndex === i);

        return (
          <div
            key={`deck-${i}`}
            className={[
              'deck-slot',
              `type-${card.type}`,
              isBeingDragged ? 'dragging' : '',
              isReorderTarget ? 'reorder-target' : '',
              isRemoving ? 'removing' : '',
              isAdding ? 'card-adding' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onDeckClick(i)}
            onMouseEnter={(e) => onShowPreview(card, e)}
            onMouseLeave={onHidePreview}
            onMouseDown={(e) => onMouseDown('deck', cardId, i, e)}
            onTouchStart={(e) => {
              onTouchStart('deck', cardId, i, e);
              onShowTouchPreview(card, e);
            }}
            onTouchEnd={() => { onCancelLongPress(); onHidePreview(); }}
          >
            <div className="deck-slot-remove">×</div>
            <div className="deck-slot-emoji">{card.emoji}</div>
            <div className="deck-slot-name">{card.name}</div>
            <div className="deck-slot-info">
              {card.type === 'drink' ? t('deckGrid.atkShort', { value: card.damage === -1 ? '1~3' : card.damage }) :
               card.type === 'food' ? t('deckGrid.healShort', { value: card.heal === 99 ? 'MAX' : card.heal }) :
               card.type === 'harassment' ? `Lv${card.requiredDrunkLevel}` :
               t('deckGrid.special')}
            </div>
            {/* レアリティ星 */}
            <div className="deck-slot-stars">{'★'.repeat(card.rarity)}</div>
            {/* 同名カード枚数バッジ */}
            {isFirstOfKind && count > 1 && (
              <div className="deck-slot-count">×{count}</div>
            )}
          </div>
        );
      })}
      {Array.from({ length: 12 - playerDeck.length }).map((_, i) => (
        <div key={`empty-${i}`} className={`deck-slot deck-slot-empty ${
          animCards.some(a => a.type === 'add') && i === 0 ? 'slot-pulse' : ''
        }`}>
          <div className="deck-slot-emoji">＋</div>
          {i === 0 && playerDeck.length < 12 && (
            <div className="deck-slot-hint">{t('deckGrid.addHint')}</div>
          )}
        </div>
      ))}
    </div>
  );
}

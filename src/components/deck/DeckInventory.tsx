import { useState } from 'react';
import { CARD_DATA } from '../../data/cards.ts';
import type { CardDef } from '../../data/types.ts';

type SortMode = 'rarity' | 'name' | 'power';

interface DeckInventoryProps {
  inventoryList: [string, { total: number; inDeck: number }][];
  playerDeck: string[];
  filter: string;
  onFilterChange: (key: string) => void;
  onCardClick: (cardId: string, cantAdd: boolean) => void;
  onMouseDown: (cardId: string, cantAdd: boolean, e: React.MouseEvent) => void;
  onTouchStart: (cardId: string, cantAdd: boolean, e: React.TouchEvent) => void;
  onCancelLongPress: () => void;
  onShowPreview: (card: CardDef, e: React.MouseEvent) => void;
  onHidePreview: () => void;
  onShowTouchPreview: (card: CardDef, e: React.TouchEvent) => void;
}

const FILTERS = [
  { key: 'all', label: '全て' },
  { key: 'drink', label: '🍺 ドリンク' },
  { key: 'food', label: '🥜 つまみ' },
  { key: 'chug', label: '🍻 一気飲み' },
  { key: 'harassment', label: '💋 セクハラ' },
  { key: 'strategy', label: '🗣️ 戦略' },
  { key: 'environment', label: '🎤 環境' },
  { key: 'status', label: '😳 状態異常' },
];

export function DeckInventory({
  inventoryList, playerDeck, filter, onFilterChange,
  onCardClick, onMouseDown, onTouchStart, onCancelLongPress,
  onShowPreview, onHidePreview, onShowTouchPreview,
}: DeckInventoryProps) {
  const [sortMode, setSortMode] = useState<SortMode>('rarity');

  // フィルター別枚数集計（全リストから計算）
  const filterCounts: Record<string, number> = {};
  for (const [cardId, counts] of inventoryList) {
    const card = CARD_DATA[cardId];
    if (!card) continue;
    const remaining = counts.total - counts.inDeck;
    filterCounts[card.type] = (filterCounts[card.type] ?? 0) + remaining;
    filterCounts['all'] = (filterCounts['all'] ?? 0) + remaining;
  }

  // フィルター適用
  const filtered = inventoryList.filter(([cardId]) =>
    filter === 'all' || CARD_DATA[cardId]?.type === filter
  );

  // ソート
  const sorted = [...filtered].sort((a, b) => {
    const ca = CARD_DATA[a[0]];
    const cb = CARD_DATA[b[0]];
    if (!ca || !cb) return 0;
    switch (sortMode) {
      case 'name': return ca.name.localeCompare(cb.name, 'ja');
      case 'power': {
        const pa = ca.damage ?? ca.heal ?? 0;
        const pb = cb.damage ?? cb.heal ?? 0;
        return pb - pa;
      }
      default: return cb.rarity - ca.rarity;
    }
  });

  const deckFull = playerDeck.length >= 12;

  return (
    <div className="deck-inventory-panel">
      <div className="inventory-panel-header">
        <div className="deck-section-title">所持カード（デッキ外）</div>
        <div className="sort-toggle">
          <button className={sortMode === 'rarity' ? 'active' : ''} onClick={() => setSortMode('rarity')}>レア順</button>
          <button className={sortMode === 'name' ? 'active' : ''} onClick={() => setSortMode('name')}>名前順</button>
          <button className={sortMode === 'power' ? 'active' : ''} onClick={() => setSortMode('power')}>威力順</button>
        </div>
      </div>

      <div className="deck-filters">
        {FILTERS.map(f => {
          const count = filterCounts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              className={`deck-filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => onFilterChange(f.key)}
            >
              {f.label}
              {count > 0 && <span className="filter-count">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="inventory-grid">
        {sorted.length === 0 && (
          <div className="inventory-empty">
            デッキ外のカードはありません。ガチャやショップでカードを入手しましょう！
          </div>
        )}
        {sorted.map(([cardId, counts]) => {
          const card = CARD_DATA[cardId];
          if (!card) return null;
          const remaining = counts.total - counts.inDeck;
          const maxCopies = playerDeck.filter(id => id === cardId).length >= 3;
          const cantAdd = deckFull || maxCopies;
          return (
            <div
              key={`inv-${cardId}`}
              className={`inv-card type-${card.type} ${cantAdd ? 'cant-add' : ''}`}
              onClick={() => onCardClick(cardId, cantAdd)}
              onMouseEnter={(e) => onShowPreview(card, e)}
              onMouseLeave={onHidePreview}
              onMouseDown={(e) => onMouseDown(cardId, cantAdd, e)}
              onTouchStart={(e) => { onTouchStart(cardId, cantAdd, e); onShowTouchPreview(card, e); }}
              onTouchEnd={() => { onCancelLongPress(); onHidePreview(); }}
            >
              <div className="inv-card-emoji">{card.emoji}</div>
              <div className="inv-card-details">
                <div className="inv-card-name">{card.name}</div>
                <div className="inv-card-desc">
                  {card.type === 'drink' ? `攻撃 ${card.damage === -1 ? '1~3' : card.damage}` :
                   card.type === 'food' ? `回復 ${card.heal === 99 ? 'MAX' : card.heal}` :
                   card.type === 'harassment' ? `酔Lv${card.requiredDrunkLevel} 酔+${card.drunkDamage ?? 0}` :
                   card.description.substring(0, 20)}
                </div>
              </div>
              <div className="inv-card-rarity">{'★'.repeat(card.rarity)}</div>
              <div className="inv-card-count">×{remaining}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

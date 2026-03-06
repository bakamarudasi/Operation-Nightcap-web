import { useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import '../styles/deck.css';

export function DeckScreen() {
  const playerDeck = useGameStore((s) => s.playerDeck);
  const inventory = useGameStore((s) => s.inventory);
  const setScreen = useGameStore((s) => s.setScreen);
  const addToDeck = useGameStore((s) => s.addToDeck);
  const removeFromDeck = useGameStore((s) => s.removeFromDeck);

  const [filter, setFilter] = useState<string>('all');

  // インベントリからデッキ外のカードを集計
  const availableCards: Record<string, { total: number; inDeck: number }> = {};
  for (const cardId of inventory) {
    if (!availableCards[cardId]) {
      availableCards[cardId] = { total: 0, inDeck: 0 };
    }
    availableCards[cardId].total++;
  }
  for (const cardId of playerDeck) {
    if (!availableCards[cardId]) {
      availableCards[cardId] = { total: 0, inDeck: 0 };
    }
    availableCards[cardId].inDeck++;
  }

  const inventoryList = Object.entries(availableCards)
    .filter(([, v]) => v.total > v.inDeck)
    .filter(([cardId]) => {
      if (filter === 'all') return true;
      return CARD_DATA[cardId]?.type === filter;
    })
    .sort((a, b) => {
      const ca = CARD_DATA[a[0]];
      const cb = CARD_DATA[b[0]];
      return (ca?.rarity ?? 0) - (cb?.rarity ?? 0);
    });

  const filters = [
    { key: 'all', label: '全て' },
    { key: 'drink', label: '🍺 ドリンク' },
    { key: 'food', label: '🥜 つまみ' },
    { key: 'chug', label: '🍻 一気飲み' },
    { key: 'harassment', label: '💋 セクハラ' },
    { key: 'strategy', label: '🗣️ 戦略' },
    { key: 'environment', label: '🎤 環境' },
    { key: 'status', label: '😳 状態異常' },
  ];

  return (
    <div className="screen active deck-screen">
      <div className="deck-header">
        <button className="back-btn" onClick={() => setScreen('title')}>← 戻る</button>
        <h2>🃏 デッキ編集</h2>
        <div className="deck-count">{playerDeck.length}/12</div>
      </div>

      {/* 現在のデッキ */}
      <div className="deck-section">
        <div className="deck-section-title">現在のデッキ</div>
        <div className="deck-grid">
          {playerDeck.map((cardId, i) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            return (
              <div
                key={`deck-${i}`}
                className={`deck-card type-${card.type}`}
                onClick={() => removeFromDeck(i)}
                title="クリックでデッキから外す"
              >
                <div className="deck-card-remove">×</div>
                <div className="deck-card-emoji">{card.emoji}</div>
                <div className="deck-card-name">{card.name}</div>
                <div className="deck-card-info">
                  {card.type === 'drink' ? `攻${card.damage === -1 ? '1~3' : card.damage}` :
                   card.type === 'food' ? `回${card.heal === 99 ? 'MAX' : card.heal}` :
                   card.type === 'harassment' ? `Lv${card.requiredDrunkLevel}` :
                   '特殊'}
                </div>
              </div>
            );
          })}
          {Array.from({ length: 12 - playerDeck.length }).map((_, i) => (
            <div key={`empty-${i}`} className="deck-card deck-card-empty">
              <div className="deck-card-emoji">＋</div>
            </div>
          ))}
        </div>
        {playerDeck.length <= 4 && (
          <div className="deck-warning">最低4枚は必要です</div>
        )}
      </div>

      {/* 所持カード（デッキ外） */}
      <div className="deck-section inventory-section">
        <div className="deck-section-title">所持カード（デッキ外）</div>
        <div className="deck-filters">
          {filters.map(f => (
            <button
              key={f.key}
              className={`deck-filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="inventory-grid">
          {inventoryList.length === 0 && (
            <div className="inventory-empty">
              デッキ外のカードはありません。ガチャやショップでカードを入手しましょう！
            </div>
          )}
          {inventoryList.map(([cardId, counts]) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            const remaining = counts.total - counts.inDeck;
            const deckFull = playerDeck.length >= 12;
            const maxCopies = playerDeck.filter(id => id === cardId).length >= 3;
            const cantAdd = deckFull || maxCopies;
            return (
              <div
                key={`inv-${cardId}`}
                className={`inv-card type-${card.type} ${cantAdd ? 'cant-add' : ''}`}
                onClick={() => !cantAdd && addToDeck(cardId)}
                title={cantAdd ? (deckFull ? 'デッキが満杯' : '同カード3枚制限') : 'クリックでデッキに追加'}
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
                <div className="inv-card-count">×{remaining}</div>
                <div className="inv-card-rarity">{'★'.repeat(card.rarity)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

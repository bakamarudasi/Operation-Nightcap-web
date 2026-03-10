import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { SHOP_DATA, getShopLineCategory } from '../data/shop.ts';
import { Card } from './Card.tsx';
import { randomPick } from '../engine/utils.ts';

export function ShopScreen() {
  const money = useGameStore((s) => s.money);
  const playerDeck = useGameStore((s) => s.playerDeck);
  const setScreen = useGameStore((s) => s.setScreen);
  const buyCard = useGameStore((s) => s.buyCard);
  const sellCard = useGameStore((s) => s.sellCard);

  const [closureLine, setClosureLine] = useState('');

  useEffect(() => {
    setClosureLine(randomPick([...SHOP_DATA.closureLines.greeting]) ?? '');
  }, []);

  const handleBuy = (cardId: string) => {
    const card = CARD_DATA[cardId];
    if (!card) return;

    if (money < card.price) {
      setClosureLine(randomPick([...SHOP_DATA.closureLines.insufficient]) ?? '');
      return;
    }
    if (playerDeck.length >= 12) {
      setClosureLine(randomPick([...SHOP_DATA.closureLines.deckFull]) ?? '');
      return;
    }
    const sameCount = playerDeck.filter(id => id === cardId).length;
    if (sameCount >= 3) {
      setClosureLine(randomPick([...SHOP_DATA.closureLines.cardLimit]) ?? '');
      return;
    }

    const success = buyCard(cardId);
    if (success) {
      const category = getShopLineCategory(cardId);
      const lines = SHOP_DATA.closureLines[category];
      setClosureLine(randomPick([...lines]) ?? '');
    }
  };

  const handleSell = (index: number) => {
    const cardId = playerDeck[index];
    const card = CARD_DATA[cardId];
    if (!card) return;
    const refund = Math.floor(card.price / 2);
    if (!window.confirm(`${card.name}を売却しますか？（${refund}龍門幣）`)) return;
    const success = sellCard(index);
    if (success) {
      setClosureLine(randomPick([...SHOP_DATA.closureLines.sell]) ?? '');
    }
  };

  // カードをカテゴリ分け
  const drinkCards = SHOP_DATA.availableCards.filter(id => CARD_DATA[id]?.type === 'drink');
  const foodCards = SHOP_DATA.availableCards.filter(id => CARD_DATA[id]?.type === 'food');
  const chugCards = SHOP_DATA.availableCards.filter(id => CARD_DATA[id]?.type === 'chug');
  const harassCards = SHOP_DATA.availableCards.filter(id => CARD_DATA[id]?.type === 'harassment');

  const renderShopItem = (cardId: string) => {
    const card = CARD_DATA[cardId];
    if (!card) return null;
    const canAfford = money >= card.price;
    const deckFull = playerDeck.length >= 12;

    return (
      <div
        key={cardId}
        className={`shop-item ${!canAfford || deckFull ? 'cant-afford' : ''}`}
        onClick={() => handleBuy(cardId)}
      >
        <span className="item-emoji">{card.emoji}</span>
        <span className="item-name">{card.name}</span>
        <span className="item-price">{card.price}龍</span>
      </div>
    );
  };

  return (
    <div className="screen active">
      <div className="shop-header">
        <button className="back-btn" onClick={() => setScreen('title')}>← 戻る</button>
        <h2>🏮 ロドスバー商店</h2>
        <span className="shop-money">💰 {money} 龍門幣</span>
      </div>

      <div className="closure-dialogue">{closureLine}</div>

      <div className="shop-items">
        <div className="shop-section-title">🍺 ドリンク</div>
        {drinkCards.map(renderShopItem)}

        <div className="shop-section-title">🥜 つまみ</div>
        {foodCards.map(renderShopItem)}

        <div className="shop-section-title">🍻 一気飲み</div>
        {chugCards.map(renderShopItem)}

        <div className="shop-section-title">💋 セクハラ</div>
        {harassCards.map(renderShopItem)}
      </div>

      <div className="deck-editor">
        <h3>現在のデッキ ({playerDeck.length}/12)</h3>
        <div className="deck-display">
          {playerDeck.map((cardId, i) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            return (
              <div
                key={`deck-${i}`}
                className="deck-slot"
                onClick={() => handleSell(i)}
                title={`${card.name} (売却: ${Math.floor(card.price / 2)}龍)`}
              >
                {card.emoji}
                <span className="slot-name">{card.name}</span>
              </div>
            );
          })}
          {Array.from({ length: 12 - playerDeck.length }).map((_, i) => (
            <div key={`empty-${i}`} className="deck-slot deck-slot-empty"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

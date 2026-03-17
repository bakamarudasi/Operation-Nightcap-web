import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { SHOP_DATA, getShopLineCategory } from '../data/shop.ts';
import { CARD_TYPE_ICONS, CARD_TYPE_LABELS } from '../data/constants.ts';
import { randomPick } from '../engine/utils.ts';
import type { CardType } from '../data/types.ts';

export function ShopScreen() {
  const { t } = useTranslation();
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

    const success = buyCard(cardId);
    if (success) {
      const category = getShopLineCategory(cardId);
      const lines = SHOP_DATA.closureLines[category];
      let line = randomPick([...lines]) ?? '';
      // デッキ満杯の場合は追加メッセージ
      if (playerDeck.length >= 12) {
        line += t('shop.deckFullMessage');
      }
      setClosureLine(line);
    }
  };

  const handleSell = (index: number) => {
    const cardId = playerDeck[index];
    const card = CARD_DATA[cardId];
    if (!card) return;
    const refund = Math.floor(card.price / 2);
    if (!window.confirm(t('shop.sellConfirm', { name: card.name, refund }))) return;
    const success = sellCard(index);
    if (success) {
      setClosureLine(randomPick([...SHOP_DATA.closureLines.sell]) ?? '');
    }
  };

  // カードをカテゴリ別にグループ化（1回のイテレーションで分類）
  const SHOP_CATEGORIES: CardType[] = ['drink', 'food', 'chug', 'harassment', 'strategy', 'environment', 'status'];
  const cardsByType: Partial<Record<CardType, string[]>> = {};
  for (const id of SHOP_DATA.availableCards) {
    const type = CARD_DATA[id]?.type;
    if (type) (cardsByType[type] ??= []).push(id);
  }

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
        <span className="item-price">{`${card.price}${t('common.currencyIcon')}`}</span>
      </div>
    );
  };

  return (
    <div className="screen active">
      <div className="shop-header">
        <button className="back-btn" onClick={() => setScreen('title')}>{t('common.back')}</button>
        <h2>{t('shop.title')}</h2>
        <span className="shop-money">{t('shop.moneyDisplay', { amount: money })}</span>
      </div>

      <div className="closure-dialogue">{closureLine}</div>

      <div className="shop-items">
        {SHOP_CATEGORIES.map(type => {
          const cards = cardsByType[type];
          if (!cards || cards.length === 0) return null;
          return (
            <div key={type}>
              <div className="shop-section-title">{CARD_TYPE_ICONS[type]} {t(CARD_TYPE_LABELS[type])}</div>
              {cards.map(renderShopItem)}
            </div>
          );
        })}
      </div>

      <div className="deck-editor">
        <h3>{t('shop.currentDeck', { count: playerDeck.length })}</h3>
        <div className="deck-display">
          {playerDeck.map((cardId, i) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            return (
              <div
                key={`deck-${i}`}
                className="deck-slot"
                onClick={() => handleSell(i)}
                title={`${card.name} (${t('shop.sellTitle', { amount: Math.floor(card.price / 2) })})`}
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

import { useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA, getEnhancedCard, getEnhanceCost, MAX_CARD_LEVEL } from '../data/cards.ts';

export function EnhanceScreen() {
  const money = useGameStore((s) => s.money);
  const inventory = useGameStore((s) => s.inventory);
  const cardLevels = useGameStore((s) => s.cardLevels);
  const setScreen = useGameStore((s) => s.setScreen);
  const enhanceCard = useGameStore((s) => s.enhanceCard);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState<string | null>(null);

  // インベントリからユニークカード一覧を作成（枚数付き）
  const cardCounts = new Map<string, number>();
  for (const id of inventory) {
    cardCounts.set(id, (cardCounts.get(id) ?? 0) + 1);
  }
  // トークンカード（rarity 0）は除外
  const uniqueCards = [...cardCounts.entries()]
    .filter(([id]) => {
      const card = CARD_DATA[id];
      return card && card.rarity > 0;
    })
    .sort((a, b) => {
      const ca = CARD_DATA[a[0]], cb = CARD_DATA[b[0]];
      return (ca?.type ?? '').localeCompare(cb?.type ?? '') || (ca?.rarity ?? 0) - (cb?.rarity ?? 0);
    });

  const selectedCard = selectedId ? CARD_DATA[selectedId] : null;
  const selectedLevel = selectedId ? (cardLevels[selectedId] ?? 1) : 1;
  const selectedCount = selectedId ? (cardCounts.get(selectedId) ?? 0) : 0;
  const isMaxLevel = selectedLevel >= MAX_CARD_LEVEL;
  const enhanceCost = selectedId ? getEnhanceCost(selectedId, selectedLevel) : 0;
  const canEnhance = selectedId && !isMaxLevel && selectedCount >= 3 && money >= enhanceCost;

  // 強化前後のステータス比較用
  const currentStats = selectedId ? getEnhancedCard(selectedId, selectedLevel) : null;
  const nextStats = selectedId && !isMaxLevel ? getEnhancedCard(selectedId, selectedLevel + 1) : null;

  const handleEnhance = () => {
    if (!selectedId || !canEnhance) return;
    const success = enhanceCard(selectedId);
    if (success) {
      setSuccessFlash(selectedId);
      setTimeout(() => setSuccessFlash(null), 600);
    }
  };

  const getStatDisplay = (card: typeof currentStats) => {
    if (!card) return [];
    const stats: { label: string; value: string | number }[] = [];
    if (card.damage !== undefined && card.damage > 0) stats.push({ label: 'DMG', value: card.damage });
    if (card.damage === -1) stats.push({ label: 'DMG', value: '1~3' });
    if (card.heal !== undefined && card.heal > 0) stats.push({ label: 'HEAL', value: card.heal });
    if (card.drunkDamage !== undefined && card.drunkDamage > 0) stats.push({ label: '酔いDMG', value: card.drunkDamage });
    if (card.sanityDamage !== undefined && card.sanityDamage > 0) stats.push({ label: '理性DMG', value: card.sanityDamage });
    if (card.enemyDamage !== undefined && card.enemyDamage > 0) stats.push({ label: '相手DMG', value: card.enemyDamage });
    if (card.type === 'environment' && card.applyBothBuffs) {
      const dur = card.applyBothBuffs[0]?.duration;
      if (dur && dur > 0) stats.push({ label: '持続', value: `${dur}T` });
    }
    return stats;
  };

  return (
    <div className="screen active enhance-screen">
      <div className="shop-header">
        <button className="back-btn" onClick={() => setScreen('select')}>← 戻る</button>
        <h2>🔨 強化工房</h2>
        <span className="shop-money">💰 {money} 龍門幣</span>
      </div>

      <div className="enhance-body">
        {/* 左: カード一覧 */}
        <div className="enhance-card-list">
          {uniqueCards.map(([cardId, count]) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            const level = cardLevels[cardId] ?? 1;
            const atMax = level >= MAX_CARD_LEVEL;
            return (
              <div
                key={cardId}
                className={`enhance-card-item ${selectedId === cardId ? 'selected-enhance' : ''} ${atMax ? 'max-level' : ''} ${successFlash === cardId ? 'enhance-success' : ''}`}
                onClick={() => !atMax && setSelectedId(cardId)}
              >
                <span className="item-emoji">{card.emoji}</span>
                <span className="item-name">{card.name}</span>
                <span className="item-level">{'★'.repeat(level)}{'☆'.repeat(MAX_CARD_LEVEL - level)}</span>
                <span className="item-count">x{count}</span>
              </div>
            );
          })}
          {uniqueCards.length === 0 && (
            <div style={{ color: 'var(--text-dim)', padding: 24 }}>カードがありません</div>
          )}
        </div>

        {/* 右: 強化詳細パネル */}
        <div className="enhance-detail">
          {!selectedCard ? (
            <div className="enhance-detail-empty">カードを選択してください</div>
          ) : (
            <>
              <h3>{selectedCard.emoji} {selectedCard.name}</h3>
              <div className="enhance-stat-row" style={{ justifyContent: 'center' }}>
                <span className="item-level" style={{ fontSize: 16 }}>
                  {'★'.repeat(selectedLevel)}{'☆'.repeat(MAX_CARD_LEVEL - selectedLevel)}
                  {isMaxLevel ? ' MAX' : ` → ${'★'.repeat(selectedLevel + 1)}${'☆'.repeat(MAX_CARD_LEVEL - selectedLevel - 1)}`}
                </span>
              </div>

              {!isMaxLevel && (
                <div className="enhance-stats">
                  {getStatDisplay(currentStats).map((stat, i) => {
                    const nextStat = nextStats ? getStatDisplay(nextStats)[i] : null;
                    return (
                      <div key={stat.label} className="enhance-stat-row">
                        <span className="stat-label">{stat.label}</span>
                        <span>
                          <span className="stat-current">{stat.value}</span>
                          {nextStat && (
                            <>
                              <span className="stat-arrow"> → </span>
                              <span className="stat-next">{nextStat.value}</span>
                            </>
                          )}
                        </span>
                      </div>
                    );
                  })}

                  <div className="enhance-cost-row">
                    <span className="cost-label">費用</span>
                    <span className={`cost-value ${money < enhanceCost ? 'insufficient' : ''}`}>
                      {enhanceCost} 龍門幣
                    </span>
                  </div>
                  <div className="enhance-cost-row">
                    <span className="cost-label">必要枚数</span>
                    <span className={`cost-value ${selectedCount < 3 ? 'insufficient' : ''}`}>
                      {selectedCount} / 3枚
                    </span>
                  </div>
                </div>
              )}

              {isMaxLevel ? (
                <button className="enhance-btn enhance-btn-max" disabled>MAX LEVEL</button>
              ) : (
                <button
                  className="enhance-btn"
                  disabled={!canEnhance}
                  onClick={handleEnhance}
                >
                  強化する
                </button>
              )}

              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {selectedCard.description}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA, getEnhancedCard, getEnhanceCost, MAX_CARD_LEVEL } from '../data/cards.ts';
import type { CardType } from '../data/types.ts';

const TYPE_LABELS: Record<string, string> = {
  all: '全て',
  drink: '酒',
  food: '食事',
  chug: '一気',
  harassment: 'ハラスメント',
  strategy: '策略',
  environment: '環境',
  status: '状態',
};

const RARITY_CLASS: Record<number, string> = {
  1: 'rarity-common',
  2: 'rarity-uncommon',
  3: 'rarity-rare',
  4: 'rarity-epic',
  5: 'rarity-legendary',
  6: 'rarity-mythic',
};

export function EnhanceScreen() {
  const money = useGameStore((s) => s.money);
  const inventory = useGameStore((s) => s.inventory);
  const cardLevels = useGameStore((s) => s.cardLevels);
  const setScreen = useGameStore((s) => s.setScreen);
  const previousScreen = useGameStore((s) => s.previousScreen);
  const enhanceCard = useGameStore((s) => s.enhanceCard);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [hideMax, setHideMax] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [statPopups, setStatPopups] = useState<{ id: number; label: string; value: string }[]>([]);
  const [hammerAnim, setHammerAnim] = useState(false);
  const particleId = useRef(0);
  const detailRef = useRef<HTMLDivElement>(null);

  // インベントリからユニークカード一覧を作成（枚数付き）
  const cardCounts = new Map<string, number>();
  for (const id of inventory) {
    cardCounts.set(id, (cardCounts.get(id) ?? 0) + 1);
  }

  // カードタイプ一覧を収集
  const availableTypes = new Set<string>();
  for (const [id] of cardCounts) {
    const card = CARD_DATA[id];
    if (card && card.rarity > 0) availableTypes.add(card.type);
  }

  // トークンカード（rarity 0）は除外 + フィルタ適用
  const uniqueCards = [...cardCounts.entries()]
    .filter(([id]) => {
      const card = CARD_DATA[id];
      if (!card || card.rarity <= 0) return false;
      if (typeFilter !== 'all' && card.type !== typeFilter) return false;
      if (hideMax) {
        const level = cardLevels[id] ?? 1;
        if (level >= MAX_CARD_LEVEL) return false;
      }
      return true;
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
  const needCards = 3;
  const shortCards = Math.max(0, needCards - selectedCount);
  const shortMoney = Math.max(0, enhanceCost - money);
  const canEnhance = selectedId && !isMaxLevel && selectedCount >= needCards && money >= enhanceCost;

  // 強化前後のステータス比較用
  const currentStats = selectedId ? getEnhancedCard(selectedId, selectedLevel) : null;
  const nextStats = selectedId && !isMaxLevel ? getEnhancedCard(selectedId, selectedLevel + 1) : null;

  const spawnParticles = useCallback(() => {
    if (!detailRef.current) return;
    const newParticles = Array.from({ length: 12 }, () => ({
      id: particleId.current++,
      x: Math.random() * 240 + 20,
      y: Math.random() * 100 + 60,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1000);
  }, []);

  const spawnStatPopups = useCallback((currentDisplay: ReturnType<typeof getStatDisplay>, nextDisplay: ReturnType<typeof getStatDisplay>) => {
    const popups: typeof statPopups = [];
    for (let i = 0; i < nextDisplay.length; i++) {
      const curr = currentDisplay[i];
      const next = nextDisplay[i];
      if (curr && next && typeof curr.value === 'number' && typeof next.value === 'number') {
        const diff = next.value - curr.value;
        if (diff > 0) {
          popups.push({ id: particleId.current++, label: next.label, value: `+${diff}` });
        }
      }
    }
    setStatPopups(popups);
    setTimeout(() => setStatPopups([]), 1200);
  }, []);

  const handleEnhance = () => {
    if (!selectedId || !canEnhance) return;

    // 強化前のステータスを記録
    const beforeDisplay = getStatDisplay(currentStats);
    const afterDisplay = getStatDisplay(nextStats);

    // ハンマーアニメーション開始
    setHammerAnim(true);

    setTimeout(() => {
      const success = enhanceCard(selectedId);
      setHammerAnim(false);
      if (success) {
        setSuccessFlash(selectedId);
        spawnParticles();
        spawnStatPopups(beforeDisplay, afterDisplay);
        setTimeout(() => setSuccessFlash(null), 800);
      }
    }, 400);
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

  // グローレベルクラス
  const getGlowClass = (level: number) => {
    if (level >= 3) return 'glow-max';
    if (level >= 2) return 'glow-mid';
    return '';
  };

  return (
    <div className="screen active enhance-screen">
      <div className="shop-header">
        <button className="back-btn" onClick={() => setScreen(previousScreen === 'deck' ? 'deck' : 'select')}>← 戻る</button>
        <h2>🔨 強化工房</h2>
        <span className="shop-money">💰 {money} 龍門幣</span>
      </div>

      {/* フィルタバー */}
      <div className="enhance-filters">
        <div className="enhance-type-tabs">
          {['all', ...Object.keys(TYPE_LABELS).filter(k => k !== 'all' && availableTypes.has(k))].map(type => (
            <button
              key={type}
              className={`enhance-tab ${typeFilter === type ? 'active' : ''}`}
              onClick={() => setTypeFilter(type)}
            >
              {TYPE_LABELS[type] ?? type}
            </button>
          ))}
        </div>
        <label className="enhance-hide-max">
          <input
            type="checkbox"
            checked={hideMax}
            onChange={(e) => setHideMax(e.target.checked)}
          />
          MAX非表示
        </label>
      </div>

      <div className="enhance-body">
        {/* 左: カード一覧 */}
        <div className="enhance-card-list">
          {uniqueCards.map(([cardId, count]) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            const level = cardLevels[cardId] ?? 1;
            const atMax = level >= MAX_CARD_LEVEL;
            const rarityClass = RARITY_CLASS[card.rarity] ?? 'rarity-common';
            const glowClass = getGlowClass(level);
            return (
              <div
                key={cardId}
                className={`enhance-card-item ${rarityClass} ${selectedId === cardId ? 'selected-enhance' : ''} ${atMax ? 'max-level' : ''} ${successFlash === cardId ? 'enhance-success' : ''}`}
                onClick={() => setSelectedId(cardId)}
              >
                <span className={`item-emoji ${glowClass}`}>{card.emoji}</span>
                <span className="item-name">{card.name}</span>
                <span className="item-level">{'★'.repeat(level)}{'☆'.repeat(MAX_CARD_LEVEL - level)}</span>
                <span className="item-count">x{count}</span>
                {count < needCards && !atMax && (
                  <span className="item-short">あと{needCards - count}枚</span>
                )}
              </div>
            );
          })}
          {uniqueCards.length === 0 && (
            <div style={{ color: 'var(--text-dim)', padding: 24 }}>
              {typeFilter !== 'all' ? `${TYPE_LABELS[typeFilter]}カードがありません` : 'カードがありません'}
            </div>
          )}
        </div>

        {/* 右: 強化詳細パネル */}
        <div className="enhance-detail" ref={detailRef}>
          {!selectedCard ? (
            <div className="enhance-detail-empty">カードを選択してください</div>
          ) : (
            <>
              {/* 拡大カードビュー */}
              <div className={`enhance-card-preview ${RARITY_CLASS[selectedCard.rarity] ?? ''} ${getGlowClass(selectedLevel)}`}>
                <span className="preview-emoji">{selectedCard.emoji}</span>
              </div>

              <h3>{selectedCard.name}</h3>
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
                    <span className={`cost-value ${shortMoney > 0 ? 'insufficient' : ''}`}>
                      {enhanceCost} 龍門幣
                    </span>
                  </div>
                  <div className="enhance-cost-row">
                    <span className="cost-label">必要枚数</span>
                    <span className={`cost-value ${shortCards > 0 ? 'insufficient' : ''}`}>
                      {selectedCount} / {needCards}枚
                      {shortCards > 0 && <span className="short-hint"> (あと{shortCards}枚)</span>}
                    </span>
                  </div>
                </div>
              )}

              {isMaxLevel ? (
                <button className="enhance-btn enhance-btn-max" disabled>MAX LEVEL</button>
              ) : (
                <div className="enhance-btn-area">
                  <button
                    className={`enhance-btn ${hammerAnim ? 'hammer-striking' : ''}`}
                    disabled={!canEnhance || hammerAnim}
                    onClick={handleEnhance}
                  >
                    {hammerAnim ? '🔨 鍛錬中...' : '🔨 強化する'}
                  </button>
                  {(shortCards > 0 || shortMoney > 0) && !isMaxLevel && (
                    <button
                      className="enhance-shop-link"
                      onClick={() => setScreen('shop')}
                    >
                      🛒 ショップへ行く
                    </button>
                  )}
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {selectedCard.description}
              </div>

              {/* パーティクルエフェクト */}
              {particles.map(p => (
                <span
                  key={p.id}
                  className="enhance-particle"
                  style={{ left: p.x, top: p.y }}
                />
              ))}

              {/* ステータス上昇ポップアップ */}
              {statPopups.map(p => (
                <span key={p.id} className="enhance-stat-popup">
                  {p.label} {p.value}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

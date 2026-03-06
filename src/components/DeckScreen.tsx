import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import type { CardDef } from '../data/types.ts';
import '../styles/deck.css';

/* ── ドラッグ状態の型 ── */
interface DragState {
  source: 'deck' | 'inventory';
  cardId: string;
  /** deck の場合の index */
  deckIndex?: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/* ── アニメーション中カード ── */
interface AnimCard {
  id: number;
  cardId: string;
  type: 'add' | 'remove';
}

let animIdCounter = 0;

export function DeckScreen() {
  const playerDeck = useGameStore((s) => s.playerDeck);
  const inventory = useGameStore((s) => s.inventory);
  const setScreen = useGameStore((s) => s.setScreen);
  const previousScreen = useGameStore((s) => s.previousScreen);
  const addToDeck = useGameStore((s) => s.addToDeck);
  const removeFromDeck = useGameStore((s) => s.removeFromDeck);

  const [filter, setFilter] = useState<string>('all');
  const [previewCard, setPreviewCard] = useState<CardDef | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [animCards, setAnimCards] = useState<AnimCard[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [deckReorderTarget, setDeckReorderTarget] = useState<number | null>(null);

  const longPressTimer = useRef<number | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const deckGridRef = useRef<HTMLDivElement>(null);

  /* ── 戻るボタンの遷移先 ── */
  const goBack = useCallback(() => {
    const back = previousScreen === 'select' ? 'select' : 'title';
    setScreen(back);
  }, [previousScreen, setScreen]);

  /* ── インベントリからデッキ外カードを集計 ── */
  const availableCards: Record<string, { total: number; inDeck: number }> = {};
  for (const cardId of inventory) {
    if (!availableCards[cardId]) availableCards[cardId] = { total: 0, inDeck: 0 };
    availableCards[cardId].total++;
  }
  for (const cardId of playerDeck) {
    if (!availableCards[cardId]) availableCards[cardId] = { total: 0, inDeck: 0 };
    availableCards[cardId].inDeck++;
  }

  const inventoryList = Object.entries(availableCards)
    .filter(([, v]) => v.total > v.inDeck)
    .filter(([cardId]) => filter === 'all' || CARD_DATA[cardId]?.type === filter)
    .sort((a, b) => (CARD_DATA[a[0]]?.rarity ?? 0) - (CARD_DATA[b[0]]?.rarity ?? 0));

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

  /* ── アニメーション付きカード追加 ── */
  const handleAdd = useCallback((cardId: string) => {
    const ok = addToDeck(cardId);
    if (ok) {
      const id = ++animIdCounter;
      setAnimCards(prev => [...prev, { id, cardId, type: 'add' }]);
      setTimeout(() => setAnimCards(prev => prev.filter(a => a.id !== id)), 400);
    }
  }, [addToDeck]);

  /* ── アニメーション付きカード削除 ── */
  const handleRemove = useCallback((index: number) => {
    const cardId = playerDeck[index];
    const id = ++animIdCounter;
    setAnimCards(prev => [...prev, { id, cardId, type: 'remove' }]);
    setTimeout(() => {
      removeFromDeck(index);
      setAnimCards(prev => prev.filter(a => a.id !== id));
    }, 300);
  }, [playerDeck, removeFromDeck]);

  /* ── カード詳細プレビュー（ホバー） ── */
  const showPreview = useCallback((card: CardDef, e: React.MouseEvent) => {
    if (drag) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPreviewCard(card);
    setPreviewPos({ x: rect.right + 8, y: rect.top });
  }, [drag]);

  const hidePreview = useCallback(() => {
    setPreviewCard(null);
  }, []);

  /* ── ドラッグ開始 (マウス) ── */
  const startDrag = useCallback((source: 'deck' | 'inventory', cardId: string, deckIndex: number | undefined, e: React.MouseEvent) => {
    e.preventDefault();
    setPreviewCard(null);
    setDrag({
      source, cardId, deckIndex,
      startX: e.clientX, startY: e.clientY,
      currentX: e.clientX, currentY: e.clientY,
    });
  }, []);

  /* ── ドラッグ開始 (タッチ - ロングプレス) ── */
  const startTouchDrag = useCallback((source: 'deck' | 'inventory', cardId: string, deckIndex: number | undefined, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = window.setTimeout(() => {
      setDrag({
        source, cardId, deckIndex,
        startX: x, startY: y,
        currentX: x, currentY: y,
      });
    }, 300);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /* ── タッチでのカード詳細プレビュー（長押し、ドラッグなし） ── */
  const handleTouchPreview = useCallback((card: CardDef, e: React.TouchEvent) => {
    if (drag) return;
    const touch = e.touches[0];
    setPreviewCard(card);
    setPreviewPos({ x: touch.clientX, y: touch.clientY - 120 });
  }, [drag]);

  /* ── ドラッグ中の移動 ── */
  useEffect(() => {
    if (!drag) return;

    const onMove = (clientX: number, clientY: number) => {
      setDrag(prev => prev ? { ...prev, currentX: clientX, currentY: clientY } : null);

      // デッキグリッド内の並べ替えターゲットを計算
      if (drag.source === 'deck' && deckGridRef.current) {
        const cards = deckGridRef.current.querySelectorAll('.deck-card:not(.deck-card-empty)');
        let target: number | null = null;
        cards.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          if (clientX >= rect.left && clientX <= rect.right &&
              clientY >= rect.top && clientY <= rect.bottom) {
            target = i;
          }
        });
        setDeckReorderTarget(target);
      }
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onEnd = () => {
      if (!drag) return;

      if (drag.source === 'inventory') {
        // インベントリからデッキエリアにドロップ → 追加
        if (deckGridRef.current) {
          const rect = deckGridRef.current.getBoundingClientRect();
          if (drag.currentX >= rect.left && drag.currentX <= rect.right &&
              drag.currentY >= rect.top && drag.currentY <= rect.bottom) {
            handleAdd(drag.cardId);
          }
        }
      } else if (drag.source === 'deck' && drag.deckIndex !== undefined) {
        if (deckReorderTarget !== null && deckReorderTarget !== drag.deckIndex) {
          // デッキ内並べ替え
          const newDeck = [...playerDeck];
          const [moved] = newDeck.splice(drag.deckIndex, 1);
          newDeck.splice(deckReorderTarget, 0, moved);
          // store の playerDeck を直接更新
          useGameStore.setState({ playerDeck: newDeck });
        } else {
          // デッキ外にドロップ → 削除チェック
          if (deckGridRef.current) {
            const rect = deckGridRef.current.getBoundingClientRect();
            if (drag.currentX < rect.left || drag.currentX > rect.right ||
                drag.currentY < rect.top || drag.currentY > rect.bottom) {
              handleRemove(drag.deckIndex);
            }
          }
        }
      }

      setDrag(null);
      setDeckReorderTarget(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [drag, deckReorderTarget, playerDeck, handleAdd, handleRemove]);

  /* ── Escキーで戻る ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack]);

  return (
    <div className="screen active deck-screen" ref={screenRef}>
      <div className="deck-header">
        <button className="back-btn" onClick={goBack}>← 戻る</button>
        <h2>🃏 デッキ編集</h2>
        <div className="deck-count">{playerDeck.length}/12</div>
      </div>

      {/* 現在のデッキ */}
      <div className="deck-section">
        <div className="deck-section-title">現在のデッキ</div>
        <div className="deck-grid" ref={deckGridRef}>
          {playerDeck.map((cardId, i) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            const isBeingDragged = drag?.source === 'deck' && drag.deckIndex === i;
            const isReorderTarget = deckReorderTarget === i && drag?.source === 'deck' && drag.deckIndex !== i;
            const isRemoving = animCards.some(a => a.type === 'remove' && a.cardId === cardId);
            return (
              <div
                key={`deck-${i}`}
                className={[
                  'deck-card',
                  `type-${card.type}`,
                  isBeingDragged ? 'dragging' : '',
                  isReorderTarget ? 'reorder-target' : '',
                  isRemoving ? 'removing' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => !drag && handleRemove(i)}
                onMouseEnter={(e) => showPreview(card, e)}
                onMouseLeave={hidePreview}
                onMouseDown={(e) => startDrag('deck', cardId, i, e)}
                onTouchStart={(e) => {
                  startTouchDrag('deck', cardId, i, e);
                  handleTouchPreview(card, e);
                }}
                onTouchEnd={() => { cancelLongPress(); hidePreview(); }}
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
            <div key={`empty-${i}`} className={`deck-card deck-card-empty ${
              animCards.some(a => a.type === 'add') && i === 0 ? 'slot-pulse' : ''
            }`}>
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
                onClick={() => !cantAdd && !drag && handleAdd(cardId)}
                onMouseEnter={(e) => showPreview(card, e)}
                onMouseLeave={hidePreview}
                onMouseDown={(e) => !cantAdd && startDrag('inventory', cardId, undefined, e)}
                onTouchStart={(e) => {
                  if (!cantAdd) startTouchDrag('inventory', cardId, undefined, e);
                  handleTouchPreview(card, e);
                }}
                onTouchEnd={() => { cancelLongPress(); hidePreview(); }}
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

      {/* ── カード詳細プレビューポップアップ ── */}
      {previewCard && !drag && (
        <div
          className="card-preview-popup"
          style={{ left: previewPos.x, top: previewPos.y }}
        >
          <div className="card-preview-header">
            <span className="card-preview-emoji">{previewCard.emoji}</span>
            <span className="card-preview-name">{previewCard.name}</span>
            <span className="card-preview-rarity">{'★'.repeat(previewCard.rarity)}</span>
          </div>
          <div className="card-preview-type">{previewCard.type}</div>
          <div className="card-preview-stats">
            {previewCard.damage !== undefined && <span>攻撃: {previewCard.damage === -1 ? '1~3' : previewCard.damage}</span>}
            {previewCard.heal !== undefined && <span>回復: {previewCard.heal === 99 ? 'MAX' : previewCard.heal}</span>}
            {previewCard.requiredDrunkLevel !== undefined && <span>必要酔度: Lv{previewCard.requiredDrunkLevel}</span>}
            {previewCard.drunkDamage !== undefined && <span>酔い+{previewCard.drunkDamage}</span>}
          </div>
          <div className="card-preview-desc">{previewCard.description}</div>
        </div>
      )}

      {/* ── ドラッグ中のゴースト ── */}
      {drag && (
        <div
          className="drag-ghost"
          style={{
            left: drag.currentX,
            top: drag.currentY,
          }}
        >
          <span>{CARD_DATA[drag.cardId]?.emoji}</span>
        </div>
      )}
    </div>
  );
}

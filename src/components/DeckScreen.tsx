import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import type { CardDef } from '../data/types.ts';
import { formatCardStat, formatDamage, formatHeal, formatInventoryDesc } from '../utils/cardFormatting.ts';
import '../styles/deck.css';

/* ── 定数 ── */
const DRAG_THRESHOLD = 5; // px — これ以上動いたらドラッグ開始

/* ── ドラッグ状態の型 ── */
interface DragState {
  source: 'deck' | 'inventory';
  cardId: string;
  deckIndex?: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /** 閾値を超えてドラッグが有効になったか */
  active: boolean;
}

/* ── アニメーション中カード ── */
interface AnimCard {
  id: number;
  deckIndex: number;
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
  const [deckReorderTarget, setDeckReorderTarget] = useState<number | null>(null);

  // ドラッグ状態はrefで管理し、レンダリング用にstateも持つ
  const dragRef = useRef<DragState | null>(null);
  const [dragRender, setDragRender] = useState<DragState | null>(null);

  const longPressTimer = useRef<number | null>(null);
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
    const currentDeck = useGameStore.getState().playerDeck;
    const ok = addToDeck(cardId);
    if (ok) {
      const id = ++animIdCounter;
      setAnimCards(prev => [...prev, { id, deckIndex: currentDeck.length, type: 'add' }]);
      setTimeout(() => setAnimCards(prev => prev.filter(a => a.id !== id)), 400);
    }
  }, [addToDeck]);

  /* ── アニメーション付きカード削除 ── */
  const handleRemove = useCallback((index: number) => {
    const id = ++animIdCounter;
    setAnimCards(prev => [...prev, { id, deckIndex: index, type: 'remove' }]);
    setTimeout(() => {
      removeFromDeck(index);
      setAnimCards(prev => prev.filter(a => a.id !== id));
    }, 300);
  }, [removeFromDeck]);

  /* ── カード詳細プレビュー ── */
  const showPreview = useCallback((card: CardDef, e: React.MouseEvent) => {
    if (dragRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // 画面端からはみ出さないよう調整
    const popupW = 228; // 220 + padding
    const popupH = 200; // 概算
    let x = rect.right + 8;
    let y = rect.top;
    if (x + popupW > window.innerWidth) x = rect.left - popupW - 8;
    if (y + popupH > window.innerHeight) y = window.innerHeight - popupH - 8;
    if (y < 8) y = 8;
    setPreviewCard(card);
    setPreviewPos({ x, y });
  }, []);

  const hidePreview = useCallback(() => setPreviewCard(null), []);

  /* ── ドラッグ: ポインタ下げ (潜在的ドラッグ開始) ── */
  const pointerDown = useCallback((source: 'deck' | 'inventory', cardId: string, deckIndex: number | undefined, clientX: number, clientY: number) => {
    dragRef.current = {
      source, cardId, deckIndex,
      startX: clientX, startY: clientY,
      currentX: clientX, currentY: clientY,
      active: false,
    };
    // active=false なのでゴーストはまだ表示しない
  }, []);

  /* ── マウス用ハンドラ ── */
  const onMouseDown = useCallback((source: 'deck' | 'inventory', cardId: string, deckIndex: number | undefined, e: React.MouseEvent) => {
    e.preventDefault();
    setPreviewCard(null);
    pointerDown(source, cardId, deckIndex, e.clientX, e.clientY);
  }, [pointerDown]);

  /* ── タッチ用: ロングプレスでドラッグ ── */
  const onTouchStart = useCallback((source: 'deck' | 'inventory', cardId: string, deckIndex: number | undefined, e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimer.current = window.setTimeout(() => {
      pointerDown(source, cardId, deckIndex, touch.clientX, touch.clientY);
      // ロングプレス = 即active
      if (dragRef.current) {
        dragRef.current.active = true;
        setDragRender({ ...dragRef.current });
      }
    }, 300);
  }, [pointerDown]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /* ── タッチプレビュー（ドラッグ未発動時のみ） ── */
  const showTouchPreview = useCallback((card: CardDef, e: React.TouchEvent) => {
    // ドラッグ中はプレビューを出さない
    if (dragRef.current?.active) return;
    const touch = e.touches[0];
    const x = Math.min(touch.clientX, window.innerWidth - 236);
    const y = Math.max(8, touch.clientY - 220);
    setPreviewCard(card);
    setPreviewPos({ x, y });
  }, []);

  /* ── グローバルなポインタ移動・終了リスナー ── */
  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      const d = dragRef.current;
      if (!d) return;

      d.currentX = clientX;
      d.currentY = clientY;

      // 閾値チェック
      if (!d.active) {
        const dx = clientX - d.startX;
        const dy = clientY - d.startY;
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        d.active = true;
        setPreviewCard(null); // ドラッグ開始でプレビュー消す
      }

      setDragRender({ ...d });

      // デッキ内並べ替えターゲット
      if (d.source === 'deck' && deckGridRef.current) {
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

    const onEnd = () => {
      cancelLongPress();
      const d = dragRef.current;
      if (!d) return;

      if (d.active) {
        // ドラッグが有効だった場合のドロップ処理
        const currentDeck = useGameStore.getState().playerDeck;

        if (d.source === 'inventory') {
          if (deckGridRef.current) {
            const rect = deckGridRef.current.getBoundingClientRect();
            if (d.currentX >= rect.left && d.currentX <= rect.right &&
                d.currentY >= rect.top && d.currentY <= rect.bottom) {
              handleAdd(d.cardId);
            }
          }
        } else if (d.source === 'deck' && d.deckIndex !== undefined) {
          // reorderTarget の最新値を取得
          const reorderEl = deckGridRef.current?.querySelectorAll('.deck-card:not(.deck-card-empty)');
          let dropTarget: number | null = null;
          reorderEl?.forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            if (d.currentX >= rect.left && d.currentX <= rect.right &&
                d.currentY >= rect.top && d.currentY <= rect.bottom) {
              dropTarget = i;
            }
          });

          if (dropTarget !== null && dropTarget !== d.deckIndex) {
            const newDeck = [...currentDeck];
            const [moved] = newDeck.splice(d.deckIndex, 1);
            newDeck.splice(dropTarget, 0, moved);
            useGameStore.setState({ playerDeck: newDeck });
          } else {
            // デッキグリッド外にドロップ → 削除
            if (deckGridRef.current) {
              const rect = deckGridRef.current.getBoundingClientRect();
              if (d.currentX < rect.left || d.currentX > rect.right ||
                  d.currentY < rect.top || d.currentY > rect.bottom) {
                handleRemove(d.deckIndex);
              }
            }
          }
        }
      }

      dragRef.current = null;
      setDragRender(null);
      setDeckReorderTarget(null);
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
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
  }, [cancelLongPress, handleAdd, handleRemove]);

  /* ── クリック（ドラッグしなかった場合のみ発火） ── */
  const handleDeckClick = useCallback((index: number) => {
    // ドラッグがactiveだった場合はクリック扱いしない
    // mouseupでdragRef.currentはnullになるが、
    // activeだった場合はonEndで処理済み
    if (dragRef.current?.active) return;
    handleRemove(index);
  }, [handleRemove]);

  const handleInvClick = useCallback((cardId: string, cantAdd: boolean) => {
    if (cantAdd || dragRef.current?.active) return;
    handleAdd(cardId);
  }, [handleAdd]);

  /* ── Escキーで戻る ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack]);

  const isDragActive = dragRender?.active ?? false;

  return (
    <div className="screen active deck-screen">
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
            const isBeingDragged = isDragActive && dragRender?.source === 'deck' && dragRender.deckIndex === i;
            const isReorderTarget = deckReorderTarget === i && isDragActive && dragRender?.source === 'deck' && dragRender.deckIndex !== i;
            const isRemoving = animCards.some(a => a.type === 'remove' && a.deckIndex === i);
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
                onClick={() => handleDeckClick(i)}
                onMouseEnter={(e) => showPreview(card, e)}
                onMouseLeave={hidePreview}
                onMouseDown={(e) => onMouseDown('deck', cardId, i, e)}
                onTouchStart={(e) => {
                  onTouchStart('deck', cardId, i, e);
                  showTouchPreview(card, e);
                }}
                onTouchEnd={() => { cancelLongPress(); hidePreview(); }}
              >
                <div className="deck-card-remove">×</div>
                <div className="deck-card-emoji">{card.emoji}</div>
                <div className="deck-card-name">{card.name}</div>
                <div className="deck-card-info">
                  {formatCardStat(card)}
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
                onClick={() => handleInvClick(cardId, cantAdd)}
                onMouseEnter={(e) => showPreview(card, e)}
                onMouseLeave={hidePreview}
                onMouseDown={(e) => !cantAdd && onMouseDown('inventory', cardId, undefined, e)}
                onTouchStart={(e) => {
                  if (!cantAdd) onTouchStart('inventory', cardId, undefined, e);
                  showTouchPreview(card, e);
                }}
                onTouchEnd={() => { cancelLongPress(); hidePreview(); }}
              >
                <div className="inv-card-emoji">{card.emoji}</div>
                <div className="inv-card-details">
                  <div className="inv-card-name">{card.name}</div>
                  <div className="inv-card-desc">
                    {formatInventoryDesc(card)}
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
      {previewCard && !isDragActive && (
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
            {previewCard.damage !== undefined && <span>攻撃: {formatDamage(previewCard.damage)}</span>}
            {previewCard.heal !== undefined && <span>回復: {formatHeal(previewCard.heal)}</span>}
            {previewCard.requiredDrunkLevel !== undefined && <span>必要酔度: Lv{previewCard.requiredDrunkLevel}</span>}
            {previewCard.drunkDamage !== undefined && <span>酔い+{previewCard.drunkDamage}</span>}
          </div>
          <div className="card-preview-desc">{previewCard.description}</div>
        </div>
      )}

      {/* ── ドラッグ中のゴースト ── */}
      {isDragActive && dragRender && (
        <div
          className="drag-ghost"
          style={{
            left: dragRender.currentX,
            top: dragRender.currentY,
          }}
        >
          <span>{CARD_DATA[dragRender.cardId]?.emoji}</span>
        </div>
      )}
    </div>
  );
}

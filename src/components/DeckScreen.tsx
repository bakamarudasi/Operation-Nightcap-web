import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import type { CardDef } from '../data/types.ts';
import { DeckGrid } from './deck/DeckGrid.tsx';
import { DeckInventory } from './deck/DeckInventory.tsx';
import { DeckStats } from './deck/DeckStats.tsx';
import { CardPreview } from './deck/CardPreview.tsx';
import '../styles/deck.css';

/* ── 定数 ── */
const DRAG_THRESHOLD = 5;

/* ── ドラッグ状態の型 ── */
interface DragState {
  source: 'deck' | 'inventory';
  cardId: string;
  deckIndex?: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
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
  const { t } = useTranslation();
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

  const dragRef = useRef<DragState | null>(null);
  const [dragRender, setDragRender] = useState<DragState | null>(null);

  const longPressTimer = useRef<number | null>(null);
  const deckGridRef = useRef<HTMLDivElement>(null);

  /* ── 戻る ── */
  const goBack = useCallback(() => {
    const back = previousScreen === 'select' ? 'select' : 'title';
    setScreen(back);
  }, [previousScreen, setScreen]);

  /* ── インベントリ集計 ── */
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
    .filter(([, v]) => v.total > v.inDeck);

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
    const popupW = 228;
    const popupH = 200;
    let x = rect.right + 8;
    let y = rect.top;
    if (x + popupW > window.innerWidth) x = rect.left - popupW - 8;
    if (y + popupH > window.innerHeight) y = window.innerHeight - popupH - 8;
    if (y < 8) y = 8;
    setPreviewCard(card);
    setPreviewPos({ x, y });
  }, []);

  const hidePreview = useCallback(() => setPreviewCard(null), []);

  /* ── ドラッグ: ポインタ下げ ── */
  const pointerDown = useCallback((source: 'deck' | 'inventory', cardId: string, deckIndex: number | undefined, clientX: number, clientY: number) => {
    dragRef.current = {
      source, cardId, deckIndex,
      startX: clientX, startY: clientY,
      currentX: clientX, currentY: clientY,
      active: false,
    };
  }, []);

  /* ── マウス用ハンドラ ── */
  const onMouseDownDeck = useCallback((source: 'deck', cardId: string, deckIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setPreviewCard(null);
    pointerDown(source, cardId, deckIndex, e.clientX, e.clientY);
  }, [pointerDown]);

  const onMouseDownInv = useCallback((cardId: string, cantAdd: boolean, e: React.MouseEvent) => {
    if (cantAdd) return;
    e.preventDefault();
    setPreviewCard(null);
    pointerDown('inventory', cardId, undefined, e.clientX, e.clientY);
  }, [pointerDown]);

  /* ── タッチ用: ロングプレスでドラッグ ── */
  const onTouchStartDeck = useCallback((source: 'deck', cardId: string, deckIndex: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimer.current = window.setTimeout(() => {
      pointerDown(source, cardId, deckIndex, touch.clientX, touch.clientY);
      if (dragRef.current) {
        dragRef.current.active = true;
        setDragRender({ ...dragRef.current });
      }
    }, 300);
  }, [pointerDown]);

  const onTouchStartInv = useCallback((cardId: string, cantAdd: boolean, e: React.TouchEvent) => {
    if (cantAdd) return;
    const touch = e.touches[0];
    longPressTimer.current = window.setTimeout(() => {
      pointerDown('inventory', cardId, undefined, touch.clientX, touch.clientY);
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

  /* ── タッチプレビュー ── */
  const showTouchPreview = useCallback((card: CardDef, e: React.TouchEvent) => {
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

      if (!d.active) {
        const dx = clientX - d.startX;
        const dy = clientY - d.startY;
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        d.active = true;
        setPreviewCard(null);
      }

      setDragRender({ ...d });

      if (d.source === 'deck' && deckGridRef.current) {
        const cards = deckGridRef.current.querySelectorAll('.deck-slot:not(.deck-slot-empty)');
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
          const reorderEl = deckGridRef.current?.querySelectorAll('.deck-slot:not(.deck-slot-empty)');
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

  /* ── クリック（ドラッグしなかった場合のみ） ── */
  const handleDeckClick = useCallback((index: number) => {
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
  const deckFull = playerDeck.length >= 12;

  return (
    <div className="screen active deck-screen">
      {/* ── ヘッダー ── */}
      <div className="deck-header">
        <button className="back-btn" onClick={goBack}>{t('common.back')}</button>
        <h2>{t('deck.title')}</h2>
        <button className="enhance-shortcut-btn" onClick={() => setScreen('enhance')}>
          {t('deck.enhanceShortcut')}
        </button>
        <div className={`deck-count ${deckFull ? 'deck-full' : ''}`}>
          {playerDeck.length}/12
          {deckFull && <span className="deck-full-label">{t('deck.full')}</span>}
        </div>
      </div>

      {/* ── メインボディ (PC: 左右分割) ── */}
      <div className="deck-body">
        {/* 左: デッキ */}
        <div className="deck-left">
          <div className="deck-section">
            <div className="deck-section-title">{t('deck.currentDeck')}</div>
            <DeckGrid
              playerDeck={playerDeck}
              animCards={animCards}
              isDragActive={isDragActive}
              dragRender={dragRender}
              deckReorderTarget={deckReorderTarget}
              deckGridRef={deckGridRef}
              onDeckClick={handleDeckClick}
              onMouseDown={onMouseDownDeck}
              onTouchStart={onTouchStartDeck}
              onCancelLongPress={cancelLongPress}
              onShowPreview={showPreview}
              onHidePreview={hidePreview}
              onShowTouchPreview={showTouchPreview}
            />
            {playerDeck.length > 0 && playerDeck.length < 4 && (
              <div className="deck-warning">
                <span className="warning-icon">⚠</span>
                {t('deck.warning', { count: playerDeck.length })}
              </div>
            )}
          </div>
          <DeckStats playerDeck={playerDeck} />
        </div>

        {/* 右: インベントリ */}
        <div className="deck-right">
          <DeckInventory
            inventoryList={inventoryList}
            playerDeck={playerDeck}
            filter={filter}
            onFilterChange={setFilter}
            onCardClick={handleInvClick}
            onMouseDown={onMouseDownInv}
            onTouchStart={onTouchStartInv}
            onCancelLongPress={cancelLongPress}
            onShowPreview={showPreview}
            onHidePreview={hidePreview}
            onShowTouchPreview={showTouchPreview}
          />
        </div>
      </div>

      {/* ── カード詳細プレビューポップアップ ── */}
      {previewCard && !isDragActive && (
        <CardPreview card={previewCard} pos={previewPos} />
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

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CARD_DATA } from '../../data/cards.ts';
import { RARITY_CONFIG } from './gachaConstants.ts';

interface Props {
  inventoryMap: Record<string, number>;
}

export function GachaCollection({ inventoryMap }: Props) {
  const { t } = useTranslation();
  const [collectionDetail, setCollectionDetail] = useState<string | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string>('all');

  const collectionGrouped = useMemo(() => {
    const grouped: Record<number, Array<{ id: string; name: string; emoji: string; count: number }>> = {};
    for (const [id, card] of Object.entries(CARD_DATA)) {
      if (!grouped[card.rarity]) grouped[card.rarity] = [];
      grouped[card.rarity].push({ id, name: card.name, emoji: card.emoji, count: inventoryMap[id] ?? 0 });
    }
    return grouped;
  }, [inventoryMap]);

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(50,25,10,0.6) 0%, rgba(25,12,5,0.8) 100%)',
      border: '1px solid rgba(255,180,80,0.15)', borderTop: 'none',
      borderRadius: '0 0 12px 12px', padding: '20px 16px',
      position: 'relative',
    }}>
      {/* タイプフィルター */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14,
        padding: '8px 0', borderBottom: '1px solid rgba(255,180,80,.08)',
      }}>
        {[
          { key: 'all', labelKey: 'collection.filterAll', emoji: '📋' },
          { key: 'drink', labelKey: 'collection.filterDrink', emoji: '🍺' },
          { key: 'food', labelKey: 'collection.filterFood', emoji: '🍖' },
          { key: 'chug', labelKey: 'collection.filterChug', emoji: '🍻' },
          { key: 'harassment', labelKey: 'collection.filterHarassment', emoji: '💋' },
          { key: 'strategy', labelKey: 'collection.filterStrategy', emoji: '🧠' },
          { key: 'environment', labelKey: 'collection.filterEnvironment', emoji: '🌙' },
          { key: 'status', labelKey: 'collection.filterStatus', emoji: '💫' },
        ].map(f => (
          <button key={f.key} className="gbtn" onClick={() => setCollectionFilter(f.key)} style={{
            background: collectionFilter === f.key ? 'rgba(255,180,80,.18)' : 'rgba(255,255,255,.03)',
            border: `1px solid ${collectionFilter === f.key ? 'rgba(255,180,80,.4)' : 'rgba(255,255,255,.06)'}`,
            borderRadius: 6, padding: '4px 8px', fontSize: 10,
            color: collectionFilter === f.key ? '#fbbf24' : '#666',
            fontWeight: collectionFilter === f.key ? 700 : 400,
            transition: 'all 0.15s',
          }}>{f.emoji} {t(f.labelKey)}</button>
        ))}
      </div>

      {/* レアリティ別プログレスバー */}
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[6, 5, 4, 3, 2, 1].map(r => {
          const allCards = Object.values(CARD_DATA).filter(c => c.rarity === r);
          const ownedCards = allCards.filter(c => (inventoryMap[c.id] ?? 0) > 0);
          if (allCards.length === 0) return null;
          const pct = (ownedCards.length / allCards.length) * 100;
          const cfg = RARITY_CONFIG[r];
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: cfg.text, fontWeight: 700, width: 28, textAlign: 'right' }}>{cfg.label}</span>
              <div style={{
                flex: 1, height: 5, background: 'rgba(255,255,255,.05)',
                borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${cfg.border}, ${cfg.text})`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{
                fontSize: 9, color: cfg.menuColor, fontFamily: "'Courier New',monospace",
                width: 36, textAlign: 'right',
              }}>{ownedCards.length}/{allCards.length}</span>
            </div>
          );
        })}
      </div>

      {[6, 5, 4, 3, 2, 1].map(r => {
        const cards = (collectionGrouped[r] || []).filter(card => {
          if (collectionFilter === 'all') return true;
          const fullCard = CARD_DATA[card.id];
          return fullCard && fullCard.type === collectionFilter;
        });
        if (!cards.length) return null;
        const cfg = RARITY_CONFIG[r];
        return (
          <div key={r} style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              padding: '6px 10px', background: 'rgba(0,0,0,.4)', borderRadius: 6,
              borderLeft: `3px solid ${cfg.border}`,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: cfg.text }}>{cfg.label}</span>
              <span style={{ fontSize: 10, color: cfg.menuColor }}>
                {cards.filter(c => c.count > 0).length}/{cards.length}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(80px,1fr))', gap: 6 }}>
              {cards.map(card => {
                const owned = card.count > 0;
                return (
                  <div key={card.id} className="card-hover"
                    onClick={owned ? () => setCollectionDetail(collectionDetail === card.id ? null : card.id) : undefined}
                    style={{
                      background: owned ? cfg.bg : 'rgba(10,5,0,.6)',
                      border: `1px solid ${owned ? (collectionDetail === card.id ? cfg.text : cfg.border) : '#1a1008'}`,
                      borderRadius: 8, padding: '8px 4px', textAlign: 'center',
                      opacity: owned ? 1 : 0.35,
                      position: 'relative', cursor: owned ? 'pointer' : 'default',
                      boxShadow: collectionDetail === card.id ? `0 0 16px ${cfg.glow}` : 'none',
                      transform: collectionDetail === card.id ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ fontSize: 22, lineHeight: 1.2 }}>{owned ? card.emoji : '？'}</div>
                    <div style={{ fontSize: 8, color: owned ? cfg.text : '#333', fontWeight: 600, marginTop: 2, lineHeight: 1.2 }}>
                      {owned ? card.name : '？？？'}
                    </div>
                    {owned && card.count > 1 && (
                      <div style={{
                        position: 'absolute', top: 2, right: 2, fontSize: 7,
                        background: 'rgba(0,0,0,.6)', borderRadius: 3, padding: '1px 3px',
                        color: cfg.menuColor,
                      }}>×{card.count}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* コレクション詳細ポップアップ */}
      {collectionDetail && (() => {
        const card = CARD_DATA[collectionDetail];
        if (!card) return null;
        const cfg = RARITY_CONFIG[card.rarity];
        const ownedCount = inventoryMap[collectionDetail] ?? 0;
        const typeIcons: Record<string, string> = {
          drink: '🍺', food: '🍖', chug: '🍻',
          harassment: '💋', strategy: '🧠', environment: '🌙', status: '💫',
        };
        return (
          <div className="slide-up" style={{
            position: 'sticky', bottom: 0,
            marginTop: 8, padding: '14px 16px',
            background: 'rgba(8,4,0,.96)',
            border: `1px solid ${cfg.border}`, borderRadius: 10,
            boxShadow: `0 0 28px ${cfg.glow}, 0 -4px 20px rgba(0,0,0,.8)`,
          }}>
            <button className="gbtn" onClick={() => setCollectionDetail(null)} style={{
              position: 'absolute', top: 6, right: 8, background: 'none',
              border: 'none', color: '#555', fontSize: 16, padding: 4,
            }}>✕</button>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                fontSize: 36, flexShrink: 0, width: 52, height: 52,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,.3)', borderRadius: 10,
                border: `1px solid ${cfg.border}44`,
              }}>{card.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, color: '#ddd', fontWeight: 700 }}>{card.name}</span>
                  <span style={{
                    fontSize: 8, padding: '2px 7px', borderRadius: 4,
                    background: 'rgba(0,0,0,.5)', border: `1px solid ${cfg.border}`, color: cfg.text,
                  }}>{cfg.label}</span>
                  <span style={{
                    fontSize: 8, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(0,0,0,.3)', color: '#888',
                  }}>{typeIcons[card.type] ?? ''} {t(`collection.type_${card.type}`, card.type)}</span>
                </div>
                <div style={{
                  fontSize: 11, color: '#aa8866', lineHeight: 1.8,
                  borderLeft: `2px solid ${cfg.border}44`, paddingLeft: 10,
                  marginBottom: 6,
                }}>{card.description}</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#5a3a18' }}>
                    {t('collection.owned')}: <span style={{ color: cfg.menuColor, fontWeight: 700 }}>{ownedCount}</span>/3
                  </span>
                  {card.damage != null && <span style={{ fontSize: 9, color: '#cc6644' }}>DMG {card.damage}</span>}
                  {card.heal != null && <span style={{ fontSize: 9, color: '#66aa66' }}>{t('collection.heal')} {card.heal}</span>}
                  <span style={{ fontSize: 9, color: '#777' }}>{t('collection.price')} 🪙{card.price}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

import { CARD_DATA } from '../../data/cards.ts';
import type { CardType } from '../../data/types.ts';
import { CARD_TYPE_LABELS, CARD_TYPE_COLORS } from './cardTypeLabels.ts';

interface DeckStatsProps {
  playerDeck: string[];
}

export function DeckStats({ playerDeck }: DeckStatsProps) {
  if (playerDeck.length === 0) return null;

  // タイプ別集計
  const typeCounts: Partial<Record<CardType, number>> = {};
  let totalDamage = 0;
  let totalHeal = 0;

  for (const cardId of playerDeck) {
    const card = CARD_DATA[cardId];
    if (!card) continue;
    typeCounts[card.type] = (typeCounts[card.type] ?? 0) + 1;
    if (card.damage !== undefined && card.damage !== -1) totalDamage += card.damage;
    if (card.damage === -1) totalDamage += 2; // 1~3の期待値
    if (card.heal !== undefined && card.heal !== 99) totalHeal += card.heal;
  }

  const total = playerDeck.length;
  const barEntries = Object.entries(typeCounts) as [CardType, number][];

  return (
    <div className="deck-stats">
      {/* 構成バー */}
      <div className="deck-composition-bar">
        {barEntries.map(([type, count]) => (
          <div
            key={type}
            className="composition-segment"
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: CARD_TYPE_COLORS[type],
            }}
            title={`${CARD_TYPE_LABELS[type]}: ${count}枚`}
          >
            {count >= 2 && <span className="composition-label">{count}</span>}
          </div>
        ))}
      </div>

      {/* サマリー */}
      <div className="deck-summary">
        <span className="summary-item summary-atk">攻撃力 {totalDamage}</span>
        <span className="summary-item summary-heal">回復力 {totalHeal}</span>
        <span className="summary-legend">
          {barEntries.map(([type, count]) => (
            <span key={type} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: CARD_TYPE_COLORS[type] }} />
              {CARD_TYPE_LABELS[type]} {count}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

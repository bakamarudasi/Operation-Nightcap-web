import type { BattleState, CharacterDef, AfterEvent } from '../../data/types.ts';
import { getAffinityLevel, getAffinityBonus } from '../../data/affinity.ts';

interface BattleResultProps {
  gameResult: 'player_win' | 'opponent_win' | 'draw';
  battle: BattleState;
  currentOpponent: CharacterDef;
  resultReward: number;
  winsByCharacter: Record<string, number>;
  pendingAfterEvent: AfterEvent | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onShowAfterEvent: (event: AfterEvent) => void;
  onReturnToBar: () => void;
}

export function BattleResult({
  gameResult,
  battle,
  currentOpponent,
  resultReward,
  winsByCharacter,
  pendingAfterEvent,
  t,
  onShowAfterEvent,
  onReturnToBar,
}: BattleResultProps) {
  return (
    <div className="battle-result">
      <div className="result-content">
        <h2>
          {gameResult === 'player_win'
            ? (battle.opponentSanity <= 0 ? t('battle.resultSanityWin') : t('battle.resultWin'))
            : gameResult === 'opponent_win'
            ? (battle.playerSanity <= 0 ? t('battle.resultSanityLose') : t('battle.resultLose'))
            : t('battle.resultDraw')}
        </h2>
        <p>
          {gameResult === 'player_win'
            ? currentOpponent.battleLines.loseLine
            : gameResult === 'opponent_win'
            ? currentOpponent.battleLines.winLine
            : t('battle.goodMatch')}
        </p>
        <div className="result-reward">{t('battle.reward', { amount: resultReward })}</div>
        {gameResult === 'player_win' && (() => {
          const charWins = winsByCharacter[currentOpponent.id] ?? 0;
          const affLv = getAffinityLevel(charWins);
          const bonus = getAffinityBonus(charWins);
          return affLv > 0 ? (
            <div className="result-affinity">
              {'❤'.repeat(affLv)} {t('battle.affinityLevel', { level: affLv })}
              {bonus > 0 && <span className="affinity-bonus"> ({t('battle.affinityBonus', { bonus })})</span>}
            </div>
          ) : null;
        })()}
        {gameResult === 'player_win' && pendingAfterEvent && (
          <button
            className="menu-btn after-event-btn"
            onClick={() => onShowAfterEvent(pendingAfterEvent)}
            style={{
              background: `linear-gradient(135deg, ${pendingAfterEvent.cgColor}cc, ${pendingAfterEvent.cgColor}88)`,
              border: `1px solid ${pendingAfterEvent.cgColor}`,
            }}
          >
            {pendingAfterEvent.emoji} {pendingAfterEvent.title}
          </button>
        )}
        <button className="menu-btn" onClick={onReturnToBar}>
          {t('battle.returnToBar')}
        </button>
      </div>
    </div>
  );
}

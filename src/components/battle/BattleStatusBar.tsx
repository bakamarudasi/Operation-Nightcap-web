import type { TFunction } from 'i18next';
import type { BattleState } from '../../data/types.ts';

export interface LastRoundInfo {
  pl: string;
  op: string;
  res: string;
  resColor: string;
}

interface Props {
  battle: BattleState;
  wins: number;
  losses: number;
  lastRound: LastRoundInfo;
  t: TFunction;
}

export function BattleStatusBar({ battle, wins, losses, lastRound, t }: Props) {
  return (
    <div className="battle-status-bar">
      <div className="status-bar-item">
        <span className="status-bar-label">{t('battle.recordLabel')}</span>
        <span className="status-bar-val">
          <span className="win-c">{t('battle.winsShort', { count: wins })}</span>
          <span className="status-bar-sep">/</span>
          <span className="lose-c">{t('battle.lossesShort', { count: losses })}</span>
        </span>
      </div>
      <div className="status-bar-divider" />
      <div className="status-bar-item">
        <span className="status-bar-label">{t('battle.deck')}</span>
        <span className="status-bar-val">{battle.playerDeckRemaining.length}</span>
      </div>
      <div className="status-bar-divider" />
      <div className="status-bar-item">
        <span className="status-bar-label">{t('battle.opponentDeck')}</span>
        <span className="status-bar-val">{battle.opponentDeckRemaining.length}</span>
      </div>
      <div className="status-bar-divider" />
      <div className="status-bar-item status-bar-lastround">
        <span className="status-bar-label">{t('battle.prevRound')}</span>
        <span className="status-bar-val" style={{ color: lastRound.resColor }}>{lastRound.res}</span>
        <span className="status-bar-detail">{lastRound.pl} vs {lastRound.op}</span>
      </div>
    </div>
  );
}

import type { BattleState, CharacterDef, Buff } from '../../data/types.ts';
import { gaugePercent } from '../../data/constants.ts';
import { CharacterPortrait } from '../CharacterPortrait.tsx';
import { BuffDisplay } from '../BuffDisplay.tsx';

interface OpponentBarProps {
  currentOpponent: CharacterDef;
  battle: BattleState;
  oppDrunkStage: { textKey: string; cls: string };
  oppSanityStage: { textKey: string; cls: string };
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export function OpponentBar({
  currentOpponent,
  battle,
  oppDrunkStage,
  oppSanityStage,
  t,
}: OpponentBarProps) {
  return (
    <div className="opponent-bar">
      <div className="opp-portrait-mini">
        <CharacterPortrait theme={currentOpponent.theme} variant="icon" />
      </div>
      <div className="opp-info">
        <div className="opp-name-row">
          <div className="opp-name">{currentOpponent.name}</div>
          <div className="opp-title">{currentOpponent.subtitle}</div>
        </div>
        <div className="gauge-row">
          <div className="gauge-label-sm">{t('battle.drunkLabel')}</div>
          <div className="gauge-track">
            <div
              className="gauge-fill opp-fill"
              style={{ width: `${gaugePercent(battle.opponentDrunk, 10)}%` }}
            />
          </div>
          <div className="gauge-lvl">
            <span className="lvl-t">{t(oppDrunkStage.textKey)}</span>
            <span className="lvl-n">({battle.opponentDrunk}/10)</span>
          </div>
        </div>
        <div className="gauge-row">
          <div className="gauge-label-sm">{t('battle.sanityLabel')}</div>
          <div className="gauge-track">
            <div
              className="gauge-fill sanity-fill"
              style={{ width: `${gaugePercent(battle.opponentSanity, currentOpponent.sanityMax ?? 10)}%` }}
            />
          </div>
          <div className={`gauge-lvl ${oppSanityStage.cls}`}>
            <span className="lvl-t">{t(oppSanityStage.textKey)}</span>
            <span className="lvl-n">({battle.opponentSanity}/{currentOpponent.sanityMax ?? 10})</span>
          </div>
        </div>
        <BuffDisplay buffs={battle.opponentBuffs} keyPrefix="ob" />
      </div>
    </div>
  );
}

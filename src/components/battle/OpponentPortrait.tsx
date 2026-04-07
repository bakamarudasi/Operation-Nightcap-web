import type { TFunction } from 'i18next';
import type { CharacterDef } from '../../data/types.ts';
import { CharacterPortrait } from '../CharacterPortrait.tsx';
import type { DrunkStage } from './battleStages.ts';

interface Props {
  currentOpponent: CharacterDef;
  opponentDrunkLevel: number;
  oppDrunkStage: DrunkStage;
  oppFlush: string;
  reaction: string | null;
  drunkClassName: (level: number) => string;
  t: TFunction;
}

export function OpponentPortrait({
  currentOpponent,
  opponentDrunkLevel,
  oppDrunkStage,
  oppFlush,
  reaction,
  drunkClassName,
  t,
}: Props) {
  return (
    <div
      className="battle-left"
      style={{ '--char-glow': currentOpponent.theme.colorGlow } as React.CSSProperties}
    >
      <div className={`char-portrait ${drunkClassName(opponentDrunkLevel)}`}>
        <div className="char-portrait-flush" style={{ background: oppFlush }} />
        <div className="char-portrait-icon">
          <CharacterPortrait
            theme={currentOpponent.theme}
            variant="portrait"
            drunkLevel={opponentDrunkLevel}
            costumeStates={currentOpponent.costumeStates}
          />
        </div>
        <div className={`char-reaction ${reaction ? 'show' : ''}`}>{reaction}</div>
      </div>
      <div className="char-info">
        <div className="char-name">{currentOpponent.name}</div>
        <div className="char-subtitle">{currentOpponent.subtitle}</div>
        <div className={`char-drunk-label ${oppDrunkStage.cls}`}>
          {t(oppDrunkStage.textKey)}
        </div>
      </div>
    </div>
  );
}

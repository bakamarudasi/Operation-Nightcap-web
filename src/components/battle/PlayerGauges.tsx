import type { TFunction } from 'i18next';
import type { BattleState } from '../../data/types.ts';
import { gaugePercent } from '../../data/constants.ts';
import { getDrunkLevel, getKanryoku } from '../../engine/utils.ts';
import { BuffDisplay } from '../BuffDisplay.tsx';
import type { DrunkStage, SanityStage } from './battleStages.ts';

interface Props {
  battle: BattleState;
  plDrunkStage: DrunkStage;
  plSanityStage: SanityStage;
  t: TFunction;
}

export function PlayerGauges({ battle, plDrunkStage, plSanityStage, t }: Props) {
  return (
    <>
      <div className="player-gauge-row gauge-row">
        <div className="gauge-label-sm">{t('battle.playerDrunk')}</div>
        <div className="gauge-track">
          <div
            className="gauge-fill player-fill"
            style={{ width: `${gaugePercent(battle.playerDrunk, 10)}%` }}
          />
        </div>
        <div className="gauge-lvl">
          <span className="lvl-t">{t(plDrunkStage.textKey)}</span>
          <span className="lvl-n">({battle.playerDrunk}/10)</span>
        </div>
      </div>
      <div className="player-gauge-row gauge-row">
        <div className="gauge-label-sm">{t('battle.playerSanity')}</div>
        <div className="gauge-track">
          <div
            className="gauge-fill sanity-fill"
            style={{ width: `${gaugePercent(battle.playerSanity, 10)}%` }}
          />
        </div>
        <div className="kanryoku-display">
          {t('battle.kanryoku', { value: getKanryoku(getDrunkLevel(battle.playerDrunk)) })}
        </div>
        <div className={`gauge-lvl ${plSanityStage.cls}`}>
          <span className="lvl-t">{t(plSanityStage.textKey)}</span>
          <span className="lvl-n">({battle.playerSanity}/10)</span>
        </div>
      </div>
      <BuffDisplay buffs={battle.playerBuffs} keyPrefix="pb" className="player-buff-icons" />
    </>
  );
}

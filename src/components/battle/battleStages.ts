// 酔い段階
export const DRUNK_STAGES = [
  { max: 0, textKey: 'battle.drunkStages.sober',    cls: 'drunk-sober' },
  { max: 1, textKey: 'battle.drunkStages.tipsy',    cls: 'drunk-tipsy' },
  { max: 3, textKey: 'battle.drunkStages.drunk',    cls: 'drunk-good' },
  { max: 6, textKey: 'battle.drunkStages.wasted',   cls: 'drunk-done' },
  { max: 9, textKey: 'battle.drunkStages.hammered', cls: 'drunk-wasted' },
  { max: 10, textKey: 'battle.drunkStages.passed',  cls: 'drunk-gone' },
];

export type DrunkStage = (typeof DRUNK_STAGES)[number];

export function getDrunkStage(value: number): DrunkStage {
  for (const s of DRUNK_STAGES) {
    if (value <= s.max) return s;
  }
  return DRUNK_STAGES[DRUNK_STAGES.length - 1];
}

// 理性段階
export const SANITY_STAGES = [
  { min: 8, textKey: 'battle.sanityStages.calm',     cls: 'sanity-calm' },
  { min: 5, textKey: 'battle.sanityStages.shaken',   cls: 'sanity-shaken' },
  { min: 2, textKey: 'battle.sanityStages.breaking', cls: 'sanity-breaking' },
  { min: 0, textKey: 'battle.sanityStages.gone',     cls: 'sanity-gone' },
];

export type SanityStage = (typeof SANITY_STAGES)[number];

export function getSanityStage(value: number): SanityStage {
  for (const s of SANITY_STAGES) {
    if (value >= s.min) return s;
  }
  return SANITY_STAGES[SANITY_STAGES.length - 1];
}

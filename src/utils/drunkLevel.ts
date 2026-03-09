/** 酔い段階データ */
export const DRUNK_STAGES = [
  { max: 0, text: 'シラフ',   cls: 'drunk-sober' },
  { max: 1, text: 'ほろ酔い', cls: 'drunk-tipsy' },
  { max: 3, text: '酔い',     cls: 'drunk-good' },
  { max: 6, text: 'べろべろ', cls: 'drunk-done' },
  { max: 9, text: '泥酔',     cls: 'drunk-wasted' },
  { max: 10, text: '潰れ',    cls: 'drunk-gone' },
] as const;

export type DrunkStage = typeof DRUNK_STAGES[number];

/** 酔い値から段階を取得 */
export function getDrunkStage(value: number): DrunkStage {
  for (const s of DRUNK_STAGES) {
    if (value <= s.max) return s;
  }
  return DRUNK_STAGES[DRUNK_STAGES.length - 1];
}

/** 酔い値からblush(頬赤らみ)のopacityを取得 */
export function getBlushOpacity(drunkLevel: number): number {
  if (drunkLevel >= 3) return 0.8;
  if (drunkLevel >= 2) return 0.5;
  if (drunkLevel >= 1) return 0.25;
  return 0;
}

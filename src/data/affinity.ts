/** キャラ好感度レベル定義 */
export interface AffinityLevelDef {
  level: number;
  requiredWins: number;
  /** 勝利時の追加報酬（龍門幣） */
  bonusReward: number;
}

export const AFFINITY_LEVELS: AffinityLevelDef[] = [
  { level: 1, requiredWins: 3, bonusReward: 100 },
  { level: 2, requiredWins: 7, bonusReward: 200 },
  { level: 3, requiredWins: 15, bonusReward: 300 },
  { level: 4, requiredWins: 25, bonusReward: 400 },
];

/** 勝利数から到達している好感度レベルを返す（0 = 未到達） */
export function getAffinityLevel(wins: number): number {
  let lv = 0;
  for (const a of AFFINITY_LEVELS) {
    if (wins >= a.requiredWins) lv = a.level;
  }
  return lv;
}

/** 好感度レベルに応じたボーナス報酬を返す */
export function getAffinityBonus(wins: number): number {
  let bonus = 0;
  for (const a of AFFINITY_LEVELS) {
    if (wins >= a.requiredWins) bonus = a.bonusReward;
  }
  return bonus;
}

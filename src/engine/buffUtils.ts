import type { Buff } from '../data/types.ts';

/** バフがアクティブかチェック */
export function hasBuff(buffs: Buff[], id: string): boolean {
  return buffs.some(b => b.id === id);
}

/** 特定バフの値を取得（なければデフォルト） */
export function getBuffValue(buffs: Buff[], id: string, defaultVal: number): number {
  const buff = buffs.find(b => b.id === id);
  return buff?.value ?? defaultVal;
}

/** duration を1減らし、0以下を除去。-1（永続）はそのまま */
export function tickBuffs(buffs: Buff[]): Buff[] {
  return buffs
    .map(b => b.duration === -1 ? b : { ...b, duration: b.duration - 1 })
    .filter(b => b.duration !== 0);
}

/** DoTバフのダメージを計算 */
export function calcDoTDamage(buffs: Buff[]): number {
  return buffs
    .filter(b => b.id === 'dot')
    .reduce((sum, b) => sum + (b.value ?? 0), 0);
}

/** ドリンクダメージにバフ効果を適用 */
export function applyDrinkBuffs(baseDmg: number, attackerBuffs: Buff[], defenderBuffs: Buff[]): number {
  let dmg = baseDmg;
  if (hasBuff(attackerBuffs, 'karaoke') || hasBuff(defenderBuffs, 'karaoke')) {
    dmg += 1;
  }
  if (hasBuff(attackerBuffs, 'atk_down')) {
    dmg = Math.floor(dmg * getBuffValue(attackerBuffs, 'atk_down', 1));
  }
  if (hasBuff(defenderBuffs, 'tipsy')) {
    dmg = Math.floor(dmg * 1.5);
  }
  return dmg;
}

/** ハラスメントの必要酔いLvを環境バフで補正 */
export function getAdjustedRequiredLevel(requiredLevel: number, userBuffs: Buff[]): number {
  let lv = requiredLevel;
  if (hasBuff(userBuffs, 'dimlight')) lv = Math.max(0, lv - 1);
  if (hasBuff(userBuffs, 'excuse')) lv = Math.max(0, lv - 1);
  return lv;
}

/** ハラスメントのダメージにバフ効果を適用 */
export function applyHarassmentBuffs(baseDmg: number, attackerBuffs: Buff[], defenderBuffs: Buff[]): number {
  let dmg = baseDmg;
  if (hasBuff(defenderBuffs, 'blush')) {
    dmg += 1;
  }
  if (hasBuff(attackerBuffs, 'alone') || hasBuff(defenderBuffs, 'alone')) {
    dmg *= 2;
  }
  return dmg;
}

/** バフのUIラベルを取得 */
export function buffLabel(buff: Buff): string | null {
  switch (buff.id) {
    case 'atk_down': return `⬇️ 攻撃力低下！次のターン、酒のダメージが半減…`;
    case 'stun': return `😵 スタン付与！次のターン行動不能…！`;
    case 'dot': return `💔 持続ダメージ付与！毎ターン理性が${buff.value ?? 0}ずつ削られる…`;
    case 'no_food': return `🚫 つまみ封じ！防御カードが使用不可に…！`;
    case 'tipsy': return `😳 ほろ酔い状態！ドリンクダメージが1.5倍に…`;
    case 'blush': return `😶‍🌫️ 動揺状態！セクハラが効きやすくなった…`;
    case 'alone': return `🌙 二人きり…セクハラのダメージが2倍に…`;
    case 'karaoke': return `🎤 カラオケ突入！ドリンクダメージ+1！`;
    case 'dimlight': return `🕯️ 照明が暗い…セクハラの条件が緩和…`;
    case 'excuse': return `🙈 「酔ってるから」…次のセクハラの条件緩和！`;
    default: return null;
  }
}

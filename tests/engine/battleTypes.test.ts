import { describe, it, expect } from 'vitest';
import {
  getMatchupResult,
  isUtilityType,
  getBuffValue,
  tickBuffs,
  calcDoTDamage,
} from '../../src/engine/battleTypes.ts';
import type { Buff } from '../../src/data/types.ts';

describe('getMatchupResult', () => {
  it('drink vs harassment は advantage', () => {
    expect(getMatchupResult('drink', 'harassment')).toBe('advantage');
  });
  it('harassment vs drink は disadvantage', () => {
    expect(getMatchupResult('harassment', 'drink')).toBe('disadvantage');
  });
  it('harassment vs food は advantage', () => {
    expect(getMatchupResult('harassment', 'food')).toBe('advantage');
  });
  it('food vs harassment は disadvantage', () => {
    expect(getMatchupResult('food', 'harassment')).toBe('disadvantage');
  });
  it('food vs drink は advantage', () => {
    expect(getMatchupResult('food', 'drink')).toBe('advantage');
  });
  it('drink vs food は disadvantage', () => {
    expect(getMatchupResult('drink', 'food')).toBe('disadvantage');
  });
  it('同タイプは neutral', () => {
    expect(getMatchupResult('drink', 'drink')).toBe('neutral');
    expect(getMatchupResult('food', 'food')).toBe('neutral');
    expect(getMatchupResult('harassment', 'harassment')).toBe('neutral');
  });
});

describe('isUtilityType', () => {
  it('strategy/environment/status は true', () => {
    expect(isUtilityType('strategy')).toBe(true);
    expect(isUtilityType('environment')).toBe(true);
    expect(isUtilityType('status')).toBe(true);
  });
  it('それ以外は false', () => {
    expect(isUtilityType('drink')).toBe(false);
    expect(isUtilityType('food')).toBe(false);
    expect(isUtilityType('harassment')).toBe(false);
  });
});

describe('getBuffValue', () => {
  it('対象IDがなければ default を返す', () => {
    const buffs: Buff[] = [{ id: 'stun', duration: 1 }];
    expect(getBuffValue(buffs, 'dot', 5)).toBe(5);
  });
  it('対象IDがあれば最大値を返す', () => {
    const buffs: Buff[] = [
      { id: 'dot', duration: 2, value: 1 },
      { id: 'dot', duration: 2, value: 3 },
      { id: 'dot', duration: 2, value: 2 },
    ];
    expect(getBuffValue(buffs, 'dot', 0)).toBe(3);
  });
  it('value 未指定なら default 扱い', () => {
    const buffs: Buff[] = [{ id: 'dot', duration: 2 }];
    expect(getBuffValue(buffs, 'dot', 7)).toBe(7);
  });
});

describe('tickBuffs', () => {
  it('duration を1減らす', () => {
    const buffs: Buff[] = [{ id: 'stun', duration: 2 }];
    const next = tickBuffs(buffs);
    expect(next).toEqual([{ id: 'stun', duration: 1 }]);
  });
  it('duration が 0 になったものは除去', () => {
    const buffs: Buff[] = [
      { id: 'stun', duration: 1 },
      { id: 'dot', duration: 2 },
    ];
    const next = tickBuffs(buffs);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('dot');
  });
  it('duration: -1（永続）はそのまま', () => {
    const buffs: Buff[] = [{ id: 'karaoke', duration: -1 }];
    const next = tickBuffs(buffs);
    expect(next).toEqual([{ id: 'karaoke', duration: -1 }]);
  });
  it('元配列を破壊しない', () => {
    const buffs: Buff[] = [{ id: 'stun', duration: 2 }];
    tickBuffs(buffs);
    expect(buffs[0].duration).toBe(2);
  });
});

describe('calcDoTDamage', () => {
  it('dot バフの value 合計を返す', () => {
    const buffs: Buff[] = [
      { id: 'dot', duration: 2, value: 2 },
      { id: 'dot', duration: 1, value: 3 },
      { id: 'stun', duration: 1 },
    ];
    expect(calcDoTDamage(buffs)).toBe(5);
  });
  it('dot がなければ 0', () => {
    expect(calcDoTDamage([{ id: 'stun', duration: 1 }])).toBe(0);
  });
  it('value 未指定の dot は 0 として計上', () => {
    const buffs: Buff[] = [{ id: 'dot', duration: 1 }];
    expect(calcDoTDamage(buffs)).toBe(0);
  });
});

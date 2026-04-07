import { describe, it, expect } from 'vitest';
import {
  getDrunkLevel,
  getKanryoku,
  canPlayCard,
  getHiddenSlotCount,
  isFoodDisabled,
  hasBuff,
  buildCorruptedSlots,
  findHighestValueCardIndex,
  shuffleArray,
  randomPick,
  POSITIVE_BUFF_IDS,
  DEBUFF_IDS,
} from '../../src/engine/utils.ts';

describe('getDrunkLevel', () => {
  it('0〜1は Lv0', () => {
    expect(getDrunkLevel(0)).toBe(0);
    expect(getDrunkLevel(1)).toBe(0);
  });
  it('2〜3は Lv1', () => {
    expect(getDrunkLevel(2)).toBe(1);
    expect(getDrunkLevel(3)).toBe(1);
  });
  it('4〜6は Lv2', () => {
    expect(getDrunkLevel(4)).toBe(2);
    expect(getDrunkLevel(6)).toBe(2);
  });
  it('7〜9は Lv3', () => {
    expect(getDrunkLevel(7)).toBe(3);
    expect(getDrunkLevel(9)).toBe(3);
  });
  it('10以上は Lv4', () => {
    expect(getDrunkLevel(10)).toBe(4);
    expect(getDrunkLevel(99)).toBe(4);
  });
});

describe('getKanryoku', () => {
  it('Lv0/1は2', () => {
    expect(getKanryoku(0)).toBe(2);
    expect(getKanryoku(1)).toBe(2);
  });
  it('Lv2は3', () => {
    expect(getKanryoku(2)).toBe(3);
  });
  it('Lv3/4は4', () => {
    expect(getKanryoku(3)).toBe(4);
    expect(getKanryoku(4)).toBe(4);
  });
});

describe('canPlayCard', () => {
  it('コストが肝力以下なら使用可', () => {
    // drunk=0 → Lv0 → 肝力2
    expect(canPlayCard({ cost: 1 }, 0)).toBe(true);
    expect(canPlayCard({ cost: 2 }, 0)).toBe(true);
    expect(canPlayCard({ cost: 3 }, 0)).toBe(false);
  });
  it('Lv2(肝力3)ではコスト3まで使える', () => {
    expect(canPlayCard({ cost: 3 }, 4)).toBe(true);
    expect(canPlayCard({ cost: 4 }, 4)).toBe(false);
  });
  it('Lv3(肝力4)ではコスト4まで使える', () => {
    expect(canPlayCard({ cost: 4 }, 7)).toBe(true);
    expect(canPlayCard({ cost: 5 }, 7)).toBe(false);
  });
});

describe('getHiddenSlotCount', () => {
  it('Lv0/1は0', () => {
    expect(getHiddenSlotCount(0)).toBe(0);
    expect(getHiddenSlotCount(1)).toBe(0);
  });
  it('Lv2は1', () => {
    expect(getHiddenSlotCount(2)).toBe(1);
  });
  it('Lv3以上は2', () => {
    expect(getHiddenSlotCount(3)).toBe(2);
    expect(getHiddenSlotCount(4)).toBe(2);
  });
});

describe('isFoodDisabled', () => {
  it('Lv3以上で封印', () => {
    expect(isFoodDisabled(2)).toBe(false);
    expect(isFoodDisabled(3)).toBe(true);
    expect(isFoodDisabled(4)).toBe(true);
  });
});

describe('hasBuff', () => {
  it('IDが含まれていれば true', () => {
    const buffs = [{ id: 'stun' }, { id: 'dot' }];
    expect(hasBuff(buffs, 'stun')).toBe(true);
    expect(hasBuff(buffs, 'dot')).toBe(true);
    expect(hasBuff(buffs, 'tipsy')).toBe(false);
  });
  it('空配列なら常に false', () => {
    expect(hasBuff([], 'stun')).toBe(false);
  });
});

describe('buildCorruptedSlots', () => {
  it('指定数だけ true が立つ', () => {
    const slots = buildCorruptedSlots(5, 3);
    expect(slots.length).toBe(5);
    expect(slots.filter(Boolean).length).toBe(3);
  });
  it('corruptCount > handSize でも handSize 個までしか立たない', () => {
    const slots = buildCorruptedSlots(3, 10);
    expect(slots.filter(Boolean).length).toBe(3);
  });
  it('corruptCount=0 なら全て false', () => {
    const slots = buildCorruptedSlots(4, 0);
    expect(slots).toEqual([false, false, false, false]);
  });
});

describe('findHighestValueCardIndex', () => {
  it('空の手札では -1', () => {
    expect(findHighestValueCardIndex([])).toBe(-1);
  });
  it('存在しないカードIDのみでも 0 を返す（フォールバック）', () => {
    expect(findHighestValueCardIndex(['__nope__'])).toBe(0);
  });
});

describe('shuffleArray', () => {
  it('要素は保持される', () => {
    const a = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray([...a]);
    expect(shuffled.sort()).toEqual(a);
  });
});

describe('randomPick', () => {
  it('空配列なら null', () => {
    expect(randomPick([])).toBeNull();
  });
  it('要素1つなら必ずそれを返す', () => {
    expect(randomPick(['only'])).toBe('only');
  });
});

describe('バフID定数', () => {
  it('positive と debuff は重複しない', () => {
    for (const id of POSITIVE_BUFF_IDS) {
      expect(DEBUFF_IDS).not.toContain(id);
    }
  });
});

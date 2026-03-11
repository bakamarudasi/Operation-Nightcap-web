import { describe, it, expect, vi } from 'vitest';
import { shuffleArray, randomPick } from '../engine/utils.ts';

describe('shuffleArray', () => {
  it('同じ要素を含む配列を返す', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffleArray(copy);
    expect(copy.sort()).toEqual(original.sort());
  });

  it('配列の長さが変わらない', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffleArray(arr);
    expect(arr).toHaveLength(5);
  });

  it('空配列を処理できる', () => {
    const arr: number[] = [];
    expect(shuffleArray(arr)).toEqual([]);
  });

  it('要素1つの配列を処理できる', () => {
    const arr = [42];
    expect(shuffleArray(arr)).toEqual([42]);
  });

  it('元の配列を直接変更する（in-place）', () => {
    const arr = [1, 2, 3];
    const result = shuffleArray(arr);
    expect(result).toBe(arr);
  });
});

describe('randomPick', () => {
  it('空配列ならnullを返す', () => {
    expect(randomPick([])).toBeNull();
  });

  it('要素1つの配列ならその要素を返す', () => {
    expect(randomPick([42])).toBe(42);
  });

  it('配列の要素の中から返す', () => {
    const arr = ['a', 'b', 'c'];
    const result = randomPick(arr);
    expect(arr).toContain(result);
  });

  it('Math.randomに基づいて要素を選択する', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(randomPick([10, 20, 30])).toBe(10);

    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(randomPick([10, 20, 30])).toBe(30);

    vi.restoreAllMocks();
  });
});

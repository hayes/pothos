import { describe, expect, it } from 'vitest';
import { deepEqual } from '../src';

describe('deepEqual', () => {
  it('compares nested objects and arrays structurally', () => {
    expect(
      deepEqual({ where: { id: 1, tags: ['a', 'b'] } }, { where: { id: 1, tags: ['a', 'b'] } }),
    ).toBe(true);
    expect(deepEqual({ where: { id: 1 } }, { where: { id: 2 } })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });

  it('treats keys holding undefined as absent', () => {
    expect(deepEqual({ where: undefined }, {})).toBe(true);
    expect(deepEqual({}, { orderBy: undefined, limit: 1 })).toBe(false);
  });

  it('compares boxed and date values by their primitive value', () => {
    expect(deepEqual(new Date(1), new Date(1))).toBe(true);
    expect(deepEqual(new Date(1), new Date(2))).toBe(false);
  });
});

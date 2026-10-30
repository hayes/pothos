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
    expect(deepEqual({}, [])).toBe(false);
  });

  it('treats keys holding undefined as absent', () => {
    expect(deepEqual({ where: undefined }, {})).toBe(true);
    expect(deepEqual({}, { orderBy: undefined, limit: 1 })).toBe(false);
  });

  it('compares boxed and date values by their primitive value', () => {
    expect(deepEqual(new Date(1), new Date(1))).toBe(true);
    expect(deepEqual(new Date(1), new Date(2))).toBe(false);
    expect(deepEqual({}, new Date(1))).toBe(false);
    expect(deepEqual(new Date(1), {})).toBe(false);
  });

  it('compares opaque class instances through equals, or not at all', () => {
    class Instant {
      #value: number;
      constructor(value: number) {
        this.#value = value;
      }
      valueOf(): never {
        throw new TypeError('use equals');
      }
      equals(other: Instant) {
        return this.#value === other.#value;
      }
    }
    class Hidden {
      #value: number;
      constructor(value: number) {
        this.#value = value;
      }
      read() {
        return this.#value;
      }
    }
    const hidden = new Hidden(1);

    expect(deepEqual(new Instant(1), new Instant(1))).toBe(true);
    expect(deepEqual(new Instant(1), new Instant(2))).toBe(false);
    expect(deepEqual(new Instant(1), {})).toBe(false);
    expect(deepEqual(hidden, hidden)).toBe(true);
    expect(deepEqual(new Hidden(1), new Hidden(1))).toBe(false);
  });

  it('still compares byte arrays and stateful class instances structurally', () => {
    class Point {
      constructor(readonly x: number) {}
    }

    expect(deepEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
    expect(deepEqual(new Point(1), new Point(1))).toBe(true);
    expect(deepEqual(new Point(1), new Point(2))).toBe(false);
  });
});

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

  it('compares opaque instances symmetrically, and only with the same prototype', () => {
    // An `equals` that accepts property bags, like Temporal's.
    class Bag {
      #year: number;
      constructor(year: number) {
        this.#year = year;
      }
      valueOf(): never {
        throw new TypeError('use equals');
      }
      equals(other: { year?: number }) {
        return other instanceof Bag ? this.#year === other.#year : other?.year === this.#year;
      }
    }
    class Other {
      valueOf(): never {
        throw new TypeError('use equals');
      }
      equals() {
        return true;
      }
    }

    expect(deepEqual(new Bag(2020), { year: 2020 })).toBe(false);
    expect(deepEqual({ year: 2020 }, new Bag(2020))).toBe(false);
    expect(deepEqual(new Other(), new Bag(2020))).toBe(false);
    expect(deepEqual(new Bag(2020), new Other())).toBe(false);
    expect(deepEqual(new Bag(2020), new Bag(2020))).toBe(true);
  });

  it('lets an error thrown by equals reach the caller', () => {
    class Broken {
      valueOf(): never {
        throw new TypeError('use equals');
      }
      equals(): never {
        throw new Error('broken equals');
      }
    }

    expect(() => deepEqual(new Broken(), new Broken())).toThrow('broken equals');
  });

  it('compares typed arrays by type and bytes', () => {
    expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(deepEqual(new Uint8Array([1, 2]), new Int8Array([1, 2]))).toBe(false);
    expect(deepEqual(new Uint8Array([1, 2]), { 0: 1, 1: 2 })).toBe(false);
    expect(deepEqual(new Uint8Array([0, 1, 2]).subarray(1), new Uint8Array([1, 2]))).toBe(true);

    const big = new Uint8Array(4_000_000);
    expect(deepEqual(big, new Uint8Array(4_000_000))).toBe(true);
  });

  it('compares cyclic values without overflowing the stack', () => {
    const left: Record<string, unknown> = { x: 1 };
    left.self = left;
    const right: Record<string, unknown> = { x: 1 };
    right.self = right;
    const different: Record<string, unknown> = { x: 2 };
    different.self = different;

    expect(deepEqual(left, right)).toBe(true);
    expect(deepEqual(left, different)).toBe(false);
  });
});

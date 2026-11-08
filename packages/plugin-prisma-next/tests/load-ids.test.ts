import { describe, expect, it } from 'vitest';
import { loadIds } from '../src/utils/load-ids';
import { COMPUTE, type PrismaNextSelection } from '../src/utils/selections';

class Amount {
  constructor(readonly cents: number) {}
  toJSON() {
    return this.cents;
  }
}

class Opaque {
  constructor(readonly value: number) {}
}

/** A level where consumer 0 computes a count identified by `loadIdentity`. */
const level = (loadIdentity: unknown): PrismaNextSelection => ({
  computed: { 'posts:0::count': { key: '::count', loadIdentity, [COMPUTE]: () => ({}) } },
});

describe('load ids', () => {
  it('name equal arguments alike, whatever objects hold them', () => {
    const id = (value: unknown) => loadIds(level({ args: { value } })).get('0');
    expect(id(new Amount(5))).toBe(id(new Amount(5)));
    expect(id(new Amount(5))).not.toBe(id(new Amount(6)));
    expect(id(new Date(1))).toBe(id(new Date(1)));
    // An object without a string form of its own is named by its class alone.
    expect(id(new Opaque(1))).toBe(id(new Opaque(2)));
  });
});

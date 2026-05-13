import { typeBrandKey } from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { brandResult, rebrandForVariant } from '../src/utils/branding';

describe('brandResult — Iterable / AsyncIterable branding', () => {
  it('brands rows yielded from a sync iterable', () => {
    const a = { id: 1 };
    const b = { id: 2 };
    const source: Iterable<unknown> = (function* () {
      yield a;
      yield b;
    })();
    const wrapped = brandResult(source, 'User') as IterableIterator<unknown>;
    const collected = [...wrapped];
    expect(collected).toEqual([a, b]);
    expect((a as Record<symbol, unknown>)[typeBrandKey]).toBe('User');
    expect((b as Record<symbol, unknown>)[typeBrandKey]).toBe('User');
  });

  it('brands rows yielded from an async iterable', async () => {
    const a = { id: 1 };
    const b = { id: 2 };
    async function* gen(): AsyncGenerator<unknown> {
      // Trivial await so biome doesn't flag the async generator —
      // the test is specifically about AsyncIterable handling.
      await Promise.resolve();
      yield a;
      yield b;
    }
    const source: AsyncIterable<unknown> = gen();
    const wrapped = brandResult(source, 'User') as AsyncIterableIterator<unknown>;
    const collected: unknown[] = [];
    for await (const row of wrapped) {
      collected.push(row);
    }
    expect(collected).toEqual([a, b]);
    expect((a as Record<symbol, unknown>)[typeBrandKey]).toBe('User');
    expect((b as Record<symbol, unknown>)[typeBrandKey]).toBe('User');
  });

  it('forwards return() to the underlying iterator for cancellation', async () => {
    // Subscription pipelines rely on `iterator.return()` to close DB
    // cursors. The wrapper has to delegate.
    let cancelled = false;
    const source: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]() {
        return {
          next() {
            return Promise.resolve({ value: { id: 1 }, done: false });
          },
          return(value: unknown) {
            cancelled = true;
            return Promise.resolve({ value, done: true } as const);
          },
        };
      },
    };
    const wrapped = brandResult(source, 'X') as AsyncIterableIterator<unknown>;
    await wrapped.next();
    await wrapped.return!(undefined);
    expect(cancelled).toBe(true);
  });
});

describe('rebrandForVariant — Object.create wrap invariant', () => {
  it('two sibling variants leave the parent brand untouched', () => {
    // Order-of-resolution test — sibling t.variant fields resolve in
    // unspecified order. Neither branding should mutate the parent.
    const parent = { id: 1, role: 'admin' };
    const adminWrapper = rebrandForVariant(parent, 'AdminUser') as Record<symbol, unknown>;
    const basicWrapper = rebrandForVariant(parent, 'BasicUser') as Record<symbol, unknown>;
    expect(adminWrapper).not.toBe(parent);
    expect(basicWrapper).not.toBe(parent);
    expect(adminWrapper[typeBrandKey]).toBe('AdminUser');
    expect(basicWrapper[typeBrandKey]).toBe('BasicUser');
    expect((parent as Record<symbol, unknown>)[typeBrandKey]).toBeUndefined();
  });

  it('property access on the wrapper inherits from the parent', () => {
    const parent = { id: 7, posts: [{ title: 'a' }] };
    const wrapper = rebrandForVariant(parent, 'Admin') as Record<string, unknown>;
    expect(wrapper.id).toBe(7);
    expect(wrapper.posts).toBe(parent.posts);
  });

  it('returns the parent unchanged if already branded with the same variant', () => {
    // Recursive variant chains through the same type — don't keep
    // stacking wrappers.
    const parent = { id: 1 };
    const first = rebrandForVariant(parent, 'X') as Record<symbol, unknown>;
    const second = rebrandForVariant(first, 'X');
    expect(second).toBe(first);
  });
});

describe('brandResult — skip primitives + Error / Date / Map / Set', () => {
  it('returns a string resolver value as-is (does not iterate chars)', () => {
    // A resolver legitimately returning a literal string (e.g. a debug
    // field returning `'ok'`) must not get wrapped into a char iterator.
    const result = brandResult('literal', 'User');
    expect(result).toBe('literal');
  });

  it('returns numbers / booleans as-is', () => {
    expect(brandResult(42, 'X')).toBe(42);
    expect(brandResult(true, 'X')).toBe(true);
    expect(brandResult(null, 'X')).toBe(null);
    expect(brandResult(undefined, 'X')).toBe(undefined);
  });

  it('does not brand Error instances', () => {
    const err = new Error('oops');
    brandResult(err, 'User');
    expect((err as unknown as Record<symbol, unknown>)[typeBrandKey]).toBeUndefined();
  });

  it('does not brand Date instances', () => {
    const d = new Date();
    brandResult(d, 'User');
    expect((d as unknown as Record<symbol, unknown>)[typeBrandKey]).toBeUndefined();
  });

  it('does not iterate Maps / Sets as row collections', () => {
    const m = new Map([['k', { id: 1 }]]);
    const result = brandResult(m, 'User');
    expect(result).toBe(m);
    // The inner value is untouched (no iteration happened).
    expect((m.get('k') as Record<symbol, unknown>)[typeBrandKey]).toBeUndefined();

    const s = new Set([{ id: 2 }]);
    expect(brandResult(s, 'User')).toBe(s);
  });
});

import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { wrapSubscriptionIterator } from '../src/subscription-iterator';

it('uses one completion decision when the source flag is a stateful getter', async () => {
  let lookups = 0;
  const iterator = wrapSubscriptionIterator(
    {
      next: () =>
        Promise.resolve({
          value: 'event',
          get done() {
            return ++lookups > 1;
          },
        }),
      return: () => Promise.resolve({ value: undefined, done: true }),
    },
    (error) => {
      throw error;
    },
  );
  const result = await iterator.next();
  expect(result.done).toBe(false);
  expect(result.value).toBe('event');
  await iterator.return!();
});

it.each([false, true])('reads the source completion flag once (done: %s)', async (completed) => {
  let lookups = 0;
  const result = {
    value: 1,
    get done() {
      lookups += 1;
      return completed;
    },
  };
  const iterator = wrapSubscriptionIterator(
    {
      next: () => Promise.resolve(result),
      return: () => Promise.resolve({ value: undefined, done: true }),
    },
    (error) => {
      throw error;
    },
  );
  await iterator.next();
  expect(lookups).toBe(1);
  await iterator.return!();
});

it('allows a source to reenter next synchronously', async () => {
  let wrapped: AsyncIterableIterator<unknown>;
  let nested: Promise<IteratorResult<unknown>> | undefined;
  let calls = 0;
  wrapped = wrapSubscriptionIterator(
    {
      next() {
        const value = ++calls;
        if (value === 1) {
          nested = wrapped.next();
        }
        return Promise.resolve({ value, done: false });
      },
    },
    (error) => {
      throw error;
    },
  );
  const outer = wrapped.next();
  // Attach rejection handlers to both reads before either can reject.
  const results = await Promise.allSettled([outer, nested!]);
  expect(results).toEqual([
    { status: 'fulfilled', value: { value: 1, done: false } },
    { status: 'fulfilled', value: { value: 2, done: false } },
  ]);
  await wrapped.return!();
});

async function closedBeforeRead() {
  const context = { payload: new Array(100_000).fill(42) };
  const source = {
    context,
    next: () => Promise.resolve({ value: undefined, done: true }),
    return: () => Promise.resolve({ value: undefined, done: true }),
  };
  const onError = () => context;
  const wrapped = wrapSubscriptionIterator(source, onError);
  await wrapped.return!();
  return {
    wrapped,
    source: new WeakRef(source),
    context: new WeakRef(context),
    onError: new WeakRef(onError),
  };
}

it('releases source and callback contexts when closed before the first read', async () => {
  setFlagsFromString('--expose_gc');
  const gc = runInNewContext('gc') as () => void;
  setFlagsFromString('--no-expose_gc');
  const closed = await closedBeforeRead();
  for (let i = 0; i < 8; i += 1) {
    await setImmediate();
    gc();
  }
  expect(closed.source.deref()).toBeUndefined();
  expect(closed.context.deref()).toBeUndefined();
  expect(closed.onError.deref()).toBeUndefined();
  // Keep the closed wrapper reachable throughout collection.
  await closed.wrapped.next();
});

import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { yieldAsyncErrors } from '../src/utils';

async function collect() {
  setFlagsFromString('--expose_gc');
  const gc = runInNewContext('gc') as () => void;
  setFlagsFromString('--no-expose_gc');
  for (let i = 0; i < 8; i += 1) {
    await setImmediate();
    gc();
  }
}

async function reentrantFailure() {
  const events = new EventEmitter();
  const context = { payload: new Array(100_000).fill(42) };
  const listener = () => context.payload.length;
  events.on('change', listener);
  let wake: (result: IteratorResult<unknown>) => void = () => {};
  let parent!: AsyncGenerator<unknown>;
  const entered = Promise.withResolvers<void>();
  let failedRead!: Promise<IteratorResult<unknown>>;
  const error = new Error('read failed');
  const child: AsyncIterator<unknown> = {
    next: () =>
      new Promise((resolve) => {
        wake = resolve;
      }),
    return: () => {
      events.off('change', listener);
      wake({ value: undefined, done: true });
      return Promise.resolve({ value: undefined, done: true });
    },
  };
  const nested: AsyncIterable<unknown> = {
    [Symbol.asyncIterator]() {
      failedRead = parent.next();
      failedRead.catch(() => {});
      entered.resolve();
      return child;
    },
  };
  let calls = 0;
  const source: AsyncIterableIterator<unknown> = {
    next() {
      if (++calls === 1) {
        return Promise.resolve({ value: nested, done: false });
      }
      throw error;
    },
    return() {
      throw new Error('cleanup failed');
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  parent = yieldAsyncErrors(source, [], undefined, 1);
  const pending = parent.next();
  await entered.promise;
  await expect(failedRead).rejects.toBe(error);
  return { iterator: parent, pending, events, context: new WeakRef(context) };
}

it('closes a late reentrant child and releases its request without another close', async () => {
  const sample = await reentrantFailure();
  try {
    expect.soft(sample.events.listenerCount('change')).toBe(0);
    await collect();
    expect.soft(sample.context.deref()).toBeUndefined();
  } finally {
    // Regression cleanup only; the assertions require terminal failure to do this itself.
    await sample.iterator.return(undefined);
    await sample.pending;
  }
});

async function emptyList() {
  const context = { payload: new Array(100_000).fill(42) };
  const iterator = yieldAsyncErrors(
    {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ done: true, value: undefined }),
      }),
    },
    [],
    () => {
      context.payload.length;
    },
    1,
  );
  await iterator.next();
  return { iterator, context: new WeakRef(context) };
}

it('releases request callbacks after natural completion while the wrapper stays reachable', async () => {
  const sample = await emptyList();
  await collect();
  expect(sample.context.deref()).toBeUndefined();
  await sample.iterator.next();
});

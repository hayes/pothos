import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { mapAsyncIterator } from '../src/utils/map-async-iterator';

async function collect(gc: () => void) {
  for (let i = 0; i < 8; i += 1) {
    await setImmediate();
    gc();
  }
}

function subscription(events: EventEmitter) {
  const context = { payload: new Array(1_000).fill(42) };
  let settle: ((result: IteratorResult<unknown>) => void) | undefined;
  const listener = (value: unknown) => settle?.({ value, done: false });
  events.on('event', listener);
  const source = {
    context,
    next: () =>
      new Promise<IteratorResult<unknown>>((resolve) => {
        settle = resolve;
      }),
    return: () => {
      events.off('event', listener);
      settle?.({ value: undefined, done: true });
      settle = undefined;
      return Promise.resolve({ value: undefined, done: true as const });
    },
  };
  const onError = () => context;
  const iterator = mapAsyncIterator(source, (value) => value, onError);
  return {
    iterator,
    source: new WeakRef(source),
    context: new WeakRef(context),
    onError: new WeakRef(onError),
  };
}

function failingIterator(error: Error, cleanup: { calls: number }) {
  const context = { payload: new Array(1_000).fill(42) };
  const source = {
    context,
    next() {
      throw error;
    },
    return() {
      cleanup.calls += 1;
      throw new Error('cleanup failure');
    },
  };
  const map = () => context;
  const onError = (failure: unknown) => {
    // Keep the request context captured by the callback.
    context.payload.length;
    throw failure;
  };
  const onClose = () => {
    context.payload.length;
    return Promise.reject(new Error('owned cleanup failure'));
  };
  return {
    iterator: mapAsyncIterator(source, map, onError, onClose),
    source: new WeakRef(source),
    context: new WeakRef(context),
    map: new WeakRef(map),
    onError: new WeakRef(onError),
    onClose: new WeakRef(onClose),
  };
}

it('releases source and callback contexts after a terminal failure with failing cleanup', async () => {
  setFlagsFromString('--expose_gc');
  const gc = runInNewContext('gc') as () => void;
  setFlagsFromString('--no-expose_gc');
  const failure = new Error('read failure');
  const cleanup = { calls: 0 };
  const closed = failingIterator(failure, cleanup);
  await expect(closed.iterator.next()).rejects.toBe(failure);
  expect(cleanup.calls).toBe(1);
  await collect(gc);
  expect(closed.source.deref()).toBeUndefined();
  expect(closed.context.deref()).toBeUndefined();
  expect(closed.map.deref()).toBeUndefined();
  expect(closed.onError.deref()).toBeUndefined();
  expect(closed.onClose.deref()).toBeUndefined();
  // Keep the wrapper reachable during GC.
  expect(await closed.iterator.next()).toEqual({ done: true, value: undefined });
});

it('releases closed subscription contexts and keeps subscription churn bounded', async () => {
  setFlagsFromString('--expose_gc');
  const gc = runInNewContext('gc') as () => void;
  setFlagsFromString('--no-expose_gc');
  const events = new EventEmitter();
  const unread = subscription(events);
  await unread.iterator.return!();
  const closed = subscription(events);
  const read = closed.iterator.next();
  await closed.iterator.return!();
  await read;
  await collect(gc);
  expect(closed.source.deref()).toBeUndefined();
  expect(closed.context.deref()).toBeUndefined();
  expect(closed.onError.deref()).toBeUndefined();
  expect(unread.source.deref()).toBeUndefined();
  expect(unread.context.deref()).toBeUndefined();
  expect(unread.onError.deref()).toBeUndefined();
  // Keep both wrappers reachable during GC.
  await closed.iterator.next();
  await unread.iterator.next();

  async function churn(count: number) {
    for (let i = 0; i < count; i += 1) {
      const { iterator } = subscription(events);
      const pending = iterator.next();
      await iterator.return!();
      await pending;
    }
  }
  await churn(2_000);
  await collect(gc);
  const before = process.memoryUsage().heapUsed;
  await churn(18_000);
  await collect(gc);
  expect(events.listenerCount('event')).toBe(0);
  expect(process.memoryUsage().heapUsed - before).toBeLessThan(2 * 1024 * 1024);
}, 15_000);

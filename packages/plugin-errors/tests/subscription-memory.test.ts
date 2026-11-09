import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { wrapSubscriptionIterator } from '../src/subscription-iterator';

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
  const iterator = wrapSubscriptionIterator(source, onError);
  return {
    iterator,
    source: new WeakRef(source),
    context: new WeakRef(context),
    onError: new WeakRef(onError),
  };
}

it('releases closed subscription contexts and keeps subscription churn bounded', async () => {
  setFlagsFromString('--expose_gc');
  const gc = runInNewContext('gc') as () => void;
  setFlagsFromString('--no-expose_gc');
  const events = new EventEmitter();
  const closed = subscription(events);
  const read = closed.iterator.next();
  await closed.iterator.return!();
  await read;
  await collect(gc);
  expect(closed.source.deref()).toBeUndefined();
  expect(closed.context.deref()).toBeUndefined();
  expect(closed.onError.deref()).toBeUndefined();
  // Keep the closed wrapper rooted while checking that its request context is gone.
  await closed.iterator.next();

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

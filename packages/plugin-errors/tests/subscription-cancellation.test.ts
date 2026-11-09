import { EventEmitter } from 'node:events';
import SchemaBuilder from '@pothos/core';
import * as graphql from 'graphql';
import { createSourceEventStream, type ExecutionResult, parse, subscribe } from 'graphql';
import { vi } from 'vitest';
import ErrorsPlugin from '../src';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createChannel() {
  const waiting = deferred<void>();
  const pending = deferred<IteratorResult<number>>();
  const iterator: AsyncIterableIterator<number> = {
    next: vi.fn(() => {
      waiting.resolve();
      return pending.promise;
    }),
    return: vi.fn(() => {
      const result = { value: undefined, done: true as const };
      pending.resolve(result);
      return Promise.resolve(result);
    }),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  return { iterator, waiting: waiting.promise, emit: pending.resolve };
}

async function createSubscription(
  source: () => AsyncIterable<number> | Promise<AsyncIterable<number>>,
  withErrors = true,
  sourceOnly = false,
) {
  const builder = new SchemaBuilder<{}>({ plugins: withErrors ? [ErrorsPlugin] : [] });
  builder.objectType(Error, {
    name: 'Error',
    fields: (t) => ({ message: t.exposeString('message') }),
  });
  builder.queryType({ fields: (t) => ({ test: t.boolean({ resolve: () => true }) }) });
  builder.subscriptionType({
    fields: (t) => ({
      test: t.int({
        errors: withErrors ? { types: [Error] } : undefined,
        subscribe: source,
        resolve: (value) => value,
      }),
    }),
  });

  const args = {
    schema: builder.toSchema(),
    document: parse(withErrors ? 'subscription { test { __typename } }' : 'subscription { test }'),
  };
  const result = await (sourceOnly
    ? createSourceEventStream(
        // GraphQL 17 requires validated arguments; GraphQL 16 accepts ExecutionArgs directly.
        (graphql.validateSubscriptionArgs?.(args) ?? args) as Parameters<
          typeof createSourceEventStream
        >[0],
      )
    : subscribe(args));
  return (
    sourceOnly && Symbol.asyncIterator in result ? result[Symbol.asyncIterator]() : result
  ) as AsyncIterableIterator<ExecutionResult>;
}

describe('subscription cancellation', () => {
  it('releases listeners over repeated GraphQL subscriptions to a quiet channel', async () => {
    const events = new EventEmitter();
    for (let i = 0; i < 50; i += 1) {
      const channel = createChannel();
      const listener = (value: number) => channel.emit({ value, done: false });
      events.on('event', listener);
      const cleanup = vi.mocked(channel.iterator.return!).getMockImplementation()!;
      vi.mocked(channel.iterator.return!).mockImplementation((...args) => {
        events.off('event', listener);
        return cleanup(...args);
      });
      const subscription = await createSubscription(() => channel.iterator);
      const pending = subscription.next();
      await channel.waiting;
      expect(events.listenerCount('event')).toBe(1);
      await subscription.return!();
      await expect(pending).resolves.toEqual({ value: undefined, done: true });
      expect(events.listenerCount('event')).toBe(0);
    }
  });

  it('closes a quiet channel while next() is pending', async () => {
    const channel = createChannel();
    const subscription = await createSubscription(() => channel.iterator);
    const next = subscription.next();
    await channel.waiting;

    const returned = subscription.return!();
    await Promise.resolve();
    expect(channel.iterator.return).toHaveBeenCalledOnce();
    await expect(returned).resolves.toEqual({ value: undefined, done: true });
    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(channel.iterator.return).toHaveBeenCalledOnce();
  });

  it('closes the iterator returned by an iterable', async () => {
    const channel = createChannel();
    const subscription = await createSubscription(() => ({
      [Symbol.asyncIterator]: () => channel.iterator,
    }));
    const next = subscription.next();
    await channel.waiting;

    await subscription.return!();
    await expect(next).resolves.toEqual({ value: undefined, done: true });
    expect(channel.iterator.return).toHaveBeenCalledOnce();
  });

  it.each([false, true])('waits for async subscription setup (errors: %s)', async (withErrors) => {
    const channel = createChannel();
    const started = deferred<void>();
    const source = deferred<AsyncIterable<number>>();
    const pendingSubscription = createSubscription(() => {
      started.resolve();
      return source.promise;
    }, withErrors);
    await started.promise;
    let settled = false;
    pendingSubscription.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    source.resolve(channel.iterator);
    const subscription = await pendingSubscription;
    await subscription.return!();
    expect(channel.iterator.next).not.toHaveBeenCalled();
    expect(channel.iterator.return).toHaveBeenCalledOnce();
  });

  it.each([
    false,
    true,
  ])('starts setup immediately and closes before the first read (errors: %s)', async (withErrors) => {
    const channel = createChannel();
    const source = vi.fn(() => channel.iterator);
    const pending = createSubscription(source, withErrors);
    expect(source).toHaveBeenCalledOnce();
    const subscription = await pending;

    await expect(subscription.return!()).resolves.toEqual({ value: undefined, done: true });
    await expect(subscription.next()).resolves.toEqual({ value: undefined, done: true });
    expect(source).toHaveBeenCalledOnce();
    expect(channel.iterator.return).toHaveBeenCalledOnce();
  });

  it('cleans up only once when cancelled between events', async () => {
    const channel = createChannel();
    vi.mocked(channel.iterator.next).mockResolvedValueOnce({ value: 1, done: false });
    const subscription = await createSubscription(() => channel.iterator);

    await expect(subscription.next()).resolves.toMatchObject({ done: false });
    await subscription.return!();
    await subscription.return!();

    expect(channel.iterator.return).toHaveBeenCalledOnce();
  });

  it('does not deliver an event that arrives during cancellation', async () => {
    const channel = createChannel();
    const subscription = await createSubscription(() => channel.iterator);
    const next = subscription.next();
    await channel.waiting;

    const returned = subscription.return!();
    channel.emit({ value: 1, done: false });

    await expect(next).resolves.toEqual({ value: undefined, done: true });
    await returned;
    expect(channel.iterator.return).toHaveBeenCalledOnce();
  });

  it('finishes cancellation through GraphQL when source cleanup fails', async () => {
    const channel = createChannel();
    vi.mocked(channel.iterator.return!).mockImplementation(() => {
      channel.emit({ value: undefined, done: true });
      return Promise.reject(new Error('cleanup failed'));
    });
    const subscription = await createSubscription(() => channel.iterator);
    const next = subscription.next();
    await channel.waiting;

    // GraphQL versions differ in their return result, but cleanup must finish in either case.
    await subscription.return!();
    expect(channel.iterator.return).toHaveBeenCalled();
    await expect(next).resolves.toEqual({ value: undefined, done: true });
  });

  it.each([
    false,
    true,
  ])('maps iterator acquisition errors from subscription setup (async: %s)', async (asyncSetup) => {
    const failure = new Error('iterator acquisition failed');
    const source: AsyncIterable<number> = {
      [Symbol.asyncIterator]() {
        throw failure;
      },
    };
    const subscription = await createSubscription(() =>
      asyncSetup ? Promise.resolve(source) : source,
    );
    await expect(subscription.next()).resolves.toMatchObject({
      done: false,
      value: { data: { test: { __typename: 'Error' } } },
    });
    await expect(subscription.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it.each([false, true])('maps subscription setup failures (async: %s)', async (asyncSetup) => {
    const failure = new Error('subscription setup failed');
    const source = vi.fn(() => {
      if (asyncSetup) {
        return Promise.reject(failure);
      }
      throw failure;
    });
    const subscription = await createSubscription(source);
    expect(source).toHaveBeenCalledOnce();
    await expect(subscription.next()).resolves.toMatchObject({
      done: false,
      value: { data: { test: { __typename: 'Error' } } },
    });
    await expect(subscription.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('emits one error event without automatically retrying a failed source', async () => {
    const channel = createChannel();
    vi.mocked(channel.iterator.next).mockRejectedValue(new Error('pubsub offline'));
    const subscription = await createSubscription(() => channel.iterator);
    await expect(subscription.next()).resolves.toMatchObject({
      done: false,
      value: { data: { test: { __typename: 'Error' } } },
    });
    await expect(subscription.next()).resolves.toEqual({ value: undefined, done: true });
    expect(channel.iterator.next).toHaveBeenCalledOnce();
  });

  it('releases the source listener after its final handled error', async () => {
    const events = new EventEmitter();
    const listener = () => {};
    events.on('change', listener);
    const channel = createChannel();
    vi.mocked(channel.iterator.next).mockRejectedValue(new Error('pubsub offline'));
    vi.mocked(channel.iterator.return!).mockImplementation(() => {
      events.off('change', listener);
      return Promise.resolve({ value: undefined, done: true });
    });
    const subscription = await createSubscription(() => channel.iterator);
    const results = [];
    for await (const value of subscription) {
      results.push(value);
    }
    expect(results).toHaveLength(1);
    expect(events.listenerCount('change')).toBe(0);
    expect(channel.iterator.return).toHaveBeenCalledOnce();
  });

  it('emits a final error only once when concurrent source reads fail', async () => {
    const channel = createChannel();
    vi.mocked(channel.iterator.next).mockRejectedValue(new Error('pubsub offline'));
    const source = await createSubscription(() => channel.iterator, true, true);
    const results = await Promise.all([source.next(), source.next()]);
    expect(results.filter((result) => !result.done)).toHaveLength(1);
    expect(results.filter((result) => result.done)).toHaveLength(1);
    await expect(source.next()).resolves.toEqual({ value: undefined, done: true });
    expect(channel.iterator.next).toHaveBeenCalledTimes(2);
  });

  it('matches native iterator acquisition timing with and without the errors wrapper', async () => {
    const observations: boolean[][] = [];
    for (const withErrors of [false, true]) {
      const channel = createChannel();
      let ready = false;
      const acquired: boolean[] = [];
      const subscription = await createSubscription(() => {
        queueMicrotask(() => {
          ready = true;
        });
        return {
          [Symbol.asyncIterator]() {
            acquired.push(ready);
            return channel.iterator;
          },
        };
      }, withErrors);
      observations.push(acquired);
      await subscription.return!();
      expect(channel.iterator.return).toHaveBeenCalledOnce();
    }
    expect(observations[1]).toEqual(observations[0]);
  });
});

import SchemaBuilder from '@pothos/core';
import { parse, subscribe } from 'graphql';
import SmartSubscriptionsPlugin, { SubscriptionManager } from '../src';

it('cleans up a source that finishes registering after cancellation', async () => {
  const registered = new Set<string>();
  let finishRegistration!: () => void;
  const registration = new Promise<void>((resolve) => {
    finishRegistration = resolve;
  });
  const builder = new SchemaBuilder({
    plugins: [SmartSubscriptionsPlugin],
    smartSubscriptions: {
      debounceDelay: null,
      subscribe: async (name) => {
        await registration;
        registered.add(name);
      },
      unsubscribe: (name) => {
        registered.delete(name);
      },
    },
  });
  builder.queryType({
    fields: (t) => ({
      value: t.int({
        smartSubscription: true,
        subscribe: (subscriptions) => {
          subscriptions.register('change');
        },
        resolve: () => 1,
      }),
    }),
  });
  builder.subscriptionType({});
  const result = await subscribe({
    schema: builder.toSchema(),
    document: parse('subscription { value }'),
    contextValue: {},
  });
  if (!(Symbol.asyncIterator in result)) {
    throw new Error('Expected a subscription');
  }
  const iterator = result[Symbol.asyncIterator]();
  await iterator.next();
  await iterator.return?.();
  finishRegistration();
  await new Promise((resolve) => setImmediate(resolve));
  expect([...registered]).toEqual([]);
});

it.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])('coordinates replacement registrations (cancel replacement: %s, reject old setup: %s)', async (cancelReplacement, rejectOldSetup) => {
  const resources = new Map<string, number>();
  const callbacks: ((error: unknown, value: unknown) => void)[] = [];
  let keeper!: (error: unknown, value: unknown) => void;
  let finishRegistration!: () => void;
  const registration = new Promise<void>((resolve, reject) => {
    finishRegistration = () => {
      if (rejectOldSetup) {
        reject(new Error('old setup failed'));
      } else {
        resolve();
      }
    };
  });
  const manager = new SubscriptionManager({
    value: {},
    subscribe: async (name, callback) => {
      if (name === 'keeper') {
        keeper = callback;
        return;
      }
      callbacks.push(callback);
      const generation = callbacks.length;
      if (generation === 1) {
        await registration;
      }
      resources.set(name, generation);
    },
    unsubscribe: (name) => {
      resources.delete(name);
    },
  });
  await manager.next();
  manager.register({ name: 'change' });
  manager.register({ name: 'keeper' });
  const first = manager.next();
  keeper(null, 1);
  await first;

  // The next response no longer uses change, so its first generation is canceled.
  manager.register({ name: 'keeper' });
  const dropped = manager.next();
  await new Promise((resolve) => setImmediate(resolve));
  keeper(null, 2);
  await dropped;

  // Reintroduce the name before the first asynchronous setup has finished.
  manager.register({ name: 'keeper' });
  manager.register({ name: 'change' });
  expect(callbacks).toHaveLength(1);
  if (cancelReplacement) {
    await manager.return();
  }
  finishRegistration();
  await new Promise((resolve) => setImmediate(resolve));
  expect(callbacks).toHaveLength(cancelReplacement ? 1 : 2);
  expect([...resources]).toEqual(cancelReplacement ? [] : [['change', 2]]);
  if (!cancelReplacement) {
    const updated = manager.next();
    callbacks[1](null, 3);
    expect((await updated).done).toBe(false);
    await manager.return();
  }
  expect([...resources]).toEqual([]);
});

it('does not wait for a lifetime subscribe promise before returning', async () => {
  const manager = new SubscriptionManager({
    value: {},
    subscribe: () => new Promise<void>(() => {}),
    unsubscribe: () => {},
  });
  manager.register({ name: 'change' });
  expect((await manager.return()).done).toBe(true);
});

it('cleans up late setup after a source reports an error during subscribe', async () => {
  const resources = new Set<string>();
  const failure = new Error('source failed');
  let finishRegistration!: () => void;
  const registration = new Promise<void>((resolve) => {
    finishRegistration = resolve;
  });
  const manager = new SubscriptionManager({
    value: {},
    subscribe: async (name, callback) => {
      callback(failure, undefined);
      await registration;
      resources.add(name);
    },
    unsubscribe: (name) => {
      resources.delete(name);
    },
  });
  manager.register({ name: 'change' });
  await expect(manager.next()).rejects.toBe(failure);
  finishRegistration();
  await new Promise((resolve) => setImmediate(resolve));
  expect([...resources]).toEqual([]);
});

import { EventEmitter } from 'node:events';
import SchemaBuilder from '@pothos/core';
import { parse, subscribe } from 'graphql';
import SmartSubscriptionsPlugin from '../src';

it.each([
  'filter',
  'invalidateCache',
] as const)('closes a subscription when %s throws synchronously', async (callback) => {
  const events = new EventEmitter();
  const listeners = new Map<string, (value: unknown) => void>();
  const failure = new Error(`${callback} failed`);
  const builder = new SchemaBuilder({
    plugins: [SmartSubscriptionsPlugin],
    smartSubscriptions: {
      debounceDelay: null,
      subscribe: (name, _context, cb) => {
        const listener = (value: unknown) => cb(null, value);
        listeners.set(name, listener);
        events.on(name, listener);
      },
      unsubscribe: (name) => {
        events.off(name, listeners.get(name)!);
        listeners.delete(name);
      },
    },
  });
  builder.queryType({
    fields: (t) => ({
      value: t.int({
        smartSubscription: true,
        resolve: () => 1,
        subscribe: (subscriptions) => {
          subscriptions.register('change', {
            [callback]: () => {
              throw failure;
            },
          });
          subscriptions.register('other');
        },
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
    throw new Error('Expected subscription iterator');
  }
  const iterator = result[Symbol.asyncIterator]();
  try {
    expect((await iterator.next()).value).toEqual({ data: { value: 1 } });
    const next = iterator.next().then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    expect(() => events.emit('change', {})).not.toThrow();
    expect(await next).toEqual({ error: failure });
    // Cleanup may await each source's unsubscribe callback.
    await Promise.resolve();
    expect(events.listenerCount('change')).toBe(0);
    expect(events.listenerCount('other')).toBe(0);
  } finally {
    await iterator.return?.().catch(() => {});
  }
});

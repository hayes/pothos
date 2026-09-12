import SchemaBuilder from '@pothos/core';
import { type ExecutionResult, parse, subscribe } from 'graphql';
import SmartSubscriptionsPlugin from '../src';

describe('lists returned as non-array iterables', () => {
  it('refetches an object in a list resolved to a Set', async () => {
    let emit: ((err: unknown, value: unknown) => void) | undefined;

    const builder = new SchemaBuilder<{
      Context: {};
      SmartSubscriptions: string;
    }>({
      plugins: [SmartSubscriptionsPlugin],
      smartSubscriptions: {
        debounceDelay: null,
        subscribe: (_name, _context, cb) => {
          emit = cb;
        },
        unsubscribe: () => {},
      },
    });

    const Item = builder.objectRef<{ value: number }>('Item').implement({
      subscribe: (subscriptions) => {
        subscriptions.register('change', { refetch: () => ({ value: 2 }) });
      },
      fields: (t) => ({
        value: t.exposeInt('value'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        items: t.field({
          type: [Item],
          smartSubscription: true,
          resolve: () => new Set([{ value: 1 }]),
        }),
      }),
    });

    builder.subscriptionType({});

    const result = await subscribe({
      schema: builder.toSchema(),
      document: parse(`
        subscription {
          items {
            value
          }
        }
      `),
      contextValue: {},
    });

    if (!(Symbol.asyncIterator in result)) {
      throw new Error(JSON.stringify(result));
    }

    const iterator = (result as AsyncIterableIterator<ExecutionResult>)[Symbol.asyncIterator]();

    try {
      expect((await iterator.next()).value).toEqual({ data: { items: [{ value: 1 }] } });

      const next = iterator.next();

      emit!(null, {});

      expect((await next).value).toEqual({ data: { items: [{ value: 2 }] } });
    } finally {
      await iterator.return?.();
    }
  });
});

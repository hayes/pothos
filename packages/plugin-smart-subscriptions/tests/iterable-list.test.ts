import SchemaBuilder from '@pothos/core';
import { type ExecutionResult, type GraphQLSchema, parse, subscribe } from 'graphql';
import SmartSubscriptionsPlugin from '../src';

interface Item {
  value: number;
}

function createSchema(
  resolveItems: () => Iterable<Item>,
  refetchItem: (item: Item) => Item | null,
) {
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

  const ItemRef = builder.objectRef<Item>('Item').implement({
    subscribe: (subscriptions, item) => {
      const refetched = refetchItem(item);

      if (refetched) {
        subscriptions.register('change', { refetch: () => refetched });
      }
    },
    fields: (t) => ({
      value: t.exposeInt('value'),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      items: t.field({
        type: [ItemRef],
        smartSubscription: true,
        resolve: () => resolveItems(),
      }),
    }),
  });

  builder.subscriptionType({});

  return {
    schema: builder.toSchema(),
    emit: (value: unknown) => emit!(null, value),
  };
}

async function subscribeToItems(schema: GraphQLSchema) {
  const result = await subscribe({
    schema,
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

  return (result as AsyncIterableIterator<ExecutionResult>)[Symbol.asyncIterator]();
}

describe('lists returned as non-array iterables', () => {
  it('refetches an object in a list resolved to a Set', async () => {
    const { schema, emit } = createSchema(
      () => new Set([{ value: 1 }]),
      () => ({ value: 2 }),
    );

    const iterator = await subscribeToItems(schema);

    try {
      expect((await iterator.next()).value).toEqual({ data: { items: [{ value: 1 }] } });

      const next = iterator.next();

      emit({});

      expect((await next).value).toEqual({ data: { items: [{ value: 2 }] } });
    } finally {
      await iterator.return?.();
    }
  });

  it('keeps every entry of a single-use iterable when one is refetched', async () => {
    const { schema, emit } = createSchema(
      function* items() {
        yield { value: 1 };
        yield { value: 2 };
      },
      (item) => (item.value === 1 ? { value: 10 } : null),
    );

    const iterator = await subscribeToItems(schema);

    try {
      expect((await iterator.next()).value).toEqual({
        data: { items: [{ value: 1 }, { value: 2 }] },
      });

      const next = iterator.next();

      emit({});

      expect((await next).value).toEqual({
        data: { items: [{ value: 10 }, { value: 2 }] },
      });
    } finally {
      await iterator.return?.();
    }
  });
});

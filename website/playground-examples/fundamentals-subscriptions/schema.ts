import SchemaBuilder from '@pothos/core';

// A subscription needs a way to broadcast updates. The pattern here is
// a minimal async iterable — graphql-yoga, Apollo Server, and Mercurius
// all accept any AsyncIterableIterator from `subscribe`. In a real app
// you'd swap this for graphql-yoga's createPubSub, Redis pub/sub, etc.
async function* tick(): AsyncIterableIterator<number> {
  let n = 0;
  while (true) {
    yield ++n;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    health: t.string({ resolve: () => 'ok' }),
  }),
});

builder.subscriptionType({
  fields: (t) => ({
    counter: t.int({
      description: 'Emits an incrementing integer once a second.',
      subscribe: () => tick(),
      resolve: (value) => value,
    }),
  }),
});

export const schema = builder.toSchema();

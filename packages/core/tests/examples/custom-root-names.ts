import SchemaBuilder from '../../src';

const builder = new SchemaBuilder<{}>({});

builder.queryType({
  name: 'CustomQuery',
  fields: (t) => ({
    hello: t.string({
      resolve: () => 'world',
    }),
  }),
});

builder.mutationType({
  name: 'CustomMutation',
  fields: (t) => ({
    hello: t.string({
      resolve: () => 'world',
    }),
  }),
});

builder.subscriptionType({
  name: 'CustomSubscription',
  fields: (t) => ({
    hello: t.int({
      // biome-ignore lint/suspicious/useAwait: <explanation>
      subscribe: async function* () {
        for (let i = 0; i < 3; i++) {
          yield i;
        }
      },
      resolve: (i) => i,
    }),
  }),
});

export const schema = builder.toSchema();

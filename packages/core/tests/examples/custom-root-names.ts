import SchemaBuilder from '../../src';

const builder = new SchemaBuilder<{}>({});

builder.queryType({
  name: 'CustomQuery',
  fields: (t) => ({
    hello: t.string({
      resolve: () => 'world',
    }),
    query: t.field({
      type: QueryObject,
      resolve: () => ({}),
    }),
    mutation: t.field({
      type: MutationObject,
      resolve: () => ({}),
    }),
    subscription: t.field({
      type: SubscriptionObject,
      resolve: () => ({}),
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

const QueryObject = builder.objectRef<{}>('Query').implement({
  fields: (t) => ({
    id: t.id({
      resolve: () => '123',
    }),
  }),
});

const MutationObject = builder.objectRef<{}>('Mutation').implement({
  fields: (t) => ({
    id: t.id({
      resolve: () => '123',
    }),
  }),
});

const SubscriptionObject = builder.objectRef<{}>('Subscription').implement({
  fields: (t) => ({
    id: t.id({
      resolve: () => '123',
    }),
  }),
});

export const schema = builder.toSchema();

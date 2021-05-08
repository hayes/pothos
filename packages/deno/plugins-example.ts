import { printSchema } from 'https://cdn.skypack.dev/graphql@v15.5.0?dts';
import DirectivesPlugin from './packages/plugin-directives/mod.ts';
import MocksPlugin from './packages/plugin-mocks/mod.ts';
import RelayPlugin from './packages/plugin-relay/mod.ts';
import ScopeAuthPlugin from './packages/plugin-scope-auth/mod.ts';
import SimpleObjectsPlugin from './packages/plugin-simple-objects/mod.ts';
import SmartSubscriptionsPlugin from './packages/plugin-smart-subscriptions/mod.ts';
import SubGraphPlugin from './packages/plugin-sub-graph/mod.ts';
import ValidationPlugin from './packages/plugin-validation/mod.ts';
import DataloaderPlugin from './packages/plugin-dataloader/mod.ts';
import SchemaBuilder from './packages/core/mod.ts';

const builder = new SchemaBuilder<{
  AuthScopes: {
    user: boolean;
  };
}>({
  plugins: [
    ValidationPlugin,
    ScopeAuthPlugin,
    SubGraphPlugin,
    SmartSubscriptionsPlugin,
    SimpleObjectsPlugin,
    RelayPlugin,
    MocksPlugin,
    DirectivesPlugin,
    DataloaderPlugin,
  ],
  relayOptions: {
    nodeTypeOptions: {},
    nodeQueryOptions: {},
    nodesQueryOptions: {},
    pageInfoTypeOptions: {},
  },
  authScopes: () => ({
    user: true,
  }),
  smartSubscriptions: {
    subscribe: () => {},
    unsubscribe: () => {},
  },
  subGraphs: {
    defaultForFields: ['test'],
    defaultForTypes: ['test'],
  },
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      smartSubscription: true,
      args: {
        name: t.arg.string({
          validate: {
            minLength: 3,
          },
        }),
      },
      authScopes: {
        user: true,
      },
      resolve(_root, { name }) {
        return `hello, ${name || 'world'}`;
      },
    }),
  }),
});

builder.simpleObject('Simple', {
  fields: (t) => ({
    test: t.boolean({}),
  }),
});

builder.loadableObject('User', {
  load: (keys: string[]) => {
    return Promise.resolve(
      keys.map((id) => (Number(id) > 0 ? { id: Number(id) } : new Error(`Invalid ID ${id}`))),
    );
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});

builder.subscriptionType({});

const schema = builder.toSchema({ mocks: {}, subGraph: 'test' });

console.log(printSchema(schema));

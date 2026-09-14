import SchemaBuilder from '@pothos/core';
import { GraphQLObjectType, GraphQLSchema, GraphQLString, validateSchema } from 'graphql';
import AddGraphQLPlugin from '../src';

function root(name: string) {
  return new GraphQLObjectType({
    name,
    fields: { hello: { type: GraphQLString, resolve: () => 'hello' } },
  });
}

it.each([
  false,
  true,
])('preserves root roles in overlapping schema and type imports (local roots: %s)', (localRoots) => {
  const query = root('CustomQuery');
  const mutation = root('CustomMutation');
  const subscription = root('CustomSubscription');
  const builder = new SchemaBuilder({
    plugins: [AddGraphQLPlugin],
    add: {
      schema: new GraphQLSchema({ query, mutation, subscription }),
      types: [query, mutation, subscription],
    },
  });

  if (localRoots) {
    builder.queryType({ fields: (t) => ({ local: t.string({ resolve: () => 'local' }) }) });
    builder.mutationType({ fields: (t) => ({ local: t.string({ resolve: () => 'local' }) }) });
    builder.subscriptionType({
      fields: (t) => ({
        local: t.string({
          subscribe: async function* () {
            yield await Promise.resolve('local');
          },
          resolve: (value) => value,
        }),
      }),
    });
  }

  for (let build = 0; build < 2; build += 1) {
    const schema = builder.toSchema();
    expect(validateSchema(schema)).toEqual([]);
    expect(schema.getQueryType()?.name).toBe(localRoots ? 'Query' : 'CustomQuery');
    expect(schema.getMutationType()?.name).toBe(localRoots ? 'Mutation' : 'CustomMutation');
    expect(schema.getSubscriptionType()?.name).toBe(
      localRoots ? 'Subscription' : 'CustomSubscription',
    );
    for (const name of ['CustomQuery', 'CustomMutation', 'CustomSubscription']) {
      expect((schema.getType(name) as GraphQLObjectType).getFields().hello).toBeDefined();
    }
  }
});

import SchemaBuilder from '@pothos/core';
import {
  buildSchema,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  graphql,
  versionInfo,
} from 'graphql';
import AddGraphQLPlugin from '../src';

it('preserves SDL defaults on object arguments, interface arguments, and input fields', async () => {
  const original = buildSchema(`
    enum Order { ASC DESC }
    input Filter { order: Order = DESC enabled: Boolean = false limit: Int = 0 name: String = null }
    interface Named { value(prefix: String! = "default"): String }
    type Item implements Named { value(prefix: String! = "default"): String }
    type Query { item: Item echo(filter: Filter = {}): String }
  `);
  original.getQueryType()!.getFields().echo.resolve = (_, args) => JSON.stringify(args);
  original.getQueryType()!.getFields().item.resolve = () => ({
    value: ({ prefix }: { prefix: string }) => prefix,
  });
  const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin], add: { schema: original } });
  const schema = builder.toSchema({ sortSchema: false });
  expect(await graphql({ schema, source: '{ item { value } echo }' })).toEqual({
    data: {
      item: { value: 'default' },
      echo: '{"filter":{"order":"DESC","enabled":false,"limit":0,"name":null}}',
    },
  });
  expect(await graphql({ schema, source: '{ echo(filter: {}) }' })).toEqual({
    data: { echo: '{"filter":{"order":"DESC","enabled":false,"limit":0,"name":null}}' },
  });
  expect(await graphql({ schema, source: '{ echo(filter: null) }' })).toEqual({
    data: { echo: '{"filter":null}' },
  });
});

it.each([
  'legacy',
  'external',
] as const)('preserves %s programmatic argument defaults', async (format) => {
  if (format === 'external' && versionInfo.major < 17) {
    return;
  }
  const Value = new GraphQLScalarType({
    name: 'Value',
    serialize: (value) => value,
    parseValue: (value) => `parsed:${String(value)}`,
  });
  const original = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        echo: {
          type: GraphQLString,
          args: {
            value: {
              type: Value,
              ...(format === 'legacy'
                ? { defaultValue: 'parsed:hello' }
                : { default: { value: 'hello' } }),
            },
          },
          resolve: (_, { value }) => value,
        },
      },
    }),
  });
  const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin], add: { schema: original } });
  expect(await graphql({ schema: builder.toSchema(), source: '{ echo }' })).toEqual({
    data: { echo: 'parsed:hello' },
  });
});

import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import {
  buildSchema,
  type ConstValueNode,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  graphql,
  Kind,
  parseConstValue,
  print,
  versionInfo,
} from 'graphql';
import DirectivesPlugin from '../src';

it.each([
  'legacy',
  'external',
  'literal',
] as const)('preserves %s imported defaults in generated AST nodes', async (format) => {
  if (format !== 'legacy' && versionInfo.major < 17) {
    return;
  }
  const Order = new GraphQLEnumType({
    name: 'Order',
    values: { FIRST: { value: 1 }, LAST: { value: 2 } },
  });
  const defaultConfig = (external: string, internal: unknown) =>
    format === 'legacy'
      ? { defaultValue: internal }
      : {
          default:
            format === 'external'
              ? { value: external }
              : {
                  literal: parseConstValue(external === 'LAST' ? 'LAST' : JSON.stringify(external)),
                },
        };
  const Filter = new GraphQLInputObjectType({
    name: 'Filter',
    fields: { order: { type: new GraphQLNonNull(Order), ...defaultConfig('LAST', 2) } },
  });
  const original = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        hello: {
          type: GraphQLString,
          args: {
            name: { type: new GraphQLNonNull(GraphQLString), ...defaultConfig('world', 'world') },
            filter: { type: Filter },
          },
          resolve: (_, { name, filter }) => `${name}:${filter?.order}`,
        },
      },
    }),
  });
  const builder = new SchemaBuilder({
    plugins: [AddGraphQLPlugin, DirectivesPlugin],
    add: { schema: original },
  });
  const schema = builder.toSchema();
  const sdl = ['Filter', 'Order', 'Query']
    .map((name) => print(schema.getType(name)!.astNode!))
    .join('\n');
  expect(sdl).toContain('name: String! = "world"');
  expect(sdl).toContain('order: Order! = LAST');
  expect(await graphql({ schema, source: '{ hello(filter: {}) }' })).toEqual({
    data: { hello: 'world:2' },
  });
  const rebuilt = buildSchema(sdl);
  expect(
    await graphql({
      schema: rebuilt,
      source: '{ hello(filter: {}) }',
      rootValue: {
        hello: ({ name, filter }: { name: string; filter: { order: string } }) =>
          `${name}:${filter.order}`,
      },
    }),
  ).toEqual({ data: { hello: 'world:LAST' } });
});

it.skipIf(versionInfo.major < 17)(
  'uses external scalar values when printing imported defaults',
  () => {
    const Value = new GraphQLScalarType({
      name: 'Value',
      serialize: (value) => (value as { internal: string }).internal,
      parseValue: (value) => ({ internal: String(value) }),
      ...{
        valueToLiteral: (value: unknown): ConstValueNode => ({
          kind: Kind.STRING,
          value: String(value).toUpperCase(),
        }),
      },
    });
    const original = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          value: {
            type: GraphQLString,
            args: { input: { type: Value, default: { value: 'external' } } },
          },
        },
      }),
    });
    const builder = new SchemaBuilder({
      plugins: [AddGraphQLPlugin, DirectivesPlugin],
      add: { schema: original },
    });
    expect(print(builder.toSchema().getQueryType()!.astNode!)).toContain(
      'input: Value = "EXTERNAL"',
    );
  },
);

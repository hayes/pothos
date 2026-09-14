import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import DirectivesPlugin from '@pothos/plugin-directives';
import {
  buildSchema,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  graphql,
  parse,
  validate,
  versionInfo,
} from 'graphql';
import FederationPlugin from '../src';

it.skipIf(versionInfo.major < 17)(
  'publishes imported non-null argument defaults in the service SDL',
  async () => {
    const original = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          hello: {
            type: GraphQLString,
            args: {
              name: { type: new GraphQLNonNull(GraphQLString), ...{ default: { value: 'world' } } },
            },
            resolve: (_, { name }) => name,
          },
        },
      }),
    });
    const builder = new SchemaBuilder({
      plugins: [AddGraphQLPlugin, DirectivesPlugin, FederationPlugin],
      add: { schema: original },
    });
    const schema = builder.toSubGraphSchema({});
    expect(await graphql({ schema, source: '{ hello }' })).toEqual({ data: { hello: 'world' } });
    const result = await graphql({ schema, source: '{ _service { sdl } }' });
    expect(result.errors).toBeUndefined();
    const sdl = (result.data!._service as { sdl: string }).sdl;
    expect(sdl).toContain('hello(name: String! = "world")');

    // The federated consumer must accept the same omitted argument as the service.
    const rebuilt = buildSchema(sdl, { assumeValidSDL: true });
    expect(validate(rebuilt, parse('{ hello }'))).toEqual([]);
    expect(
      await graphql({
        schema: rebuilt,
        source: '{ hello }',
        rootValue: { hello: ({ name }: { name: string }) => name },
      }),
    ).toEqual({ data: { hello: 'world' } });
  },
);

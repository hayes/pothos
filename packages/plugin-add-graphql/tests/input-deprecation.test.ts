import SchemaBuilder from '@pothos/core';
import { GraphQLInputObjectType, GraphQLString, printSchema } from 'graphql';
import AddGraphQLPlugin from '../src';

describe('importing input types', () => {
  it('keeps deprecationReason on imported input fields', () => {
    const existingInput = new GraphQLInputObjectType({
      name: 'Legacy',
      fields: {
        old: { type: GraphQLString, deprecationReason: 'Use next' },
        next: { type: GraphQLString },
      },
    });

    const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin] });

    const Legacy = builder.addGraphQLInput<{ old?: string; next?: string }>(existingInput);

    builder.queryType({
      fields: (t) => ({
        hello: t.string({
          args: { input: t.arg({ type: Legacy }) },
          resolve: () => 'world',
        }),
      }),
    });

    const schema = builder.toSchema();

    expect(schema.getType('Legacy')).toBeDefined();
    expect(printSchema(schema)).toContain('old: String @deprecated(reason: "Use next")');
  });
});

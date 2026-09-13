import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import { buildSchema, validateSchema } from 'graphql';
import SubGraphPlugin from '../src';

describe.each([
  [AddGraphQLPlugin, SubGraphPlugin],
  [SubGraphPlugin, AddGraphQLPlugin],
] as const)('%s before %s', (first, second) => {
  it.each([
    {
      name: 'ordinary objects named Mutation and Subscription',
      source: `
        schema { query: Root }
        type Root { mutationObject: Mutation subscriptionObject: Subscription }
        type Mutation { value: String }
        type Subscription { value: String }
      `,
      roots: ['Root', undefined, undefined],
    },
    {
      name: 'custom operation root names',
      source: `
        schema { query: Read mutation: Write subscription: Events }
        type Read { value: String }
        type Write { value: String }
        type Events { value: String }
      `,
      roots: ['Read', 'Write', 'Events'],
    },
    {
      name: 'operation roots with swapped names',
      source: `
        schema { query: Mutation mutation: Query }
        type Mutation { subscriptionObject: Subscription }
        type Query { value: String }
        type Subscription { value: String }
      `,
      roots: ['Mutation', 'Query', undefined],
    },
  ])('preserves $name', ({ source, roots }) => {
    const builder = new SchemaBuilder<{ SubGraphs: 'public' }>({
      plugins: [first, second],
      add: { schema: buildSchema(source) },
      subGraphs: {
        defaultForTypes: ['public'],
        fieldsInheritFromTypes: true,
      },
    });

    const schema = builder.toSchema({ subGraph: 'public' });

    expect(validateSchema(schema)).toEqual([]);
    expect([
      schema.getQueryType()?.name,
      schema.getMutationType()?.name,
      schema.getSubscriptionType()?.name,
    ]).toEqual(roots);
  });
});

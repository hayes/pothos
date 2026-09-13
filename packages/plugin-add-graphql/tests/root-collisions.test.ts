import SchemaBuilder from '@pothos/core';
import {
  buildSchema,
  execute,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  lexicographicSortSchema,
  printSchema,
  validateSchema,
} from 'graphql';
import { gql } from 'graphql-tag';
import AddGraphQLPlugin from '../src';

interface Types {
  Context: {};
  Scalars: {
    DateTime: {
      Input: string;
      Output: string;
    };
  };
}

const DateTime = new GraphQLScalarType({ name: 'DateTime' });

function objectType(name: string, fields: Record<string, string>) {
  return new GraphQLObjectType({
    name,
    fields: () =>
      Object.fromEntries(
        Object.entries(fields).map(([fieldName, value]) => [
          fieldName,
          { type: GraphQLString, resolve: () => value },
        ]),
      ),
  });
}

function createBuilder(schema: GraphQLSchema) {
  return new SchemaBuilder<Types>({
    plugins: [AddGraphQLPlugin],
    add: { schema },
  });
}

function printSorted(schema: GraphQLSchema) {
  expect(validateSchema(schema)).toHaveLength(0);

  return printSchema(lexicographicSortSchema(schema));
}

describe('imported schema roots', () => {
  it('adds a root with a name of its own as a regular object type', () => {
    const builder = createBuilder(
      new GraphQLSchema({ query: objectType('Root', { hello: 'imported' }) }),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type Query {
        own: String
      }

      type Root {
        hello: String
      }"
    `);
  });

  it('merges a colliding root into a query type defined with queryType', () => {
    const builder = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type Query {
        hello: String
        own: String
      }"
    `);
  });

  it('merges a colliding root into a query type defined with queryFields', () => {
    const builder = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    builder.queryFields((t) => ({ own: t.string({ resolve: () => 'own' }) }));

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type Query {
        hello: String
        own: String
      }"
    `);
  });

  it('builds the same schema for queryType and queryFields', () => {
    const withQueryType = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    withQueryType.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    const withQueryFields = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    withQueryFields.queryFields((t) => ({ own: t.string({ resolve: () => 'own' }) }));

    expect(printSorted(withQueryType.toSchema())).toBe(printSorted(withQueryFields.toSchema()));
  });

  it('resolves fields merged from a colliding root', async () => {
    const builder = createBuilder(
      new GraphQLSchema({
        query: objectType('Query', { hello: 'imported' }),
        mutation: objectType('Mutation', { doIt: 'imported mutation' }),
      }),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    builder.mutationType({
      fields: (t) => ({ ownMutation: t.string({ resolve: () => 'own mutation' }) }),
    });

    const schema = builder.toSchema();

    expect(printSorted(schema)).toMatchInlineSnapshot(`
      "type Mutation {
        doIt: String
        ownMutation: String
      }

      type Query {
        hello: String
        own: String
      }"
    `);

    const result = await execute({
      schema,
      document: gql`
        query {
          hello
          own
        }
      `,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "hello": "imported",
          "own": "own",
        },
      }
    `);
  });

  it('merges root fields with arguments and referenced types', async () => {
    const builder = createBuilder(
      buildSchema(`
        type Query {
          thing(name: String!): Thing
        }

        type Thing {
          name: String
        }
      `),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    const schema = builder.toSchema();

    expect(printSorted(schema)).toMatchInlineSnapshot(`
      "type Query {
        own: String
        thing(name: String!): Thing
      }

      type Thing {
        name: String
      }"
    `);

    const result = await execute({
      schema,
      document: gql`
        query {
          thing(name: "thing") {
            name
          }
        }
      `,
      contextValue: {},
      rootValue: { thing: (args: { name: string }) => ({ name: args.name }) },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "thing": {
            "name": "thing",
          },
        },
      }
    `);
  });

  it('reports fields defined in both the builder and a colliding root', () => {
    const withQueryType = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    withQueryType.queryType({
      fields: (t) => ({ hello: t.string({ resolve: () => 'own' }) }),
    });

    const withQueryFields = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    withQueryFields.queryFields((t) => ({ hello: t.string({ resolve: () => 'own' }) }));

    expect(() => withQueryType.toSchema()).toThrowErrorMatchingInlineSnapshot(
      '[PothosSchemaError: Duplicate field hello on Query]',
    );
    expect(() => withQueryFields.toSchema()).toThrowErrorMatchingInlineSnapshot(
      '[PothosSchemaError: Duplicate field hello on Query]',
    );
  });

  it('adds roots that do not collide with configured types', () => {
    const builder = createBuilder(
      new GraphQLSchema({
        query: objectType('R', { hello: 'imported' }),
        mutation: objectType('M', { doIt: 'imported mutation' }),
      }),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "schema {
        query: Query
        mutation: M
      }

      type M {
        doIt: String
      }

      type Query {
        own: String
      }

      type R {
        hello: String
      }"
    `);
  });

  it('does not merge fields for types that are not roots of the imported schema', () => {
    const Thing = objectType('Thing', { a: 'imported a', b: 'imported b' });
    const builder = createBuilder(
      new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'ImportedQuery',
          fields: () => ({ thing: { type: Thing, resolve: () => ({}) } }),
        }),
      }),
    );

    builder.objectRef<{}>('Thing').implement({
      fields: (t) => ({ a: t.string({ resolve: () => 'own a' }) }),
    });

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type ImportedQuery {
        thing: Thing
      }

      type Query {
        own: String
      }

      type Thing {
        a: String
      }"
    `);
  });

  it('skips imported scalars that are already configured', () => {
    const builder = createBuilder(
      new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'ImportedQuery',
          fields: () => ({ when: { type: DateTime, resolve: () => '2020-01-01' } }),
        }),
      }),
    );

    builder.addScalarType('DateTime', DateTime);

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "scalar DateTime

      type ImportedQuery {
        when: DateTime
      }

      type Query {
        own: String
      }"
    `);
  });
});

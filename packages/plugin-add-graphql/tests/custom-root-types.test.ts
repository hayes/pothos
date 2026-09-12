import SchemaBuilder from '@pothos/core';
import {
  buildSchema,
  execute,
  GraphQLObjectType,
  GraphQLString,
  parse,
  printSchema,
  validateSchema,
} from 'graphql';
import AddGraphQLPlugin from '../src';

describe('importing schemas with custom operation root names', () => {
  it('keeps the operation root roles of the imported schema', async () => {
    const existingSchema = buildSchema(`
      schema {
        query: Root
        mutation: RootMutation
      }

      type Root {
        hello: String
      }

      type RootMutation {
        setHello(value: String): String
      }
    `);

    const rootType = existingSchema.getQueryType()!;
    rootType.getFields().hello.resolve = () => 'world';

    const builder = new SchemaBuilder({
      plugins: [AddGraphQLPlugin],
      add: { schema: existingSchema },
    });

    const schema = builder.toSchema();

    expect(validateSchema(schema)).toStrictEqual([]);
    expect(schema.getQueryType()?.name).toBe('Root');
    expect(schema.getMutationType()?.name).toBe('RootMutation');
    expect(printSchema(schema)).toContain('schema {\n  query: Root\n  mutation: RootMutation\n}');

    const result = await execute({ schema, document: parse('{ hello }') });

    expect(result.data).toEqual({ hello: 'world' });
  });

  it('does not re-declare an operation root the builder already defines', () => {
    const existingSchema = buildSchema(`
      schema {
        query: Root
      }

      type Root {
        hello: String
        secret: String
      }
    `);

    const builder = new SchemaBuilder({
      plugins: [AddGraphQLPlugin],
      add: { schema: existingSchema },
    });

    builder.queryType({
      fields: (t) => ({
        ownField: t.string({ resolve: () => 'own' }),
      }),
    });

    const schema = builder.toSchema();

    expect(schema.getQueryType()?.name).toBe('Query');
    expect(Object.keys(schema.getQueryType()!.getFields())).toStrictEqual(['ownField']);
    expect(printSchema(schema)).not.toContain('schema {');
  });

  it('does not infer roots from the names of non-root imported types', () => {
    const existingSchema = buildSchema(`
      schema {
        query: Root
      }

      type Root {
        other: Query
      }

      type Query {
        hello: String
      }
    `);

    const builder = new SchemaBuilder({
      plugins: [AddGraphQLPlugin],
      add: { schema: existingSchema },
    });

    const schema = builder.toSchema();

    expect(validateSchema(schema)).toStrictEqual([]);
    expect(schema.getQueryType()?.name).toBe('Root');
    expect(Object.keys(schema.getQueryType()!.getFields())).toStrictEqual(['other']);
    expect(Object.keys((schema.getType('Query') as GraphQLObjectType).getFields())).toStrictEqual([
      'hello',
    ]);
  });

  it('does not infer mutation or subscription roots from type names', () => {
    const existingSchema = buildSchema(`
      schema {
        query: Root
        mutation: RootMutation
        subscription: RootSubscription
      }

      type Root {
        other: Mutation
        another: Subscription
      }

      type RootMutation {
        doIt: String
      }

      type RootSubscription {
        watch: String
      }

      type Mutation {
        hello: String
      }

      type Subscription {
        hello: String
      }
    `);

    const builder = new SchemaBuilder({
      plugins: [AddGraphQLPlugin],
      add: { schema: existingSchema },
    });

    const schema = builder.toSchema();

    expect(schema.getMutationType()?.name).toBe('RootMutation');
    expect(schema.getSubscriptionType()?.name).toBe('RootSubscription');
    expect(Object.keys(schema.getMutationType()!.getFields())).toStrictEqual(['doIt']);
    expect(Object.keys(schema.getSubscriptionType()!.getFields())).toStrictEqual(['watch']);
    expect(
      Object.keys((schema.getType('Mutation') as GraphQLObjectType).getFields()),
    ).toStrictEqual(['hello']);
    expect(
      Object.keys((schema.getType('Subscription') as GraphQLObjectType).getFields()),
    ).toStrictEqual(['hello']);
  });

  it('still infers the root from the type name for standalone imports', () => {
    const existingQuery = new GraphQLObjectType({
      name: 'Query',
      fields: { hello: { type: GraphQLString, resolve: () => 'world' } },
    });

    const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin] });

    builder.addGraphQLObject(existingQuery);

    const schema = builder.toSchema();

    expect(schema.getQueryType()?.name).toBe('Query');
    expect(Object.keys(schema.getQueryType()!.getFields())).toStrictEqual(['hello']);
  });

  it('still merges imported roots that use the default names', () => {
    const existingSchema = buildSchema(`
      type Query {
        hello: String
      }
    `);

    const builder = new SchemaBuilder({
      plugins: [AddGraphQLPlugin],
      add: { schema: existingSchema },
    });

    builder.queryFields((t) => ({
      ownField: t.string({ resolve: () => 'own' }),
    }));

    const schema = builder.toSchema();

    expect(schema.getQueryType()?.name).toBe('Query');
    expect(Object.keys(schema.getQueryType()!.getFields()).sort()).toStrictEqual([
      'hello',
      'ownField',
    ]);
  });
});

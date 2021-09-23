import {
  execute,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  lexicographicSortSchema,
  printSchema,
} from 'graphql';
import gql from 'graphql-tag';
import SchemaBuilder from '@giraphql/core';
import schema from './example/schema';

describe('extends example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(schema))).toMatchSnapshot();
  });

  it('has expected directives in extensions', () => {
    const types = schema.getTypeMap();

    expect(types.Obj.extensions?.directives).toStrictEqual({ o: { foo: 123 } });
    expect(types.Query.extensions?.directives).toStrictEqual({
      o: { foo: 123 },
      rateLimit: { limit: 1, duration: 5 },
    });

    const testField = (types.Query as GraphQLObjectType).getFields().test;

    expect(testField.extensions?.directives).toStrictEqual({ f: [{ foo: 123 }] });
    expect(testField.args[0].extensions?.directives).toStrictEqual({ a: { foo: 123 } });

    expect(types.IF.extensions?.directives).toStrictEqual({ i: { foo: 123 } });
    expect(types.UN.extensions?.directives).toStrictEqual({ u: { foo: 123 } });
    expect(types.EN.extensions?.directives).toStrictEqual({ e: { foo: 123 } });
    expect((types.EN as GraphQLEnumType).getValue('ONE')?.extensions?.directives).toStrictEqual({
      ev: { foo: 123 },
    });
    expect(types.Date.extensions?.directives).toStrictEqual({ s: { foo: 123 } });
    expect(types.In.extensions?.directives).toStrictEqual({ io: { foo: 123 } });
    expect(
      (types.In as GraphQLInputObjectType).getFields().test.extensions?.directives,
    ).toStrictEqual({ if: { foo: 123 } });
  });

  it('gatsby format', () => {
    const builder = new SchemaBuilder<{
      Directives: {
        rateLimit: {
          locations: 'FIELD_DEFINITION' | 'OBJECT';
          args: {
            limit: number;
            duration: number;
          };
        };
      };
    }>({
      plugins: ['directives'],
    });

    builder.queryType({
      directives: {
        rateLimit: { limit: 5, duration: 60 },
      },
    });

    const types = builder.toSchema({}).getTypeMap();

    expect(types.Query.extensions?.directives).toStrictEqual([
      {
        name: 'rateLimit',
        args: { limit: 5, duration: 60 },
      },
    ]);
  });

  it('rate limits', async () => {
    const query = gql`
      query {
        test
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: () => ({}),
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "test": "hi",
        },
      }
    `);

    const result2 = await execute({
      schema,
      document: query,
      contextValue: () => ({}),
    });

    expect(result2).toMatchInlineSnapshot(`
      Object {
        "data": null,
        "errors": Array [
          [GraphQLError: Too many requests, please try again in 5 seconds.],
        ],
      }
    `);
  });
});

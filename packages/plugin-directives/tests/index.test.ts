import {
  execute,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  Kind,
  lexicographicSortSchema,
  printSchema,
} from 'graphql';
import gql from 'graphql-tag';
import SchemaBuilder from '@pothos/core';
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

  it('constructs the astNode with defaultValue for inputs and args', () => {
    const types = schema.getTypeMap();

    const testField = (types.Query as GraphQLObjectType).getFields().test;

    const arg1 = testField.args[0];
    const myInput = testField.args[1];
    const myOtherInput = testField.args[2];

    expect(arg1.astNode?.defaultValue).toBeUndefined();
    expect(myInput.astNode?.defaultValue).toBeUndefined();
    expect(myOtherInput.astNode?.defaultValue).toBeDefined();
    expect(myOtherInput.astNode?.defaultValue).toStrictEqual({
      kind: Kind.OBJECT,
      fields: [],
    });

    const MyInput = (types.MyInput as GraphQLInputObjectType).getFields();

    expect(MyInput.booleanWithDefault.astNode?.defaultValue).toStrictEqual({
      kind: Kind.BOOLEAN,
      value: false,
    });
    expect(MyInput.enumWithDefault.astNode?.defaultValue).toStrictEqual({
      kind: Kind.ENUM,
      value: 'TWO',
    });
    expect(MyInput.idWithDefault.astNode?.defaultValue).toStrictEqual({
      kind: Kind.INT,
      value: '123',
    });
    expect(MyInput.stringWithDefault.astNode?.defaultValue).toStrictEqual({
      kind: Kind.STRING,
      value: 'default string',
    });
    expect(MyInput.idsWithDefault.astNode?.defaultValue).toStrictEqual({
      kind: Kind.LIST,
      values: [
        { kind: Kind.INT, value: '123' },
        { kind: Kind.INT, value: '456' },
      ],
    });
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

    const types = builder.toSchema().getTypeMap();

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
      {
        "data": {
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
      {
        "data": {
          "test": null,
        },
        "errors": [
          [GraphQLError: Too many requests, please try again in 5 seconds.],
        ],
      }
    `);
  });
});

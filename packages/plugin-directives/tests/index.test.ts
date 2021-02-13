import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  lexicographicSortSchema,
  printSchema,
} from 'graphql';
import SchemaBuilder from '@giraphql/core';
import exampleSchema from './example/schema';

describe('extends example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });

  test('has expected directives in extensions', () => {
    const types = exampleSchema.getTypeMap();

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

  test('gatsby format', () => {
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
});

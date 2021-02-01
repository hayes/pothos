import {
  printSchema,
  lexicographicSortSchema,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from 'graphql';
import exampleSchema from './example/schema';

describe('extends example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });

  test('has expected directives in extensions', () => {
    const types = exampleSchema.getTypeMap();

    expect(types.Obj.extensions?.directives).toStrictEqual([{ args: { foo: 123 }, name: 'o' }]);
    expect(types.Query.extensions?.directives).toStrictEqual([{ args: { foo: 123 }, name: 'o' }]);

    const testField = (types.Query as GraphQLObjectType).getFields().test;

    expect(testField.extensions?.directives).toStrictEqual([{ args: { foo: 123 }, name: 'f' }]);
    expect(testField.args[0].extensions?.directives).toStrictEqual([
      { args: { foo: 123 }, name: 'a' },
    ]);

    expect(types.IF.extensions?.directives).toStrictEqual([{ args: { foo: 123 }, name: 'i' }]);
    expect(types.UN.extensions?.directives).toStrictEqual([{ args: { foo: 123 }, name: 'u' }]);
    expect(types.EN.extensions?.directives).toStrictEqual([{ args: { foo: 123 }, name: 'e' }]);
    expect((types.EN as GraphQLEnumType).getValue('ONE')?.extensions?.directives).toStrictEqual([
      { args: { foo: 123 }, name: 'ev' },
    ]);
    expect(types.Date.extensions?.directives).toStrictEqual([{ args: { foo: 123 }, name: 's' }]);
    expect(types.In.extensions?.directives).toStrictEqual([{ args: { foo: 123 }, name: 'io' }]);
    expect(
      (types.In as GraphQLInputObjectType).getFields().test.extensions?.directives,
    ).toStrictEqual([{ args: { foo: 123 }, name: 'if' }]);
  });
});

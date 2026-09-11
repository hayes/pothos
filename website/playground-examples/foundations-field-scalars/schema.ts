import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region field-method
builder.queryType({
  fields: (t) => ({
    name: t.field({
      description: 'Name field',
      type: 'String',
      resolve: () => 'Gina',
    }),
  }),
});
// #endregion field-method

// #region convenience-methods
builder.queryFields((t) => ({
  id: t.id({ resolve: () => '123' }),
  int: t.int({ resolve: () => 123 }),
  float: t.float({ resolve: () => 1.23 }),
  boolean: t.boolean({ resolve: () => false }),
  string: t.string({ resolve: () => 'abc' }),
  idList: t.idList({ resolve: () => ['123'] }),
  intList: t.intList({ resolve: () => [123] }),
  floatList: t.floatList({ resolve: () => [1.23] }),
  booleanList: t.booleanList({ resolve: () => [false] }),
  stringList: t.stringList({ resolve: () => ['abc'] }),
}));
// #endregion convenience-methods

export const schema = builder.toSchema();

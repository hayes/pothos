import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region fields
builder.queryType({
  fields: (t) => ({
    example: t.field({
      type: t.listRef(
        t.listRef('String'),
        // items are non-nullable by default, this can be overridden
        // by passing `nullable: true`
        { nullable: true },
      ),
      resolve: () => {
        return [['a', 'b'], ['c', 'd'], null];
      },
    }),
  }),
});
// #endregion fields

export const schema = builder.toSchema();

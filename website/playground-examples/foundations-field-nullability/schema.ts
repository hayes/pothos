import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region fields
builder.queryType({
  fields: (t) => ({
    nonNullableField: t.field({
      type: 'String',
      nullable: false,
      resolve: () => 'Gina',
    }),
    nonNullableString: t.string({
      nullable: false,
      resolve: () => 'Gina',
    }),
    nonNullableList: t.field({
      type: ['String'],
      nullable: false,
      resolve: () => ['Gina', 'James'],
    }),
    sparseList: t.field({
      type: ['String'],
      nullable: {
        list: false,
        items: true,
      },
      resolve: () => [null],
    }),
  }),
});
// #endregion fields

export const schema = builder.toSchema();

import SchemaBuilder from '@pothos/core';

// #region builder
const builder = new SchemaBuilder<{
  Scalars: {
    ID: { Input: string; Output: string };
  };
}>({});
// #endregion builder

builder.queryType({
  fields: (t) => ({
    echo: t.id({
      args: { id: t.arg.id({ required: true }) },
      resolve: (_parent, { id }) => id,
    }),
    inputType: t.string({
      args: { id: t.arg.id({ required: true }) },
      resolve: (_parent, { id }) => typeof id,
    }),
  }),
});
export const schema = builder.toSchema();

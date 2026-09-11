// #region schema
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder<{
  Context: { requestId: string };
}>({});

builder.queryType({
  fields: (t) => ({
    requestId: t.string({
      resolve: (_parent, _args, context) => context.requestId,
    }),
  }),
});

export const schema = builder.toSchema();
// #endregion schema

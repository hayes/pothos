// #region builder
import SchemaBuilder from '@pothos/core';

interface PothosTypes {
  Context: {
    user: {
      id: string;
    };
  };
}

const builder = new SchemaBuilder<PothosTypes>({});
// #endregion builder

builder.queryType({
  fields: (t) => ({ viewerId: t.id({ resolve: (_parent, _args, context) => context.user.id }) }),
});
export const schema = builder.toSchema();

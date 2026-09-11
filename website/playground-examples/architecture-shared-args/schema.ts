// #region helper
import SchemaBuilder, { type ArgBuilder } from '@pothos/core';

const builder = new SchemaBuilder({});
type BuilderTypes = typeof builder.$inferSchemaTypes;

function createCommonArgs(arg: ArgBuilder<BuilderTypes>) {
  return {
    id: arg.id({}),
    reason: arg({ type: 'String', required: false }),
  };
}

builder.mutationType({
  fields: (t) => ({
    mutation1: t.boolean({
      args: {
        ...createCommonArgs(t.arg),
      },
      resolve: (_parent, args) => !!args.reason,
    }),
    mutation2: t.boolean({
      args: {
        ...createCommonArgs(t.arg),
      },
      resolve: (_parent, args) => !!args.reason,
    }),
  }),
});
// #endregion helper

builder.queryType({ fields: (t) => ({ ready: t.boolean({ resolve: () => true }) }) });

export const schema = builder.toSchema();

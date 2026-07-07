// #region imports
import SchemaBuilder from '@pothos/core';
// #endregion imports

// #region context-type
interface Context {
  user?: { id: number; name: string };
}
// #endregion context-type

// #region builder-init
const builder = new SchemaBuilder<{
  Context: Context;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
  };
}>({});
// #endregion builder-init

// The runtime implementation for the DateTime scalar declared in the
// generic above (see the Scalars guide).
builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => {
    if (typeof value !== 'string') {
      throw new Error('DateTime must be an ISO 8601 string');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid DateTime');
    }
    return date;
  },
});

builder.queryType({
  fields: (t) => ({
    me: t.string({
      nullable: true,
      resolve: (_root, _args, ctx) => ctx.user?.name ?? null,
    }),
  }),
});

// #region export
export const schema = builder.toSchema();
// #endregion export

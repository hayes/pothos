// #region imports
import SchemaBuilder from '@pothos/core';
// #endregion imports

// You always start by creating a builder. Everything else hangs off it.
// #region builder
const builder = new SchemaBuilder({});
// #endregion builder

// The Query root is required for any GraphQL schema, even if it has
// no fields yet.
// #region query
builder.queryType({
  fields: (t) => ({
    health: t.string({ resolve: () => 'ok' }),
  }),
});
// #endregion query

// #region export
export const schema = builder.toSchema();
// #endregion export

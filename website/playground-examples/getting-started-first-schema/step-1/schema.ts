import SchemaBuilder from '@pothos/core';

// You always start by creating a builder. Everything else hangs off it.
const builder = new SchemaBuilder({});

// The Query root is required for any GraphQL schema, even if it has
// no fields yet.
builder.queryType({
  fields: (t) => ({
    health: t.string({ resolve: () => 'ok' }),
  }),
});

export const schema = builder.toSchema();

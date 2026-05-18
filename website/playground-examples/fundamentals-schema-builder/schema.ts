import SchemaBuilder from '@pothos/core';

// The generic argument to SchemaBuilder is a single types map. The
// most-used slot is Context — the shape passed to every resolver.
interface Context {
  userId?: string;
}

const builder = new SchemaBuilder<{
  Context: Context;
}>({});

// Once you have a builder, every type, field, and root operation is
// defined on it. Plugins, if any, plug into this same generic via the
// second `plugins: []` entry of the constructor options.

builder.queryType({
  fields: (t) => ({
    me: t.string({
      nullable: true,
      resolve: (_root, _args, ctx) => ctx.userId ?? null,
    }),
  }),
});

export const schema = builder.toSchema();

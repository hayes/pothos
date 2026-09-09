import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: { name: t.arg.string() },
      resolve: (_root, { name }) => `Hello, ${name ?? 'friend'}.`,
    }),
  }),
});

export const schema = builder.toSchema();

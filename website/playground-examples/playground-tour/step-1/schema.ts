import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region query
builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      nullable: false,
      args: { name: t.arg.string({ required: true }) },
      resolve: (_parent, args) => `Hello, ${args.name}!`,
    }),
  }),
});
// #endregion query

export const schema = builder.toSchema();

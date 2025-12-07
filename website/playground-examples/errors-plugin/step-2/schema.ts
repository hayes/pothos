import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';

const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin],
  errors: {
    defaultTypes: [],
    // onResolvedError: (error) => console.error('Handled error:', error),
  },
});

builder.objectType(Error, {
  name: 'Error',
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      errors: {
        types: [Error],
      },
      args: {
        name: t.arg.string({ required: false }),
      },
      resolve: (_parent, { name }) => {
        if (name && name.slice(0, 1) !== name.slice(0, 1).toUpperCase()) {
          throw new Error('name must be capitalized');
        }

        return `hello, ${name || 'World'}`;
      },
    }),
  }),
});

export const schema = builder.toSchema();

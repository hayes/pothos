import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '@pothos/plugin-with-input';

const builder = new SchemaBuilder({
  plugins: [WithInputPlugin],
  // optional
  withInput: {
    typeOptions: {
      // default options for Input object types created by this plugin
    },
    argOptions: {
      // set required: false to override default behavior
    },
  },
});

builder.queryType({
  fields: (t) => ({
    example: t.fieldWithInput({
      input: {
        // Note that this uses a new t.input field builder for defining input fields
        id: t.input.id({ required: true }),
      },
      type: 'ID',
      resolve: (_root, args) => args.input.id,
    }),
  }),
});

export const schema = builder.toSchema();

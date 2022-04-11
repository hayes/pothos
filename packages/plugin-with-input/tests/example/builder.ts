import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '../../src';

export default new SchemaBuilder({
  plugins: [WithInputPlugin],
  withInput: {
    argOptions: {
      description: 'input arg',
    },
  },
});

const builderWithNonRequireInputs = new SchemaBuilder<{ WithInputArgRequired: false }>({
  plugins: [WithInputPlugin],
  withInput: {
    argOptions: {
      required: false,
      description: 'input arg',
    },
  },
});

builderWithNonRequireInputs.queryType({
  fields: (t) => ({
    default: t.fieldWithInput({
      type: 'Boolean',
      input: {
        example: t.input.boolean({
          required: true,
        }),
      },
      resolve: (root, args) => {
        // @ts-expect-error input is not required
        const result = args.input.example;

        return result;
      },
    }),
    overwrite: t.fieldWithInput({
      type: 'Boolean',
      argOptions: {
        required: true,
      },
      input: {
        example: t.input.boolean({
          required: true,
        }),
      },
      resolve: (root, args) => {
        const result = args.input.example;

        return result;
      },
    }),
  }),
});

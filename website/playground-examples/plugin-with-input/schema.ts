import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '@pothos/plugin-with-input';

const builder = new SchemaBuilder({ plugins: [WithInputPlugin] });
builder.queryType({
  fields: (t) => ({
    // #region default-input
    echo: t.fieldWithInput({
      type: 'ID',
      input: { id: t.input.id({ required: true }) },
      resolve: (_, { input }) => input.id,
    }),
    // #endregion default-input
    // #region custom-input
    lookup: t.fieldWithInput({
      type: 'ID',
      typeOptions: { name: 'LookupInput' },
      argOptions: { name: 'criteria' },
      input: { id: t.input.id({ required: true }) },
      resolve: (_, { criteria }) => criteria.id,
    }),
    // #endregion custom-input
    // #region optional-input
    optional: t.fieldWithInput({
      type: 'String',
      argOptions: { required: false },
      input: { name: t.input.string() },
      resolve: (_, { input }) => input?.name ?? 'Anonymous',
    }),
    // #endregion optional-input
  }),
});
export const schema = builder.toSchema();

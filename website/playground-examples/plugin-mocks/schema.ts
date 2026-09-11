import SchemaBuilder from '@pothos/core';
import MocksPlugin from '@pothos/plugin-mocks';
const builder = new SchemaBuilder({ plugins: [MocksPlugin] });
// #region fields
builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      resolve: () => {
        throw new Error('Not implemented');
      },
    }),
    untouched: t.string({ resolve: () => 'Original resolver' }),
  }),
});
// #endregion fields
// #region mocks
export const schema = builder.toSchema({
  mocks: {
    Query: {
      greeting: () => 'Mock result!',
    },
  },
});
// #endregion mocks

// #region annotation
import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';

const builder = new SchemaBuilder<{
  Directives: {
    rateLimit: {
      locations: 'FIELD_DEFINITION';
      args: { limit: number; duration: number };
    };
  };
}>({
  plugins: [DirectivesPlugin],
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      directives: [{ name: 'rateLimit', args: { limit: 5, duration: 60 } }],
      resolve: () => 'world',
    }),
  }),
});
// #endregion annotation

builder.queryField('recordedDirectives', (t) =>
  t.string({
    resolve: () => JSON.stringify(schema.getQueryType()!.getFields().hello.extensions.directives),
  }),
);

export const schema = builder.toSchema();

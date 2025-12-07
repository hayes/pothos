import SchemaBuilder from '@pothos/core';
import DirectivePlugin from '@pothos/plugin-directives';

const builder = new SchemaBuilder<{
  Directives: {
    rateLimit: {
      locations: 'OBJECT' | 'FIELD_DEFINITION';
      args: { limit: number; duration: number };
    };
  };
}>({
  plugins: [DirectivePlugin],
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
});

builder.queryType({
  directives: {
    rateLimit: { limit: 5, duration: 60 },
  },
  fields: (t) => ({
    hello: t.string({ resolve: () => 'world' }),
  }),
});

export const schema = builder.toSchema();

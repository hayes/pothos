import SchemaBuilder from '@pothos/core';
import { pluginName } from './plugin';

const builder = new SchemaBuilder({
  plugins: [pluginName],
  logLabel: 'Request',
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({ resolve: () => 'Hello' }),
    goodbye: t.string({ resolve: async () => 'Goodbye' }),
  }),
});

export const schema = builder.toSchema();

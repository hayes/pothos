import SchemaBuilder from '@pothos/core';
import { pluginName } from './plugin';

const builder = new SchemaBuilder({ plugins: [pluginName] });

builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      extensions: { normalizeName: true },
      args: { name: t.arg.string({ required: true }) },
      resolve: (_parent, { name }) => {
        if (name === 'broken') {
          throw new Error('Greeting unavailable');
        }
        return `Hello, ${name}!`;
      },
    }),
  }),
});

export const schema = builder.toSchema();

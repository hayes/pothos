import SchemaBuilder from '@pothos/core';
import { pluginName } from './plugin';

const builder = new SchemaBuilder({ plugins: [pluginName] });
const Input = builder.inputType('NamesInput', {
  fields: (t) => ({ names: t.stringList({ required: true, extensions: { trimInput: true } }) }),
});
builder.queryType({
  fields: (t) => ({
    names: t.stringList({
      args: {
        first: t.arg.string({ required: true, extensions: { trimInput: true } }),
        others: t.arg({ type: Input, required: true }),
      },
      resolve: (_parent, args) => [args.first, ...args.others.names],
    }),
  }),
});
export const schema = builder.toSchema();

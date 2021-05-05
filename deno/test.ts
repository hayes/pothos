import { printSchema } from 'https://cdn.skypack.dev/graphql@v15.5.0?dts';
import ValidationPlugin from './packages/plugin-validation/index.ts';

import SchemaBuilder from './packages/core/index.ts';

const builder = new SchemaBuilder({
  plugins: [ValidationPlugin],
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({
          validate: {
            minLength: 3,
          },
        }),
      },
      resolve(_root, { name }) {
        return `hello, ${name || 'world'}`;
      },
    }),
  }),
});

const schema = builder.toSchema({});

console.log(printSchema(schema));

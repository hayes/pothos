// #region schema
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField, wrapResolver } from '@pothos/plugin-tracing';

const builder = new SchemaBuilder<{
  Tracing: boolean | { label: string };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, options, config) =>
      wrapResolver(resolver, (error, duration) => {
        const label =
          typeof options === 'object' ? options.label : `${config.parentType}.${config.name}`;
        console.log(`${label}: ${duration}ms`, error);
      }),
  },
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      tracing: { label: 'greeting' },
      args: { name: t.arg.string() },
      resolve: (_parent, { name }) => `hello, ${name ?? 'World'}`,
    }),
  }),
});

export const schema = builder.toSchema();
// #endregion schema

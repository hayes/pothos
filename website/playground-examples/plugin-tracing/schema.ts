// #region schema
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField, wrapResolver } from '@pothos/plugin-tracing';

const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, _options, config) =>
      wrapResolver(resolver, (error, duration) => {
        console.log(`${config.parentType}.${config.name}: ${duration}ms`, error);
      }),
  },
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: { name: t.arg.string() },
      resolve: (_parent, { name }) => `hello, ${name ?? 'World'}`,
    }),
  }),
});

export const schema = builder.toSchema();
// #endregion schema

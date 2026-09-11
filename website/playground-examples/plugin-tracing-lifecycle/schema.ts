import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField, runFunction } from '@pothos/plugin-tracing';

const events: string[] = [];

// #region tracer
const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver) => (parent, args, context, info) => {
      events.push(`start ${info.fieldName}`);
      console.log(`Starting ${info.parentType.name}.${info.fieldName}`);
      return runFunction(
        () => resolver(parent, args, context, info),
        (error, duration) => {
          events.push(`end ${info.fieldName}: ${error === null ? 'ok' : 'error'}`);
          console.log(`Finished ${info.parentType.name}.${info.fieldName}: ${duration}ms`, error);
        },
      );
    },
  },
});
// #endregion tracer

builder.queryType({ fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }) });

// #region lifecycle
builder.mutationType({
  fields: (t) => ({
    reset: t.boolean({
      tracing: false,
      resolve: () => {
        events.length = 0;
        return true;
      },
    }),
    sync: t.string({ resolve: () => 'sync' }),
    async: t.string({ resolve: async () => 'async' }),
    throws: t.string({
      nullable: true,
      resolve: () => {
        throw new Error('sync failure');
      },
    }),
    rejects: t.string({
      nullable: true,
      resolve: async () => {
        throw new Error('async failure');
      },
    }),
    quiet: t.string({ tracing: false, resolve: () => 'untraced' }),
    events: t.stringList({ tracing: false, resolve: () => [...events] }),
  }),
});
// #endregion lifecycle

export const schema = builder.toSchema();

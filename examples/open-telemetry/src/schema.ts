import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField } from '@pothos/plugin-tracing';
import { createOpenTelemetryWrapper } from '@pothos/tracing-opentelemetry';
import { tracer, TracingOptions } from './zipkinTracer';

const createSpan = createOpenTelemetryWrapper<TracingOptions>(tracer, {
  includeSource: true,
  onSpan: (span, options) => {
    if (typeof options === 'object' && options.attributes) {
      span.setAttributes(options.attributes);
    }
  },
  includeArgs: true,
  ignoreError: true,
});

export const builder = new SchemaBuilder<{
  Tracing: TracingOptions;
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, options) => createSpan(resolver, options),
  },
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: { name: t.arg.string(), delay: t.arg.int() },
      resolve: async (parent, { name, delay }) =>
        tracer.startActiveSpan('resolving hello', async () => {
          const hello = `hello, ${name ?? 'World'}`;

          await new Promise((resolve) => {
            setTimeout(resolve, delay ?? 0);
          });

          return hello;
        }),
    }),
  }),
});

export const schema = builder.toSchema({});

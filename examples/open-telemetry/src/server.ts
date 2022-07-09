import { createServer } from '@graphql-yoga/node';
import { AttributeValue } from '@opentelemetry/api';
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isRootField } from '@pothos/plugin-tracing';
import { createOpenTelemetryWrapper } from '@pothos/tracing-opentelemetry';
import { schema } from './schema';
import { tracer, tracingPlugin } from './zipkinTracer';

type TracingOptions = boolean | { attributes?: Record<string, AttributeValue> };

const createSpan = createOpenTelemetryWrapper<TracingOptions>(tracer, {
  includeSource: true,
  onSpan: (span, options) => {
    if (typeof options === 'object' && options.attributes) {
      span.setAttributes(options.attributes);
    }
  },
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

const server = createServer({
  schema,
  plugins: [tracingPlugin],
});

server.start().catch(console.error);

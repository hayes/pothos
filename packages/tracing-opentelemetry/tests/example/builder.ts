import { AttributeValue } from '@opentelemetry/api';
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isEnumField, isRootField, isScalarField } from '@pothos/plugin-tracing';
import { createOpenTelemetryWrapper } from '../../src';
import { tracer } from './tracer';

type TracingOptions =
  | boolean
  | {
      attributes?: Record<string, AttributeValue>;
      useOperationAsSpanName?: boolean;
      spanName?: string;
    };

const createSpan = createOpenTelemetryWrapper<Exclude<TracingOptions, false>>(tracer, {
  includeSource: true,
  onSpan: (span, options) => {
    if (typeof options === 'object' && options.attributes) {
      span.setAttributes(options.attributes);

      if (options.spanName) {
        span.updateName(options.spanName);
      }
    }
  },
});

export const builder = new SchemaBuilder<{ Tracing: TracingOptions }>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) =>
      (isRootField(config) || (!isScalarField(config) && !isEnumField(config))) && {
        attributes: {},
      },
    wrap: (resolver, options) => createSpan(resolver, options),
  },
});

export const builder2 = new SchemaBuilder<{ Tracing: TracingOptions }>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => {
      if (isRootField(config)) {
        return (root, args, ctx, info) => ({ spanName: info.operation.name?.value });
      }

      return false;
    },
    wrap: (resolver, options) => createSpan(resolver, options),
  },
});

const createNamedSpan = createOpenTelemetryWrapper<Exclude<TracingOptions, false>>(tracer, {
  includeSource: true,
  onSpan: (span, options, source, args, ctx, info) => {
    // if this is a root field
    if (!info.path.prev && info.operation.name?.value) {
      span.updateName(info.operation.name?.value);
    }
  },
});
export const builder3 = new SchemaBuilder<{ Tracing: TracingOptions }>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, options, config) => createNamedSpan(resolver, options),
  },
});

const createSpanFromOperation = createOpenTelemetryWrapper<Exclude<TracingOptions, false>>(tracer, {
  includeSource: true,
  onSpan: (span, options, source, args, ctx, info) => {
    if (
      typeof options === 'object' &&
      options.useOperationAsSpanName &&
      info.operation.name?.value
    ) {
      span.updateName(info.operation.name?.value);
    }
  },
});
export const builder4 = new SchemaBuilder<{ Tracing: TracingOptions }>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => {
      if (isRootField(config)) {
        return { useOperationAsSpanName: true };
      }
      return false;
    },
    wrap: (resolver, options, config) => createSpanFromOperation(resolver, options),
  },
});

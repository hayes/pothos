import { AttributeValue } from '@opentelemetry/api';
import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isEnumField, isRootField, isScalarField } from '@pothos/plugin-tracing';
import { createOpenTelemetryWrapper } from '../../src';
import { tracer } from './tracer';

type TracingOptions =
  | false
  | {
      attributes?: Record<string, AttributeValue>;
    };

const wrapper = createOpenTelemetryWrapper<Exclude<TracingOptions, false>>(tracer, {
  onSpan: (span, options) => {
    Object.keys(options.attributes ?? {}).forEach((key) => {
      span.setAttribute(key, options.attributes![key]);
    });
  },
});

export const builder = new SchemaBuilder<{ Tracing: TracingOptions }>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) =>
      (isRootField(config) || (!isScalarField(config) && !isEnumField(config))) && {
        attributes: {},
      },
    wrap: (config) => wrapper,
  },
});

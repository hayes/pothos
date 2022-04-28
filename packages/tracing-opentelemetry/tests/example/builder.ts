import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isEnumField, isRootField, isScalarField } from '@pothos/plugin-tracing';
import { createOpenTelemetryWrapper } from '../../src';
import { tracer } from './tracer';

const wrapper = createOpenTelemetryWrapper(tracer);

export const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config) || (!isScalarField(config) && !isEnumField(config)),
    wrap: (config, value) => (value ? wrapper : null),
  },
});

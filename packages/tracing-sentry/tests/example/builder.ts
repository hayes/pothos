import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isEnumField, isRootField, isScalarField } from '@pothos/plugin-tracing';
import { createSentryWrapper } from '../../src';

const traceResolver = createSentryWrapper({
  includeArgs: true,
  includeSource: true,
});

export const builder = new SchemaBuilder({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config) || (!isScalarField(config) && !isEnumField(config)),
    wrap: (resolver, options) => traceResolver(resolver, options),
  },
});

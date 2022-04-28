import SchemaBuilder from '@pothos/core';
import TracingPlugin, { isEnumField, isRootField, isScalarField } from '../../src';

export const builder = new SchemaBuilder<{
  Context: { log: (message: string) => void };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config) || (!isScalarField(config) && !isEnumField(config)),
    wrap: (config, value) =>
      value
        ? (next, source, args, ctx, info) => {
            ctx.log(`Executing resolver ${info.parentType.name}.${info.fieldName}`);

            return next();
          }
        : null,
  },
});

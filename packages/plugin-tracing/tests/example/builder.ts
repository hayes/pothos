import SchemaBuilder from '@pothos/core';
import TracingPlugin, {
  isEnumField,
  isExposedField,
  isRootField,
  isScalarField,
  runFunction,
} from '../../src';

export const builder = new SchemaBuilder<{
  Context: { log: (message: string) => void };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) =>
      isRootField(config) ||
      (!isExposedField(config) && !isScalarField(config) && !isEnumField(config)),
    wrap: (resolver) => (source, args, ctx, info, abortSignal) =>
      runFunction(
        () => resolver(source, args, ctx, info, abortSignal),
        (error, duration) => {
          if (error) {
            ctx.log(
              `Error running resolver for ${info.parentType}.${info.fieldName}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          } else {
            ctx.log(
              `Successfully ran resolver for ${info.parentType}.${
                info.fieldName
              } in ${duration.toPrecision(3)}ms`,
            );
          }
        },
      ),
  },
});

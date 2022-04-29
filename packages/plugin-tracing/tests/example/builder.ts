import SchemaBuilder from '@pothos/core';
import TracingPlugin, {
  isEnumField,
  isExposedField,
  isRootField,
  isScalarField,
  runFunction,
  wrapResolver,
} from '../../src';

export const builder = new SchemaBuilder<{
  Context: { log: (message: string) => void };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) =>
      isRootField(config) ||
      (!isExposedField(config) && !isScalarField(config) && !isEnumField(config)),
    wrap: (resolver) => (source, args, ctx, info) =>
      runFunction(
        () => resolver(source, args, ctx, info),
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

export const builder2 = new SchemaBuilder<{
  Tracing: boolean | { formatMessage: (duration: number) => string };
  Context: { log: (message: string) => void };
}>({
  plugins: [TracingPlugin],
  tracing: {
    default: (config) => isRootField(config) || (!isScalarField(config) && !isEnumField(config)),
    wrap: (resolver, options, config) =>
      wrapResolver(resolver, (error, duration) => {
        const message =
          typeof options === 'object'
            ? options.formatMessage(duration)
            : `Executed resolver ${config.parentType}.${config.name} in ${duration}ms`;

        console.log(message);
      }),
  },
});

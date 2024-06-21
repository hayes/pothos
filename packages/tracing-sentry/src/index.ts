import { GraphQLFieldResolver, GraphQLResolveInfo, print } from 'graphql';
import { pathToString, runFunction } from '@pothos/plugin-tracing';
import * as Sentry from '@sentry/node';
import { AttributeNames } from './enums';

export * from './enums';

interface SentryWrapperOptions<T> {
  ignoreError?: boolean;
  includeArgs?: boolean;
  includeSource?: boolean;
  onSpan?: (
    span: Sentry.Span,
    options: T,
    parent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => void;
}

export function createSentryWrapper<T = unknown>(options?: SentryWrapperOptions<T>) {
  return <Context extends object = object>(
      resolver: GraphQLFieldResolver<unknown, Context, Record<string, unknown>>,
      fieldOptions: T,
      tracingOptions?: SentryWrapperOptions<T>,
    ): GraphQLFieldResolver<unknown, Context, Record<string, unknown>> =>
    (source, args, ctx, info) => {
      const parentSpan = Sentry.getActiveSpan();

      if (!parentSpan) {
        return resolver(source, args, ctx, info);
      }

      const attributes: Record<string, string> = {
        [AttributeNames.FIELD_NAME]: info.fieldName,
        [AttributeNames.FIELD_PATH]: pathToString(info),
        [AttributeNames.FIELD_TYPE]: info.returnType.toString(),
      };

      if (tracingOptions?.includeArgs ?? options?.includeArgs) {
        attributes[AttributeNames.FIELD_ARGS] = JSON.stringify(args, null, 2);
      }

      if (tracingOptions?.includeSource ?? options?.includeSource) {
        attributes[AttributeNames.SOURCE] = print(info.fieldNodes[0]);
      }

      return Sentry.startSpan(
        {
          parentSpan,
          name: info.fieldName,
          op: 'graphql.resolve',
          attributes,
        },
        (span) => {
          tracingOptions?.onSpan?.(span, fieldOptions, source, args, ctx, info);
          options?.onSpan?.(span, fieldOptions, source, args, ctx, info);

          return runFunction(
            () => resolver(source, args, ctx, info),
            (error) => {
              if (error) {
                span.setStatus({
                  code: 2,
                  message: error instanceof Error ? error.message : 'Unknown error',
                });
                Sentry.captureException(error);
              }
            },
          );
        },
      );
    };
}

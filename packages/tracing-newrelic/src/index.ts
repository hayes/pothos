import { pathToString } from '@pothos/plugin-tracing';
import { type GraphQLFieldResolver, print } from 'graphql';
import newrelic from 'newrelic';
import { AttributeNames } from './enums';

export * from './enums';

export interface NewRelicWrapperOptions {
  includeArgs?: boolean;
  includeSource?: boolean;
}

export function createNewrelicWrapper<T>(options?: NewRelicWrapperOptions) {
  return <Context extends object = object>(
    resolver: GraphQLFieldResolver<unknown, Context, Record<string, unknown>>,
    _fieldOptions?: T,
    tracingOptions?: NewRelicWrapperOptions,
  ): GraphQLFieldResolver<unknown, Context, Record<string, unknown>> =>
    (source, args, ctx, info, abortSignal) =>
      newrelic.startSegment('graphql.resolve', true, () => {
        newrelic.addCustomSpanAttributes({
          [AttributeNames.FIELD_NAME]: info.fieldName,
          [AttributeNames.FIELD_PATH]: pathToString(info),
          [AttributeNames.FIELD_TYPE]: info.returnType.toString(),
        });

        if (tracingOptions?.includeSource ?? options?.includeSource) {
          newrelic.addCustomSpanAttribute(AttributeNames.SOURCE, print(info.fieldNodes[0]));
        }

        if (tracingOptions?.includeArgs ?? options?.includeArgs) {
          newrelic.addCustomSpanAttribute(AttributeNames.FIELD_ARGS, JSON.stringify(args, null, 2));
        }

        return resolver(source, args, ctx, info, abortSignal);
      });
}

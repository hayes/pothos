import {
  getNamespace,
  getSegment,
  isAutomaticMode,
  setSegment,
  Subsegment,
} from 'aws-xray-sdk-core';
import { GraphQLFieldResolver, GraphQLResolveInfo, print } from 'graphql';
import { createSpanWithParent, runFunction } from '@pothos/plugin-tracing';
import { AttributeNames, SpanNames } from './enums';

export * from './enums';

interface XRayWrapperOptions<T> {
  includeArgs?: boolean;
  includeSource?: boolean;
  onSegment?: (
    span: Subsegment,
    options: T,
    parent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => void;
}

export function createXRayWrapper<T = unknown>(options?: XRayWrapperOptions<T>) {
  return <Context extends object = object>(
      resolver: GraphQLFieldResolver<unknown, Context, Record<string, unknown>>,
      fieldOptions: T,
      tracingOptions?: XRayWrapperOptions<T>,
    ): GraphQLFieldResolver<unknown, Context, Record<string, unknown>> =>
    (source: unknown, args: {}, context: Context, info: GraphQLResolveInfo) => {
      const segment = createSpanWithParent<Subsegment | null>(context, info, (path, parent) => {
        const parentSegment = parent ?? getSegment();

        if (!parentSegment) {
          return null;
        }

        const childSegment = new Subsegment(SpanNames.RESOLVE);

        parentSegment.addSubsegment(childSegment);

        childSegment.addAttribute(AttributeNames.FIELD_NAME, info.fieldName);
        childSegment.addAttribute(AttributeNames.FIELD_PATH, path);
        childSegment.addAttribute(AttributeNames.FIELD_TYPE, info.returnType.toString());

        if (tracingOptions?.includeSource ?? options?.includeSource) {
          childSegment.addAttribute(AttributeNames.SOURCE, print(info.fieldNodes[0]));
        }

        if (tracingOptions?.includeArgs ?? options?.includeArgs) {
          childSegment.addAttribute(AttributeNames.FIELD_ARGS, JSON.stringify(args, null, 2));
        }

        tracingOptions?.onSegment?.(childSegment, fieldOptions, source, args, context, info);
        options?.onSegment?.(childSegment, fieldOptions, source, args, context, info);

        return childSegment;
      });

      if (!segment) {
        return resolver(source, args, context, info);
      }

      return runFunction(
        () => {
          if (isAutomaticMode()) {
            const session = getNamespace();

            return session.runAndReturn(() => {
              setSegment(segment);

              return resolver(source, args, context, info);
            });
          }
          return resolver(source, args, context, info);
        },
        (error) => {
          segment.close(error as Error | null);
        },
      );
    };
}

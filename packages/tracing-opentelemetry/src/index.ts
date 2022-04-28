import { GraphQLResolveInfo } from 'graphql';
import { context as opentelemetryContext, Span, trace, Tracer } from '@opentelemetry/api';
import { createSpanWithParent, onEnd } from '@pothos/plugin-tracing';

export enum AttributeNames {
  FIELD_NAME = 'graphql.field.name',
  FIELD_PATH = 'graphql.field.path',
  FIELD_TYPE = 'graphql.field.type',
}

export enum SpanNames {
  RESOLVE = 'graphql.resolve',
}

export interface TracingWrapperOptions<T> {
  onSpan: (
    span: Span,
    options: T,
    parent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => void;
}

export function createOpenTelemetryWrapper<T = unknown>(
  tracer: Tracer,
  options?: TracingWrapperOptions<T>,
) {
  return (
    next: () => unknown,
    fieldOptions: T,
    parent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const span = createSpanWithParent<Span>(context, info, (path, parentSpan) => {
      const spanContext = parentSpan
        ? trace.setSpan(opentelemetryContext.active(), parentSpan)
        : undefined;

      return tracer.startSpan(
        SpanNames.RESOLVE,
        {
          attributes: {
            [AttributeNames.FIELD_NAME]: info.fieldName,
            [AttributeNames.FIELD_PATH]: path,
            [AttributeNames.FIELD_TYPE]: info.returnType.toString(),
          },
        },
        spanContext,
      );
    });

    options?.onSpan(span, fieldOptions, parent, args, context, info);

    return onEnd(next, (error) => {
      if (error) {
        span.recordException(error as Error);
      }
      span.end();
    });
  };
}

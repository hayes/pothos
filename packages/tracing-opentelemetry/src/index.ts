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

interface TracingWrapperOptions {
  onSpan: (
    span: Span,
    parent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => void;
}

export function createOpenTelemetryWrapper(tracer: Tracer, options?: TracingWrapperOptions) {
  return (
    next: () => unknown,
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

    options?.onSpan(span, parent, args, context, info);

    return onEnd(next, (error) => {
      if (error) {
        span.recordException(error as Error);
      }
      span.end();
    });
  };
}

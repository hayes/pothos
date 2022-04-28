import { GraphQLResolveInfo } from 'graphql';
import { context as opentelemetryContext, Span, trace, Tracer } from '@opentelemetry/api';
import { isThenable } from '@pothos/core';

export enum AttributeNames {
  FIELD_NAME = 'graphql.field.name',
  FIELD_PATH = 'graphql.field.path',
  FIELD_TYPE = 'graphql.field.type',
}

export enum SpanNames {
  RESOLVE = 'graphql.resolve',
}

const spanCacheSymbol = Symbol.for('Pothos.tracing.spanCache');

interface InternalContext {
  [spanCacheSymbol]?: Record<string, Span>;
}

function pathToString(info: GraphQLResolveInfo) {
  let current = info.path;
  let path = current.key;

  while (current.prev) {
    current = current.prev;
    path = `${current.key}.${path}`;
  }

  return path;
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
    const span = createResolverSpan(tracer, context as InternalContext, info);

    options?.onSpan(span, parent, args, context, info);

    let result: unknown;
    try {
      result = next();
    } catch (error: unknown) {
      span.recordException(error as Error);
      span.end();

      throw error;
    }

    if (isThenable(result)) {
      return result.then(
        (value) => {
          span.end();

          return value;
        },
        (error: Error) => {
          span.recordException(error);
          span.end();

          throw error;
        },
      );
    }

    span.end();

    return result;
  };
}

function getParentPaths(path: GraphQLResolveInfo['path']): [string, ...string[]] {
  if (!path.prev) {
    return [String(path.key)];
  }

  const parentPaths = getParentPaths(path.prev);

  return [`${parentPaths[0]}.${path.key}`, ...parentPaths];
}

function getParentSpan(context: InternalContext, info: GraphQLResolveInfo) {
  if (!info.path.prev) {
    return null;
  }

  const paths = getParentPaths(info.path.prev);
  const spanCache = context[spanCacheSymbol];

  if (!spanCache) {
    return null;
  }

  for (const path of paths) {
    if (spanCache[path]) {
      return spanCache[path];
    }
  }

  return null;
}

function createResolverSpan(tracer: Tracer, context: InternalContext, info: GraphQLResolveInfo) {
  const parentSpan = getParentSpan(context, info);

  const spanContext = parentSpan
    ? trace.setSpan(opentelemetryContext.active(), parentSpan)
    : undefined;

  const stringPath = pathToString(info);
  const span = tracer.startSpan(
    SpanNames.RESOLVE,
    {
      attributes: {
        [AttributeNames.FIELD_NAME]: info.fieldName,
        [AttributeNames.FIELD_PATH]: stringPath,
        [AttributeNames.FIELD_TYPE]: info.returnType.toString(),
      },
    },
    spanContext,
  );

  if (!context[spanCacheSymbol]) {
    context[spanCacheSymbol] = {};
  }

  context[spanCacheSymbol]![stringPath] = span;

  return span;
}

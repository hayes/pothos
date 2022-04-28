import { GraphQLResolveInfo } from 'graphql';
import {
  isThenable,
  PothosOutputFieldConfig,
  PothosOutputFieldType,
  SchemaTypes,
} from '@pothos/core';

export function isRootField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
  return (
    config.parentType === 'Query' ||
    config.parentType === 'Mutation' ||
    config.parentType === 'Subscription'
  );
}

export function resolveFieldType<Types extends SchemaTypes>(
  type: PothosOutputFieldType<Types>,
): 'Enum' | 'Interface' | 'Object' | 'Scalar' | 'Union' {
  if (type.kind === 'List') {
    return resolveFieldType(type.type);
  }

  return type.kind;
}

export function isScalarField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
  return resolveFieldType(config.type) === 'Scalar';
}

export function isEnumField<Types extends SchemaTypes>(config: PothosOutputFieldConfig<Types>) {
  return resolveFieldType(config.type) === 'Enum';
}

const spanCacheSymbol = Symbol.for('Pothos.tracing.spanCache');

interface InternalContext<T> {
  [spanCacheSymbol]?: Record<string, T>;
}

export function pathToString(info: GraphQLResolveInfo) {
  let current = info.path;
  let path = String(current.key);

  while (current.prev) {
    current = current.prev;
    path = `${current.key}.${path}`;
  }

  return path;
}

function getParentPaths(path: GraphQLResolveInfo['path']): [string, ...string[]] {
  if (!path.prev) {
    return [String(path.key)];
  }

  const parentPaths = getParentPaths(path.prev);

  return [`${parentPaths[0]}.${path.key}`, ...parentPaths];
}

export function getParentSpan<T>(context: InternalContext<T>, info: GraphQLResolveInfo) {
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

export function createSpanWithParent<T>(
  context: object,
  info: GraphQLResolveInfo,
  createSpan: (path: string, parent: T | null) => T,
) {
  const parentSpan = getParentSpan<T>(context, info);
  const stringPath = pathToString(info);
  const span = createSpan(stringPath, parentSpan);

  if (!(context as InternalContext<T>)[spanCacheSymbol]) {
    (context as InternalContext<T>)[spanCacheSymbol] = {};
  }

  (context as InternalContext<T>)[spanCacheSymbol]![stringPath] = span;

  return span;
}

export function onEnd(next: () => unknown, end: (error: unknown) => void) {
  let result: unknown;
  try {
    result = next();
  } catch (error: unknown) {
    end(error);

    throw error;
  }

  if (isThenable(result)) {
    return result.then(
      (value) => {
        end(null);

        return value;
      },
      (error: Error) => {
        end(error);

        throw error;
      },
    );
  }

  end(null);

  return result;
}

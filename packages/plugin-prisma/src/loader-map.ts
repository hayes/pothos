import { GraphQLResolveInfo } from 'graphql';
import { createContextCache } from '@giraphql/core';
import { LoaderMappings } from './util';

const cache = createContextCache((ctx) => new Map<string, LoaderMappings>());

export function cacheKey(path: GraphQLResolveInfo['path']) {
  let key = String(path.key);
  let current = path.prev;

  while (current) {
    key = `${current.key}.${key}`;
    current = current.prev;
  }

  return key;
}

export function setLoaderMapping(
  ctx: object,
  path: GraphQLResolveInfo['path'],
  value: LoaderMappings,
) {
  const map = cache(ctx);
  const key = cacheKey(path);

  map.set(key, value);
}

export function getLoaderMapping(ctx: object, path: GraphQLResolveInfo['path']) {
  const map = cache(ctx);
  const key = cacheKey(path);

  return map.get(key) ?? null;
}

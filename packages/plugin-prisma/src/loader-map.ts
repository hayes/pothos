import { GraphQLResolveInfo } from 'graphql';
import { createContextCache } from '@giraphql/core';
import { LoaderMappings } from './util';

const cache = createContextCache((ctx) => new Map<string, LoaderMappings>());

export function cacheKey(path: GraphQLResolveInfo['path'], subPath: string[]) {
  let key = '';
  let current: GraphQLResolveInfo['path'] | undefined = path;

  while (current) {
    if (typeof current.key === 'string') {
      key = key ? `${current.key}.${key}` : current.key;
    }
    current = current.prev;
  }

  for (const entry of subPath) {
    key = `${key}.${entry}`;
  }

  return key;
}

export function setLoaderMappings(
  ctx: object,
  path: GraphQLResolveInfo['path'],
  value: LoaderMappings,
) {
  Object.keys(value).forEach((field) => {
    const mapping = value[field];
    const map = cache(ctx);
    const selectionName = mapping.alias ?? mapping.field;
    const subPath = [...mapping.indirectPath, selectionName];
    const key = cacheKey(path, subPath);

    map.set(key, mapping.mappings);
  });
}

export function getLoaderMapping(ctx: object, path: GraphQLResolveInfo['path']) {
  const map = cache(ctx);
  const key = cacheKey(path, []);

  return map.get(key) ?? null;
}

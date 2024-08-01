import { createContextCache } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';

export type LoaderMappings = Record<
  string,
  {
    field: string;
    type: string;
    mappings: LoaderMappings;
    indirectPath: string[];
  }
>;

const cache = createContextCache(() => new Map<string, LoaderMappings>());

export function cacheKey(type: string, path: GraphQLResolveInfo['path'], subPath: string[] = []) {
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

  return `${type}@${key}`;
}

export function setLoaderMappings(ctx: object, info: GraphQLResolveInfo, value: LoaderMappings) {
  const map = cache(ctx);
  for (const [field, mapping] of Object.entries(value)) {
    const subPath = [...mapping.indirectPath, field];
    const key = cacheKey(mapping.type, info.path, subPath);

    map.set(key, mapping.mappings);
  }
}

export function getLoaderMapping(ctx: object, path: GraphQLResolveInfo['path'], type: string) {
  const map = cache(ctx);
  const key = cacheKey(type, path, []);

  return map.get(key) ?? null;
}

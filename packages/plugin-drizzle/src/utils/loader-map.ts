import { GraphQLResolveInfo } from 'graphql';
import { createContextCache } from '@pothos/core';

export type LoaderMappings = Record<
  string,
  {
    field: string;
    type: string;
    mappings: LoaderMappings;
    indirectPath: string[];
  }
>;

const cache = createContextCache((ctx) => new Map<string, LoaderMappings>());

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
  Object.keys(value).forEach((field) => {
    const map = cache(ctx);

    const mapping = value[field];
    const subPath = [...mapping.indirectPath, field];
    const key = cacheKey(mapping.type, info.path, subPath);

    map.set(key, mapping.mappings);
  });
}

export function getLoaderMapping(ctx: object, path: GraphQLResolveInfo['path'], type: string) {
  const map = cache(ctx);
  const key = cacheKey(type, path, []);

  return map.get(key) ?? null;
}

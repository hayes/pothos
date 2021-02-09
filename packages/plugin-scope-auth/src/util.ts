import { SchemaTypes } from '@giraphql/core';
import { Path } from 'graphql/jsutils/Path';
import { AuthScopeMap } from '.';

export function canCache<Types extends SchemaTypes>(map: AuthScopeMap<Types>): boolean {
  if (map.$granted) {
    return false;
  }

  return (map.$all ? canCache(map.$all!) : true) && (map.$any ? canCache(map.$any!) : true);
}

export function cacheKey(path: Path | undefined) {
  if (!path) {
    // Root
    return '*';
  }

  let key = String(path.key);
  let current = path.prev;

  while (current) {
    key = `${current.key}.${current}`;
    current = current.prev;
  }

  return key;
}

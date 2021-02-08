import { SchemaTypes } from '@giraphql/core';
import { AuthScopeMap } from '.';

export function canCache<Types extends SchemaTypes>(map: AuthScopeMap<Types>): boolean {
  if (map.$granted) {
    return false;
  }

  return (map.$all ? canCache(map.$all!) : true) && (map.$any ? canCache(map.$any!) : true);
}

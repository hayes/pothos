import { Path, PothosFieldConfig, SchemaTypes } from '@pothos/core';

import type { AuthScopeMap } from '.';

export function canCache<Types extends SchemaTypes>(map: AuthScopeMap<Types>): boolean {
  if (map.$granted) {
    return false;
  }

  return (map.$all ? canCache(map.$all) : true) && (map.$any ? canCache(map.$any) : true);
}

export function cacheKey(path: Path | undefined) {
  if (!path) {
    // Root
    return '*';
  }

  let key = String(path.key);
  let current = path.prev;

  while (current) {
    key = `${current.key}.${key}`;
    current = current.prev;
  }

  return key;
}

export function isObjectOrInterface(fieldConfig: PothosFieldConfig<never>) {
  return (
    (fieldConfig.graphqlKind === 'Interface' || fieldConfig.graphqlKind === 'Object') &&
    fieldConfig.kind !== 'Query' &&
    fieldConfig.kind !== 'Mutation' &&
    fieldConfig.kind !== 'Subscription'
  );
}

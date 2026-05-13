import type { GraphQLResolveInfo } from 'graphql';

// Two return shapes from the mapper:
//   - Plain include: `parent[rel]` = row (to-one) or `Row[]` (to-many single branch).
//   - Combine: `parent[rel]` = `{ [alias]: value, … }`.
//
// To-many disambiguation: Array.isArray → plain include; object → combine spec.
export function getRelationValue(
  parent: unknown,
  info: GraphQLResolveInfo,
  relationName: string,
  isToMany: boolean,
): unknown {
  if (parent == null || typeof parent !== 'object') {
    return undefined;
  }
  const p = parent as Record<string, unknown>;
  const val = p[relationName];

  if (!isToMany) {
    return val;
  }
  if (val == null || Array.isArray(val)) {
    return val;
  }
  if (typeof val === 'object') {
    const alias = info.fieldNodes[0]?.alias?.value ?? info.fieldName;
    return (val as Record<string, unknown>)[alias];
  }
  return val;
}

// Counts/aggregates always force a combine — the parent slot is the
// spec object keyed by alias.
export function getCombineSpecValue(
  parent: unknown,
  info: GraphQLResolveInfo,
  relationName: string,
): unknown {
  if (parent == null || typeof parent !== 'object') {
    return undefined;
  }
  const spec = (parent as Record<string, unknown>)[relationName];
  if (spec == null || typeof spec !== 'object' || Array.isArray(spec)) {
    return undefined;
  }
  const alias = info.fieldNodes[0]?.alias?.value ?? info.fieldName;
  return (spec as Record<string, unknown>)[alias];
}

import { createContextCache } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { Position } from './types.js';

/**
 * What a plan records for one field whose selection was merged: the mappings of the fields walked
 * beneath it, and, for a field a select function planned, the position it was planned at, so a
 * resolver can ask the same question of it that the select path asked. A static selection records
 * the shared empty mapping and has no position: it ran no callback that could have read one.
 */
export interface Mapping {
  nested: Mappings;
  position?: Position;
}

/**
 * Mappings keyed by `${Type}@${relative.path}`, where the relative path is the aliased field path
 * from the walked field to the mapped field (`Post@edges.node.author`). A resolver beneath the
 * walked field finds a mapping iff the plan that would have loaded its data was merged.
 */
export type Mappings = Record<string, Mapping>;

/** The mapping of a static selection: nothing can ever be recorded beneath one. */
export const EMPTY_MAPPING: Mapping = Object.freeze({ nested: Object.freeze({}) as Mappings });

/**
 * Adopts the first mapping recorded for a key; a later one deep-unions into a copy, so a recorded
 * mapping is never changed after the fact (two plays may accept a different subset of the fields).
 */
export function unionMappings(into: Mapping | undefined, from: Mapping): Mapping {
  if (!into || into === EMPTY_MAPPING) {
    return from;
  }

  const nested: Mappings = { ...into.nested };

  for (const key of Object.keys(from.nested)) {
    nested[key] = unionMappings(nested[key], from.nested[key]);
  }

  return into.position === undefined ? { nested } : { nested, position: into.position };
}

/**
 * Per request context: the mappings recorded so far, and the keys they were recorded under, by
 * the path prefix that rehomed them. A field resolved for each of N rows of a list records the
 * same mappings under the same keys every time — `responsePath` drops the list index, so every
 * row rebuilds the same strings — so a prefix builds its keys once and the rows after the first
 * only write.
 */
const cache = createContextCache(() => ({
  mappings: new Map<string, Mapping>(),
  rehomed: new Map<string, Map<string, string>>(),
}));

/**
 * Memoised per path link. A path link is created once per field per row and never mutated, and
 * graphql-js shares the links above a list between every row of it, so the prefix of a field
 * resolved for each of N rows is computed once rather than N times. Every consumer of a mapping
 * asks for a path this way, several times per resolve, so the cost is otherwise paid repeatedly
 * for a string that cannot change. Weak, so the links go with the request.
 */
const pathKeys = new WeakMap<object, string>();

/** The string keys of a response path joined by `.`; list indices are dropped. */
export function responsePath(path: GraphQLResolveInfo['path'] | undefined): string {
  if (!path) {
    return '';
  }

  let key = pathKeys.get(path);

  if (key === undefined) {
    const prefix = responsePath(path.prev);

    // A list index contributes nothing, so the link's key is its prefix's.
    key = typeof path.key === 'string' ? (prefix ? `${prefix}.${path.key}` : path.key) : prefix;
    pathKeys.set(path, key);
  }

  return key;
}

export function cacheKey(type: string, path: GraphQLResolveInfo['path']) {
  return `${type}@${responsePath(path)}`;
}

/** Records the mappings of a plan rooted at the field `info` resolves, under that field's path. */
export function setLoaderMappings(ctx: object, info: GraphQLResolveInfo, mappings: Mappings) {
  const { mappings: map, rehomed } = cache(ctx);
  const prefix = responsePath(info.path);
  let keys = rehomed.get(prefix);

  if (!keys) {
    keys = new Map();
    rehomed.set(prefix, keys);
  }

  for (const key of Object.keys(mappings)) {
    let under = keys.get(key);

    if (under === undefined) {
      const at = key.indexOf('@');

      under = `${key.slice(0, at)}@${prefix}.${key.slice(at + 1)}`;
      keys.set(key, under);
    }

    map.set(under, mappings[key]);
  }
}

/**
 * Records the mapping of the field `info` resolves (under its own parent type) along with the
 * mappings beneath it, so both the field's resolver and the resolvers below it can look
 * themselves up.
 */
export function setFieldMapping(ctx: object, info: GraphQLResolveInfo, mapping: Mapping) {
  cache(ctx).mappings.set(cacheKey(info.parentType.name, info.path), mapping);
  setLoaderMappings(ctx, info, mapping.nested);
}

export function getLoaderMapping(
  ctx: object,
  path: GraphQLResolveInfo['path'],
  type: string,
): Mapping | null {
  return cache(ctx).mappings.get(cacheKey(type, path)) ?? null;
}

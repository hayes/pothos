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

const cache = createContextCache(() => new Map<string, Mapping>());

/** The string keys of a response path joined by `.`; list indices are dropped. */
export function responsePath(path: GraphQLResolveInfo['path'] | undefined): string {
  let key = '';
  let current = path;

  while (current) {
    if (typeof current.key === 'string') {
      key = key ? `${current.key}.${key}` : current.key;
    }
    current = current.prev;
  }

  return key;
}

export function cacheKey(type: string, path: GraphQLResolveInfo['path']) {
  return `${type}@${responsePath(path)}`;
}

/** Records the mappings of a plan rooted at the field `info` resolves, under that field's path. */
export function setLoaderMappings(ctx: object, info: GraphQLResolveInfo, mappings: Mappings) {
  const map = cache(ctx);
  const prefix = responsePath(info.path);

  for (const key of Object.keys(mappings)) {
    const at = key.indexOf('@');

    map.set(`${key.slice(0, at)}@${prefix}.${key.slice(at + 1)}`, mappings[key]);
  }
}

/**
 * Records the mapping of the field `info` resolves (under its own parent type) along with the
 * mappings beneath it, so both the field's resolver and the resolvers below it can look
 * themselves up.
 */
export function setFieldMapping(ctx: object, info: GraphQLResolveInfo, mapping: Mapping) {
  cache(ctx).set(cacheKey(info.parentType.name, info.path), mapping);
  setLoaderMappings(ctx, info, mapping.nested);
}

export function getLoaderMapping(
  ctx: object,
  path: GraphQLResolveInfo['path'],
  type: string,
): Mapping | null {
  return cache(ctx).get(cacheKey(type, path)) ?? null;
}

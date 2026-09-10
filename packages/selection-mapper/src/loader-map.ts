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
 * the path prefix that rehomed them. `responsePath` drops list indices, so every row of a list
 * rebuilds the same key strings; a prefix builds them once.
 *
 * `mappings` holds what a plan recorded for a whole field: every row of that field was loaded by
 * it, so one mapping per path answers for all of them. `rows` holds a mapping only where rows of
 * one list disagree about which plan loaded them — a mapping carries the position a connection
 * pages with, so a row answering from another row's mapping would page with arguments its own
 * data was never fetched with. `disagreed` stays false when that never happened, so a request
 * whose rows were all loaded the same way pays nothing for the row tier.
 */
const cache = createContextCache(() => ({
  mappings: new Map<string, Mapping>(),
  rehomed: new Map<string, Map<string, string>>(),
  rows: new WeakMap<object, Map<string, Mapping>>(),
  disagreed: false,
}));

type Cache = ReturnType<typeof cache>;

/**
 * Memoised per path link, which is created once per field per row and never mutated. graphql-js
 * shares the links above a list between every row of it, so the prefix of a field resolved for
 * each of N rows is built once rather than N times. Weak, so the links go with the request.
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

/**
 * The keys `mappings` is recorded under when it is rehomed beneath `prefix`. Built once per
 * prefix and shared by both tiers: the strings depend on the path and the plan's own keys, never
 * on which row is being recorded for.
 */
function rehomedKeys(cached: Cache, prefix: string) {
  let keys = cached.rehomed.get(prefix);

  if (!keys) {
    keys = new Map();
    cached.rehomed.set(prefix, keys);
  }

  return keys;
}

/** `key`, a plan's own `Type@relative.path`, moved beneath `prefix`. Built once per prefix. */
function rehome(keys: Map<string, string>, key: string, prefix: string) {
  let under = keys.get(key);

  if (under === undefined) {
    const at = key.indexOf('@');

    under = `${key.slice(0, at)}@${prefix}.${key.slice(at + 1)}`;
    keys.set(key, under);
  }

  return under;
}

/** `row` if a mapping can be hung off it. A root field resolves with no parent value at all. */
function ownerOf(row: unknown): object | null {
  return typeof row === 'object' && row !== null ? row : null;
}

/**
 * Records `mapping` at `key` for `row`. An unclaimed key takes it, and a key already holding this
 * very mapping needs no write, so the rows after the first write nothing. Only a key two plans
 * disagree about gives the row a mapping of its own — or, with no row to hang it off, nothing, so
 * the resolvers beneath fall back and load their own data.
 */
function claim(cached: Cache, key: string, mapping: Mapping, row: object | null) {
  const held = cached.mappings.get(key);

  if (held === undefined) {
    cached.mappings.set(key, mapping);
  } else if (held !== mapping && row) {
    let own = cached.rows.get(row);

    if (!own) {
      own = new Map();
      cached.rows.set(row, own);
      cached.disagreed = true;
    }

    own.set(key, mapping);
  }
}

/**
 * Records the mappings of a plan rooted at the field `info` resolves, under that field's path.
 * The plan loaded the whole field, so its mappings answer for every row of it: they go to the
 * shared tier, and a later plan for the same field replaces them.
 */
export function setLoaderMappings(ctx: object, info: GraphQLResolveInfo, mappings: Mappings) {
  const cached = cache(ctx);
  const prefix = responsePath(info.path);
  const keys = rehomedKeys(cached, prefix);

  for (const key of Object.keys(mappings)) {
    cached.mappings.set(rehome(keys, key, prefix), mappings[key]);
  }
}

/**
 * Records the mappings of a plan that loaded `row` alone — the fallback loader's, or the one a
 * resolver was handed for the row it is about to resolve with. Where a plan has already claimed
 * a key with a different mapping, these are recorded against the row instead of replacing it, so
 * a row the planned query did not load never re-answers for a sibling it did.
 *
 * A row mapping is found by the resolvers whose parent is `row` itself. Deeper down the parent is
 * something `row`'s own resolvers produced, which nothing here has seen, so those resolvers read
 * the plan's mapping, as their siblings do.
 */
export function setRowMappings(
  ctx: object,
  info: GraphQLResolveInfo,
  mappings: Mappings,
  row: unknown,
) {
  writeRowMappings(cache(ctx), info, mappings, ownerOf(row));
}

function writeRowMappings(
  cached: Cache,
  info: GraphQLResolveInfo,
  mappings: Mappings,
  row: object | null,
) {
  const prefix = responsePath(info.path);
  const keys = rehomedKeys(cached, prefix);

  for (const key of Object.keys(mappings)) {
    claim(cached, rehome(keys, key, prefix), mappings[key], row);
  }
}

/**
 * Records the mapping of the field `info` resolves (under its own parent type) along with the
 * mappings beneath it, so both the field's resolver and the resolvers below it can look
 * themselves up. `row` is the value the field is about to resolve with: the parent row when it
 * was loaded by the planned query, and the reloaded row when the fallback loader fetched it.
 */
export function setFieldMapping(
  ctx: object,
  info: GraphQLResolveInfo,
  mapping: Mapping,
  row: unknown,
) {
  const cached = cache(ctx);
  const owner = ownerOf(row);

  claim(cached, cacheKey(info.parentType.name, info.path), mapping, owner);
  writeRowMappings(cached, info, mapping.nested, owner);
}

/**
 * The mapping recorded for the field at `path` on `row`, preferring one recorded for that row
 * over the plan's. `row` is the value whose data the mapping describes — the resolver's parent.
 */
export function getLoaderMapping(
  ctx: object,
  path: GraphQLResolveInfo['path'],
  type: string,
  row?: unknown,
): Mapping | null {
  const cached = cache(ctx);
  const key = cacheKey(type, path);

  if (cached.disagreed) {
    const owner = ownerOf(row);
    const own = owner && cached.rows.get(owner)?.get(key);

    if (own) {
      return own;
    }
  }

  return cached.mappings.get(key) ?? null;
}

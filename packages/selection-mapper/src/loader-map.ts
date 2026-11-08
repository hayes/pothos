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

/** Unions already made. A mapping is not changed once recorded, so one pair has one answer. */
const unions = new WeakMap<Mapping, WeakMap<Mapping, Mapping>>();

/**
 * Adopts the first mapping recorded for a key; a later one deep-unions into a copy, so a recorded
 * mapping is never changed after the fact (two plays may accept a different subset of the fields).
 *
 * Invocations of one field share what is beneath them (see `Plan.nested`), so a mapping is a DAG
 * whose keys can all lead to one mapping. A pair is unioned once however many keys lead to it, or
 * the union would take as long as the DAG written out as a tree.
 */
export function unionMappings(into: Mapping | undefined, from: Mapping): Mapping {
  if (!into || into === EMPTY_MAPPING) {
    return from;
  }

  if (into === from || from === EMPTY_MAPPING) {
    return into;
  }

  let byFrom = unions.get(into);

  if (!byFrom) {
    byFrom = new WeakMap();
    unions.set(into, byFrom);
  }

  const known = byFrom.get(from);

  if (known) {
    return known;
  }

  const nested: Mappings = { ...into.nested };

  for (const key of Object.keys(from.nested)) {
    nested[key] = unionMappings(nested[key], from.nested[key]);
  }

  const union = into.position === undefined ? { nested } : { nested, position: into.position };

  byFrom.set(from, union);

  return union;
}

/**
 * Per execution: the mappings recorded so far, and the keys they were recorded under, by
 * the path prefix that rehomed them. `responsePath` drops list indices, so every row of a list
 * rebuilds the same key strings; a prefix builds them once.
 *
 * `mappings` holds what a plan recorded for a whole field: every row of that field was loaded by
 * it, so one mapping per path answers for all of them. `rows` holds a mapping that answers for
 * one row only — because two plans disagreed about a key, or because the plan loaded that row
 * alone. A mapping carries the position a connection pages with, so a row answering from another
 * row's mapping would page with arguments its own data was never fetched with. `rowScoped` stays
 * false while nothing has been recorded there, so a request whose rows were all loaded the same
 * way pays nothing for the row tier.
 *
 * `scopes` and `rows` are keyed by `executionPath`, which keeps list indices to tell siblings
 * apart.
 */
interface Cache {
  mappings: Map<string, Mapping>;
  rehomed: Map<string, Map<string, string>>;
  rows: WeakMap<object, Map<string, Map<string, Mapping>>>;
  rowScoped: boolean;
  scopes: Map<string, Mappings>;
}

/** Per context: the cache of each event of each execution. */
const contextCaches = createContextCache(() => new WeakMap<object, WeakMap<object, Cache>>());

/** The one event of a query or mutation. */
const OPERATION = {};

/**
 * The cache of the execution `info` is in, or null for a subscription event with nothing to tell
 * it apart: nothing is recorded for it and nothing found, so its resolvers load their own data.
 *
 * Every executor builds an object once per execution and puts it in the info of every resolver
 * in it: graphql-js 17 a `getAbortSignal`, graphql-js 16, graphql-jit and @graphql-tools/executor
 * the coerced `variableValues`. @defer and @stream payloads reuse it, and they belong to the
 * execution. Not the path: graphql-jit builds a new one for every resolver.
 *
 * Subscription events need one more key. graphql-js and graphql-jit build that object afresh for
 * each event, but @graphql-tools/executor (Yoga, Envelop) reuses the `subscribe`'s for every
 * event, and gives each event nothing of its own but its payload, as `rootValue`. So an event is
 * keyed by its payload too, and a payload that isn't an object has no identity. The `subscribe`
 * resolver runs with the server's root value, usually undefined, so it records nothing; what it
 * would record is never read, since no resolver runs beneath it. Under @graphql-tools/executor,
 * events yielding the same payload object (or the server's root value) share a cache.
 */
function cache(ctx: object, info: GraphQLResolveInfo): Cache | null {
  let event: object | null = OPERATION;

  if (info.operation.operation === 'subscription') {
    event = ownerOf(info.rootValue);

    if (!event) {
      return null;
    }
  }

  const executions = contextCaches(ctx);
  const execution = (info as { getAbortSignal?: object }).getAbortSignal ?? info.variableValues;
  let events = executions.get(execution);

  if (!events) {
    events = new WeakMap();
    executions.set(execution, events);
  }

  let cached = events.get(event);

  if (!cached) {
    cached = {
      mappings: new Map(),
      rehomed: new Map(),
      rows: new WeakMap(),
      rowScoped: false,
      scopes: new Map(),
    };
    events.set(event, cached);
  }

  return cached;
}

/**
 * The entries of `cache` for the operation `info` is in. Keyed on its `variableValues`, which
 * every executor coerces afresh for each operation, so operations sharing a context never share
 * an entry. For plans, which depend on the operation and not on the event: the events of a
 * subscription may share them, unlike their mappings.
 */
export function forOperation<T>(
  cache: WeakMap<object, Map<string, T>>,
  info: GraphQLResolveInfo,
): Map<string, T> {
  let entries = cache.get(info.variableValues);

  if (!entries) {
    entries = new Map();
    cache.set(info.variableValues, entries);
  }

  return entries;
}

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

/** Memoised per path link, as `pathKeys` is. */
const executionPaths = new WeakMap<object, string>();

/**
 * Every key of a response path, list indices included, joined by `.`: one field execution's
 * place in its execution. A string rather than the link itself, because graphql-jit builds a new
 * path for every resolver.
 */
function executionPath(path: GraphQLResolveInfo['path']): string {
  let key = executionPaths.get(path);

  if (key === undefined) {
    key = path.prev ? `${executionPath(path.prev)}.${path.key}` : String(path.key);
    executionPaths.set(path, key);
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
function claim(
  cached: Cache,
  key: string,
  mapping: Mapping,
  row: object | null,
  path: GraphQLResolveInfo['path'],
) {
  const held = cached.mappings.get(key);

  if (held === undefined) {
    cached.mappings.set(key, mapping);
  } else if (held !== mapping && row) {
    claimForRow(cached, key.slice(0, key.indexOf('@')), mapping, row, path);
  }
}

/**
 * Records `mapping` for this field execution against `row` alone, never in the shared tier. The caller loaded
 * `row` by itself, so an unclaimed key is not the caller's to take: the shared tier answers for
 * every row of a field, and a sibling that was never loaded would read the entry as proof that
 * it had been. With no row to hang it off there is nothing to record, and the resolvers beneath
 * fall back and load their own data.
 */
function claimForRow(
  cached: Cache,
  type: string,
  mapping: Mapping,
  row: object,
  path: GraphQLResolveInfo['path'],
) {
  let byPath = cached.rows.get(row);
  if (!byPath) {
    byPath = new Map();
    cached.rows.set(row, byPath);
    cached.rowScoped = true;
  }
  const at = executionPath(path);
  let own = byPath.get(at);
  if (!own) {
    own = new Map();
    byPath.set(at, own);
  }
  own.set(type, mapping);
}

/**
 * Records the mappings of a plan rooted at the field `info` resolves, under that field's path.
 * The plan loaded the whole field, so its mappings answer for every row of it: they go to the
 * shared tier. Multiple plans can contribute to one field (Relay nodes of different model
 * types share the list's path), so later contributions replace matching keys and retain others.
 */
export function setLoaderMappings(ctx: object, info: GraphQLResolveInfo, mappings: Mappings) {
  const cached = cache(ctx, info);

  if (!cached) {
    return;
  }

  const prefix = responsePath(info.path);
  const keys = rehomedKeys(cached, prefix);
  const at = executionPath(info.path);
  const previous = cached.scopes.get(at);
  cached.scopes.set(at, previous ? { ...previous, ...mappings } : mappings);

  for (const key of Object.keys(mappings)) {
    cached.mappings.set(rehome(keys, key, prefix), mappings[key]);
  }
}

/**
 * Records a row's mappings and scopes its descendants to this concrete field execution. A
 * descendant's parent is a different object, so row identity alone cannot carry its plan through
 * a relation, connection wrapper, or list. The execution path retains indices to isolate siblings.
 */
export function setRowMappings(ctx: object, info: GraphQLResolveInfo, mappings: Mappings) {
  cache(ctx, info)?.scopes.set(executionPath(info.path), mappings);
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
  const cached = cache(ctx, info);

  if (!cached) {
    return;
  }

  const owner = ownerOf(row);

  claim(cached, cacheKey(info.parentType.name, info.path), mapping, owner, info.path);
  cached.scopes.set(executionPath(info.path), mapping.nested);
}

/**
 * `setFieldMapping` for a plan that loaded `row` alone: the field's own mapping is recorded
 * against `row` rather than claimed for the whole field, so a sibling row the plan never loaded
 * keeps falling back instead of reading the entry and resolving against data it does not carry.
 *
 * Descendants inherit the mapping through this field's execution scope, even when their parent
 * is a child object or a connection wrapper rather than the row that was reloaded.
 */
export function setRowFieldMapping(
  ctx: object,
  info: GraphQLResolveInfo,
  mapping: Mapping,
  row: unknown,
) {
  const cached = cache(ctx, info);

  if (!cached) {
    return;
  }

  const owner = ownerOf(row);

  if (owner) {
    claimForRow(cached, info.parentType.name, mapping, owner, info.path);
  }

  cached.scopes.set(executionPath(info.path), mapping.nested);
}

/**
 * The mapping recorded for the field `info` resolves on `row`, preferring one recorded for that
 * row over the plan's. `row` is the value whose data the mapping describes — the resolver's
 * parent.
 */
export function getLoaderMapping(
  ctx: object,
  info: GraphQLResolveInfo,
  type: string,
  row?: unknown,
): Mapping | null {
  const { path } = info;
  const cached = cache(ctx, info);

  if (!cached) {
    return null;
  }

  if (cached.rowScoped) {
    const owner = ownerOf(row);
    const own = owner && cached.rows.get(owner)?.get(executionPath(path))?.get(type);

    if (own) {
      return own;
    }
  }

  for (let ancestor = path.prev; ancestor; ancestor = ancestor.prev) {
    const scope = cached.scopes.get(executionPath(ancestor));

    if (scope) {
      // A different plan may have omitted this field. Do not treat a sibling's shared mapping
      // as proof that this execution loaded it.
      return (
        scope[`${type}@${responsePath(path).slice(responsePath(ancestor).length + 1)}`] ?? null
      );
    }
  }

  return cached.mappings.get(cacheKey(type, path)) ?? null;
}

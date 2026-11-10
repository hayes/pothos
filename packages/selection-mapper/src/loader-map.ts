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
 * Per execution: the mappings recorded so far.
 *
 * `scopes` holds what a plan recorded beneath a field execution: everything resolved beneath it was
 * loaded by that plan, so it answers for all of it, and for nothing else. `rows` holds a mapping
 * from a plan that loaded one row alone, and answers for that row only. A mapping carries the
 * position a connection pages with, so a row answering from another row's mapping would page with
 * arguments its own data was never fetched with. `rowScoped` stays false while nothing has been
 * recorded there, so a request whose rows were all loaded the same way pays nothing for the row
 * tier.
 *
 * `scopes` and `rows` are keyed by a field execution's place (see `placeOf`), which tells sibling
 * rows apart, in weak maps: a `Map` holding every path link of a request tripled the time spent
 * collecting garbage.
 */
interface Cache {
  places: Map<string, object>;
  rows: WeakMap<object, WeakMap<object, Map<string, Mapping>>>;
  rowScoped: boolean;
  scopes: WeakMap<object, Mappings>;
}

/** Per context: the cache of each execution, by `executionOf`. */
const contextCaches = createContextCache(() => new WeakMap<object, Cache>());

/**
 * An object the executor builds once per execution, and once per event of a subscription, and
 * hands to every resolver in it, @defer and @stream payloads included:
 *
 * - graphql-js 17: the `getAbortSignal` of the execution.
 * - graphql-js 16 and @graphql-tools/executor (Yoga): the root link of the path. They build one
 *   path chain per execution or event, linking each field to its parent's, so every resolver
 *   beneath a root field shares its link, and the `subscribe` resolver has its own. Their fields'
 *   links carry a `typename`. A root field doesn't share its link with the others, so each root
 *   field has a cache of its own, which is all it reads.
 * - graphql-jit: the coerced `variableValues`. It builds a new path, without `typename`, for every
 *   resolver, but coerces the variables afresh for every execution and event.
 */
function executionOf(info: GraphQLResolveInfo): object {
  const signal = (info as { getAbortSignal?: object }).getAbortSignal;

  if (signal) {
    return signal;
  }

  let { path } = info;

  if (path.typename === undefined) {
    return info.variableValues;
  }

  while (path.prev) {
    path = path.prev;
  }

  return path;
}

function cache(ctx: object, info: GraphQLResolveInfo): Cache {
  const executions = contextCaches(ctx);
  const execution = executionOf(info);
  let cached = executions.get(execution);

  if (!cached) {
    cached = {
      places: new Map(),
      rows: new WeakMap(),
      rowScoped: false,
      scopes: new WeakMap(),
    };
    executions.set(execution, cached);
  }

  return cached;
}

/**
 * Where `path`, a link of `info.path`, sits in its execution: the link itself, where the executor
 * builds one per field execution and shares it with the resolvers beneath, which a field's link
 * carrying a `typename` tells. Where it builds a new path for every resolver (graphql-jit), an
 * object standing for the path's keys, list indices included.
 */
function placeOf(cached: Cache, info: GraphQLResolveInfo, path: GraphQLResolveInfo['path']) {
  if (info.path.typename !== undefined) {
    return path;
  }

  const at = executionPath(path);
  let place = cached.places.get(at);

  if (!place) {
    place = {};
    cached.places.set(at, place);
  }

  return place;
}

/**
 * The entries of `cache` for the operation `info` is in. Keyed on its `variableValues`, which
 * every executor coerces afresh for each operation, so operations sharing a context never share
 * an entry. The events of a subscription may share them, so a plan cached here runs its `select`
 * and `query` callbacks once for all of them; use `forExecution` where they read per-event state.
 */
export function forOperation<T>(
  cache: WeakMap<object, Map<string, T>>,
  info: GraphQLResolveInfo,
): Map<string, T> {
  return entriesFor(cache, info.variableValues);
}

/**
 * The entries of `cache` for the execution `info` is in, by `executionOf`, as mappings are kept:
 * each event of a subscription gets its own, and @defer and @stream payloads share their
 * execution's.
 */
export function forExecution<T>(
  cache: WeakMap<object, Map<string, T>>,
  info: GraphQLResolveInfo,
): Map<string, T> {
  return entriesFor(cache, executionOf(info));
}

function entriesFor<T>(cache: WeakMap<object, Map<string, T>>, key: object): Map<string, T> {
  let entries = cache.get(key);

  if (!entries) {
    entries = new Map();
    cache.set(key, entries);
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

/**
 * Memoised per path link, as `pathKeys` is. Built only where paths are rebuilt for every resolver,
 * so it saves the walk over a resolver's ancestors from building each prefix again.
 */
const executionPaths = new WeakMap<object, string>();

/** Every key of a response path, list indices included, joined by `.`. */
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

/** A number for each field node seen, by identity. Weak, so the nodes go with their document. */
const fieldNodeIds = new WeakMap<object, number>();
let nextFieldNodeId = 0;

/**
 * `cacheKey(type, info.path)` and the identity of every node in `info.fieldNodes`. The path keeps
 * each place in the response apart, list indices aside, so the root fields of a mutation, which run
 * in turn and whose callbacks may read what an earlier one changed, never share a plan. The nodes
 * decide what a plan loads: fragments on different types can merge different nodes into one
 * response path, so a plan keyed on the path alone would be reused for a field asking for
 * something else.
 */
export function fieldKey(type: string, info: GraphQLResolveInfo): string {
  let key = cacheKey(type, info.path);

  for (const node of info.fieldNodes) {
    let id = fieldNodeIds.get(node);

    if (id === undefined) {
      id = nextFieldNodeId++;
      fieldNodeIds.set(node, id);
    }

    key += `:${id}`;
  }

  return key;
}

/** `row` if a mapping can be hung off it. A root field resolves with no parent value at all. */
function ownerOf(row: unknown): object | null {
  return typeof row === 'object' && row !== null ? row : null;
}

/**
 * Records `mapping` for this field execution against `row` alone.
 */
function claimForRow(cached: Cache, type: string, mapping: Mapping, row: object, place: object) {
  let byPlace = cached.rows.get(row);
  if (!byPlace) {
    byPlace = new WeakMap();
    cached.rows.set(row, byPlace);
    cached.rowScoped = true;
  }
  let own = byPlace.get(place);
  if (!own) {
    own = new Map();
    byPlace.set(place, own);
  }
  own.set(type, mapping);
}

/**
 * Records the mappings of a plan rooted at the field `info` resolves, under that field's path.
 * The plan loaded the whole field, so its mappings answer for everything resolved beneath this
 * execution of it. Multiple plans can contribute to one field (Relay nodes of different model
 * types share the list's path), so later contributions replace matching keys and retain others.
 */
export function setLoaderMappings(ctx: object, info: GraphQLResolveInfo, mappings: Mappings) {
  const cached = cache(ctx, info);
  const place = placeOf(cached, info, info.path);
  const previous = cached.scopes.get(place);
  cached.scopes.set(place, previous ? { ...previous, ...mappings } : mappings);
}

/**
 * Records a row's mappings and scopes its descendants to this concrete field execution. A
 * descendant's parent is a different object, so row identity alone cannot carry its plan through
 * a relation, connection wrapper, or list. The place keeps list indices to isolate siblings.
 */
export function setRowMappings(ctx: object, info: GraphQLResolveInfo, mappings: Mappings) {
  const cached = cache(ctx, info);

  cached.scopes.set(placeOf(cached, info, info.path), mappings);
}

/**
 * Records the mapping of the field `info` resolves, from a plan that loaded `row` alone, against
 * `row`: the field's lookup on `row` answers from it whatever the field's other rows were loaded
 * with.
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
  const owner = ownerOf(row);
  const place = placeOf(cached, info, info.path);

  if (owner) {
    claimForRow(cached, info.parentType.name, mapping, owner, place);
  }

  cached.scopes.set(place, mapping.nested);
}

/**
 * The mapping recorded for the field `info` resolves on `row`, preferring one recorded for that
 * row over the plan's. `row` is the value whose data the mapping describes — the resolver's
 * parent. The plan's comes from the nearest field execution above that recorded one: with none
 * above, no plan loaded `row`, whatever was recorded for another row at the same path.
 */
export function getLoaderMapping(
  ctx: object,
  info: GraphQLResolveInfo,
  type: string,
  row?: unknown,
): Mapping | null {
  const { path } = info;
  const cached = cache(ctx, info);

  if (cached.rowScoped) {
    const owner = ownerOf(row);
    const own =
      owner &&
      cached.rows
        .get(owner)
        ?.get(placeOf(cached, info, path))
        ?.get(type);

    if (own) {
      return own;
    }
  }

  for (let ancestor = path.prev; ancestor; ancestor = ancestor.prev) {
    const scope = cached.scopes.get(placeOf(cached, info, ancestor));

    if (scope) {
      // A different plan may have omitted this field. Do not treat a sibling's shared mapping
      // as proof that this execution loaded it.
      return (
        scope[`${type}@${responsePath(path).slice(responsePath(ancestor).length + 1)}`] ?? null
      );
    }
  }

  return null;
}

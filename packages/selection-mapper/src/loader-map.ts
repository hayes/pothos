import { createContextCache, isThenable } from '@pothos/core';
import type { GraphQLResolveInfo, OperationDefinitionNode } from 'graphql';
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
 * apart. `subscribed` is, for a subscription event, the execution of the `subscribe` that
 * yielded its payload: what that `subscribe` planned is what the payload holds. `planned` is set
 * when a plan's query is handed out, and cleared when a `subscribe` yields the payload it loaded.
 */
interface Cache {
  mappings: Map<string, Mapping>;
  rehomed: Map<string, Map<string, string>>;
  rows: WeakMap<object, Map<string, Map<string, Mapping>>>;
  rowScoped: boolean;
  scopes: Map<string, Mappings>;
  operation: OperationDefinitionNode;
  planned: boolean;
  subscribed: Cache | null;
}

/**
 * Per context: the cache of each execution, and the `subscribe` execution each payload was
 * yielded by, or null for a payload two of them yielded.
 */
const contextCaches = createContextCache(() => ({
  executions: new WeakMap<object, Cache>(),
  payloads: new WeakMap<object, Cache | null>(),
}));

/**
 * The object an executor makes once per execution and puts in the info of every resolver in it.
 * graphql-js 17 gives each execution, and each subscription event, its own `getAbortSignal`.
 * graphql-js 16 and graphql-jit have none, but coerce `variableValues` afresh for each execution
 * and each event. Not the path: graphql-jit builds a new one for every resolver.
 */
function executionOf(info: GraphQLResolveInfo): object {
  return (info as { getAbortSignal?: object }).getAbortSignal ?? info.variableValues;
}

/** The cache of the execution `info` is in. */
function cache(ctx: object, info: GraphQLResolveInfo): Cache {
  const caches = contextCaches(ctx);
  const execution = executionOf(info);
  let cached = caches.executions.get(execution);

  if (!cached) {
    const payload = ownerOf(info.rootValue);
    const subscribed = payload && caches.payloads.get(payload);

    cached = {
      mappings: new Map(),
      rehomed: new Map(),
      rows: new WeakMap(),
      rowScoped: false,
      scopes: new Map(),
      operation: info.operation,
      planned: false,
      subscribed: subscribed?.operation === info.operation ? subscribed : null,
    };
    caches.executions.set(execution, cached);
  }

  return cached;
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
  const prefix = responsePath(info.path);
  const keys = rehomedKeys(cached, prefix);
  const at = executionPath(info.path);
  const previous = cached.scopes.get(at);
  cached.scopes.set(at, previous ? { ...previous, ...mappings } : mappings);
  cached.planned = true;

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
  cache(ctx, info).scopes.set(executionPath(info.path), mappings);
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
  const owner = ownerOf(row);

  if (owner) {
    claimForRow(cached, info.parentType.name, mapping, owner, info.path);
  }

  cached.scopes.set(executionPath(info.path), mapping.nested);
}

/**
 * The mapping recorded for the field `info` resolves on `row`, preferring one recorded for that
 * row over the plan's. `row` is the value whose data the mapping describes — the resolver's
 * parent. A subscription event's resolvers fall back to what its `subscribe` recorded.
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

  const key = cacheKey(type, path);

  return cached.mappings.get(key) ?? cached.subscribed?.mappings.get(key) ?? null;
}

/**
 * `events`, what a subscription field's `subscribe` returned, with the payloads it loaded linked
 * to that `subscribe`'s execution. The execution of an event, whose root value is its payload,
 * then falls back to the mappings that `subscribe` recorded: a payload it loaded with a planned
 * query holds what that plan selected.
 *
 * A planned query vouches for the one payload yielded after it was handed out, so a payload
 * yielded with no planned query since the previous one (a row from a pubsub, say) is not linked
 * and its resolvers load their own data. A payload yielded by two subscriptions sharing the
 * context is linked to neither, and a value that is not an async iterable is returned as is.
 */
export function linkSubscriptionEvents(
  ctx: object,
  info: GraphQLResolveInfo,
  events: unknown,
): unknown {
  if (isThenable(events)) {
    return events.then((resolved) => linkSubscriptionEvents(ctx, info, resolved));
  }

  if (!isAsyncIterable(events)) {
    return events;
  }

  const caches = contextCaches(ctx);
  const subscribed = cache(ctx, info);
  const link = (result: IteratorResult<unknown>) => {
    if (result.done) {
      return result;
    }

    const payload = subscribed.planned ? ownerOf(result.value) : null;

    subscribed.planned = false;

    if (payload) {
      const held = caches.payloads.get(payload);

      caches.payloads.set(payload, held === undefined || held === subscribed ? subscribed : null);
    }

    return result;
  };

  const linked: AsyncIterable<unknown> = {
    [Symbol.asyncIterator]() {
      const iterator = events[Symbol.asyncIterator]();
      const wrapped: AsyncIterator<unknown> = {
        next: (...args) => Promise.resolve(iterator.next(...args)).then(link),
      };

      const { return: end, throw: fail } = iterator;

      // A generator can yield from a `catch` or `finally`, and executors still run that event.
      if (end) {
        wrapped.return = (value) => Promise.resolve(end.call(iterator, value)).then(link);
      }

      if (fail) {
        wrapped.throw = (error) => Promise.resolve(fail.call(iterator, error)).then(link);
      }

      return wrapped;
    },
  };

  return linked;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

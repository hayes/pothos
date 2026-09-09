import { isThenable } from '@pothos/core';
import {
  type IndirectInclude,
  type PathSegment,
  selectedFieldNames,
  queryFromWalk as walkQueryFromWalk,
  selectionStateFromInfo as walkSelectionStateFromInfo,
  walkFromInfo as walkWalkFromInfo,
} from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import { type DrizzleWalk, drizzleAdapter } from './adapter.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import type { SelectionMap } from './selections.js';

export type { IndirectInclude };
export { selectedFieldNames };

export interface QueryFromInfoOptions<T extends SelectionMap> {
  config: PothosDrizzleSchemaConfig;
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  select?: T;
  path?: PathSegment[];
  paths?: PathSegment[][];
  /** Records the walk's merges so `queryFromWalk` can put a resolver's selection first. */
  replayable?: boolean;
}

export function queryFromInfo<T extends SelectionMap>({
  config,
  select,
  ...options
}: QueryFromInfoOptions<T>): T {
  const walk = walkWalkFromInfo(drizzleAdapter(config), {
    ...options,
    // A `select` without `columns` merges as "no columns yet", not "every column".
    initial: select ? { columns: {}, ...select } : undefined,
  });

  if (!walk) {
    // Nothing is planned under the paths: the caller gets its own selection back untouched.
    return (select ?? {}) as T;
  }

  return (
    isThenable(walk)
      ? walk.then((settled) => walkQueryFromWalk(settled as DrizzleWalk))
      : walkQueryFromWalk(walk)
  ) as T;
}

/**
 * The walk for the field `info` resolves (or `typeName`), nothing recorded: a promise while a
 * select beneath the field is async, undefined when `paths` are given and nothing is selected
 * under them. The model loader's, and the first step of a `drizzleField` resolve (replayable, so
 * the resolver's `query()` selection can come first).
 */
export function walkFromInfo({
  config,
  ...options
}: Omit<QueryFromInfoOptions<SelectionMap>, 'select'>): DrizzleWalk | undefined {
  return walkWalkFromInfo(drizzleAdapter(config), options);
}

/**
 * The query for a walk `walkFromInfo` returned, settled: the caller's `select` first, the walked
 * plan after it, the mappings recorded, and the query serialized. This is how the `query()`
 * builder handed to a `drizzleField` or `drizzleConnection` resolver stays synchronous once a
 * selection beneath the field is async, with the precedence of `queryFromInfo`: a relation the
 * document also plans with other arguments loads on its own.
 */
export function queryFromWalk<T extends SelectionMap>(
  walk: DrizzleWalk | undefined,
  { select }: QueryFromInfoOptions<T>,
): T {
  if (!walk) {
    // Nothing is selected under the paths: the caller gets its own selection back.
    return (select ?? {}) as T;
  }

  // A `select` without `columns` merges as "no columns yet", not "every column".
  return walkQueryFromWalk(walk, select ? { columns: {}, ...select } : undefined) as T;
}

/** The walk loading the field `info` resolves for its parent row (the model loader's query). */
export function selectionStateFromInfo(
  config: PothosDrizzleSchemaConfig,
  context: object,
  info: GraphQLResolveInfo,
): DrizzleWalk {
  return walkSelectionStateFromInfo(drizzleAdapter(config), context, info);
}

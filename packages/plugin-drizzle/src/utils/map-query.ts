import { isThenable, PothosValidationError } from '@pothos/core';
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
 * under them. The model loader's, and the first step of a `drizzleField` resolve.
 */
export function walkFromInfo({
  config,
  ...options
}: Omit<QueryFromInfoOptions<SelectionMap>, 'select'>): DrizzleWalk | undefined {
  return walkWalkFromInfo(drizzleAdapter(config), options);
}

/**
 * The query for a walk `walkFromInfo` returned, settled: the caller's `select` merged into it,
 * the mappings recorded, and the query serialized. This is how the `query()` builder handed to a
 * `drizzleField` or `drizzleConnection` resolver stays synchronous once a selection beneath the
 * field is async: the document is planned first, and `select` is merged into the settled plan.
 * A `select` that repeats a planned relation or extra with other arguments keeps the precedence
 * of `queryFromInfo` (the caller's selection first, the document after it) by planning again,
 * which is only possible while nothing beneath the field is async.
 */
export function queryFromWalk<T extends SelectionMap>(
  walk: DrizzleWalk | undefined,
  options: QueryFromInfoOptions<T>,
): T {
  const { config, select } = options;

  if (!walk) {
    // Nothing is selected under the paths: the caller gets its own selection back.
    return (select ?? {}) as T;
  }

  const initial = select ? { columns: {}, ...select } : undefined;
  const conflict = initial && drizzleAdapter(config).typeLevelConflict(walk.root, initial);

  if (!conflict) {
    return walkQueryFromWalk(walk, initial) as T;
  }

  const query = queryFromInfo(options);

  if (isThenable(query)) {
    const { info } = walk.env;

    throw new PothosValidationError(
      `The ${conflict.kind} "${conflict.name}" passed to query() in the resolver for ${info.parentType.name}.${info.fieldName} conflicts with the arguments a selection beneath the field planned for it, and a selection beneath the field is async. Move the ${conflict.kind}'s arguments to the field that selects it.`,
    );
  }

  return query;
}

/** The walk loading the field `info` resolves for its parent row (the model loader's query). */
export function selectionStateFromInfo(
  config: PothosDrizzleSchemaConfig,
  context: object,
  info: GraphQLResolveInfo,
): DrizzleWalk {
  return walkSelectionStateFromInfo(drizzleAdapter(config), context, info);
}

import { isThenable } from '@pothos/core';
// The plugin's own entry points wrap the mapper's, so the mapper is reached through its namespace
// rather than through same-named imports.
import * as mapper from '@pothos/selection-mapper';
import {
  type IndirectInclude,
  type PathSegment,
  selectedFieldNames,
} from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import { type DrizzlePlan, drizzleAdapter } from './adapter.js';
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
  const plan = mapper.planFromInfo(drizzleAdapter(config), {
    ...options,
    // A `select` without `columns` merges as "no columns yet", not "every column".
    initial: select ? { columns: {}, ...select } : undefined,
  });

  if (!plan) {
    // Nothing is planned under the paths: the caller gets its own selection back untouched.
    return (select ?? {}) as T;
  }

  return (
    isThenable(plan)
      ? plan.then((settled) => mapper.queryFromPlan(settled as DrizzlePlan))
      : mapper.queryFromPlan(plan)
  ) as T;
}

/**
 * The plan for the field `info` resolves (or `typeName`), nothing recorded: a promise while a
 * select beneath the field is async, undefined when `paths` are given and nothing is selected
 * under them. The model loader's, and the first step of a `drizzleField` resolve, whose
 * merges are recorded so the resolver's `query()` selection can come first.
 */
export function planFromInfo({
  config,
  ...options
}: Omit<QueryFromInfoOptions<SelectionMap>, 'select'>): DrizzlePlan | undefined {
  return mapper.planFromInfo(drizzleAdapter(config), options);
}

/**
 * The query for a plan `planFromInfo` returned, settled: the caller's `select` first, the walked
 * plan after it, the mappings recorded, and the query serialized. This is how the `query()`
 * builder handed to a `drizzleField` or `drizzleConnection` resolver stays synchronous once a
 * selection beneath the field is async, with the precedence of `queryFromInfo`: a relation the
 * document also plans with other arguments loads on its own.
 */
export function queryFromPlan<T extends SelectionMap>(
  plan: DrizzlePlan | undefined,
  { select }: QueryFromInfoOptions<T>,
): T {
  if (!plan) {
    // Nothing is selected under the paths: the caller gets its own selection back.
    return (select ?? {}) as T;
  }

  // A `select` without `columns` merges as "no columns yet", not "every column".
  return mapper.queryFromPlan(plan, select ? { columns: {}, ...select } : undefined) as T;
}

/** The plan loading the field `info` resolves for its parent row (the model loader's query). */
export function rowPlanFromInfo(
  config: PothosDrizzleSchemaConfig,
  context: object,
  info: GraphQLResolveInfo,
): DrizzlePlan {
  return mapper.rowPlanFromInfo(drizzleAdapter(config), context, info);
}

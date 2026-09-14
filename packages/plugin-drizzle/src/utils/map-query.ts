import { isThenable, type MaybePromise } from '@pothos/core';
import { type PathSegment, Plan } from '@pothos/selection-mapper';
import type { DBQueryConfig } from 'drizzle-orm';
import type { GraphQLResolveInfo } from 'graphql';
import { type DrizzlePlan, drizzleAdapter } from './adapter.js';
import { checkAwaitSelections } from './await-selections.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import type { SelectionMap } from './selections.js';

export interface QueryFromInfoOptions<Await extends boolean = false> {
  config: PothosDrizzleSchemaConfig;
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  path?: PathSegment[];
  paths?: PathSegment[][];
  /** Whether the caller will await the query. Async selections otherwise throw. */
  awaitSelections?: Await;
}

/** Only explicitly selected columns are guaranteed; planning metadata is not part of the query. */
export type QueryFromInfoResult<T> = Omit<T, keyof QueryFromInfoOptions<boolean> | 'columns'> & {
  columns: T extends { columns: infer Columns extends {} } ? Columns : {};
};

/** A boolean async option must account for promises, just like Prisma's helper. */
export type QueryFromInfoReturn<T, Await extends boolean> = [Await] extends [false]
  ? QueryFromInfoResult<T>
  : MaybePromise<QueryFromInfoResult<T>>;

/** Merge query options with the GraphQL selection and return a query ready for Drizzle. */
export function queryFromInfo<const T extends object, Await extends boolean = false>({
  config,
  context,
  info,
  typeName,
  path,
  paths,
  awaitSelections,
  ...selection
}: QueryFromInfoOptions<Await> &
  T &
  Record<
    Exclude<keyof T, keyof QueryFromInfoOptions<Await> | keyof DBQueryConfig<'many'>>,
    never
  >): QueryFromInfoReturn<T, Await> {
  const plan = planFromInfo({ config, context, info, typeName, path, paths });
  const query = isThenable(plan)
    ? plan.then((settled) => queryFromPlan(settled as DrizzlePlan | undefined, selection))
    : queryFromPlan(plan, selection);

  return checkAwaitSelections(
    query,
    awaitSelections,
    'queryFromInfo',
    `${info.parentType.name}.${info.fieldName}`,
  ) as QueryFromInfoReturn<T, Await>;
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
}: Omit<QueryFromInfoOptions, 'awaitSelections'>): DrizzlePlan | undefined {
  return Plan.fromInfo(drizzleAdapter(config), options);
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
  select?: T,
): T {
  if (!plan) {
    // Nothing is selected under the paths: the caller gets its own selection back.
    return (select ?? {}) as T;
  }

  // A `select` without `columns` merges as "no columns yet", not "every column".
  return plan.query(select ? { columns: {}, ...select } : undefined) as T;
}

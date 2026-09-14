import { isThenable, type MaybePromise } from '@pothos/core';
import { type PathSegment, Plan } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import { type DrizzlePlan, drizzleAdapter } from './adapter.js';
import { checkAwaitSelections } from './await-selections.js';
import type { PothosDrizzleSchemaConfig } from './config.js';
import type { SelectionMap } from './selections.js';

export interface QueryFromInfoOptions<
  T extends SelectionMap = SelectionMap,
  Await extends boolean = false,
> {
  config: PothosDrizzleSchemaConfig;
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  select?: T;
  path?: PathSegment[];
  paths?: PathSegment[][];
  /** Whether the caller will await the query. Async selections otherwise throw. */
  awaitSelections?: Await;
}

/** Only explicitly selected columns are guaranteed on the resulting rows. */
export type QueryFromInfoResult<T> = Omit<T, 'columns'> & {
  columns: T extends { columns: infer Columns extends {} } ? Columns : {};
};

/** A boolean async option must account for promises, just like Prisma's helper. */
export type QueryFromInfoReturn<T extends SelectionMap, Await extends boolean> = [Await] extends [
  false,
]
  ? QueryFromInfoResult<T>
  : MaybePromise<QueryFromInfoResult<T>>;

/** Build a query synchronously unless the caller opts into awaiting async selections. */
export function queryFromInfo<const T extends SelectionMap = {}, Await extends boolean = false>({
  config,
  select,
  awaitSelections,
  ...options
}: QueryFromInfoOptions<T, Await>): QueryFromInfoReturn<T, Await> {
  const plan = Plan.fromInfo(drizzleAdapter(config), {
    ...options,
    // A `select` without `columns` merges as "no columns yet", not "every column".
    initial: select ? { columns: {}, ...select } : undefined,
  });

  const query = plan
    ? isThenable(plan)
      ? plan.then((settled) => (settled as DrizzlePlan).query())
      : plan.query()
    : (select ?? {});

  return checkAwaitSelections(
    query,
    awaitSelections,
    'queryFromInfo',
    `${options.info.parentType.name}.${options.info.fieldName}`,
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
}: Omit<QueryFromInfoOptions<SelectionMap>, 'select' | 'awaitSelections'>):
  | DrizzlePlan
  | undefined {
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

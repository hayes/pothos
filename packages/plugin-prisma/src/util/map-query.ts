import { isThenable, type MaybePromise } from '@pothos/core';
import { cacheKey, type PathSegment, Plan, selectedFieldNames } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { SelectionMap } from '../types.js';
import { type PrismaPlan, type PrismaPlayedPlan, prismaAdapter } from './adapter.js';
import { wrapWithUsageCheck } from './usage.js';

export { selectedFieldNames };

/**
 * What `queryFromInfo` returns. A given `include` puts the query in include mode, so the result
 * is `{ include }`. Otherwise it is whichever of `select` and `include` the walked type's mode
 * produced, both optional, so the result spreads into a prisma call either way: a type in select
 * mode keeps a given `select` as `select`, a type in include mode merges it into `include`; the
 * selected columns are on the rows in both.
 */
export type QueryFromInfoResult<Include> = undefined extends Include
  ? { select?: SelectionMap['select']; include?: SelectionMap['include'] }
  : { include: Include };

/**
 * The query for the field `info` resolves. A given `select` is merged as the initial selection;
 * for a type in include mode the plan still produces `include`, with the columns of that
 * `select` implied by the row.
 *
 * This is prisma's rule for turning a plan into a query, and it lives here because it is only
 * prisma's: drizzle seeds its plan with `{ columns: {}, ...select }` and hands back the caller's
 * bare `select`, and prisma-next emits onto a collection instead.
 */
export function queryFromInfo<
  Select extends SelectionMap['select'] | undefined = undefined,
  Include extends SelectionMap['include'] | undefined = undefined,
>({
  context,
  info,
  typeName,
  select,
  include,
  path = [],
  paths = [],
  withUsageCheck = false,
  skipDeferredFragments = true,
}: {
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  path?: PathSegment[];
  paths?: PathSegment[][];
  withUsageCheck?: boolean;
  skipDeferredFragments?: boolean;
} & (
  | { include?: Include; select?: never }
  | { select?: Select; include?: never }
)): QueryFromInfoResult<Include> {
  const initial = select ? { select } : include ? { include } : undefined;
  const plan = Plan.fromInfo(prismaAdapter, {
    context,
    info,
    typeName,
    path,
    paths,
    skipDeferredFragments,
    initial,
  }) as MaybePromise<PrismaPlan> | undefined;

  // Nothing is selected under the paths: there is nothing to plan and nothing to map, so the
  // caller gets back the selection it gave.
  const query = plan
    ? isThenable(plan)
      ? plan.then((settled) => settled.query())
      : plan.query()
    : (initial ?? {});

  if (!withUsageCheck) {
    return query as never;
  }

  // `onUnusedQuery`: the query is wrapped so reads on it can be observed; a promise (A-7) is
  // wrapped once it settles.
  return (
    isThenable(query)
      ? query.then((settled) => wrapWithUsageCheck(settled as object))
      : wrapWithUsageCheck(query)
  ) as never;
}

/**
 * L-4: the query for the field `info` resolves, from a plan `plans` holds per `Type@path`. The
 * fallback path in `wrapResolve` runs once per row of the list its parent came from and asked
 * for a fresh walk every time; `ModelLoader.queryCache` caches its own entry point this way and
 * under this key, and this is the same cache for the same reason.
 *
 * What is written is unchanged. The plan is settled once and played per call, so each caller
 * still gets a query of its own and each call still records the plan's mappings on the shared
 * tier — under the same keys, since `responsePath` drops list indices and every row of a list
 * therefore writes under the path the first row wrote under. All that goes away is the re-walk.
 */
export function fallbackQueryFromInfo(
  plans: Map<string, MaybePromise<PrismaPlan>>,
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments = true,
): MaybePromise<SelectionMap> {
  const key = cacheKey(info.parentType.name, info.path);
  let plan = plans.get(key);

  if (!plan) {
    plan = Plan.fromInfo(prismaAdapter, {
      context,
      info,
      skipDeferredFragments,
    }) as MaybePromise<PrismaPlan>;

    plans.set(key, plan);
  }

  return isThenable(plan) ? plan.then((settled) => settled.query()) : plan.query();
}

/**
 * The plan loading the field `info` resolves for its parent row (the model loader's query),
 * already played: an E-2 plan is never played behind another selection.
 */
export function rowPlanFromInfo(
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments: boolean,
): PrismaPlayedPlan {
  return Plan.forParentRow(prismaAdapter, context, info, skipDeferredFragments);
}

import { isThenable, type MaybePromise } from '@pothos/core';
import { cacheKey, type PathSegment, Plan } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { SelectionMap } from '../types.js';
import { type PrismaPlan, prismaAdapter } from './adapter.js';
import { wrapWithUsageCheck } from './usage.js';

/**
 * What `queryFromInfo` returns, typed so the result round trips: spread it into a prisma call and
 * the rows carry what was asked for, with types.
 *
 * A given `include` puts the query in include mode, so the result is `{ include }`. A given
 * `select` keeps its literal type, so prisma narrows the rows to the selected columns. With
 * neither, nothing narrows the rows and the result is whichever of the two the walked type's mode
 * produced, both optional.
 *
 * `{ select: Select }` is what the rows hold, not always what the query is: only a type in select
 * mode returns the `select` (widened by the walk, so the rows are a superset of `Select`). A type
 * in include mode merges it into `include` instead, dropping the columns and keeping the
 * relations, and an include-mode query loads every column — so the given columns and relations are
 * on the rows there too. Reading `Select`'s keys off a row is therefore sound in both modes;
 * reading `.select` off the query itself is not, since an include-mode type does not return one.
 */
export type QueryFromInfoResult<Select, Include> = undefined extends Include
  ? undefined extends Select
    ? { select?: SelectionMap['select']; include?: SelectionMap['include'] }
    : { select: Select; include?: SelectionMap['include'] }
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
)): QueryFromInfoResult<Select, Include> {
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

  // `onUnusedQuery`: the query is wrapped so reads on it can be observed; a promise is wrapped
  // once it settles.
  return (
    isThenable(query)
      ? query.then((settled) => wrapWithUsageCheck(settled as object))
      : wrapWithUsageCheck(query)
  ) as never;
}

/**
 * The query for the field `info` resolves, from a plan `plans` holds per `Type@path`. The
 * fallback in `wrapResolve` runs once per row of the list its parent came from, so the plan is
 * walked and settled once and played per call: each caller still gets a query of its own, and
 * every row of a list records under the same mapping keys, since `responsePath` drops list
 * indices.
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

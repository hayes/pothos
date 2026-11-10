import { type MaybePromise } from '@pothos/core';
import { type PathSegment } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { SelectionMap } from '../types.js';
import { type PrismaPlan } from './adapter.js';
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
export type QueryFromInfoResult<Select, Include> = undefined extends Include ? undefined extends Select ? {
    select?: SelectionMap['select'];
    include?: SelectionMap['include'];
} : {
    select: Select;
    include?: SelectionMap['include'];
} : {
    include: Include;
};
/**
 * What `queryFromInfo` returns for a given `awaitSelections`. `[Await] extends [false]` rather than
 * `Await extends true`, so a caller passing a `boolean` variable — which infers `Await` as
 * `boolean`, neither literal — is handed the promise to deal with, rather than a synchronous type
 * it cannot rely on.
 */
export type QueryFromInfoReturn<Select, Include, Await extends boolean> = [Await] extends [false] ? QueryFromInfoResult<Select, Include> : MaybePromise<QueryFromInfoResult<Select, Include>>;
/**
 * The query for the field `info` resolves. A given `select` is merged as the initial selection;
 * for a type in include mode the plan still produces `include`, with the columns of that
 * `select` implied by the row.
 *
 * This is prisma's rule for turning a plan into a query, and it lives here because it is only
 * prisma's: drizzle seeds its plan with `{ columns: {}, ...select }` and hands back the caller's
 * bare `select`, and prisma-next emits onto a collection instead.
 *
 * The query is synchronous unless `awaitSelections` says otherwise, and a subtree that plans
 * asynchronously throws rather than returning a promise the declared type denies.
 */
export declare function queryFromInfo<Select extends SelectionMap['select'] | undefined = undefined, Include extends SelectionMap['include'] | undefined = undefined, Await extends boolean = false>({ context, info, typeName, select, include, path, paths, withUsageCheck, skipDeferredFragments, awaitSelections, }: {
    context: object;
    info: GraphQLResolveInfo;
    typeName?: string;
    path?: PathSegment[];
    paths?: PathSegment[][];
    withUsageCheck?: boolean;
    skipDeferredFragments?: boolean;
    /**
     * Whether the caller will await the query. Without it, a field with an async selection beneath
     * it throws instead of returning a promise.
     */
    awaitSelections?: Await;
} & ({
    include?: Include;
    select?: never;
} | {
    select?: Select;
    include?: never;
})): QueryFromInfoReturn<Select, Include, Await>;
export type FallbackPlanRecipe = () => {
    typeName?: string;
    paths?: PathSegment[][];
    initial?: SelectionMap;
};
/**
 * The query for the field `info` resolves, from a plan `plans` holds per parent type, response
 * path and field nodes (see `fieldKey`). The fallback in `wrapResolve` runs once per row of the
 * list its parent came from, so the plan is walked and settled once and played per call: each
 * caller still gets a query of its own, and every row of a list records under the same mapping
 * keys, since `responsePath` drops list indices.
 */
export declare function fallbackQueryFromInfo(plans: Map<string, MaybePromise<PrismaPlan>>, context: object, info: GraphQLResolveInfo, skipDeferredFragments?: boolean, recipe?: FallbackPlanRecipe): MaybePromise<SelectionMap>;

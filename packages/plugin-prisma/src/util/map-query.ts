import { isThenable } from '@pothos/core';
import {
  type PathSegment,
  selectedFieldNames,
  queryFromInfo as walkQueryFromInfo,
  selectionStateFromInfo as walkSelectionStateFromInfo,
} from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { SelectionMap } from '../types.js';
import { type PrismaWalk, prismaAdapter } from './adapter.js';
import { wrapWithUsageCheck } from './usage.js';

export { selectedFieldNames };

/**
 * What `queryFromInfo` returns. The walked type's mode wins: a given `include` puts the query in
 * include mode, so the result is `{ include }`; with neither given it is whichever of the two the
 * mode produced, both optional so the result spreads into a prisma call either way. A given
 * `select` is kept as `{ select }` by a type in select mode, but a type in include mode merges it
 * into an `include` query (`{ include }`, or `{}` when nothing is included), so the result is the
 * union of the two; the selected columns are on the rows in both.
 */
export type QueryFromInfoResult<Select, Include> = undefined extends Select
  ? undefined extends Include
    ? { select?: SelectionMap['select']; include?: SelectionMap['include'] }
    : { include: Include }
  :
      | { select: Select; include?: undefined }
      | { select?: undefined; include?: SelectionMap['include'] };

/**
 * The query for the field `info` resolves. A given `select` is merged as the initial selection;
 * for a type in include mode the walk still produces `include`, with the columns of that
 * `select` implied by the row.
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
  const query = walkQueryFromInfo(prismaAdapter, {
    context,
    info,
    typeName,
    path,
    paths,
    skipDeferredFragments,
    initial: select ? { select } : include ? { include } : undefined,
  });

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

/** The walk loading the field `info` resolves for its parent row (the model loader's query). */
export function selectionStateFromInfo(
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments: boolean,
): PrismaWalk {
  return walkSelectionStateFromInfo(prismaAdapter, context, info, skipDeferredFragments);
}

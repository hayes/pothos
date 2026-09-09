import {
  selectedFieldNames,
  queryFromInfo as walkQueryFromInfo,
  selectionStateFromInfo as walkSelectionStateFromInfo,
} from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { SelectionMap } from '../types.js';
import { type PrismaWalk, prismaAdapter } from './adapter.js';

export { selectedFieldNames };

/**
 * What `queryFromInfo` returns: the shape that was passed in, or, when neither `select` nor
 * `include` was given, whichever of the two the walked type's mode produced. Both keys are
 * optional so the result spreads into a prisma call either way.
 */
export type QueryFromInfoResult<Select, Include> = undefined extends Select
  ? undefined extends Include
    ? { select?: SelectionMap['select']; include?: SelectionMap['include'] }
    : { include: Include }
  : { select: Select };

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
  path?: (string | { name: string; type?: string })[];
  paths?: (string | { name: string; type?: string })[][];
  withUsageCheck?: boolean;
  skipDeferredFragments?: boolean;
} & (
  | { include?: Include; select?: never }
  | { select?: Select; include?: never }
)): QueryFromInfoResult<Select, Include> {
  return walkQueryFromInfo(prismaAdapter, {
    context,
    info,
    typeName,
    path,
    paths,
    withUsageCheck,
    skipDeferredFragments,
    initial: select ? { select } : include ? { include } : undefined,
  }) as never;
}

/** The walk loading the field `info` resolves for its parent row (the model loader's query). */
export function selectionStateFromInfo(
  context: object,
  info: GraphQLResolveInfo,
  skipDeferredFragments: boolean,
): PrismaWalk {
  return walkSelectionStateFromInfo(prismaAdapter, context, info, skipDeferredFragments);
}

import {
  selectedFieldNames,
  queryFromInfo as walkQueryFromInfo,
  selectionStateFromInfo as walkSelectionStateFromInfo,
} from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { SelectionMap } from '../types.js';
import { type PrismaWalk, prismaAdapter } from './adapter.js';

export { selectedFieldNames };

export function queryFromInfo<
  Select extends SelectionMap['select'] | undefined = undefined,
  Include extends SelectionMap['select'] | undefined = undefined,
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
)): undefined extends Include
  ? {
      select: Select;
    }
  : { include: Include } {
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

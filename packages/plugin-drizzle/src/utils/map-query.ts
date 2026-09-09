import {
  type IndirectInclude,
  selectedFieldNames,
  queryFromInfo as walkQueryFromInfo,
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
  path?: (string | { name: string; type?: string })[];
  paths?: (string | { name: string; type?: string })[][];
  withUsageCheck?: boolean;
}

export function queryFromInfo<T extends SelectionMap>({
  config,
  select,
  ...options
}: QueryFromInfoOptions<T>): T {
  return walkQueryFromInfo(drizzleAdapter(config), {
    ...options,
    // A `select` without `columns` merges as "no columns yet", not "every column"; when nothing
    // is planned the caller gets its own selection back untouched.
    initial: select ? { columns: {}, ...select } : undefined,
    noMatch: select,
  }) as T;
}

/** The walk for a field's return type (or `typeName`), nothing recorded; the model loader's. */
export function walkFromInfo<T extends SelectionMap>({
  config,
  select,
  ...options
}: QueryFromInfoOptions<T>): DrizzleWalk {
  return walkWalkFromInfo(drizzleAdapter(config), {
    ...options,
    initial: select ? { columns: {}, ...select } : undefined,
  });
}

/** The walk loading the field `info` resolves for its parent row (the model loader's query). */
export function selectionStateFromInfo(
  config: PothosDrizzleSchemaConfig,
  context: object,
  info: GraphQLResolveInfo,
): DrizzleWalk {
  return walkSelectionStateFromInfo(drizzleAdapter(config), context, info);
}

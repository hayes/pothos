import type { GraphQLResolveInfo } from 'graphql';
import type { AnyContract } from '../types';
import { mapSelectionFromInfo, type PothosPrismaNextConfig } from './map-query';
import { renderSelection } from './render-selection';
import type { PrismaNextSelection } from './selection';

export {
  type IndirectInclude,
  type MapFromInfoOptions,
  mapSelectionFromInfo,
  type PothosPrismaNextConfig,
} from './map-query';
export { renderSelection } from './render-selection';
export type {
  BranchSelection,
  CountSelection,
  PaginationSpec,
  PrismaNextSelection,
  RefineCallback,
  RelationSelection,
} from './selection';

/**
 * Loose structural shape the mapper + renderer chain into. The real
 * orm-client `Collection` is fully typed, but the plugin only knows
 * the model name and columns at runtime — so a fully-typed Collection
 * would collapse `.select(name)` to `keyof never`. Add a method here
 * when orm-client adds one the mapper needs.
 */
export interface MapperCollection {
  select(...fields: string[]): MapperCollection;
  include(name: string, refine?: (rel: MapperCollection) => MapperCollection): MapperCollection;
  combine(spec: Record<string, unknown>): MapperCollection;
  count(): unknown;
  where(input: unknown): MapperCollection;
  orderBy(input: unknown): MapperCollection;
  take(n: number): MapperCollection;
  skip(n: number): MapperCollection;
}

export interface PreparedQuery {
  collection: MapperCollection;
  selection: PrismaNextSelection;
}

export function applySelectionToCollection(
  baseCollection: MapperCollection,
  info: GraphQLResolveInfo,
  contract: AnyContract,
  context: unknown,
  options: {
    paths?: string[][];
    path?: string[];
    extraColumns?: readonly string[];
    skipDeferredFragments?: boolean;
    typeName?: string;
    defaultConnectionSize?: number;
    maxConnectionSize?: number;
  } = {},
): PreparedQuery {
  // Plain assignment over conditional spreads — same observable behavior
  // (undefined leaves the consumer's default) but keeps the hidden
  // class stable across resolves.
  const config: PothosPrismaNextConfig = {
    contract,
    skipDeferredFragments: options.skipDeferredFragments ?? true,
    defaultConnectionSize: options.defaultConnectionSize,
    maxConnectionSize: options.maxConnectionSize,
  };
  const ctx = (context as object) ?? {};
  const selection = mapSelectionFromInfo({
    config,
    context: ctx,
    info,
    paths: options.paths,
    path: options.path,
    extraColumns: options.extraColumns,
    typeName: options.typeName,
  });
  const collection = renderSelection(selection, baseCollection, ctx, {
    defaultConnectionSize: options.defaultConnectionSize,
    maxConnectionSize: options.maxConnectionSize,
  });
  return { collection, selection };
}

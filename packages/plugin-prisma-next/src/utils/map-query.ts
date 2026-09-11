/**
 * The plugin's entry points into `@pothos/selection-mapper`: the plan of a resolver's `info`
 * emitted onto its collection.
 */
import { isThenable } from '@pothos/core';
import { type IndirectInclude, type PathSegment, Plan } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { AnyContract } from '../types.js';
import { emit, type MapperCollection, type PrismaNextPlan, prismaNextAdapter } from './adapter.js';

export type { IndirectInclude };

export interface ApplySelectionOptions {
  /** Descend through these paths from the field's return type (`[['edges', 'node'], ['nodes']]`). */
  paths?: PathSegment[][];
  path?: PathSegment[];
  /** Columns always read on the root, ahead of anything the selection adds (cursor and id columns). */
  extraColumns?: readonly string[];
  skipDeferredFragments?: boolean;
  /** Walk as this type instead of `info.returnType` (a `node(id:)` load of a concrete type). */
  typeName?: string;
}

/**
 * Walks the GraphQL info and emits the orm-client chain on `baseCollection`, returning the
 * augmented collection. The result is a promise only when a `select` callback beneath the
 * field returned one; a schema without async selections never sees one.
 */
export function applySelectionToCollection(
  baseCollection: MapperCollection,
  info: GraphQLResolveInfo,
  contract: AnyContract,
  context: unknown,
  options: ApplySelectionOptions = {},
): MapperCollection {
  // Next passes the original context to callbacks and does not use loader mapping caches.
  const ctx = context as object;
  const initial = options.extraColumns?.length ? { columns: options.extraColumns } : undefined;
  const adapter = prismaNextAdapter(contract);
  const plan = Plan.fromInfo(adapter, {
    context: ctx,
    info,
    typeName: options.typeName,
    path: options.path,
    paths: options.paths,
    initial,
    skipDeferredFragments: options.skipDeferredFragments,
  });

  if (!plan) {
    // Nothing is selected under the paths: only the caller's own columns are read.
    return emit(baseCollection, initial ?? {}, undefined, ctx);
  }

  // Serialize the play directly: query() also publishes mappings to an object-context cache,
  // but Next resolves selected rows through its own overlay.
  const finish = (settled: PrismaNextPlan) =>
    emit(baseCollection, adapter.toQuery(settled.play().root), settled.model, ctx);

  return isThenable(plan)
    ? (plan.then((settled) => finish(settled as PrismaNextPlan)) as unknown as MapperCollection)
    : finish(plan);
}

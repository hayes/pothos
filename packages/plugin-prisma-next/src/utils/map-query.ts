/**
 * The plugin's entry points into `@pothos/selection-mapper`: the plan of a resolver's `info`
 * emitted onto its collection.
 */
import { isThenable, type MaybePromise, PothosSchemaError } from '@pothos/core';
import { type IndirectInclude, type PathSegment, Plan } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { AnyContract } from '../types.js';
import { emit, type MapperCollection, type PrismaNextPlan, prismaNextAdapter } from './adapter.js';

export type { IndirectInclude };

export interface ApplySelectionOptions {
  skipDeferredFragments?: boolean;
  /** @internal Set when the builder has a Collection provider for fallback loads. */
  fallback?: boolean;
  /** Descend through these paths from the field's return type (`[['edges', 'node'], ['nodes']]`). */
  paths?: PathSegment[][];
  path?: PathSegment[];
  /** Columns always read on the root, ahead of anything the selection adds (cursor and id columns). */
  extraColumns?: readonly string[];
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
): MaybePromise<MapperCollection> {
  if (options.skipDeferredFragments && !options.fallback) {
    throw new PothosSchemaError(
      'skipDeferredFragments requires a Collection provider for fallback loading.',
    );
  }
  // Selection callbacks receive the application's original context.
  const ctx = context as object;
  const initial = options.extraColumns?.length ? { columns: options.extraColumns } : undefined;
  const adapter = prismaNextAdapter(contract, options.fallback);
  const plan = Plan.fromInfo(adapter, {
    context: ctx,
    info,
    typeName: options.typeName,
    path: options.path,
    paths: options.paths,
    initial,
    skipDeferredFragments: options.skipDeferredFragments ?? options.fallback ?? false,
  });

  if (!plan) {
    // Nothing is selected under the paths: only the caller's own columns are read.
    return emit(baseCollection, initial ?? {}, undefined, ctx);
  }

  // Publish coverage for manual helper callers too. Context-free eager helpers
  // retain their original behavior; fallback loading requires an object context.
  const finish = (settled: PrismaNextPlan) =>
    emit(
      baseCollection,
      ctx && typeof ctx === 'object' ? settled.query() : adapter.toQuery(settled.play().root),
      settled.model,
      ctx,
    );

  return isThenable(plan)
    ? Promise.resolve(plan).then((settled) => finish(settled as PrismaNextPlan))
    : finish(plan);
}

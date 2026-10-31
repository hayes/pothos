import {
  isThenable,
  type MaybePromise,
  PothosSchemaError,
  PothosValidationError,
} from '@pothos/core';
import { type IndirectInclude, type PathSegment, Plan } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { AnyContract } from '../types.js';
import {
  emit,
  type MapperCollection,
  type PrismaNextPlan,
  prismaNextAdapter,
  variantRelationProblem,
} from './adapter.js';

export type { IndirectInclude };

export interface ApplySelectionOptions {
  skipDeferredFragments?: boolean;
  /** @internal Set when the builder has a Collection provider for fallback loads. */
  fallback?: boolean;
  /** Paths to the selection from the field's return type (`[['edges', 'node'], ['nodes']]`). */
  paths?: PathSegment[][];
  path?: PathSegment[];
  /** Columns always read on the root, such as cursor and id columns. */
  extraColumns?: readonly string[];
  /** Walk as this type instead of `info.returnType` (a `node(id:)` load). */
  typeName?: string;
}

/** Returns a promise only when a `select` callback beneath the field is async. */
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
  const ctx = context as object;
  // Relations declared on a variant can only be planned on a collection narrowed to it.
  const variantValue = baseCollection.state?.variantValue;
  const variant = typeof variantValue === 'string' ? variantValue : undefined;
  const initial =
    options.extraColumns?.length || variant !== undefined
      ? {
          ...(options.extraColumns?.length ? { columns: options.extraColumns } : {}),
          ...(variant !== undefined ? { variant } : {}),
        }
      : undefined;
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
    return emit(baseCollection, initial ?? {}, undefined, ctx);
  }

  // `query()` records the plan's mappings on the context, so it needs an object context.
  const finish = (settled: PrismaNextPlan) => {
    const query =
      ctx && typeof ctx === 'object' ? settled.query() : adapter.toQuery(settled.play().root);
    const problem = variantRelationProblem(query, settled.model);
    if (problem) {
      throw new PothosValidationError(problem.message);
    }
    return emit(baseCollection, query, settled.model, ctx);
  };

  return isThenable(plan)
    ? Promise.resolve(plan).then((settled) => finish(settled as PrismaNextPlan))
    : finish(plan);
}

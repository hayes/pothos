import { isThenable, type MaybePromise, PothosValidationError } from '@pothos/core';
import { type PathSegment, Plan } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import {
  emit,
  type MapperCollection,
  type PrismaNextPlan,
  prismaNextAdapter,
  variantRelationProblem,
} from './adapter.js';
import type { PrismaNextConfig } from './config.js';

export interface ApplySelectionOptions {
  /** Paths to the selection from the field's return type (`[['edges', 'node'], ['nodes']]`). */
  paths?: PathSegment[][];
  /** Columns always read on the root, such as cursor columns. */
  extraColumns?: readonly string[];
}

/** Returns a promise only when a `select` callback beneath the field is async. */
export function applySelectionToCollection(
  baseCollection: MapperCollection,
  info: GraphQLResolveInfo,
  config: PrismaNextConfig,
  context: unknown,
  options: ApplySelectionOptions = {},
): MaybePromise<MapperCollection> {
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
  const ctx = context as object;
  const adapter = prismaNextAdapter(config.contract);
  const plan = Plan.fromInfo(adapter, {
    context: ctx,
    info,
    paths: options.paths,
    initial,
    skipDeferredFragments: config.skipDeferredFragments,
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

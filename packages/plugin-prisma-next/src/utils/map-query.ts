import { completeValue, type MaybePromise } from '@pothos/core';
import { type PathSegment, Plan } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import type { MapperCollection, PrismaNextPlan } from './adapter.js';
import type { PrismaNextConfig } from './config.js';
import type { PrismaNextQuery } from './selections.js';

export interface ApplySelectionOptions {
  /** Paths to the selection from the field's return type (`[['edges', 'node'], ['nodes']]`). */
  paths?: PathSegment[][];
  /** Columns always read on the root, such as cursor columns. */
  extraColumns?: readonly string[];
}

/** Returns a promise only when a `select` callback beneath the field is async. */
export function applySelectionToCollection(
  collection: MapperCollection,
  info: GraphQLResolveInfo,
  config: PrismaNextConfig,
  context: object,
  { paths, extraColumns }: ApplySelectionOptions = {},
): MaybePromise<MapperCollection> {
  const { adapter } = config;
  // Relations declared on a variant can only be planned on a collection narrowed to it.
  const variant = collection.state?.variantValue;
  const initial: PrismaNextQuery = {
    columns: extraColumns,
    args: typeof variant === 'string' ? { variant: { value: variant } } : {},
  };
  const plan = Plan.fromInfo(adapter, { context, info, paths, initial });

  if (!plan) {
    return extraColumns?.length ? collection.select(...extraColumns) : collection;
  }

  return completeValue(plan as MaybePromise<PrismaNextPlan>, (settled) =>
    adapter.emit(
      collection,
      // `query()` records the plan's mappings on the context, so it needs an object context.
      context && typeof context === 'object'
        ? settled.query()
        : adapter.toQuery(settled.play().root),
      settled.model,
      context,
    ),
  );
}

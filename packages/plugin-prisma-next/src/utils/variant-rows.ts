import type { MaybePromise } from '@pothos/core';
import type { GraphQLNamedType, GraphQLResolveInfo } from 'graphql';
import { getPluginConfig } from './config.js';
import { reloadFor } from './errors.js';
import type { PrismaNextRelation } from './model.js';

/**
 * Completes the rows of a relation that targets a variant model before its field returns them.
 * They loaded through the variant model's own accessor, which can't include the base model's
 * relations or, for a variant with a table of its own, read the base's columns, so the planner left
 * those out of the returned type's selection. One batched statement loads them for every parent, so
 * plugins listed before this one, such as scope-auth, and an interface's `resolveType`, see the
 * columns and to-one relations the type's `select` promises.
 */
export function completeVariantRows<T>(
  builder: object,
  relation: PrismaNextRelation,
  type: GraphQLNamedType | null | undefined,
  context: object,
  info: GraphQLResolveInfo,
  rows: T,
): MaybePromise<T> {
  const config = getPluginConfig(builder);
  const dropped =
    relation.targetVariantModel && type
      ? config.adapter.droppedBeneathVariantModel(type, relation)
      : undefined;
  if (!dropped || rows == null) {
    return rows;
  }
  const list = (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[];
  const completed = config.loader(context, relation.targetModel).completeRows(list, dropped);
  const found = completed && reloadFor(info, () => completed);
  // A row the base model narrowed to the variant doesn't have isn't of the variant. Only rows that
  // complete are checked, so without a completion such a row stays, and its fields fail to reload.
  return found ? found.then((kept) => (Array.isArray(rows) ? kept : (kept[0] ?? null)) as T) : rows;
}

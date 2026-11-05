import { completeValue, isThenable, type MaybePromise } from '@pothos/core';
import {
  type GraphQLNamedType,
  type GraphQLResolveInfo,
  getNamedType,
  getNullableType,
  isListType,
} from 'graphql';
import { getPluginConfig } from './config.js';
import { reloadFor } from './errors.js';
import type { PrismaNextRelation } from './model.js';
import { loadedThrough } from './selections.js';

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

/**
 * `completeVariantRows` for what a field with its own `select` returned: the rows of a relation
 * that targets a variant model, which the field's select loaded, as a row or a list of them. A list
 * can be any iterable, and its items promises, which settle before the rows complete.
 */
export function completeReturnedVariantRows(
  builder: object,
  value: unknown,
  context: object,
  info: GraphQLResolveInfo,
): unknown {
  if (Array.isArray(value)) {
    return completeReturnedList(builder, value, context, info, false);
  }
  if (value && typeof value === 'object' && isListType(getNullableType(info.returnType))) {
    if (Symbol.asyncIterator in value) {
      return completeEach(builder, value as AsyncIterable<unknown>, context, info);
    }
    if (Symbol.iterator in value) {
      return completeReturnedList(builder, [...(value as Iterable<unknown>)], context, info, false);
    }
  }
  return completeValue(
    completeReturnedList(builder, [value], context, info, false),
    (rows) => rows[0] ?? null,
  );
}

async function* completeEach(
  builder: object,
  items: AsyncIterable<unknown>,
  context: object,
  info: GraphQLResolveInfo,
) {
  for await (const item of items) {
    yield* await completeReturnedList(builder, [await item], context, info, false);
  }
}

/**
 * Completes the rows among `list`'s items. A promised item settles first: a rejected one stays as
 * its promise, which `settled` lists hold, for GraphQL to report as that item's error.
 */
function completeReturnedList(
  builder: object,
  list: unknown[],
  context: object,
  info: GraphQLResolveInfo,
  settled: boolean,
): MaybePromise<unknown[]> {
  const byRelation = new Map<PrismaNextRelation, object[]>();
  let promised = false;
  for (const row of list) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const relation = loadedThrough(row);
    if (!relation) {
      promised ||= !settled && isThenable(row);
      continue;
    }
    let rows = byRelation.get(relation);
    if (!rows) {
      rows = [];
      byRelation.set(relation, rows);
    }
    rows.push(row);
  }
  if (promised) {
    return Promise.all(
      list.map((item) =>
        isThenable(item)
          ? item.then(
              (row) => [row],
              () => [item],
            )
          : [item],
      ),
    ).then((items) =>
      completeReturnedList(
        builder,
        items.map(([item]) => item),
        context,
        info,
        true,
      ),
    );
  }
  if (!byRelation.size) {
    return list;
  }
  const type = getNamedType(info.returnType);
  const completions = [...byRelation].map(([relation, rows]) =>
    completeVariantRows(builder, relation, type, context, info, rows),
  );
  // Rows of each relation that didn't complete aren't of the variant.
  const keep = (completed: object[][]) => {
    const kept = new Set(completed.flat());
    return list.filter(
      (row) => !(row && typeof row === 'object' && loadedThrough(row)) || kept.has(row),
    );
  };
  return completions.some(isThenable)
    ? Promise.all(completions).then(keep)
    : keep(completions as object[][]);
}

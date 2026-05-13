import type { MapperCollection } from './apply-selection';
import { applyCursorPagination } from './cursors';
import { resolveSizeOption } from './options';
import type {
  AggregateBranchSelection,
  BranchSelection,
  CountSelection,
  PrismaNextSelection,
  RelationSelection,
} from './selection';

export interface RenderConfig {
  defaultConnectionSize?: number;
  maxConnectionSize?: number;
}

export function renderSelection(
  selection: PrismaNextSelection,
  base: MapperCollection,
  context: object,
  config: RenderConfig,
): MapperCollection {
  let acc = base;
  if (selection.columns.size > 0) {
    acc = acc.select(...selection.columns);
  }
  for (const [relationName, relation] of selection.relations) {
    acc = renderRelation(acc, relationName, relation, context, config);
  }
  return acc;
}

// Plain `.include(rel, cb => …)`: to-one, or to-many with a single
// branch and no counts/aggregates. Result: `parent[rel] = row | [rows]`.
//
// `.include(rel, cb => cb.combine({...}))`: to-many with multiple
// aliases OR any counts/aggregates. Result: `parent[rel] = { [alias]: v, … }`.
function renderRelation(
  parent: MapperCollection,
  relationName: string,
  relation: RelationSelection,
  context: object,
  config: RenderConfig,
): MapperCollection {
  const useCombine =
    relation.isToMany &&
    (relation.counts.size > 0 || relation.aggregates.size > 0 || relation.branches.size > 1);

  if (!useCombine) {
    const [, branch] = relation.branches.entries().next().value!;
    return parent.include(relationName, (rel) => renderBranch(branch, rel, context, config));
  }

  return parent.include(relationName, (rel) => {
    // Object.create(null) defense in depth — the mapper already rejects
    // `__proto__` aliases, but a polluted Object.prototype could still
    // surface via bracket assignment on a normal object.
    const spec = Object.create(null) as Record<string, unknown>;
    for (const [alias, branch] of relation.branches) {
      spec[alias] = renderBranch(branch, rel, context, config);
    }
    for (const [alias, count] of relation.counts) {
      spec[alias] = renderCount(count, rel, context);
    }
    for (const [alias, agg] of relation.aggregates) {
      spec[alias] = renderAggregate(agg, rel, context);
    }
    return rel.combine(spec);
  });
}

// Field-level `where` runs BEFORE the user's aggregate selector so
// users don't need to chain `.where(...)` inside the callback.
function renderAggregate(
  agg: AggregateBranchSelection,
  innerCollection: MapperCollection,
  context: object,
): unknown {
  let r = innerCollection;
  if (agg.where !== undefined) {
    if (typeof agg.where === 'function') {
      const whereFn = agg.where as (accessor: unknown, args: unknown, ctx: unknown) => unknown;
      r = r.where((accessor: unknown) => whereFn(accessor, agg.args, context)) as MapperCollection;
    } else {
      r = r.where(agg.where) as MapperCollection;
    }
  }
  return agg.aggregate(r, agg.args, context);
}

function renderBranch(
  branch: BranchSelection,
  innerCollection: MapperCollection,
  context: object,
  config: RenderConfig,
): MapperCollection {
  let r = innerCollection;
  // `refine` (compiled from the user's `query` option) runs BEFORE
  // cursor pagination so the filter applies to the over-fetched set
  // the cursor's `.take(N+1)` operates on.
  if (branch.refine) {
    const refined = branch.refine(r, branch.args, context);
    if (refined != null) {
      r = refined as MapperCollection;
    }
  }
  if (branch.pagination) {
    const defaultSize =
      resolveSizeOption(branch.pagination.defaultSize, branch.args, context) ??
      config.defaultConnectionSize;
    const maxSize =
      resolveSizeOption(branch.pagination.maxSize, branch.args, context) ??
      config.maxConnectionSize;
    const pagination = applyCursorPagination(
      r,
      branch.pagination.cursor,
      branch.args as import('@pothos/plugin-relay').DefaultConnectionArguments,
      {
        ...(defaultSize !== undefined ? { defaultSize } : {}),
        ...(maxSize !== undefined ? { maxSize } : {}),
      },
    );
    r = pagination.collection as unknown as MapperCollection;
  }
  return renderSelection(branch.inner, r, context, config);
}

function renderCount(
  count: CountSelection,
  innerCollection: MapperCollection,
  context: object,
): unknown {
  let r = innerCollection;
  if (count.refine) {
    const refined = count.refine(r, count.args, context);
    if (refined != null) {
      r = refined as MapperCollection;
    }
  }
  if (count.where === undefined) {
    return r.count();
  }
  if (typeof count.where === 'function') {
    const whereFn = count.where as (accessor: unknown, args: unknown, ctx: unknown) => unknown;
    return r.where((accessor: unknown) => whereFn(accessor, count.args, context)).count();
  }
  return r.where(count.where).count();
}

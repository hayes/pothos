/**
 * The accumulator's optional members, with the answers an accumulator that omits them gets. The
 * traversal and the plugins' loaders go through here rather than reaching into
 * `Adapter.accumulator`, so an accumulator that never shares a slot between two consumers
 * implements three members.
 */
import type { NodeBase } from './node.js';
import type { Accumulator, Adapter, MergeOptions, TypeLevelConflict } from './types.js';

/** M-3, or true for an accumulator with no conflicts to report. */
export function accepts<Model, Query, NodeType extends NodeBase<Model>>(
  accumulator: Accumulator<Model, Query, NodeType>,
  node: NodeType,
  query: Query,
  options?: MergeOptions,
): boolean {
  return accumulator.accepts ? accumulator.accepts(node, query, options) : true;
}

/** S-7, or none. */
export function conflictOf<Model, Query, NodeType extends NodeBase<Model>>(
  accumulator: Accumulator<Model, Query, NodeType>,
  node: NodeType,
  query: Query,
): TypeLevelConflict | undefined {
  return accumulator.conflict?.(node, query);
}

/**
 * Everything `from` holds, merged into `node`. An accumulator with a concrete tree does this
 * without leaving it; one without falls back to the round trip through its query.
 */
export function absorb<Model, Query, NodeType extends NodeBase<Model>>(
  accumulator: Accumulator<Model, Query, NodeType>,
  node: NodeType,
  from: NodeType,
): void {
  if (accumulator.absorb) {
    accumulator.absorb(node, from);

    return;
  }

  accumulator.merge(node, accumulator.emit(from));
}

/** M-3 node to node, likewise. */
export function acceptsFrom<Model, Query, NodeType extends NodeBase<Model>>(
  accumulator: Accumulator<Model, Query, NodeType>,
  node: NodeType,
  from: NodeType,
): boolean {
  return accumulator.acceptsFrom
    ? accumulator.acceptsFrom(node, from)
    : accepts(accumulator, node, accumulator.emit(from));
}

/**
 * TEMPORARY: the accumulator of an adapter, built from the legacy members of `Adapter` when it
 * has no accumulator of its own. Every call site goes through here while the adapters are ported
 * one at a time; when the last of them is, this becomes `adapter.accumulator` and goes away with
 * the legacy members. One shim per adapter, so the lookup costs nothing per merge.
 */
const shims = new WeakMap<object, Accumulator<never, never, never>>();

export function accumulatorOf<Model, Query, NodeType extends NodeBase<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
): Accumulator<Model, Query, NodeType> {
  if (adapter.accumulator) {
    return adapter.accumulator;
  }

  let shim = shims.get(adapter) as Accumulator<Model, Query, NodeType> | undefined;

  if (!shim) {
    shim = legacyAccumulator(adapter);
    shims.set(adapter, shim as Accumulator<never, never, never>);
  }

  return shim;
}

function legacyAccumulator<Model, Query, NodeType extends NodeBase<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
): Accumulator<Model, Query, NodeType> {
  return {
    create: (model) => adapter.createNode!(model),
    merge(node, query, options) {
      if (options?.asQuery) {
        adapter.mergeQuery!(node, query);

        return;
      }

      adapter.merge!(
        node,
        options?.lenient ? adapter.withoutConflicts!(node, query) : query,
        options?.key,
        options?.alias,
      );
    },
    accepts: (node, query, options) =>
      adapter.compatible!(node, query, options?.ignoreArgs ?? false, options?.key, options?.alias),
    conflict: (node, query) => adapter.typeLevelConflict!(node, query),
    emit: (node) => adapter.serialize!(node),
  };
}

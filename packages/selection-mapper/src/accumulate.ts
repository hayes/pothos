/**
 * The accumulator's optional members, with the answers an accumulator that omits them gets. The
 * traversal and the plugins' loaders go through here rather than reaching into
 * `Adapter.accumulator`, so an accumulator that never shares a slot between two consumers
 * implements three members.
 */
import type { NodeBase } from './node.js';
import type { Accumulator, MergeOptions, TypeLevelConflict } from './types.js';

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

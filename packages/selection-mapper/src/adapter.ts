/**
 * The ORM boundary: what an adapter tells the traversal, and where the selections it produces
 * accumulate. One class, so an adapter's state and helpers have a home and the members it has
 * nothing to say about are inherited rather than checked for.
 */
import type { GraphQLField, GraphQLNamedType } from 'graphql';
import type { MergeOptions, SelectFn, TypeLevelConflict, WalkedType } from './types.js';

/**
 * What the traversal requires of a node: the model it loads. `Model` is the adapter's model
 * description: whatever it needs to look a relation's target up by name. One object per model,
 * so model identity is the same as model equality.
 */
export interface NodeBase<Model> {
  model: Model;
}

/**
 * The ORM boundary, translation only. `Model` is the model description a node carries, `Query`
 * the ORM's own selection format (prisma `{ select, include, ...args }`, drizzle
 * `DBQueryConfig`), opaque to the traversal, and `NodeType` what selections accumulate into, of
 * which the traversal reads only `model`.
 *
 * Six members must be answered: three translate a schema into queries (`modelFor`,
 * `typeSelection`, `fieldSelection`) and three accumulate them (`create`, `merge`, `emit`). The
 * four below those are the merge rules, and each has the answer here that an adapter with no
 * conflicts to report wants: nothing ever conflicts, and node-to-node work round-trips through
 * `emit`. An adapter that gives every consumer of a relation its own slot inherits all four.
 *
 * `TreeAdapter` in tree.ts overrides all four over a concrete query tree, and is what the prisma
 * and drizzle adapters extend; an adapter whose query is not such a tree extends this directly.
 */
export abstract class Adapter<Model, Query, NodeType extends NodeBase<Model>> {
  /**
   * S-8: whether a fragment under `@defer` is walked. `EntryOptions.skipDeferredFragments`
   * overrides it for one entry point.
   */
  skipDeferredFragments = true;

  /**
   * The model a type carries, or undefined. Does not follow indirect includes (the walker's own
   * `modelOf` does). One object per model: identity is model identity.
   */
  abstract modelFor(type: GraphQLNamedType): Model | undefined;

  /** S-1: what the type always needs, or undefined. */
  abstract typeSelection(type: GraphQLNamedType): Query | undefined;

  /**
   * S-4..S-6: a static query, a select function, or nothing. `type` is the type the field is being
   * walked on (its parent type, or a same-model type the plan moved to), for an adapter that
   * classifies a selection's keys against the parent model.
   */
  abstract fieldSelection(
    field: GraphQLField<unknown, unknown>,
    type: WalkedType,
  ): Query | SelectFn<Query> | undefined;

  /** A fresh, empty node for `model`. */
  abstract create(model: Model): NodeType;

  /** M-1, M-2, S-9, E-2, E-3, in place. Never mutates `query`. */
  abstract merge(node: NodeType, query: Query, options?: MergeOptions): void;

  /** M-6: the node as a query of this ORM's format. */
  abstract emit(node: NodeType): Query;

  /**
   * M-3: whether `query` can be merged into `node` without changing what is already selected.
   * Inherited: nothing ever conflicts.
   */
  accepts(_node: NodeType, _query: Query, _options?: MergeOptions): boolean {
    return true;
  }

  /**
   * S-7: the first entry of a type-level `query` that conflicts with what `node` holds.
   * Inherited: none.
   */
  conflict(_node: NodeType, _query: Query): TypeLevelConflict | undefined {
    return undefined;
  }

  /** Everything `from` holds, merged into `node`. Inherited: the round trip through `emit`. */
  absorb(node: NodeType, from: NodeType): void {
    this.merge(node, this.emit(from));
  }

  /** M-3 node to node. Inherited: the round trip through `emit`. */
  acceptsFrom(node: NodeType, from: NodeType): boolean {
    return this.accepts(node, this.emit(from));
  }
}

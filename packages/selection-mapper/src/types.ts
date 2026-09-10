/**
 * The public types of the walker: what an entry point takes, the `Adapter` an ORM plugin supplies,
 * and the `Plan` it runs with.
 */
import type { MaybePromise } from '@pothos/core';
import type {
  FieldNode,
  GraphQLField,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql';
import type { Mapping, Mappings } from './loader-map.js';
import type { IndirectInclude, PathSegment } from './matches.js';
import type { Node, NodeBase } from './node.js';

export type WalkedType = GraphQLInterfaceType | GraphQLObjectType;

/**
 * D-7: where a plan is. One link of a chain running from the field an entry point was called for
 * down to the field being planned: the field's node in the document, the type it was found on,
 * and the position of the field the plan it was found in hangs beneath.
 *
 * The walker builds one per select invocation and reads none of it: a caller that wants a path, a
 * list of segments, or a name walks `parent` itself and materializes what it needs. A plan whose
 * fields nothing asks about therefore costs one link per select function and no arrays at all.
 */
export interface Position {
  /** The field this one is selected beneath, or undefined at the field the plan started from. */
  readonly parent: Position | undefined;
  /** The type the field was walked on: its parent type, or a same-model type the plan moved to. */
  readonly type: WalkedType;
  readonly field: GraphQLField<unknown, unknown>;
  /** The field's node in the document, which carries its alias and arguments. */
  readonly node: FieldNode;
}

/** A relation query: a query, or a callback building one from the field's arguments. */
export type NestedQuery<Query> =
  | MaybePromise<Query | null | undefined>
  | ((args: object, ctx: object, position: Position) => MaybePromise<Query | null | undefined>);

/**
 * The callback handed to a field's select function to plan the selection beneath the field:
 * `query` is merged first (a function is called with the field's args, `true` means no query),
 * then the selection found under `path` (an explicit include, or a string path from the field's
 * return type) is walked as `type` (or the field's return type). Declared synchronous (A-7): the
 * result is a promise only when a callback beneath it returned one, and must then be awaited.
 */
export type NestedSelection<Query> = (
  query?: NestedQuery<Query> | true,
  path?: PathSegment[] | IndirectInclude,
  type?: string,
) => Query;

/** A function field selection (S-6). A falsy result selects nothing (S-5). */
export type SelectFn<Query> = (
  args: object,
  ctx: object,
  nested: NestedSelection<Query>,
  selectedFieldNode: (path: string[]) => FieldNode | null,
  position: Position,
) => MaybePromise<Query | false | null | undefined>;

export interface EntryOptions<Query> {
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  path?: PathSegment[];
  paths?: PathSegment[][];
  /**
   * Merged into the root before anything is walked (E-1), so on a conflict it wins; returned as
   * is when paths are given and nothing is selected under them.
   */
  initial?: Query;
  /**
   * S-8, overriding `Adapter.skipDeferredFragments` for this plan. The setting belongs to a
   * builder while prisma's adapter is a module singleton, so that plugin passes it per entry
   * point instead of putting it on the adapter.
   */
  skipDeferredFragments?: boolean;
}

/** One merge into a plan's root, in order, recorded only by `planFromInfo`. */
export type RootMerge<Query> =
  | { kind: 'type'; query: Query }
  | { kind: 'variant'; type: WalkedType; variant: WalkedType; query: Query }
  | { kind: 'field'; key: string; alias: string; query: Query; mapping: Mapping };

/**
 * The ORM boundary. `Model` is the model description a node carries, `Query` the ORM's own selection
 * format (prisma `{ select, include, ...args }`, drizzle `DBQueryConfig`), opaque to the walker,
 * and `NodeType` the adapter's node type, of which the walker reads only `model`.
 */
export interface Adapter<Model, Query, NodeType extends NodeBase<Model> = Node<Model>> {
  /** S-8: whether a fragment under `@defer` is walked. `EntryOptions` may override it. */
  skipDeferredFragments: boolean;
  /**
   * The model a type carries, or undefined. Does not follow indirect includes (the walker's own
   * `modelOf` does). One object per model: identity is model identity.
   */
  modelFor(type: GraphQLNamedType): Model | undefined;
  /**
   * A fresh, empty node of the query tree for `model`. The walker never looks inside a node
   * beyond `model`; the adapter owns the shape. `createNode` from this package builds the
   * default tree (columns, relations, extras, arguments) the prisma and drizzle adapters use.
   */
  createNode(model: Model): NodeType;
  /** S-1: what the type always needs, or undefined. */
  typeSelection(type: GraphQLNamedType): Query | undefined;
  /**
   * S-4..S-6: a static query, a select function, or nothing. `type` is the type the field is being
   * walked on (its parent type, or a same-model type the plan moved to), for an adapter that
   * classifies a selection's keys against the parent model.
   */
  fieldSelection(
    field: GraphQLField<unknown, unknown>,
    type: WalkedType,
  ): Query | SelectFn<Query> | undefined;
  /**
   * M-1, M-2, S-9, in place. Never mutates `query`. `key` is the field the query came from
   * (`Type@alias`, or `Type@path.alias` beneath an indirect include) when the query is a field's
   * selection, and `alias` the field's response key alone, so an adapter that keeps one slot per
   * selected field can key it; both are absent for a type-level selection, an initial selection,
   * and a loader's staged query.
   */
  merge(node: NodeType, query: Query, key?: string, alias?: string): void;
  /**
   * M-3: whether `query` can be merged into `node` without changing what is already selected:
   * relations present in both are compatible recursively (arguments deep-equal below the top),
   * extras present in both are equal. With `ignoreArgs` the node's own arguments are not
   * compared. `key` and `alias` as for `merge`. An adapter that never shares a node between two fields
   * answers true.
   */
  compatible(
    node: NodeType,
    query: Query,
    ignoreArgs: boolean,
    key?: string,
    alias?: string,
  ): boolean;
  /**
   * E-3: merges the relation query a nested selection was given (a `t.relation` `query`, a
   * connection's cursor query) into the root of the nested plan. A query without a column
   * selection must add no columns: the plan beneath it adds the columns it needs. `null` or
   * `undefined` means no query.
   */
  mergeQuery(node: NodeType, query: Query | null | undefined): void;
  /**
   * S-7: the first relation (arguments compared by value) or extra (compared as the adapter
   * compares extras) of a type-level `query` that conflicts with what `node` already holds.
   */
  typeLevelConflict(node: NodeType, query: Query): TypeLevelConflict | undefined;
  /** E-2: `query` without the relations and extras whose arguments conflict with `node`. */
  withoutConflicts(node: NodeType, query: Query): Query;
  /** M-6. */
  serialize(node: NodeType): Query;
}

/** A type-level selection entry that cannot be merged with what a node already holds. */
export interface TypeLevelConflict {
  kind: 'extra' | 'relation';
  name: string;
}

/**
 * One root being built: its query tree, the mappings recorded beneath it, and what the traversal
 * runs
 * with. An entry point creates one; every nested selection creates a child plan that copies
 * `adapter`, `context`, `info` and `skipDeferred` from it.
 */
export interface Plan<Model, Query, NodeType extends NodeBase<Model> = Node<Model>> {
  adapter: Adapter<Model, Query, NodeType>;
  context: object;
  info: GraphQLResolveInfo;
  /** S-8: `EntryOptions.skipDeferredFragments`, or the adapter's own setting. */
  skipDeferred: boolean;
  root: NodeType;
  mappings: Mappings;
  /**
   * D-7: where the field this plan hangs beneath is, which the position of every field walked
   * into it links back to. Undefined when there is no field above the plan: the model loader
   * plans a field for its own parent row, so its plan starts at that field.
   */
  position?: Position;
  /**
   * The merges waiting on a user callback that returned a promise, in the order they were
   * appended (A-2, A-4). Absent until the first one: a synchronous plan never creates a promise.
   */
  pending?: Promise<void>;
  /**
   * The merges into `root` in order, recorded by `planFromInfo` so `queryFromPlan` can replay
   * them behind a caller's selection. Absent for every other plan: nested plans are never
   * replayed, and `rowPlanFromInfo` is not emitted through `queryFromPlan`.
   */
  merges?: RootMerge<Query>[];
}

/**
 * The public types of the walk: what an entry point takes, the `Adapter` an ORM plugin supplies,
 * and the `Env` and `Walk` the walk runs with.
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
import type { Mappings } from './loader-map.js';
import type { IndirectInclude, PathSegment } from './matches.js';
import type { Node, NodeBase } from './node.js';

export type WalkedType = GraphQLInterfaceType | GraphQLObjectType;

/** A relation query: a map, or a callback building one from the field's arguments. */
export type NestedQuery<Map, X = undefined> =
  | MaybePromise<Map | null | undefined>
  | ((args: object, ctx: object, extra: X) => MaybePromise<Map | null | undefined>);

/**
 * The callback handed to a field's select function to plan the selection beneath the field:
 * `query` is merged first (a function is called with the field's args, `true` means no query),
 * then the selection found under `path` (an explicit include, or a string path from the field's
 * return type) is walked as `type` (or the field's return type). Declared synchronous (A-7): the
 * result is a promise only when a callback beneath it returned one, and must then be awaited.
 */
export type NestedSelection<Map, X = undefined> = (
  query?: NestedQuery<Map, X> | true,
  path?: PathSegment[] | IndirectInclude,
  type?: string,
) => Map;

/** A function field selection (S-6). A falsy result selects nothing (S-5). */
export type SelectFn<Map, X = undefined> = (
  args: object,
  ctx: object,
  nested: NestedSelection<Map, X>,
  getSelectedNode: (path: string[]) => FieldNode | null,
  extra: X,
) => MaybePromise<Map | false | null | undefined>;

export interface EntryOptions<Map> {
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  path?: PathSegment[];
  paths?: PathSegment[][];
  /**
   * Merged into the root before anything is walked (E-1), so on a conflict it wins; returned as
   * is when paths are given and nothing is selected under them.
   */
  initial?: Map;
  skipDeferredFragments?: boolean;
}

/**
 * The ORM boundary. `M` is the model description a node carries, `Map` the ORM's own selection
 * format (prisma `{ select, include, ...args }`, drizzle `DBQueryConfig`), opaque to the walker,
 * `X` an adapter-owned value threaded from a walk to the select functions beneath it (drizzle's
 * `PathInfo`), and `N` the adapter's node type, of which the walker reads only `model`.
 */
export interface Adapter<M, Map, X = undefined, N extends NodeBase<M> = Node<M>> {
  skipDeferredFragments: boolean;
  /**
   * L-2: whether the walk records loader mappings for the plugin's resolvers to look up
   * (`getLoaderMapping`). Default true. An adapter whose resolvers read a loaded row another way
   * sets it false, and the walk records nothing.
   */
  recordsMappings?: boolean;
  /**
   * The model a type carries, or undefined. Does not follow indirect includes (`Env.modelOf`
   * does). One object per model: identity is model identity.
   */
  modelFor(type: GraphQLNamedType): M | undefined;
  /**
   * A fresh, empty node of the query tree for `model`. The walker never looks inside a node
   * beyond `model`; the adapter owns the shape. `createNode` from this package builds the
   * default tree (columns, relations, extras, arguments) the prisma and drizzle adapters use.
   */
  createNode(model: M): N;
  /** S-1: what the type always needs, or undefined. */
  typeSelection(type: GraphQLNamedType): Map | undefined;
  /** S-4..S-6: a static map, a select function, or nothing. */
  fieldSelection(field: GraphQLField<unknown, unknown>): Map | SelectFn<Map, X> | undefined;
  /**
   * M-1, M-2, S-9, in place. Never mutates `map`. `key` is the field the map came from
   * (`Type@alias`, or `Type@path.alias` beneath an indirect include) when the map is a field's
   * selection, and `alias` the field's response key alone, so an adapter that keeps one slot per
   * selected field can key it; both are absent for a type-level selection, an initial selection,
   * and a loader's staged query.
   */
  merge(node: N, map: Map, key?: string, alias?: string): void;
  /**
   * M-3: whether `map` can be merged into `node` without changing what is already selected:
   * relations present in both are compatible recursively (arguments deep-equal below the top),
   * extras present in both are equal. With `ignoreArgs` the node's own arguments are not
   * compared. `key` and `alias` as for `merge`. An adapter that never shares a node between two fields
   * answers true.
   */
  compatible(node: N, map: Map, ignoreArgs: boolean, key?: string, alias?: string): boolean;
  /**
   * E-3: merges the relation query a nested selection was given (a `t.relation` `query`, a
   * connection's cursor query) into the root of the nested walk. A query without a column
   * selection must add no columns: the walk beneath it adds the columns it needs. `null` or
   * `undefined` means no query.
   */
  mergeQuery(node: N, query: Map | null | undefined): void;
  /**
   * S-7: the first relation (arguments compared by value) or extra (compared as the adapter
   * compares extras) of a type-level `map` that conflicts with what `node` already holds.
   */
  typeLevelConflict(node: N, map: Map): TypeLevelConflict | undefined;
  /** E-2: `map` without the relations and extras whose arguments conflict with `node`. */
  withoutConflicts(node: N, map: Map): Map;
  /** M-6. */
  serialize(node: N): Map;
  /**
   * D-7: the extra handed to the select function of `field` (selected by `node` on `type`), built
   * from the extra of the walk it hangs beneath. Called once per entry point for the resolved
   * field and once per function-select field.
   */
  callbackExtra?(
    parent: X | undefined,
    type: WalkedType,
    field: GraphQLField<unknown, unknown>,
    node: FieldNode,
  ): X;
  /**
   * S-7: how to walk a fragment on `condition` while walking `type`: as `type`, as `condition`
   * (a variant of the same model, whose type-level selection is merged), or not at all
   * (undefined: its fields are suppressed, nested fragments are still classified against `type`).
   * `declared` is the declared return type of the field being walked, before any indirect
   * include is followed. Defaults to `defaultFragmentType`.
   */
  fragmentType?(
    type: WalkedType,
    condition: GraphQLNamedType,
    declared: GraphQLNamedType,
  ): WalkedType | undefined;
}

/** A type-level selection entry that cannot be merged with what a node already holds. */
export interface TypeLevelConflict {
  kind: 'extra' | 'relation';
  name: string;
}

/** What one entry-point call runs with, shared by reference with every nested walk. */
export interface Env<M, Map, X = undefined, N extends NodeBase<M> = Node<M>> {
  adapter: Adapter<M, Map, X, N>;
  context: object;
  info: GraphQLResolveInfo;
  skipDeferred: boolean;
  /** The model of a type, following indirect includes. */
  modelOf: (type: GraphQLNamedType) => M | undefined;
}

/** One root being built: its query tree and the mappings recorded beneath it. */
export interface Walk<M, Map, X = undefined, N extends NodeBase<M> = Node<M>> {
  env: Env<M, Map, X, N>;
  root: N;
  mappings: Mappings;
  /** D-7: the extra of the field this walk hangs beneath. */
  extra?: X;
  /**
   * The merges waiting on a user callback that returned a promise, in the order they were
   * appended (A-2, A-4). Absent until the first one: a synchronous walk never creates a promise.
   */
  pending?: Promise<void>;
}

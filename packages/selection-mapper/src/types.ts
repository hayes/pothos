/**
 * The types the adapter contract and the entry points mention: where a field is, what a select
 * function is handed, what an entry point takes, and how one merge differs from a plain one.
 */
import type { MaybePromise } from '@pothos/core';
import type {
  FieldNode,
  GraphQLField,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from 'graphql';
import type { IndirectInclude, PathSegment } from './matches.js';

export type WalkedType = GraphQLInterfaceType | GraphQLObjectType;

/**
 * Where a field is. One link of a chain running from the field an entry point was called for down
 * to the field being planned: the field's node in the document, the type it was found on, and the
 * position of the field the plan it was found in hangs beneath.
 *
 * The walker builds one per select invocation and reads none of it, so a caller that wants a path
 * or a name walks `parent` itself and materializes what it needs. A plan whose fields nothing asks
 * about costs one link per select function and no arrays at all.
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
 * return type) is walked as `type` (or the field's return type). Declared synchronous: the result
 * is a promise only when a callback beneath it returned one, and must then be awaited.
 */
export type NestedSelection<Query> = (
  query?: NestedQuery<Query> | true,
  path?: PathSegment[] | IndirectInclude,
  type?: string,
) => Query;

/** Inspect fields beneath the current selection, through fragments and wrappers. */
export interface SelectedFieldNode {
  /** Lazily collect selected schema field names; aliases do not change the names. */
  (): ReadonlySet<string>;
  (path: string[]): FieldNode | null;
}

/** A function field selection. A falsy result selects nothing. */
export type SelectFn<Query> = (
  args: object,
  ctx: object,
  nested: NestedSelection<Query>,
  selectedFieldNode: SelectedFieldNode,
  position: Position,
) => MaybePromise<Query | false | null | undefined>;

export interface EntryOptions<Query> {
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  path?: PathSegment[];
  paths?: PathSegment[][];
  /**
   * Merged into the root before anything is walked, so on a conflict it wins. `Plan.fromInfo`
   * answers undefined when paths are given and nothing is selected under them; what a caller
   * hands its resolver then is the caller's own rule, not this package's.
   */
  initial?: Query;
  /**
   * Overrides `Adapter.skipDeferredFragments` for this plan. The setting belongs to a builder
   * while prisma's adapter is a module singleton, so that plugin passes it per entry point
   * instead of putting it on the adapter.
   */
  skipDeferredFragments?: boolean;
}

/** How one merge into an adapter's node differs from a plain one. */
export interface MergeOptions {
  /**
   * The node's own top-level arguments are not compared. A field's selection is merged into a
   * node whose arguments came from somewhere else, so only what is nested below is checked.
   */
  ignoreArgs?: boolean;
  /**
   * The query is a relation query, not a selection. A query without a column selection must add
   * no columns: the plan beneath it adds the ones it needs.
   */
  asQuery?: boolean;
  /**
   * Keys that conflict with what the node holds are left out, one at a time, instead of the merge
   * being refused or throwing.
   */
  lenient?: boolean;
  /**
   * The response key of the field the query came from, so an adapter that keeps one slot per
   * selected field can name it. Absent for a type-level selection, an initial selection and a
   * staged query.
   */
  alias?: string;
}

/**
 * A key of a type-level selection that cannot be merged with what a node already holds. `kind`
 * chooses the error message, so it is the ORM's own word for the key rather than this package's:
 * prisma reports a conflicting `_count` as a `relation`, since that is what a user wrote.
 */
export interface TypeLevelConflict {
  kind: 'extra' | 'relation';
  name: string;
}

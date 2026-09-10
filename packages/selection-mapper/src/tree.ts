/**
 * The concrete query tree and its rules (M-1..M-4, S-7, S-9, E-2, E-3), shared by every adapter
 * whose query is a tree of columns, relations, extras and arguments.
 *
 * The traversal never reaches in here: it drives an `Accumulator`, and this module builds the one
 * the prisma and drizzle adapters use from a `QueryFormat` — the only format-specific part left,
 * which is the key loop of the ORM's own query plus `serialize`.
 */
import { deepEqual } from './deep-equal.js';
import { createNode, type Node, relation } from './node.js';
import type { Accumulator, MergeOptions, TypeLevelConflict } from './types.js';

/**
 * What a format reports for one entry of its query. Called by `QueryFormat.read`; the visitor
 * decides what to do with the entry, so the four rules (merge, accept, conflict, lenient merge)
 * share one key loop per format instead of one each.
 *
 * A visitor is re-entrant: `relation` reads the nested query with the same visitor, so a `read`
 * must hold no state of its own across a callback.
 */
export interface EntryVisitor<Model, Query> {
  /** A named column of the model. */
  column(name: string): void;
  /** S-9: every column. Final — a node never goes back to named columns. */
  allColumns(): void;
  /** A relation, with the model it targets and the query selected beneath it. */
  relation(name: string, model: Model, query: Query): void;
  /**
   * An adapter-specific computed value (prisma `_count` entries, drizzle `extras`). `kind` is
   * what a type-level conflict on it is called, for a format whose extras are not user-facing
   * "extras" (prisma's counts read as a relation).
   */
  extra(name: string, value: unknown, kind?: TypeLevelConflict['kind']): void;
  /**
   * The query arguments, normalized. M-4: a non-empty set replaces whatever the node holds.
   * Reported on every read, empty or not: M-3 compares a query's arguments to the node's whether
   * or not the query has any.
   */
  args(args: object): void;
}

/** The format-specific half of a tree adapter: how to read its query, and how to write one. */
export interface QueryFormat<Model, Query> {
  /** The entries of `query`, read against `model`. The whole key loop of the format. */
  read(query: Query, model: Model, visit: EntryVisitor<Model, Query>): void;
  /** M-6: the node as a query of this format. Recursive: the format serializes its own children. */
  serialize(node: Node<Model>): Query;
  /**
   * M-3 for one extra: whether `value` cannot join `extras` under `name`. Defaults to a
   * `deepEqual` against the entry already there, which is what a format whose extras are plain
   * values wants; drizzle compares its extras by identity, and prisma overrides it for the
   * `_count: true` wildcard.
   */
  extraConflicts?(extras: ReadonlyMap<string, unknown>, name: string, value: unknown): boolean;
}

/**
 * The accumulator the prisma and drizzle adapters use: the tree of `node.ts` with the merge,
 * compare and conflict rules this package owns. An adapter supplies only `format`.
 */
export function treeAccumulator<Model, Query>(
  format: QueryFormat<Model, Query>,
): Accumulator<Model, Query, Node<Model>> {
  const merger = new Merger(format);
  const checker = new Checker(format);

  return {
    create: createNode,
    merge(node, query, options) {
      merger.run(node, query, options);
    },
    accepts: (node, query, options) => checker.run(node, query, options),
    conflict: (node, query) => firstConflict(format, node, query),
    absorb: absorbNode,
    acceptsFrom: (node, from) => acceptsNode(format, node, from, false),
    emit: (node) => format.serialize(node),
  };
}

/** M-3 for one extra, through the format's rule or the default. */
function extraConflicts<Model, Query>(
  format: QueryFormat<Model, Query>,
  extras: ReadonlyMap<string, unknown>,
  name: string,
  value: unknown,
) {
  return format.extraConflicts
    ? format.extraConflicts(extras, name, value)
    : extras.has(name) && !deepEqual(extras.get(name), value);
}

/**
 * M-1, M-2, S-9, E-2, E-3 in place. One visitor per accumulator, re-used down the tree: a merge
 * saves and restores the node it is at rather than allocating a visitor per level, so a merge
 * allocates only what the format's own `read` does.
 */
class Merger<Model, Query> implements EntryVisitor<Model, Query> {
  private node!: Node<Model>;
  /** E-3: a relation query must add no columns; the plan beneath it adds the ones it needs. */
  private asQuery = false;
  /** E-2: a conflicting relation or extra is left out instead of merged. Top level only. */
  private lenient = false;

  constructor(private readonly format: QueryFormat<Model, Query>) {}

  run(node: Node<Model>, query: Query, options?: MergeOptions) {
    this.node = node;
    this.asQuery = options?.asQuery ?? false;
    this.lenient = options?.lenient ?? false;
    this.format.read(query, node.model, this);
  }

  column(name: string) {
    this.node.columns?.add(name);
  }

  allColumns() {
    if (!this.asQuery) {
      this.node.columns = null;
    }
  }

  relation(name: string, model: Model, query: Query) {
    const parent = this.node;

    if (this.lenient) {
      const existing = parent.relations.get(name);

      // The subtree is checked whole, so once the relation is accepted it merges whole.
      if (existing && !acceptsQuery(this.format, existing, query, false)) {
        return;
      }
    }

    const child = relation(parent, name, model, query);
    const { asQuery, lenient } = this;

    this.node = child;
    this.asQuery = false;
    this.lenient = false;
    this.format.read(query, model, this);
    this.node = parent;
    this.asQuery = asQuery;
    this.lenient = lenient;
  }

  extra(name: string, value: unknown) {
    if (this.lenient && extraConflicts(this.format, this.node.extras, name, value)) {
      return;
    }

    this.node.extras.set(name, value);
  }

  args(args: object) {
    if (hasKeys(args)) {
      this.node.args = args;
    }
  }
}

/**
 * M-3: whether a query merges into a node without changing what is already selected. Runs the
 * whole query even after the first failure (a rejection is the rare path) so a `read` stays a
 * plain loop.
 */
class Checker<Model, Query> implements EntryVisitor<Model, Query> {
  private node!: Node<Model>;
  private ignoreArgs = false;
  private ok = true;

  constructor(private readonly format: QueryFormat<Model, Query>) {}

  run(node: Node<Model>, query: Query, options?: MergeOptions) {
    this.node = node;
    this.ignoreArgs = options?.ignoreArgs ?? false;
    this.ok = true;
    this.format.read(query, node.model, this);

    return this.ok;
  }

  column() {}

  allColumns() {}

  relation(name: string, model: Model, query: Query) {
    const child = this.node.relations.get(name);

    if (!this.ok || !child) {
      return;
    }

    const parent = this.node;
    const { ignoreArgs } = this;

    // Below the top, a relation's own arguments are part of what is already selected (M-3).
    this.node = child;
    this.ignoreArgs = false;
    this.format.read(query, model, this);
    this.node = parent;
    this.ignoreArgs = ignoreArgs;
  }

  extra(name: string, value: unknown) {
    if (this.ok && extraConflicts(this.format, this.node.extras, name, value)) {
      this.ok = false;
    }
  }

  args(args: object) {
    if (this.ok && !this.ignoreArgs && !deepEqual(this.node.args, args)) {
      this.ok = false;
    }
  }
}

/** M-3 with a throwaway checker, for the recursive calls a lenient merge makes. */
function acceptsQuery<Model, Query>(
  format: QueryFormat<Model, Query>,
  node: Node<Model>,
  query: Query,
  ignoreArgs: boolean,
) {
  return new Checker(format).run(node, query, { ignoreArgs });
}

/**
 * S-7: the first top-level entry of `query` that conflicts with `node`. Top-level only, so the
 * error names the entry a user wrote rather than something nested beneath it.
 */
function firstConflict<Model, Query>(
  format: QueryFormat<Model, Query>,
  node: Node<Model>,
  query: Query,
): TypeLevelConflict | undefined {
  let found: TypeLevelConflict | undefined;
  const visitor: EntryVisitor<Model, Query> = {
    column() {},
    allColumns() {},
    args() {},
    relation(name, _model, nested) {
      const child = node.relations.get(name);

      if (!found && child && !acceptsQuery(format, child, nested, false)) {
        found = { kind: 'relation', name };
      }
    },
    extra(name, value, kind = 'extra') {
      if (!found && extraConflicts(format, node.extras, name, value)) {
        found = { kind, name };
      }
    },
  };

  format.read(query, node.model, visitor);

  return found;
}

/**
 * Node to node: everything `from` holds, merged into `into`. Replaces a serialize/merge round
 * trip.
 */
function absorbNode<Model>(into: Node<Model>, from: Node<Model>) {
  if (from.columns === null) {
    into.columns = null;
  } else if (into.columns) {
    for (const column of from.columns) {
      into.columns.add(column);
    }
  }

  if (hasKeys(from.args)) {
    into.args = from.args;
  }

  for (const [name, value] of from.extras) {
    into.extras.set(name, value);
  }

  for (const [name, child] of from.relations) {
    absorbNode(relation(into, name, child.model, undefined), child);
  }
}

/** M-3 node to node. */
function acceptsNode<Model, Query>(
  format: QueryFormat<Model, Query>,
  into: Node<Model>,
  from: Node<Model>,
  ignoreArgs: boolean,
): boolean {
  if (!ignoreArgs && !deepEqual(into.args, from.args)) {
    return false;
  }

  for (const [name, value] of from.extras) {
    if (extraConflicts(format, into.extras, name, value)) {
      return false;
    }
  }

  for (const [name, child] of from.relations) {
    const existing = into.relations.get(name);

    if (existing && !acceptsNode(format, existing, child, false)) {
      return false;
    }
  }

  return true;
}

/** Whether an object has any own enumerable key. */
export function hasKeys(value: object) {
  return Object.keys(value).length > 0;
}

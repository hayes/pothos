/**
 * The node one root accumulates into — a model, its arguments, its columns, its relations and its
 * extras — and the merge rules over a tree of them (M-1..M-4, S-7, S-9, E-2, E-3), shared by
 * every adapter whose query is a tree of that shape.
 *
 * Those rules are what this module replaced: each ORM plugin used to write its own merge, compare
 * and conflict logic over its own accumulator, and `NodeAdapter` is that logic written once. A
 * subclass supplies the only format-specific part left: `read`, the key loop of the ORM's own
 * query, and `emit`, the node written back. The traversal never reaches in here — it drives the
 * `Adapter` contract, of which this implements everything but those two.
 */
import { isThenable, PothosValidationError } from '@pothos/core';
import { Adapter, type NodeBase } from './adapter.js';
import { deepEqual } from './deep-equal.js';
import type { MergeOptions, TypeLevelConflict } from './types.js';

/**
 * One level of the query being built, used by the prisma and drizzle adapters: the model, its
 * arguments, the columns it selects (`null` = every column, which is final: a node never goes
 * back to named columns), its relations and adapter-specific extras (prisma `_count` entries,
 * drizzle `extras`). An adapter whose query is not a tree of this shape extends `Adapter`
 * directly and accumulates into a node of its own.
 */
export interface Node<Model> extends NodeBase<Model> {
  args: object;
  columns: Set<string> | null;
  relations: Map<string, Node<Model>>;
  extras: Map<string, unknown>;
}

export function createNode<Model>(model: Model): Node<Model> {
  return { model, args: {}, columns: new Set(), relations: new Map(), extras: new Map() };
}

/**
 * The only way to obtain a child node: get the relation's node or create it. `value` is what the
 * map holds for the relation, checked here because a thenable there is an un-awaited
 * `nestedSelection()` that would otherwise be spread as an empty object.
 */
export function relation<Model>(
  node: Node<Model>,
  name: string,
  model: Model,
  value: unknown,
): Node<Model> {
  if (isThenable(value)) {
    throw new PothosValidationError(
      `Relation "${name}" was given a promise. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.`,
    );
  }

  let child = node.relations.get(name);

  if (!child) {
    child = createNode(model);
    node.relations.set(name, child);
  }

  return child;
}

/**
 * What an adapter reports for one entry of its query. Called by `NodeAdapter.read`; the visitor
 * decides what to do with the entry, so the four rules (merge, accept, conflict, lenient merge)
 * share one key loop per adapter instead of one each.
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
   * what a type-level conflict on it is called, for an adapter whose extras are not user-facing
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

/**
 * The adapter the prisma and drizzle adapters extend: the node tree above with every merge,
 * compare and conflict rule this package owns. A subclass answers `read` and `emit`, plus the
 * three translation members of `Adapter`.
 */
export abstract class NodeAdapter<Model, Query> extends Adapter<Model, Query, Node<Model>> {
  /**
   * One merger and one checker per adapter, re-used down the tree: each saves and restores the
   * node it is at rather than allocating a visitor per level, so a merge allocates only what the
   * subclass's own `read` does. They cannot be this object — a merge runs a check inside itself
   * (E-2), so one `this` could not hold both cursors.
   */
  private readonly merger: Merger<Model, Query> = new Merger(this);
  private readonly checker: Checker<Model, Query> = new Checker(this);

  /** The entries of `query`, read against `model`. The whole key loop of the ORM's format. */
  abstract read(query: Query, model: Model, visit: EntryVisitor<Model, Query>): void;

  create(model: Model): Node<Model> {
    return createNode(model);
  }

  merge(node: Node<Model>, query: Query, options?: MergeOptions): void {
    this.merger.run(node, query, options);
  }

  override accepts(node: Node<Model>, query: Query, options?: MergeOptions): boolean {
    return this.checker.run(node, query, options);
  }

  /**
   * M-3 for one extra: whether `value` cannot join `extras` under `name`. A `deepEqual` against
   * the entry already there, which is what an adapter whose extras are plain values wants;
   * drizzle compares its extras by identity, and prisma overrides it for the `_count: true`
   * wildcard.
   */
  extraConflicts(extras: ReadonlyMap<string, unknown>, name: string, value: unknown): boolean {
    return extras.has(name) && !deepEqual(extras.get(name), value);
  }

  /**
   * S-7: the first top-level entry of `query` that conflicts with `node`. Top-level only, so the
   * error names the entry a user wrote rather than something nested beneath it.
   */
  override conflict(node: Node<Model>, query: Query): TypeLevelConflict | undefined {
    let found: TypeLevelConflict | undefined;

    this.read(query, node.model, {
      column() {},
      allColumns() {},
      args() {},
      relation: (name, _model, nested) => {
        const child = node.relations.get(name);

        if (!found && child && !new Checker(this).run(child, nested)) {
          found = { kind: 'relation', name };
        }
      },
      extra: (name, value, kind = 'extra') => {
        if (!found && this.extraConflicts(node.extras, name, value)) {
          found = { kind, name };
        }
      },
    });

    return found;
  }

  /** Node to node, without the serialize/merge round trip. */
  override absorb(into: Node<Model>, from: Node<Model>): void {
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
      this.absorb(relation(into, name, child.model, undefined), child);
    }
  }

  /** M-3 node to node, likewise. */
  override acceptsFrom(into: Node<Model>, from: Node<Model>): boolean {
    if (!deepEqual(into.args, from.args)) {
      return false;
    }

    for (const [name, value] of from.extras) {
      if (this.extraConflicts(into.extras, name, value)) {
        return false;
      }
    }

    for (const [name, child] of from.relations) {
      const existing = into.relations.get(name);

      if (existing && !this.acceptsFrom(existing, child)) {
        return false;
      }
    }

    return true;
  }
}

/** M-1, M-2, S-9, E-2, E-3 in place. */
class Merger<Model, Query> implements EntryVisitor<Model, Query> {
  private node!: Node<Model>;
  /** E-3: a relation query must add no columns; the plan beneath it adds the ones it needs. */
  private asQuery = false;
  /** E-2: a conflicting relation or extra is left out instead of merged. Top level only. */
  private lenient = false;

  constructor(private readonly adapter: NodeAdapter<Model, Query>) {}

  run(node: Node<Model>, query: Query, options?: MergeOptions): void {
    this.node = node;
    this.asQuery = options?.asQuery ?? false;
    this.lenient = options?.lenient ?? false;
    this.adapter.read(query, node.model, this);
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
      if (existing && !new Checker(this.adapter).run(existing, query)) {
        return;
      }
    }

    const child = relation(parent, name, model, query);
    const { asQuery, lenient } = this;

    this.node = child;
    this.asQuery = false;
    this.lenient = false;
    this.adapter.read(query, model, this);
    this.node = parent;
    this.asQuery = asQuery;
    this.lenient = lenient;
  }

  extra(name: string, value: unknown) {
    if (this.lenient && this.adapter.extraConflicts(this.node.extras, name, value)) {
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

  constructor(private readonly adapter: NodeAdapter<Model, Query>) {}

  run(node: Node<Model>, query: Query, options?: MergeOptions) {
    this.node = node;
    this.ignoreArgs = options?.ignoreArgs ?? false;
    this.ok = true;
    this.adapter.read(query, node.model, this);

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
    this.adapter.read(query, model, this);
    this.node = parent;
    this.ignoreArgs = ignoreArgs;
  }

  extra(name: string, value: unknown) {
    if (this.ok && this.adapter.extraConflicts(this.node.extras, name, value)) {
      this.ok = false;
    }
  }

  args(args: object) {
    if (this.ok && !this.ignoreArgs && !deepEqual(this.node.args, args)) {
      this.ok = false;
    }
  }
}

/** Whether an object has any own enumerable key. */
function hasKeys(value: object) {
  return Object.keys(value).length > 0;
}

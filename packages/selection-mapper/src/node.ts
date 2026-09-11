/**
 * The node one root accumulates into — a model, its arguments, its columns, its relations and its
 * computed values — and the merge, compare and conflict rules over a tree of them, shared by every
 * adapter whose query is a tree of that shape.
 *
 * A subclass supplies the only format-specific parts: `visitQuery`, the key loop of the ORM's own
 * query, and `toQuery`, the node written back. The traversal never reaches in here — it drives the
 * `Adapter` contract, of which this implements everything but those two.
 */
import { isThenable, PothosValidationError } from '@pothos/core';
import { Adapter, type NodeBase } from './adapter.js';
import { deepEqual } from './deep-equal.js';
import type { MergeOptions, TypeLevelConflict } from './types.js';

/**
 * One level of the query being built, used by the prisma and drizzle adapters: the model, its
 * arguments, the columns it selects (`null` = every column, which is final: a node never goes
 * back to named columns), its relations and its computed values (prisma `_count` keys, drizzle
 * `extras`). An adapter whose query is not a tree of this shape extends `Adapter` directly.
 */
export interface Node<Model> extends NodeBase<Model> {
  args: object;
  columns: Set<string> | null;
  relations: Map<string, Node<Model>>;
  computed: Map<string, unknown>;
}

export function createNode<Model>(model: Model): Node<Model> {
  return { model, args: {}, columns: new Set(), relations: new Map(), computed: new Map() };
}

/**
 * The only way to obtain a child node: get the relation's node or create it. `value` is what the
 * map holds for the relation, checked here because a thenable is an un-awaited
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
 * What an adapter reports for one key of its query. Called by `NodeAdapter.visitQuery`; the
 * visitor decides what to do with the key, so merging, checking and conflict-finding share one
 * key loop per adapter instead of one each.
 *
 * A visitor is re-entrant: `relation` reads the nested query with the same visitor, so a
 * `visitQuery` must hold no state of its own across a callback.
 */
export interface QueryVisitor<Model, Query> {
  /** A named column of the model. */
  column(name: string): void;
  /** Every column. Final — a node never goes back to named columns. */
  allColumns(): void;
  /** A relation, with the model it targets and the query selected beneath it. */
  relation(name: string, model: Model, query: Query): void;
  /**
   * A value the ORM computes per row, neither a column nor a relation (prisma `_count` keys,
   * drizzle `extras`). `kind` is what a conflict on it is called to a user of that ORM, whose own
   * word for these is not the shared one (prisma's counts read as a relation).
   */
  computed(name: string, value: unknown, kind?: TypeLevelConflict['kind']): void;
  /**
   * The query arguments, normalized. A non-empty set replaces whatever the node holds. Reported
   * on every pass, empty or not, since a merge check compares a query's arguments to the node's
   * whether or not the query has any.
   */
  args(args: object): void;
}

/**
 * The adapter the prisma and drizzle adapters extend: the node tree above with every merge,
 * compare and conflict rule this package owns. A subclass answers `visitQuery` and `toQuery`, plus
 * the three translation members of `Adapter`.
 */
export abstract class NodeAdapter<Model, Query> extends Adapter<Model, Query, Node<Model>> {
  /**
   * One merger and one merge check per adapter, re-used down the tree: each saves and restores
   * the node it is at rather than allocating a visitor per level, so a merge allocates only what
   * the subclass's own `visitQuery` does. They cannot be this object — a lenient merge runs a
   * check inside itself, so one `this` could not hold both cursors.
   */
  private readonly merger: Merger<Model, Query> = new Merger(this);
  private readonly mergeCheck: MergeCheck<Model, Query> = new MergeCheck(this);

  /** Every key of `query`, read against `model` and reported to `visit`. The ORM's key loop. */
  abstract visitQuery(query: Query, model: Model, visit: QueryVisitor<Model, Query>): void;

  createNode(model: Model): Node<Model> {
    return createNode(model);
  }

  mergeQuery(node: Node<Model>, query: Query, options?: MergeOptions): void {
    this.merger.run(node, query, options);
  }

  override canMergeQuery(node: Node<Model>, query: Query, options?: MergeOptions): boolean {
    return this.mergeCheck.run(node, query, options);
  }

  /**
   * Whether `value` cannot join `computed` under `name`. A `deepEqual` against the value already
   * there, which is what an adapter whose computed values are plain values wants; drizzle
   * compares its `extras` by identity, and prisma overrides it for the `_count: true` wildcard.
   */
  computedConflicts(computed: ReadonlyMap<string, unknown>, name: string, value: unknown): boolean {
    return computed.has(name) && !deepEqual(computed.get(name), value);
  }

  /**
   * The first top-level key of `query` that conflicts with `node`. Top-level only, so the error
   * names the key a user wrote rather than something nested beneath it.
   */
  override firstConflict(node: Node<Model>, query: Query): TypeLevelConflict | undefined {
    let found: TypeLevelConflict | undefined;

    this.visitQuery(query, node.model, {
      column() {},
      allColumns() {},
      args() {},
      relation: (name, _model, nested) => {
        const child = node.relations.get(name);

        if (!found && child && !new MergeCheck(this).run(child, nested)) {
          found = { kind: 'relation', name };
        }
      },
      computed: (name, value, kind = 'extra') => {
        if (!found && this.computedConflicts(node.computed, name, value)) {
          found = { kind, name };
        }
      },
    });

    return found;
  }

  /** Node to node, without the serialize/merge round trip. */
  override mergeNode(into: Node<Model>, from: Node<Model>): void {
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

    for (const [name, value] of from.computed) {
      into.computed.set(name, value);
    }

    for (const [name, child] of from.relations) {
      this.mergeNode(relation(into, name, child.model, undefined), child);
    }
  }

  /** `canMergeQuery` node to node, likewise. */
  override canMergeNode(into: Node<Model>, from: Node<Model>): boolean {
    if (!deepEqual(into.args, from.args)) {
      return false;
    }

    for (const [name, value] of from.computed) {
      if (this.computedConflicts(into.computed, name, value)) {
        return false;
      }
    }

    for (const [name, child] of from.relations) {
      const existing = into.relations.get(name);

      if (existing && !this.canMergeNode(existing, child)) {
        return false;
      }
    }

    return true;
  }
}

/** One query folded into a node, in place. */
class Merger<Model, Query> implements QueryVisitor<Model, Query> {
  private node!: Node<Model>;
  /** A relation query must add no columns; the plan beneath it adds the ones it needs. */
  private asQuery = false;
  /** A conflicting relation or computed value is left out, not merged. Top level only. */
  private lenient = false;

  constructor(private readonly adapter: NodeAdapter<Model, Query>) {}

  run(node: Node<Model>, query: Query, options?: MergeOptions): void {
    this.node = node;
    this.asQuery = options?.asQuery ?? false;
    this.lenient = options?.lenient ?? false;
    this.adapter.visitQuery(query, node.model, this);
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
      if (existing && !new MergeCheck(this.adapter).run(existing, query)) {
        return;
      }
    }

    const child = relation(parent, name, model, query);
    const { asQuery, lenient } = this;

    this.node = child;
    this.asQuery = false;
    this.lenient = false;
    this.adapter.visitQuery(query, model, this);
    this.node = parent;
    this.asQuery = asQuery;
    this.lenient = lenient;
  }

  computed(name: string, value: unknown) {
    if (this.lenient && this.adapter.computedConflicts(this.node.computed, name, value)) {
      return;
    }

    this.node.computed.set(name, value);
  }

  args(args: object) {
    if (hasKeys(args)) {
      this.node.args = args;
    }
  }
}

/**
 * Whether a query merges into a node without changing what is already selected. Runs the whole
 * query even after the first failure (a rejection is the rare path) so a `visitQuery` stays a
 * plain loop.
 */
class MergeCheck<Model, Query> implements QueryVisitor<Model, Query> {
  private node!: Node<Model>;
  private ignoreArgs = false;
  private ok = true;

  constructor(private readonly adapter: NodeAdapter<Model, Query>) {}

  run(node: Node<Model>, query: Query, options?: MergeOptions) {
    this.node = node;
    this.ignoreArgs = options?.ignoreArgs ?? false;
    this.ok = true;
    this.adapter.visitQuery(query, node.model, this);

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

    // Below the top, a relation's own arguments are part of what is already selected.
    this.node = child;
    this.ignoreArgs = false;
    this.adapter.visitQuery(query, model, this);
    this.node = parent;
    this.ignoreArgs = ignoreArgs;
  }

  computed(name: string, value: unknown) {
    if (this.ok && this.adapter.computedConflicts(this.node.computed, name, value)) {
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

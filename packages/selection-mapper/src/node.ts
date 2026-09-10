import { isThenable, PothosValidationError } from '@pothos/core';

/**
 * What the walker requires of a node: the model it loads. `Model` is the adapter's model
 * description: whatever it needs to look a relation's target up by name. One object per model,
 * so model identity is the same as model equality.
 */
export interface NodeBase<Model> {
  model: Model;
}

/**
 * The default node of the query being built, used by the prisma and drizzle adapters: the
 * model, its arguments, the columns it selects (`null` = every column, which is final: a node
 * never goes back to named columns), its relations and adapter-specific extras (prisma `_count`
 * entries, drizzle `extras`). An adapter whose query is not a tree of this shape supplies its
 * own node type through `Adapter.createNode`.
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

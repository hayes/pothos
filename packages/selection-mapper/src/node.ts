import { isThenable, PothosValidationError } from '@pothos/core';

/**
 * One node of the query being built: the model it loads, its arguments, the columns it selects
 * (`null` = every column, which is final: a node never goes back to named columns), its relations
 * and adapter-specific extras (prisma `_count` entries, drizzle `extras`).
 *
 * `M` is the adapter's model description: whatever it needs to look a relation's target up by
 * name. One object per model, so model identity is the same as model equality.
 */
export interface Node<M> {
  model: M;
  args: object;
  columns: Set<string> | null;
  relations: Map<string, Node<M>>;
  extras: Map<string, unknown>;
}

export function createNode<M>(model: M): Node<M> {
  return { model, args: {}, columns: new Set(), relations: new Map(), extras: new Map() };
}

/**
 * The only way to obtain a child node: get the relation's node or create it. `value` is what the
 * map holds for the relation, checked here because a thenable there is an un-awaited
 * `nestedSelection()` that would otherwise be spread as an empty object.
 */
export function relation<M>(node: Node<M>, name: string, model: M, value: unknown): Node<M> {
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

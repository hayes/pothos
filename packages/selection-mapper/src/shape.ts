/**
 * The shape of a selection set: a number that two selection sets of one document share exactly
 * when they select the same thing, written the same way. A walk beneath a field reads its
 * selection set and nothing else of the node, so walks are shared by shape rather than by node.
 */
import { PothosValidationError } from '@pothos/core';
import {
  type ASTNode,
  type GraphQLResolveInfo,
  Kind,
  print,
  type SelectionNode,
  type SelectionSetNode,
} from 'graphql';

/** One document's shapes: the id interned for each selection's text, and each set's id. */
interface Shapes {
  ids: Map<string, number>;
  sets: WeakMap<SelectionSetNode, number>;
}

/**
 * Per execution: a fragment spread is shaped by its name, which means the same definition only
 * within one fragment map. Each set is shaped once, so shaping costs one pass over the document.
 */
const shapesByFragments = new WeakMap<object, Shapes>();

export function selectionShape(
  info: GraphQLResolveInfo,
  selectionSet: SelectionSetNode | undefined,
): number {
  if (!selectionSet) {
    return 0;
  }

  let shapes = shapesByFragments.get(info.fragments);

  if (!shapes) {
    shapes = { ids: new Map(), sets: new WeakMap() };
    shapesByFragments.set(info.fragments, shapes);
  }

  return shapeOfSet(shapes, selectionSet);
}

function shapeOfSet(shapes: Shapes, selectionSet: SelectionSetNode): number {
  let id = shapes.sets.get(selectionSet);

  if (id === undefined) {
    id = intern(
      shapes,
      selectionSet.selections.map((selection) => shapeOfSelection(shapes, selection)),
    );
    shapes.sets.set(selectionSet, id);
  }

  return id;
}

/**
 * A selection's text with every selection set beneath it replaced by its id. A spread stops at its
 * name, so nothing is shaped twice however often a fragment is spread.
 */
function shapeOfSelection(shapes: Shapes, selection: SelectionNode): number {
  switch (selection.kind) {
    case Kind.FIELD:
      return intern(shapes, [
        'field',
        selection.alias?.value ?? '',
        selection.name.value,
        printAll(selection.arguments),
        printAll(selection.directives),
        selection.selectionSet ? shapeOfSet(shapes, selection.selectionSet) : 0,
      ]);
    case Kind.FRAGMENT_SPREAD:
      return intern(shapes, ['spread', selection.name.value, printAll(selection.directives)]);
    case Kind.INLINE_FRAGMENT:
      return intern(shapes, [
        'inline',
        selection.typeCondition?.name.value ?? '',
        printAll(selection.directives),
        shapeOfSet(shapes, selection.selectionSet),
      ]);
    default: {
      const unknown: never = selection;

      throw new PothosValidationError(`Unknown selection kind ${(unknown as SelectionNode).kind}`);
    }
  }
}

function printAll(nodes: readonly ASTNode[] | undefined) {
  return nodes?.length ? nodes.map((node) => print(node)) : [];
}

/** The id of `parts`, assigned the first time they are seen. Ids start at 1; 0 means no set. */
function intern(shapes: Shapes, parts: unknown[]): number {
  const text = JSON.stringify(parts);
  let id = shapes.ids.get(text);

  if (id === undefined) {
    id = shapes.ids.size + 1;
    shapes.ids.set(text, id);
  }

  return id;
}

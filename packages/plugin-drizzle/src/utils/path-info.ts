import type { Position } from '@pothos/selection-mapper';
import { type GraphQLOutputType, isListType, isNonNullType } from 'graphql';
import type { FieldPathInfo, PathInfo } from '../types.js';

/** Set by each field's gate before its resolver runs, by `info.path`. */
const plannedAt = new WeakMap<object, Position>();

/** Records the position the field executing at `path` was planned at. */
export function setPlannedPosition(path: object, position: Position) {
  plannedAt.set(path, position);
}

/** The position the field executing for `info` was planned at, as its gate recorded it. */
export function plannedPosition(info: { path: object }): Position | undefined {
  return plannedAt.get(info.path);
}

/**
 * The public `PathInfo` of a position: `path` as `Type.field` from the field the query was
 * planned for down to the field being planned, and one segment per step with the alias the
 * document used and whether the field is a list.
 *
 * The walker hands out positions, which are links rather than paths; this is the only place the
 * chain is walked, and it is walked only when a `query` callback or a `select` function actually
 * wants one. A field whose query is a plain object never builds either array.
 */
export function pathInfoFor(position: Position | undefined): PathInfo | undefined {
  if (!position) {
    return undefined;
  }

  const path: string[] = [];
  const segments: FieldPathInfo[] = [];

  for (let at: Position | undefined = position; at; at = at.parent) {
    const field = at.node.name.value;

    path.push(`${at.type.name}.${field}`);
    segments.push({
      field,
      alias: at.node.alias?.value ?? field,
      parentType: at.type.name,
      isList: isListField(at.field.type),
    });
  }

  return { path: path.reverse(), segments: segments.reverse() };
}

/** A list field, whether or not the list itself is non-null (`[Post!]!`). */
function isListField(type: GraphQLOutputType) {
  return isListType(type) || (isNonNullType(type) && isListType(type.ofType));
}

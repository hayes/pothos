import type { parentShapeKey } from '@pothos/core';
import type { TypeScopeInfo } from './types.js';

/**
 * Checks whether a type scope function is running for `ref`'s object type, narrowing `parent` to
 * that type's shape. Use it to apply different rules for each type implementing an interface.
 *
 * Takes object refs, not interfaces, classes or type names. A failed check narrows away `ref`'s
 * shape, so check a type whose shape matches the parent's declared type last.
 */
export function isParentType<Shape>(
  ref: { kind: 'Object'; name: string; [parentShapeKey]: Shape },
  parent: unknown,
  info: Pick<TypeScopeInfo, 'parentType'>,
): parent is Shape {
  return info.parentType.name === ref.name;
}

import type { outputShapeKey } from '@pothos/core';
import type { TypeScopeInfo } from './types.js';

/**
 * Checks whether a type scope function is running for `ref`'s object type, narrowing `parent` to
 * that type's shape. Use it to apply different rules for each type implementing an interface.
 */
export function isParentType<Shape>(
  ref: { kind: 'Object'; name: string; [outputShapeKey]: Shape },
  parent: unknown,
  info: TypeScopeInfo,
): parent is Shape {
  return info.parentType.name === ref.name;
}

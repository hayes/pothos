import { brandWithType, type OutputType, type SchemaTypes, typeBrandKey } from '@pothos/core';

/** The row is the prototype, so its data isn't visible to `Object.keys` or spread. */
export function rebrandForVariant<T>(parent: T, variantTypeName: string): T;
export function rebrandForVariant(parent: unknown, variantTypeName: string): unknown {
  if (parent == null || typeof parent !== 'object') {
    return parent;
  }
  const existingBrand = (parent as Record<symbol, unknown>)[typeBrandKey];
  if (existingBrand === variantTypeName) {
    return parent;
  }
  // Brands aren't configurable, so sibling variants of one row can't brand it in place.
  const wrapper = Object.create(parent as object) as object;
  brandWithType(wrapper, variantTypeName as unknown as OutputType<SchemaTypes>);
  return wrapper;
}

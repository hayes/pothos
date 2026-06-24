import { brandWithType, type OutputType, type SchemaTypes, typeBrandKey } from '@pothos/core';

/**
 * Wrap so the variant carries its own brand without disturbing the
 * parent's brand (which is non-configurable). Callers MUST read
 * variant rows via property access — Object.keys, JSON.stringify, and
 * object spread only see own-properties and will skip parent data.
 */
export function rebrandForVariant<T>(parent: T, variantTypeName: string): T;
export function rebrandForVariant(parent: unknown, variantTypeName: string): unknown {
  if (parent == null || typeof parent !== 'object') {
    return parent;
  }
  const existingBrand = (parent as Record<symbol, unknown>)[typeBrandKey];
  if (existingBrand === variantTypeName) {
    return parent;
  }
  // Always wrap. Branding the parent in place would make order-of-
  // resolution load-bearing: sibling variants on the same row would
  // race on the non-configurable brand slot.
  const wrapper = Object.create(parent as object) as object;
  brandWithType(wrapper, variantTypeName as unknown as OutputType<SchemaTypes>);
  return wrapper;
}

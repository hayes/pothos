import { SchemaTypes } from '@pothos/core';
import { DrizzleRef } from '../interface-ref';
import { DrizzleObjectRef } from '../object-ref';

export const refMap = new WeakMap<object, Map<string, DrizzleRef<never>>>();

export function getRefFromModel<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  type: 'interface' | 'object' = 'object',
): DrizzleRef<Types> {
  if (!refMap.has(builder)) {
    refMap.set(builder, new Map());
  }
  const cache = refMap.get(builder)!;

  if (!cache.has(name)) {
    cache.set(
      name,
      type === 'object' ? new DrizzleObjectRef(name, name) : new DrizzleObjectRef(name, name),
    );
  }

  return cache.get(name)! as never;
}

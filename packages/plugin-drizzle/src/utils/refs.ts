import { PothosSchemaError, type SchemaTypes } from '@pothos/core';
import { DrizzleInterfaceRef, type DrizzleRef } from '../interface-ref.js';
import { DrizzleObjectRef } from '../object-ref.js';

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
      type === 'object' ? new DrizzleObjectRef(name, name) : new DrizzleInterfaceRef(name, name),
    );
  }

  const ref = cache.get(name) as unknown as DrizzleRef<Types>;

  if (
    (type === 'interface' && !(ref instanceof DrizzleInterfaceRef)) ||
    (type === 'object' && !(ref instanceof DrizzleObjectRef))
  ) {
    throw new PothosSchemaError(
      `Drizzle table ${name} was created as both an object and interface.  Use 'variant' instead of 'name' in one of the implementations`,
    );
  }

  return ref;
}

/**
 * Added to table name parameters when `DrizzleRelations` isn't set, so the error says how to set
 * it up instead of showing `never`. It's a branded string so editors don't suggest it.
 */
type MissingDrizzleRelations<Hint extends string> = string & {
  readonly missingDrizzleRelations: Hint;
};

type DrizzleRelationsSetup =
  'Set DrizzleRelations on SchemaTypes: new SchemaBuilder<{ DrizzleRelations: typeof relations }>(...)';

export type DrizzleRelationsHint<Types extends SchemaTypes, List extends boolean = false> = [
  keyof Types['DrizzleRelations'],
] extends [never]
  ?
      | MissingDrizzleRelations<DrizzleRelationsSetup>
      | (List extends true ? [MissingDrizzleRelations<DrizzleRelationsSetup>] : never)
  : never;

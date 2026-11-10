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
 * Without `DrizzleRelations` there are no table names, and a name is checked against `never`. The
 * name positions accept this hint as well, so the error names the missing setup. It is a branded
 * string rather than a literal, so editors don't offer it, and `never` once `DrizzleRelations` is
 * set. `List` adds the hint in a list, for the positions that take `[name]`.
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

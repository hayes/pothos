import { PothosSchemaError, type SchemaTypes } from '@pothos/core';
import { PrismaNextInterfaceRef } from '../interface-ref';
import { PrismaNextObjectRef } from '../object-ref';
import type { ModelName, Row } from '../types';

// Per-builder ref cache. Keys are the *default* type name for a model
// (which is the contract model name). Variants are NOT cached — they
// always get a fresh ref keyed on the variant name.
//
// Consequence (matches plugin-drizzle): if only a variant is
// registered for a model and another file references the model by
// name (e.g. `t.relation('user')` from a sibling), the string-form
// helper returns the cached default ref which never had a
// registration. Pothos core surfaces this as an unresolved-ref error
// at schema-build time.
const objectRefMap = new WeakMap<
  object,
  Map<string, PrismaNextObjectRef<SchemaTypes, never, never>>
>();
const interfaceRefMap = new WeakMap<
  object,
  Map<string, PrismaNextInterfaceRef<SchemaTypes, never, never>>
>();

export function getRefFromContractModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
>(
  modelName: M,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): PrismaNextObjectRef<Types, M, Shape> {
  let cache = objectRefMap.get(builder);
  if (!cache) {
    cache = new Map();
    objectRefMap.set(builder, cache);
  }
  let ref = cache.get(modelName as string);
  if (!ref) {
    ref = new PrismaNextObjectRef(modelName as string, modelName) as PrismaNextObjectRef<
      SchemaTypes,
      never,
      never
    >;
    cache.set(modelName as string, ref);
  }
  return ref as unknown as PrismaNextObjectRef<Types, M, Shape>;
}

export function getInterfaceRefFromContractModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
>(
  modelName: M,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): PrismaNextInterfaceRef<Types, M, Shape> {
  let cache = interfaceRefMap.get(builder);
  if (!cache) {
    cache = new Map();
    interfaceRefMap.set(builder, cache);
  }
  let ref = cache.get(modelName as string);
  if (!ref) {
    ref = new PrismaNextInterfaceRef(modelName as string, modelName) as PrismaNextInterfaceRef<
      SchemaTypes,
      never,
      never
    >;
    cache.set(modelName as string, ref);
  }
  return ref as unknown as PrismaNextInterfaceRef<Types, M, Shape>;
}

/** @internal — used by schema-builder to detect object/interface kind collision. */
export function assertSameKindRegistration<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: string,
  kind: 'object' | 'interface',
): void {
  const otherCache = kind === 'object' ? interfaceRefMap.get(builder) : objectRefMap.get(builder);
  if (otherCache?.has(modelName)) {
    throw new PothosSchemaError(
      `Model '${modelName}' was registered as both a prismaObject and a prismaInterface. ` +
        "Use 'variant' instead of the default name on one of the registrations.",
    );
  }
}

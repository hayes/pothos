import { PothosSchemaError, type SchemaTypes } from '@pothos/core';
import { PrismaNextInterfaceRef } from '../interface-ref.js';
import { PrismaNextObjectRef } from '../object-ref.js';
import type { ModelName, Row } from '../types.js';
import { defaultTypeName } from './contract.js';

// Only default refs are cached; variants always get a fresh ref.
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
    // A model registered only as an interface is what its relations and root fields return.
    const iface = interfaceRefMap.get(builder)?.get(modelName as string);
    if (iface) {
      return iface as unknown as PrismaNextObjectRef<Types, M, Shape>;
    }
    ref = new PrismaNextObjectRef(
      defaultTypeName(modelName as string),
      modelName,
    ) as PrismaNextObjectRef<SchemaTypes, never, never>;
    cache.set(modelName as string, ref);
  }
  return ref as unknown as PrismaNextObjectRef<Types, M, Shape>;
}

export function getRefForContractModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
>(
  modelName: M,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): PrismaNextObjectRef<Types, M, Shape> | PrismaNextInterfaceRef<Types, M, Shape> {
  const iface = interfaceRefMap.get(builder)?.get(modelName as string);
  return iface
    ? (iface as unknown as PrismaNextInterfaceRef<Types, M, Shape>)
    : getRefFromContractModel<Types, M, Shape>(modelName, builder);
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
    ref = new PrismaNextInterfaceRef(
      defaultTypeName(modelName as string),
      modelName,
    ) as PrismaNextInterfaceRef<SchemaTypes, never, never>;
    cache.set(modelName as string, ref);
  }
  return ref as unknown as PrismaNextInterfaceRef<Types, M, Shape>;
}

/** @internal */
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

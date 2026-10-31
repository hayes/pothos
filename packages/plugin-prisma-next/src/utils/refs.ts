import { PothosSchemaError, type SchemaTypes } from '@pothos/core';
import { PrismaNextInterfaceRef } from '../interface-ref.js';
import { PrismaNextObjectRef } from '../object-ref.js';
import type { ModelName, Row } from '../types.js';
import { defaultTypeName } from './contract.js';

type AnyRef =
  | PrismaNextObjectRef<SchemaTypes, never, never>
  | PrismaNextInterfaceRef<SchemaTypes, never, never>;

// Only default refs are cached; variants always get a fresh ref.
const refMap = new WeakMap<object, Map<string, AnyRef>>();

/**
 * The default ref for a model. Without a `kind` it is whichever kind the model was registered as
 * (an object ref if it has not been registered yet); with one, a ref of the other kind throws.
 */
export function getRefFromContractModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
>(
  modelName: M,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind: 'interface',
): PrismaNextInterfaceRef<Types, M, Shape>;
export function getRefFromContractModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
>(
  modelName: M,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind: 'object',
): PrismaNextObjectRef<Types, M, Shape>;
export function getRefFromContractModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
>(
  modelName: M,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind?: 'interface' | 'object',
): PrismaNextObjectRef<Types, M, Shape> | PrismaNextInterfaceRef<Types, M, Shape>;
export function getRefFromContractModel(
  modelName: string,
  builder: object,
  kind?: 'interface' | 'object',
): unknown {
  let cache = refMap.get(builder);
  if (!cache) {
    cache = new Map();
    refMap.set(builder, cache);
  }
  let ref = cache.get(modelName);
  if (!ref) {
    ref =
      kind === 'interface'
        ? new PrismaNextInterfaceRef(defaultTypeName(modelName), modelName as never)
        : new PrismaNextObjectRef(defaultTypeName(modelName), modelName as never);
    cache.set(modelName, ref);
  }
  if (kind && ref instanceof PrismaNextInterfaceRef !== (kind === 'interface')) {
    throw new PothosSchemaError(
      `Model '${modelName}' was registered as both a prismaObject and a prismaInterface. ` +
        "Use 'variant' instead of the default name on one of the registrations.",
    );
  }
  return ref;
}

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

/** Refs made by a lookup without a kind before the model was registered. */
const provisional = new WeakSet<AnyRef>();

/**
 * The default ref for a model. Without a `kind` it is whichever kind the model was registered as
 * (an object ref, standing in for either kind, if it has not been registered yet); with one, a
 * ref of the other kind throws.
 */
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
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  kind?: 'interface' | 'object',
): unknown {
  let cache = refMap.get(builder);
  if (!cache) {
    cache = new Map();
    refMap.set(builder, cache);
  }
  let ref = cache.get(modelName);
  if (!ref) {
    ref = createRef(modelName, kind ?? 'object');
    cache.set(modelName, ref);
    if (!kind) {
      provisional.add(ref);
    }
  }
  if (kind && ref instanceof PrismaNextInterfaceRef !== (kind === 'interface')) {
    if (!provisional.has(ref)) {
      throw new PothosSchemaError(
        `Model '${modelName}' was registered as both a prismaObject and a prismaInterface. ` +
          "Use 'variant' instead of the default name on one of the registrations.",
      );
    }
    const replacement = createRef(modelName, kind);
    builder.configStore.associateParamWithRef(ref as never, replacement as never);
    cache.set(modelName, replacement);
    ref = replacement;
  }
  if (kind) {
    provisional.delete(ref);
  }
  return ref;
}

function createRef(modelName: string, kind: 'interface' | 'object'): AnyRef {
  return kind === 'interface'
    ? new PrismaNextInterfaceRef(defaultTypeName(modelName), modelName as never)
    : new PrismaNextObjectRef(defaultTypeName(modelName), modelName as never);
}

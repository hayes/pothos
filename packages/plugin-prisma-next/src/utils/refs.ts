import { PothosSchemaError, type SchemaTypes } from '@pothos/core';
import { PrismaInterfaceRef } from '../interface-ref.js';
import { PrismaObjectRef } from '../object-ref.js';
import { defaultTypeName } from './contract.js';

export type AnyRef =
  | PrismaObjectRef<SchemaTypes, never, never>
  | PrismaInterfaceRef<SchemaTypes, never, never>;

// Only refs for a model's default type name are cached.
const refMap = new WeakMap<object, Map<string, AnyRef>>();

/** Refs made by a lookup without a kind before the model was registered. */
const provisional = new WeakSet<AnyRef>();

/**
 * Without `kind` and before the model is registered, this is a provisional object ref that a
 * later lookup with `kind: 'Interface'` replaces.
 */
export function getRefFromContractModel<Types extends SchemaTypes>(
  modelKey: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind?: 'Interface' | 'Object',
): AnyRef {
  let cache = refMap.get(builder);
  if (!cache) {
    cache = new Map();
    refMap.set(builder, cache);
  }
  let ref = cache.get(modelKey);
  if (!ref) {
    ref = createRef(modelKey, kind ?? 'Object');
    cache.set(modelKey, ref);
    if (!kind) {
      provisional.add(ref);
    }
  }
  if (kind && ref instanceof PrismaInterfaceRef !== (kind === 'Interface')) {
    if (!provisional.has(ref)) {
      const [first, then] =
        kind === 'Interface' ? ['Object', 'Interface'] : ['Interface', 'Object'];
      throw new PothosSchemaError(
        `Model '${modelKey}' was used with prisma${first} or prisma${first}Field(s) and then ` +
          `with prisma${then} or prisma${then}Field(s), so its default type would be both an ` +
          "object and an interface. Use 'variant' instead of the default name on one of them.",
      );
    }
    const replacement = createRef(modelKey, kind);
    builder.configStore.associateParamWithRef(ref as never, replacement as never);
    cache.set(modelKey, replacement);
    ref = replacement;
  }
  if (kind) {
    provisional.delete(ref);
  }
  return ref;
}

function createRef(modelKey: string, kind: 'Interface' | 'Object'): AnyRef {
  return kind === 'Interface'
    ? new PrismaInterfaceRef(defaultTypeName(modelKey), modelKey as never)
    : new PrismaObjectRef(defaultTypeName(modelKey), modelKey as never);
}

export function refFor(builder: object, type: unknown): AnyRef {
  return type instanceof PrismaObjectRef || type instanceof PrismaInterfaceRef
    ? (type as AnyRef)
    : getRefFromContractModel(
        type as string,
        builder as PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
      );
}

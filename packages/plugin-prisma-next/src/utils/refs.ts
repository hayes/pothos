import { PothosSchemaError, type SchemaTypes } from '@pothos/core';
import { PrismaNextInterfaceRef } from '../interface-ref.js';
import { PrismaNextObjectRef } from '../object-ref.js';
import { defaultTypeName } from './contract.js';

/** A prisma object or interface ref of any model. */
export type AnyRef =
  | PrismaNextObjectRef<SchemaTypes, never, never>
  | PrismaNextInterfaceRef<SchemaTypes, never, never>;

// Only refs for a model's default type name are cached. Types given a `variant` or `name` get their
// own ref.
const refMap = new WeakMap<object, Map<string, AnyRef>>();

/** Refs made by a lookup without a kind before the model was registered. */
const provisional = new WeakSet<AnyRef>();

/**
 * The default ref for a model. With `kind`, it is a ref of that kind, and a model already
 * registered as the other kind throws. Without one, it is a ref of the kind the model was
 * registered as. If the model isn't registered yet, it is a provisional object ref that a later
 * lookup with `kind: 'Interface'` replaces.
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
  if (kind && ref instanceof PrismaNextInterfaceRef !== (kind === 'Interface')) {
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
    ? new PrismaNextInterfaceRef(defaultTypeName(modelKey), modelKey as never)
    : new PrismaNextObjectRef(defaultTypeName(modelKey), modelKey as never);
}

/** A prisma ref as given, or the default ref of the model a name names. */
export function refFor(builder: object, type: unknown): AnyRef {
  return type instanceof PrismaNextObjectRef || type instanceof PrismaNextInterfaceRef
    ? (type as AnyRef)
    : getRefFromContractModel(
        type as string,
        builder as PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
      );
}

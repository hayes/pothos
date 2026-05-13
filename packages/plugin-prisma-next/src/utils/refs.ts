import { PothosSchemaError, type SchemaTypes } from '@pothos/core';
import { PrismaNextInterfaceRef } from '../interface-ref';
import { PrismaNextObjectRef } from '../object-ref';
import type { ModelName, Row } from '../types';

const prismaRefMap = new WeakMap<
  object,
  Map<string, PrismaNextObjectRef<SchemaTypes, never, never>>
>();

// Refs cached per builder so `prismaObject('User', …)` and a sibling
// `t.relation('posts')` resolve to the same instance. Variant refs key
// by `typeName` so the default-model ref stays canonical.
export function getRefFromContractModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
>(
  modelName: M,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  typeName?: string,
): PrismaNextObjectRef<Types, M, Shape> {
  if (!prismaRefMap.has(builder)) {
    prismaRefMap.set(builder, new Map());
  }
  const cache = prismaRefMap.get(builder)!;
  const cacheKey = typeName ?? modelName;

  let ref = cache.get(cacheKey);
  if (!ref) {
    ref = new PrismaNextObjectRef(cacheKey, modelName) as PrismaNextObjectRef<
      SchemaTypes,
      never,
      never
    >;
    cache.set(cacheKey, ref);
  }

  return ref as unknown as PrismaNextObjectRef<Types, M, Shape>;
}

const prismaInterfaceRefMap = new WeakMap<
  object,
  Map<string, PrismaNextInterfaceRef<SchemaTypes, never, never>>
>();

// Interface counterpart of the object cache. `configStore.addFields`
// keys by ref identity, so a fresh ref per call would break the
// string-form helper merge with `prismaInterface('User', …)`.
export function getInterfaceRefFromContractModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
>(
  modelName: M,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  typeName?: string,
): PrismaNextInterfaceRef<Types, M, Shape> {
  if (!prismaInterfaceRefMap.has(builder)) {
    prismaInterfaceRefMap.set(builder, new Map());
  }
  const cache = prismaInterfaceRefMap.get(builder)!;
  const cacheKey = typeName ?? modelName;

  let ref = cache.get(cacheKey);
  if (!ref) {
    ref = new PrismaNextInterfaceRef(cacheKey, modelName) as PrismaNextInterfaceRef<
      SchemaTypes,
      never,
      never
    >;
    cache.set(cacheKey, ref);
  }
  return ref as unknown as PrismaNextInterfaceRef<Types, M, Shape>;
}

// The string-form helpers (`prismaObjectField('User', …)`) lazily create
// a default-keyed cache entry on first call. If the user only registers
// `User` under a variant name, that lazy entry is orphaned and fields
// added to it never surface. We detect both orderings:
//   - variant registered BEFORE field-helper string-form call:
//     `assertNoVariantOnlyRegistration` at field-helper time.
//   - field-helper string-form BEFORE variant registration:
//     `findOrphanedDefaultRef` at variant-registration time.
// `markRefRegistered` distinguishes lazy ref-cache entries from real
// `prismaObject` / `prismaInterface` registrations.

type RefKind = 'object' | 'interface';

function cacheFor(kind: RefKind, builder: object) {
  return kind === 'object' ? prismaRefMap.get(builder) : prismaInterfaceRefMap.get(builder);
}

const registeredKeysMap = new WeakMap<object, { object: Set<string>; interface: Set<string> }>();

function getRegisteredKeys(builder: object) {
  let entry = registeredKeysMap.get(builder);
  if (!entry) {
    entry = { object: new Set(), interface: new Set() };
    registeredKeysMap.set(builder, entry);
  }
  return entry;
}

/** @internal */
export function markRefRegistered<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind: RefKind,
  key: string,
): void {
  getRegisteredKeys(builder as object)[kind].add(key);
}

/** @internal */
export function findVariantTypeNames<Types extends SchemaTypes>(
  modelName: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind: RefKind,
): string[] {
  const cache = cacheFor(kind, builder as object);
  if (!cache || cache.has(modelName)) {
    return [];
  }
  const variants: string[] = [];
  for (const [key, ref] of cache) {
    if ((ref.modelName as string) === modelName) {
      variants.push(key);
    }
  }
  return variants;
}

/** @internal */
export function assertNoVariantOnlyRegistration<Types extends SchemaTypes>(
  modelName: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  callerLabel: string,
  kind: RefKind,
): void {
  const variants = findVariantTypeNames(modelName, builder, kind);
  if (variants.length > 0) {
    const registerCall = kind === 'object' ? 'prismaObject' : 'prismaInterface';
    throw new PothosSchemaError(
      `${callerLabel}('${modelName}', ...): model '${modelName}' has no default ` +
        `${registerCall} registration, only variant(s) ${variants.map((v) => `'${v}'`).join(', ')}. ` +
        'Pass the variant name as the first argument, or the ref returned by ' +
        `builder.${registerCall} directly.`,
    );
  }
}

/** @internal */
export function findOrphanedDefaultRef<Types extends SchemaTypes>(
  modelName: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  kind: RefKind,
): string | undefined {
  const cache = cacheFor(kind, builder as object);
  if (!cache?.has(modelName)) {
    return undefined;
  }
  const registered = getRegisteredKeys(builder as object)[kind];
  if (registered.has(modelName)) {
    return undefined;
  }
  return modelName;
}

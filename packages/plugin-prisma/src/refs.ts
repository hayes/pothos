import { ObjectRef, SchemaTypes } from '@giraphql/core';
import { Prisma } from '@prisma/client';
import { PrismaDelegate } from './types.js';

export const clients = new WeakSet<object>();
export const nameMap = new WeakMap<object, string>();
export const refMap = new WeakMap<object, Map<PrismaDelegate, ObjectRef<unknown>>>();
export const findUniqueMap = new WeakMap<
  object,
  Map<ObjectRef<unknown>, ((args: unknown, ctx: {}) => unknown) | null>
>();

export function getNameFromDelegate<Types extends SchemaTypes>(
  delegate: PrismaDelegate,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
): string {
  const { client } = builder.options.prisma;

  if (!clients.has(client)) {
    Object.keys(client).forEach((key) => {
      const val = client[key as keyof typeof client];

      if (typeof val === 'object' && val !== null) {
        nameMap.set(val, `${key[0].toUpperCase()}${key.slice(1)}`);
      }
    });
  }

  if (!nameMap.has(delegate)) {
    throw new Error(
      'Unknown delegate, ensure you are using the same instance of PrismaClient that was passed in the SchemaBuilder constructor',
    );
  }

  return nameMap.get(delegate)!;
}

export function getRefFromDelegate<Types extends SchemaTypes>(
  delegate: PrismaDelegate,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
): ObjectRef<unknown> {
  if (!refMap.has(builder)) {
    refMap.set(builder, new Map());
  }
  const cache = refMap.get(builder)!;
  const name = getNameFromDelegate(delegate, builder);

  if (!cache.has(delegate)) {
    cache.set(delegate, builder.objectRef(name));
  }

  return cache.get(delegate)!;
}

export function getFindUniqueForRef<Types extends SchemaTypes>(
  ref: ObjectRef<unknown>,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
) {
  if (!findUniqueMap.has(builder)) {
    findUniqueMap.set(builder, new Map());
  }
  const cache = findUniqueMap.get(builder)!;

  if (!cache.has(ref)) {
    return null;
  }

  return cache.get(ref)! as (args: unknown, context: Types['Context']) => unknown;
}

export function setFindUniqueForRef<Types extends SchemaTypes>(
  ref: ObjectRef<unknown>,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findUnique: ((args: any, context: Types['Context']) => unknown) | null,
) {
  if (!findUniqueMap.has(builder)) {
    findUniqueMap.set(builder, new Map());
  }
  const cache = findUniqueMap.get(builder)!;

  cache.set(ref, findUnique);
}

export function getRelation<Types extends SchemaTypes>(
  delegate: PrismaDelegate,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  relation: string,
) {
  const { client } = builder.options.prisma;
  const name = getNameFromDelegate(delegate, builder);
  // eslint-disable-next-line no-underscore-dangle
  const dmmf = (client as unknown as { _dmmf: { modelMap: Record<string, Prisma.DMMF.Model> } })
    ._dmmf;
  const modelData = dmmf.modelMap[name];

  if (!modelData) {
    throw new Error(`Model '${name}' not found in DMMF`);
  }

  const fieldData = modelData.fields.find((field) => field.name === relation);

  if (!fieldData) {
    throw new Error(`Field '${relation}' not found in model '${name}'`);
  }

  if (fieldData.kind !== 'object') {
    throw new Error(`Field ${relation} of model '${name}' is not a relation (${fieldData.kind})`);
  }

  return fieldData;
}

export function getRelatedDelegate<Types extends SchemaTypes>(
  delegate: PrismaDelegate,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  relation: string,
) {
  const fieldData = getRelation(delegate, builder, relation);

  return fieldData.type;
}

export function getDelegateFromModel(client: Record<string, unknown>, model: string) {
  const lowerCase = `${model.slice(0, 1).toLowerCase()}${model.slice(1)}`;

  const delegate = lowerCase in client ? client[lowerCase] : null;

  if (!delegate) {
    throw new Error(`Unable to find delegate for model ${model}`);
  }

  return delegate as PrismaDelegate;
}

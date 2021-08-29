import { ObjectRef, SchemaTypes } from '@giraphql/core';
import { Prisma } from '@prisma/client';
import { PrismaDelegate } from './types';

export const clients = new WeakSet<object>();
export const nameMap = new WeakMap<object, string>();
export const refMap = new WeakMap<object, Map<string, ObjectRef<unknown>>>();
export const findUniqueMap = new WeakMap<
  object,
  Map<ObjectRef<unknown>, ((args: unknown, ctx: {}) => unknown) | null>
>();

export const includeForRefMap = new WeakMap<
  object,
  Map<ObjectRef<unknown>, Record<string, unknown> | null>
>();

export function getRefFromModel<Types extends SchemaTypes>(
  name: string,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
): ObjectRef<unknown> {
  if (!refMap.has(builder)) {
    refMap.set(builder, new Map());
  }
  const cache = refMap.get(builder)!;

  if (!cache.has(name)) {
    cache.set(name, builder.objectRef(name));
  }

  return cache.get(name)!;
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
  name: string,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  relation: string,
) {
  const { client } = builder.options.prisma;
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
  name: string,
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  relation: string,
) {
  const fieldData = getRelation(name, builder, relation);

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

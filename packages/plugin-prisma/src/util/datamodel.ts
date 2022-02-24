import { ObjectRef, SchemaTypes } from '@pothos/core';
import { Prisma } from '../../tests/client';
import { PrismaObjectRef } from '../object-ref';
import { PrismaDelegate, PrismaModelTypes } from '../types';
import { formatCursor, parseCompositeCursor, parseRawCursor } from './cursors';

export const refMap = new WeakMap<object, Map<string, PrismaObjectRef<PrismaModelTypes>>>();
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
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): PrismaObjectRef<PrismaModelTypes> {
  if (!refMap.has(builder)) {
    refMap.set(builder, new Map());
  }
  const cache = refMap.get(builder)!;

  if (!cache.has(name)) {
    cache.set(name, new PrismaObjectRef(name));
  }

  return cache.get(name)!;
}

export function getRelation<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  relation: string,
) {
  const modelData = getModel(name, builder);

  const fieldData = modelData.fields.find((field) => field.name === relation);

  if (!fieldData) {
    throw new Error(`Field '${relation}' not found in model '${name}'`);
  }

  if (fieldData.kind !== 'object') {
    throw new Error(`Field ${relation} of model '${name}' is not a relation (${fieldData.kind})`);
  }

  return fieldData;
}

export function getModel<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  const { client } = builder.options.prisma;
  // eslint-disable-next-line no-underscore-dangle
  const dmmf = (client as unknown as { _dmmf: { modelMap: Record<string, Prisma.DMMF.Model> } })
    ._dmmf;
  const modelData = dmmf.modelMap[name];

  if (!modelData) {
    throw new Error(`Model '${name}' not found in DMMF`);
  }

  return modelData;
}

export function getCursorFormatter<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  cursor: string,
) {
  const modelData = getModel(name, builder);
  const primaryKey = modelData.primaryKey?.name ?? modelData.primaryKey?.fields.join('_');

  return formatCursor(cursor === primaryKey ? modelData.primaryKey!.fields : cursor);
}

export function getCursorParser<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  cursor: string,
) {
  const modelData = getModel(name, builder);
  const primaryKey = modelData.primaryKey?.name ?? modelData.primaryKey?.fields.join('_');

  const parser =
    cursor === primaryKey ? parseCompositeCursor(modelData.primaryKey!.fields) : parseRawCursor;

  return (rawCursor: string) => ({
    [cursor]: parser(rawCursor),
  });
}

export function getDelegateFromModel(client: Record<string, unknown>, model: string) {
  const lowerCase = `${model.slice(0, 1).toLowerCase()}${model.slice(1)}`;

  const delegate = lowerCase in client ? client[lowerCase] : null;

  if (!delegate) {
    throw new Error(`Unable to find delegate for model ${model}`);
  }

  return delegate as PrismaDelegate;
}

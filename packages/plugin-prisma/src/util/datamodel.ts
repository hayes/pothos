import { ObjectRef, PothosSchemaError, SchemaTypes } from '@pothos/core';
import { PrismaInterfaceRef, PrismaRef } from '../interface-ref';
import { PrismaObjectRef } from '../object-ref';
import { PrismaClient, PrismaDelegate, PrismaModelTypes } from '../types';
import { getDMMF } from './get-client';

export const refMap = new WeakMap<object, Map<string, PrismaRef<never, PrismaModelTypes>>>();
export const findUniqueMap = new WeakMap<
  object,
  Map<ObjectRef<SchemaTypes, unknown>, ((args: unknown, ctx: {}) => unknown) | null>
>();

export const includeForRefMap = new WeakMap<
  object,
  Map<ObjectRef<SchemaTypes, unknown>, Record<string, unknown> | null>
>();

export function getRefFromModel<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  type: 'interface' | 'object' = 'object',
): PrismaRef<Types, PrismaModelTypes> {
  if (!refMap.has(builder)) {
    refMap.set(builder, new Map());
  }
  const cache = refMap.get(builder)!;

  if (!cache.has(name)) {
    cache.set(
      name,
      type === 'object' ? new PrismaObjectRef(name, name) : new PrismaInterfaceRef(name, name),
    );
  }

  return cache.get(name)! as never;
}

export function getRelation<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  relation: string,
) {
  const fieldData = getFieldData(name, builder, relation);

  if (fieldData.kind !== 'object') {
    throw new PothosSchemaError(
      `Field ${relation} of model '${name}' is not a relation (${fieldData.kind})`,
    );
  }

  return fieldData;
}

export function getFieldData<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  fieldName: string,
) {
  const modelData = getModel(name, builder);

  const fieldData = modelData.fields.find((field) => field.name === fieldName);

  if (!fieldData) {
    throw new PothosSchemaError(`Field '${fieldName}' not found in model '${name}'`);
  }

  return fieldData;
}

export function getModel<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  const dmmf = getDMMF(builder);

  const modelData = Array.isArray(dmmf.models)
    ? dmmf.models.find((model) => model.name === name)
    : dmmf.models[name];

  if (!modelData) {
    throw new PothosSchemaError(`Model '${name}' not found in DMMF`);
  }

  return modelData;
}

export function getDelegateFromModel(client: PrismaClient, model: string) {
  const lowerCase = `${model.slice(0, 1).toLowerCase()}${model.slice(1)}`;

  const delegate =
    lowerCase in client ? (client as PrismaClient & Record<string, unknown>)[lowerCase] : null;

  if (!delegate) {
    throw new PothosSchemaError(`Unable to find delegate for model ${model}`);
  }

  return delegate as PrismaDelegate;
}

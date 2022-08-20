import { SchemaTypes } from '@pothos/core';
import { EdgeDBObjectRef } from '../object-ref';
import { EdgeDBModelTypes } from '../types';
import { getObjectsTypes } from './get-client';

export const refMap = new WeakMap<object, Map<string, EdgeDBObjectRef<EdgeDBModelTypes>>>();

export function getRefFromModel<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): EdgeDBObjectRef<EdgeDBModelTypes> {
  if (!refMap.has(builder)) {
    refMap.set(builder, new Map());
  }
  const cache = refMap.get(builder)!;

  if (!cache.has(name)) {
    cache.set(name, new EdgeDBObjectRef(name));
  }

  return cache.get(name)!;
}

export function getLink<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  link: string,
) {
  const fieldData = getFieldData(name, builder, link);

  if (fieldData.__kind__ !== 'link') {
    throw new Error(`Field ${link} of model '${name}' is not a link (${fieldData.__kind__})`);
  }

  return fieldData;
}

export function getFieldData<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  fieldName: string,
) {
  const modelData = getModel(name, builder);
  const fieldData = modelData.__element__.__pointers__[fieldName];

  if (!fieldData) {
    throw new Error(`Field '${fieldName}' not found in model '${name}'`);
  }

  return fieldData;
}

export function getModel<Types extends SchemaTypes>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  const typeFields = getObjectsTypes(builder);

  const typeData = typeFields[name];
  if (!typeData) {
    throw new Error(`Type '${name}' not found in schema's default exports.`);
  }

  return typeData;
}

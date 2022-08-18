import './global-types';
import SchemaBuilder, { SchemaTypes } from '@pothos/core';
import { EdgeDBObjectFieldBuilder } from './edgedb-field-builder';
import { getRefFromModel } from './util/datamodel';
import { getModelDescription } from './util/description';
import { getRelationMap } from './util/relation-map';
import { getObjectsTypes } from './util/get-client';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.edgeDBObject = function edgeDBObject(type, { fields, description, ...options }) {
  const ref = getRefFromModel(type as string, this);
  const name: string = type as string;
  const fieldMap = getRelationMap(getObjectsTypes(this)).get(type as string)!;

  ref.name = name;

  this.objectType(ref, {
    ...(options as {}),
    description: getModelDescription(type, this, description),
    extensions: {
      ...options.extensions,
      pothosEdgeDBModel: type,
      pothosEdgeDBFieldMap: fieldMap,
    },
    name,
    fields: fields
      ? () =>
          fields(
            new EdgeDBObjectFieldBuilder(
              name,
              this,
              type,
              getRelationMap(getObjectsTypes(this)).get(type)!,
            ),
          )
      : undefined,
  });

  return ref as never;
};

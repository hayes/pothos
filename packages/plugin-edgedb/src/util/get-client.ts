import { SchemaTypes } from '@pothos/core';
import { EdgeDB, EdgeDBDriver } from '../types';

export function getDriver<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: Types['Context'],
): EdgeDBDriver {
  if (typeof builder.options.edgeDB.client === 'function') {
    console.warn('Not implemented yet');
  }

  return builder.options.edgeDB.client;
}

export function getObjectsTypes<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
): EdgeDB.Datamodel {
  if (!builder.options.edgeDB.qb.default) {
    console.warn(`Missing EdgeDB Query Builder.`);
  }

  return builder.options.edgeDB.qb.default as EdgeDB.Datamodel;
}

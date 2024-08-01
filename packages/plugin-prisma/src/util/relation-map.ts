import { createContextCache } from '@pothos/core';
import type { DMMF, RuntimeDataModel } from './get-client';

export interface FieldMap {
  model: string;
  relations: Map<string, FieldMap>;
}

export type RelationMap = Map<string, FieldMap>;

export const getRelationMap = createContextCache(
  (datamodel: DMMF['datamodel'] | RuntimeDataModel) => createRelationMap(datamodel),
);

export function createRelationMap({ models }: DMMF['datamodel'] | RuntimeDataModel) {
  const relationMap: RelationMap = new Map();

  if (Array.isArray(models)) {
    for (const model of models) {
      relationMap.set(model.name, { model: model.name, relations: new Map() });
    }

    for (const model of models) {
      const map = relationMap.get(model.name)!.relations;

      for (const field of model.fields) {
        if (field.kind === 'object' && relationMap.has(field.type)) {
          map.set(field.name, relationMap.get(field.type)!);
        }
      }
    }
  } else {
    for (const name of Object.keys(models)) {
      relationMap.set(name, { model: name, relations: new Map() });
    }

    for (const [name, model] of Object.entries(models)) {
      const map = relationMap.get(name)!.relations;

      for (const field of model.fields) {
        if (field.kind === 'object' && relationMap.has(field.type)) {
          map.set(field.name, relationMap.get(field.type)!);
        }
      }
    }
  }

  return relationMap;
}

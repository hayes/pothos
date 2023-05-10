import { createContextCache } from '@pothos/core';
import { DMMF, RuntimeDataModel } from './get-client';

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
    models.forEach((model) => {
      relationMap.set(model.name, { model: model.name, relations: new Map() });
    });

    models.forEach((model) => {
      const map = relationMap.get(model.name)!.relations;

      model.fields.forEach((field) => {
        if (field.kind === 'object' && relationMap.has(field.type)) {
          map.set(field.name, relationMap.get(field.type)!);
        }
      });
    });
  } else {
    Object.keys(models).forEach((name) => {
      relationMap.set(name, { model: name, relations: new Map() });
    });

    Object.entries(models).forEach(([name, model]) => {
      const map = relationMap.get(name)!.relations;

      model.fields.forEach((field) => {
        if (field.kind === 'object' && relationMap.has(field.type)) {
          map.set(field.name, relationMap.get(field.type)!);
        }
      });
    });
  }

  return relationMap;
}

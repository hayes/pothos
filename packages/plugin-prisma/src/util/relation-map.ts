import { createContextCache } from '@pothos/core';
import type { DMMF, RuntimeDataModel } from './get-client.js';

export interface FieldMap {
  model: string;
  relations: Map<string, FieldMap>;
  /** The relations `_count` can count, so `_count: true` can be spelled out when it has to be. */
  listRelations: Set<string>;
}

export type RelationMap = Map<string, FieldMap>;

export const getRelationMap = createContextCache(
  (datamodel: DMMF['datamodel'] | RuntimeDataModel) => createRelationMap(datamodel),
);

export function createRelationMap({ models }: DMMF['datamodel'] | RuntimeDataModel) {
  const relationMap: RelationMap = new Map();

  if (Array.isArray(models)) {
    for (const model of models) {
      relationMap.set(model.name, {
        model: model.name,
        relations: new Map(),
        listRelations: new Set(),
      });
    }

    for (const model of models) {
      const map = relationMap.get(model.name)!;

      for (const field of model.fields) {
        if (field.kind === 'object' && relationMap.has(field.type)) {
          map.relations.set(field.name, relationMap.get(field.type)!);

          if (field.isList) {
            map.listRelations.add(field.name);
          }
        }
      }
    }
  } else {
    for (const name of Object.keys(models)) {
      relationMap.set(name, { model: name, relations: new Map(), listRelations: new Set() });
    }

    for (const [name, model] of Object.entries(models)) {
      const map = relationMap.get(name)!;

      for (const field of model.fields) {
        if (field.kind === 'object' && relationMap.has(field.type)) {
          map.relations.set(field.name, relationMap.get(field.type)!);

          if (field.isList) {
            map.listRelations.add(field.name);
          }
        }
      }
    }
  }

  return relationMap;
}

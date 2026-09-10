import { createContextCache } from '@pothos/core';
import type { DMMF, DMMFField, RuntimeDataModel } from './get-client.js';

export interface FieldMap {
  relations: Map<string, FieldMap>;
  /** The relations `_count` can count, so `_count: true` can be spelled out when it has to be. */
  listRelations: Set<string>;
}

export type RelationMap = Map<string, FieldMap>;

/**
 * Every model's relations, by name. Built once per datamodel, from either shape prisma hands us:
 * the DMMF's array of models or the runtime datamodel's record of them.
 */
export const getRelationMap = createContextCache(
  ({ models }: DMMF['datamodel'] | RuntimeDataModel) => {
    const entries: [string, { fields: DMMFField[] }][] = Array.isArray(models)
      ? models.map((model) => [model.name, model])
      : Object.entries(models);
    const relationMap: RelationMap = new Map();

    for (const [name] of entries) {
      relationMap.set(name, { relations: new Map(), listRelations: new Set() });
    }

    for (const [name, model] of entries) {
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

    return relationMap;
  },
);

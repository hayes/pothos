import { createContextCache } from '@pothos/core';
import { DMMF } from '@prisma/generator-helper';

export interface FieldMap {
  model: string;
  relations: Map<string, FieldMap>;
}

export type RelationMap = Map<string, FieldMap>;

export const getRelationMap = createContextCache((client: object) =>
  createRelationMap(
    // eslint-disable-next-line no-underscore-dangle
    (client as unknown as { _dmmf: { datamodel: DMMF.Datamodel } })._dmmf.datamodel,
  ),
);

export function createRelationMap({ models }: DMMF.Datamodel) {
  const relationMap: RelationMap = new Map();

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

  return relationMap;
}

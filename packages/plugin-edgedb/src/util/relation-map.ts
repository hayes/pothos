import { createContextCache } from '@pothos/core';
import { EdgeDB } from '../types';

export interface FieldMap {
  type: string;
  links: Map<string, FieldMap>;
}
export type RelationMap = Map<string, FieldMap>;

export const getRelationMap = createContextCache((edgeDBDefaultExports: unknown) =>
  createRelationMap(edgeDBDefaultExports as EdgeDB.Datamodel),
);

export function createRelationMap(edgeDBDefault: EdgeDB.Datamodel) {
  const relationMap: RelationMap = new Map();

  Object.entries(edgeDBDefault).forEach(([type]) => {
    relationMap.set(type, {
      type,
      links: new Map([]),
    });
  });

  Object.entries(edgeDBDefault).forEach(([type, { __element__ }]) => {
    const map = relationMap.get(type)!.links;

    Object.entries(__element__.__pointers__)
      .filter(
        ([key, entry]) =>
          !String(key).startsWith('<') &&
          String(key) !== '__type__' &&
          String(entry.__kind__) === 'link',
      )
      .forEach(([linkName, entry]) => {
        const typeName = entry.target.__name__.replace('default::', '');
        map.set(linkName, relationMap.get(typeName)!);
      });
  });

  return relationMap;
}

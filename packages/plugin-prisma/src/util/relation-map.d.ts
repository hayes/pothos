import type { DMMFField, RuntimeDataModel } from './get-client.js';
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
export declare const getRelationMap: import("@pothos/core").ContextCache<RelationMap, RuntimeDataModel | {
    models: {
        name: string;
        fields: DMMFField[];
        primaryKey: {
            name: string | null;
            fields: string[];
        } | null;
        uniqueIndexes: {
            name: string | null;
            fields: string[];
        }[];
        documentation?: string;
    }[];
}, []>;

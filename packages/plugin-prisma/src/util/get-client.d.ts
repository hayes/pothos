import { type SchemaTypes } from '@pothos/core';
import type { PrismaClient } from '../types.js';
export interface DMMFField {
    type: string;
    kind: string;
    name: string;
    isRequired: boolean;
    isList: boolean;
    hasDefaultValue: boolean;
    isUnique: boolean;
    isId: boolean;
    documentation?: string;
    relationName?: string;
    relationFromFields?: string[];
    isUpdatedAt?: boolean;
}
export interface DMMF {
    datamodel: {
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
    };
}
export interface RuntimeDataModel {
    models: Record<string, {
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
    }>;
}
export declare const prismaClientCache: import("@pothos/core").ContextCache<import("@pothos/core").ContextCache<PrismaClient, object, []>, PothosSchemaTypes.SchemaBuilder<SchemaTypes>, []>;
export declare function getClient<Types extends SchemaTypes>(builder: PothosSchemaTypes.SchemaBuilder<Types>, context: Types['Context']): PrismaClient;
export declare function getDMMF<Types extends SchemaTypes>(builder: PothosSchemaTypes.SchemaBuilder<Types>): DMMF['datamodel'] | RuntimeDataModel;

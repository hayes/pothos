import { type SchemaTypes } from '@pothos/core';
import { type PrismaRef } from '../interface-ref.js';
import type { PrismaClient, PrismaDelegate, PrismaModelTypes } from '../types.js';
export declare const refMap: WeakMap<object, Map<string, PrismaRef<never, PrismaModelTypes>>>;
export declare function getRefFromModel<Types extends SchemaTypes>(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, type?: 'interface' | 'object'): PrismaRef<Types, PrismaModelTypes>;
export declare function getRelation<Types extends SchemaTypes>(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, relation: string): import("./get-client.js").DMMFField;
export declare function getFieldData<Types extends SchemaTypes>(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, fieldName: string): import("./get-client.js").DMMFField;
export declare function getModel<Types extends SchemaTypes>(name: string, builder: PothosSchemaTypes.SchemaBuilder<Types>): {
    fields: import("./get-client.js").DMMFField[];
    primaryKey: {
        name: string | null;
        fields: string[];
    } | null;
    uniqueIndexes: {
        name: string | null;
        fields: string[];
    }[];
    documentation?: string;
};
export declare function getDelegateFromModel(client: PrismaClient, model: string): PrismaDelegate;

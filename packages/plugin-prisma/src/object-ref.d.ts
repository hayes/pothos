import { abstractReturnShapeKey, ObjectRef, type SchemaTypes } from '@pothos/core';
import type { PrismaModelTypes, WithBrand } from './types.js';
export declare const prismaModelKey: unique symbol;
export declare class PrismaObjectRef<Types extends SchemaTypes, Model extends PrismaModelTypes, T = {}> extends ObjectRef<Types, T> {
    [prismaModelKey]: Model;
    [abstractReturnShapeKey]: WithBrand<T>;
    modelName: string;
    constructor(name: string, modelName: string);
    addBrand<V extends T | T[]>(value: V): V extends T[] ? {
        [K in keyof V]: WithBrand<V[K]>;
    } : WithBrand<V>;
    hasBrand(value: unknown): boolean;
}

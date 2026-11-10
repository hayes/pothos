import { type InterfaceRef, type MaybePromise, type ObjectRef, type SchemaTypes } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { SelectionMap } from './types.js';
import { type PrismaNode, type PrismaPlayedPlan } from './util/adapter.js';
import type { FieldMap } from './util/relation-map.js';
interface ResolvablePromise<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (err: unknown) => void;
}
export declare class ModelLoader {
    context: object;
    builder: PothosSchemaTypes.SchemaBuilder<never>;
    findUnique: (model: Record<string, unknown>, ctx: {}) => MaybePromise<unknown>;
    modelName: string;
    queryCache: WeakMap<object, Map<string, MaybePromise<PrismaPlayedPlan>>>;
    staged: Set<{
        root: PrismaNode;
        models: Map<object, ResolvablePromise<Record<string, unknown> | null>>;
    }>;
    tick: Promise<void>;
    constructor(context: object, builder: PothosSchemaTypes.SchemaBuilder<never>, modelName: string, findUnique: (model: Record<string, unknown>, ctx: {}) => MaybePromise<unknown>);
    static forRef<Types extends SchemaTypes>(ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>, modelName: string, findUnique: ((model: Record<string, unknown>, ctx: {}) => MaybePromise<unknown>) | null | undefined, builder: PothosSchemaTypes.SchemaBuilder<Types>): import("@pothos/core").ContextCache<ModelLoader, object, []>;
    static getFindUnique(findBy: string | {
        name: string | null;
        fields: string[];
    }): (model: Record<string, unknown>) => {};
    static getDefaultFindBy<Types extends SchemaTypes>(ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>, modelName: string, builder: PothosSchemaTypes.SchemaBuilder<Types>): string | {
        name: string | null;
        fields: string[];
    };
    static getDefaultIDSelection<Types extends SchemaTypes>(ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>, modelName: string, builder: PothosSchemaTypes.SchemaBuilder<Types>): Record<string, boolean>;
    static getCursorSelection<Types extends SchemaTypes>(ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>, modelName: string, cursor: string, builder: PothosSchemaTypes.SchemaBuilder<Types>): Record<string, boolean>;
    static getFindUniqueForField<Types extends SchemaTypes>(ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>, modelName: string, fieldName: string, builder: PothosSchemaTypes.SchemaBuilder<Types>): (model: Record<string, unknown>) => {};
    getSelection(info: GraphQLResolveInfo): MaybePromise<PrismaPlayedPlan>;
    /**
     * `model` reloaded with the selection of the field `info` resolves. A synchronous selection
     * stages synchronously, so every row resolved in a tick joins the same batch; only a selection
     * with an async select beneath the field waits for it.
     */
    loadSelection(info: GraphQLResolveInfo, model: object): Promise<Record<string, unknown> | null>;
    private loadWith;
    stageQuery(played: Pick<PrismaPlayedPlan, 'root'>, model: object): Promise<Record<string, unknown> | null>;
    initLoad(played: Pick<PrismaPlayedPlan, 'root'>, initialModel: {}): Promise<Record<string, unknown> | null>;
}
/** Matches `ScopeAuthParentLoader` in @pothos/plugin-scope-auth, which this plugin can't import. */
type ScopeAuthParentLoader = (parent: unknown, context: object, info: GraphQLResolveInfo) => MaybePromise<unknown>;
/**
 * The parent scope-auth's checks see for a type: the row when it has every top-level key of the
 * type's selection, otherwise the row reloaded with it. `scalars` are the columns of include mode,
 * which loads every scalar.
 */
export declare function typeParentLoader(loaders: (context: object) => ModelLoader, fieldMap: FieldMap, selection: SelectionMap, scalars: readonly string[]): ScopeAuthParentLoader;
export {};

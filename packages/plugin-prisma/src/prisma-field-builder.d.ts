import { type CompatibleTypes, type ExposeNullability, type FieldKind, type FieldRef, type InferredFieldOptionKeys, type InputFieldMap, type InterfaceParam, type NormalizeArgs, ObjectRef, type PluginName, type SchemaTypes, type ShapeFromTypeParam, type TypeParam } from '@pothos/core';
import type { PrismaRef } from './interface-ref.js';
import type { PrismaConnectionShape, PrismaModelTypes, RelatedConnectionOptions, RelatedFieldOptions, RelationCountOptions, ShapeFromConnection, TypesForRelation, VariantFieldOptions } from './types.js';
import type { FieldMap } from './util/relation-map.js';
declare const RootBuilder: {
    new <Types extends SchemaTypes, Shape, Kind extends FieldKind>(builder: PothosSchemaTypes.SchemaBuilder<Types>, kind: FieldKind, graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind]): PothosSchemaTypes.RootFieldBuilder<Types, Shape, Kind>;
};
type ContextForAuth<Types extends SchemaTypes, Scopes extends {} = {}> = PothosSchemaTypes.ScopeAuthContextForAuth<Types, Scopes> extends {
    Context: infer T;
} ? T extends object ? T : object : object;
type FieldAuthScopes<Types extends SchemaTypes, Parent, Args extends {} = {}> = PothosSchemaTypes.ScopeAuthFieldAuthScopes<Types, Parent, Args> extends {
    Scopes: infer T;
} ? T : never;
export declare class PrismaObjectFieldBuilder<Types extends SchemaTypes, Model extends PrismaModelTypes, Shape extends object = Model['Shape']> extends RootBuilder<Types, Shape, 'PrismaObject'> {
    model: string;
    prismaFieldMap: FieldMap;
    exposeBoolean: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], "Boolean", "Boolean" extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, "Boolean", Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, "Boolean", Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, import("@pothos/core").FieldNullability<"Boolean"> extends Nullable ? Types["DefaultFieldNullability"] extends true ? ("Boolean" extends infer T ? T extends "Boolean" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "Boolean" extends infer T ? T extends "Boolean" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never : Nullable extends true ? ("Boolean" extends infer T ? T extends "Boolean" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "Boolean" extends infer T ? T extends "Boolean" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never, "PrismaObject">;
    exposeFloat: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], "Float", "Float" extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, "Float", Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, "Float", Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, import("@pothos/core").FieldNullability<"Float"> extends Nullable ? Types["DefaultFieldNullability"] extends true ? ("Float" extends infer T ? T extends "Float" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "Float" extends infer T ? T extends "Float" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never : Nullable extends true ? ("Float" extends infer T ? T extends "Float" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "Float" extends infer T ? T extends "Float" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never, "PrismaObject">;
    exposeInt: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], "Int", "Int" extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, "Int", Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, "Int", Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, import("@pothos/core").FieldNullability<"Int"> extends Nullable ? Types["DefaultFieldNullability"] extends true ? ("Int" extends infer T ? T extends "Int" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "Int" extends infer T ? T extends "Int" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never : Nullable extends true ? ("Int" extends infer T ? T extends "Int" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "Int" extends infer T ? T extends "Int" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never, "PrismaObject">;
    exposeID: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], "ID", "ID" extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, "ID", Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, "ID", Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, import("@pothos/core").FieldNullability<"ID"> extends Nullable ? Types["DefaultFieldNullability"] extends true ? ("ID" extends infer T ? T extends "ID" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "ID" extends infer T ? T extends "ID" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never : Nullable extends true ? ("ID" extends infer T ? T extends "ID" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "ID" extends infer T ? T extends "ID" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never, "PrismaObject">;
    exposeString: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], "String", "String" extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, "String", Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, "String", Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, import("@pothos/core").FieldNullability<"String"> extends Nullable ? Types["DefaultFieldNullability"] extends true ? ("String" extends infer T ? T extends "String" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "String" extends infer T ? T extends "String" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never : Nullable extends true ? ("String" extends infer T ? T extends "String" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never) | null | undefined : "String" extends infer T ? T extends "String" ? T extends keyof Types["outputShapes"] ? Types["outputShapes"][T] : T extends import("@pothos/core").BaseEnum ? import("@pothos/core").ValuesFromEnum<T> : never : never : never, "PrismaObject">;
    exposeBooleanList: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], ["Boolean"], ["Boolean"] extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, ["Boolean"], Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, ["Boolean"], Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, ShapeFromTypeParam<Types, ["Boolean"], Nullable>, "PrismaObject">;
    exposeFloatList: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], ["Float"], ["Float"] extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, ["Float"], Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, ["Float"], Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, ShapeFromTypeParam<Types, ["Float"], Nullable>, "PrismaObject">;
    exposeIntList: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], ["Int"], ["Int"] extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, ["Int"], Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, ["Int"], Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, ShapeFromTypeParam<Types, ["Int"], Nullable>, "PrismaObject">;
    exposeIDList: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], ["ID"], ["ID"] extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, ["ID"], Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, ["ID"], Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, ShapeFromTypeParam<Types, ["ID"], Nullable>, "PrismaObject">;
    exposeStringList: <Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], ["String"], ["String"] extends [unknown] ? {
        list: true;
        items: true;
    } : true>>(name: Name, ...args: NormalizeArgs<[options: ExposeNullability<Types, ["String"], Model["Shape"], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, ["String"], Nullable, {}, ResolveReturnShape>, "description" | "nullable" | "resolve" | "select" | "type"> & {
        description?: string | false;
    }], 0>) => FieldRef<Types, ShapeFromTypeParam<Types, ["String"], Nullable>, "PrismaObject">;
    withAuth: 'scopeAuth' extends PluginName ? <Scopes extends FieldAuthScopes<Types, Shape, Record<string, unknown>>>(scopes: Scopes) => PothosSchemaTypes.PrismaObjectFieldBuilder<Omit<Types, 'Context'> & {
        Context: ContextForAuth<Types, Scopes>;
    }, Model, Shape> : '@pothos/plugin-scope-auth is required to use this method';
    relatedConnection: 'relay' extends PluginName ? <Field extends Model['ListRelations'], Nullable extends boolean, Args extends InputFieldMap, const ConnectionInterfaces extends InterfaceParam<Types>[] = [], const EdgeInterfaces extends InterfaceParam<Types>[] = [], Type = unknown, Shape = Type extends PrismaRef<any, any> ? Type['$inferType'] : TypesForRelation<Types, Model, Field>['Shape']>(field: Field, options: RelatedConnectionOptions<Types, Model, Field, Nullable, Args, Type>, ...args: NormalizeArgs<[
        connectionOptions: ObjectRef<Types, ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, Shape, false>>> | PothosSchemaTypes.ConnectionObjectOptions<Types, ObjectRef<Types, ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>>, false, false, PrismaConnectionShape<Types, ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>, Shape, Args>, ConnectionInterfaces>,
        edgeOptions: ObjectRef<Types, {
            cursor: string;
            node?: Shape | null | undefined;
        }> | PothosSchemaTypes.ConnectionEdgeObjectOptions<Types, ObjectRef<Types, ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>>, false, PrismaConnectionShape<Types, ShapeFromTypeParam<Types, [ObjectRef<Types, Shape>], Nullable>, Shape, Args>, EdgeInterfaces>
    ], 0>) => FieldRef<Types, ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, Shape, Nullable>>> : '@pothos/plugin-relay is required to use this method';
    typename: string;
    constructor(typename: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, model: string, fieldMap: FieldMap, graphqlKind?: PothosSchemaTypes.PothosKindToGraphQLType[FieldKind]);
    relation<Field extends Model['RelationName'], Nullable extends boolean, Args extends InputFieldMap, ResolveReturnShape>(name: Field, ...allArgs: NormalizeArgs<[
        options: RelatedFieldOptions<Types, Model, Field, Nullable, Args, ResolveReturnShape, Shape>
    ]>): FieldRef<Types, Model['Relations'][Field]['Shape'], 'Object'>;
    relationCount<Field extends Model['ListRelations'], Args extends InputFieldMap>(name: Field, ...allArgs: NormalizeArgs<[
        options: RelationCountOptions<Types, Shape, TypesForRelation<Types, Model, Field>['Where'], Args>
    ]>): FieldRef<Types, number, 'Object'>;
    variant<Variant extends Model['Name'] | PrismaRef<any, Model>, Args extends InputFieldMap, Nullable>(variant: Variant, ...allArgs: NormalizeArgs<[
        options: VariantFieldOptions<Types, Model, Variant extends PrismaRef<any, Model> ? Variant : PrismaRef<Types, Model>, Args, Nullable, Shape>
    ]>): FieldRef<Types, Model['Shape'], 'Object'>;
    expose<Type extends TypeParam<Types>, Nullable extends boolean, ResolveReturnShape, Name extends CompatibleTypes<Types, Model['Shape'], Type, true>>(name: Name, ...args: NormalizeArgs<[
        options: ExposeNullability<Types, Type, Model['Shape'], Name, Nullable> & Omit<PothosSchemaTypes.ObjectFieldOptions<Types, Shape, Type, Nullable, {}, ResolveReturnShape>, 'description' | 'nullable' | 'select' | InferredFieldOptionKeys> & {
            description?: string | false;
        }
    ]>): FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, 'PrismaObject'>;
    private createExpose;
}
export {};

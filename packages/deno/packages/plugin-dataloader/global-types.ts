// @ts-nocheck
import { FieldKind, FieldNullability, FieldRef, InputFieldMap, InterfaceParam, ObjectParam, OutputType, PluginName, SchemaTypes, ShapeFromTypeParam, TypeParam, } from '../core/index.ts';
import { ImplementableLoadableNodeRef, LoadableNodeRef } from './refs/index.ts';
import { ImplementableLoadableInterfaceRef, LoadableInterfaceRef } from './refs/interface.ts';
import { ImplementableLoadableObjectRef, LoadableObjectRef } from './refs/object.ts';
import { LoadableUnionRef } from './refs/union.ts';
import { DataloaderObjectTypeOptions, DataLoaderOptions, LoadableFieldOptions, LoadableNodeId, LoadableNodeOptions, } from './types.ts';
import type { LoadableGroupFieldOptions, LoadableInterfaceOptions, LoadableListFieldOptions, LoadableUnionOptions, PothosDataloaderPlugin, } from './index.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            dataloader: PothosDataloaderPlugin<Types>;
        }
        export interface SchemaBuilder<Types extends SchemaTypes> {
            loadableObject: <Shape extends NameOrRef extends ObjectParam<Types> ? ShapeFromTypeParam<Types, NameOrRef, false> : object, Key extends bigint | number | string, Interfaces extends InterfaceParam<Types>[], NameOrRef extends ObjectParam<Types> | string, CacheKey = Key>(nameOrRef: NameOrRef, options: DataloaderObjectTypeOptions<Types, Shape, Key, Interfaces, NameOrRef, CacheKey>) => LoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>;
            loadableInterface: <Shape extends NameOrRef extends InterfaceParam<Types> ? ShapeFromTypeParam<Types, NameOrRef, false> : object, Key extends bigint | number | string, Interfaces extends InterfaceParam<Types>[], NameOrRef extends InterfaceParam<Types> | string, CacheKey = Key>(nameOrRef: NameOrRef, options: LoadableInterfaceOptions<Types, Shape, Key, Interfaces, NameOrRef, CacheKey>) => LoadableInterfaceRef<Types, Key | Shape, Shape, Key, CacheKey>;
            loadableObjectRef: <Shape extends object, Key extends bigint | number | string, CacheKey = Key>(name: string, options: DataLoaderOptions<Types, Shape, Key, CacheKey>) => ImplementableLoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>;
            loadableInterfaceRef: <Shape extends object, Key extends bigint | number | string, CacheKey = Key>(name: string, options: DataLoaderOptions<Types, Shape, Key, CacheKey>) => ImplementableLoadableInterfaceRef<Types, Key | Shape, Shape, Key, CacheKey>;
            loadableNodeRef: <Shape extends object, IDShape extends bigint | number | string = string, Key extends bigint | number | string = IDShape, CacheKey = Key>(name: string, options: DataLoaderOptions<Types, Shape, Key, CacheKey> & LoadableNodeId<Types, Shape, IDShape>) => ImplementableLoadableNodeRef<Types, Key | Shape, Shape, IDShape, Key, CacheKey>;
            loadableUnion: <Key extends bigint | number | string, Member extends ObjectParam<Types>, CacheKey = Key, Shape = ShapeFromTypeParam<Types, Member, false>>(name: string, options: LoadableUnionOptions<Types, Key, Member, CacheKey, Shape>) => LoadableUnionRef<Types, Key | Shape, Shape, Key, CacheKey>;
            loadableNode: "relay" extends PluginName ? <Shape extends NameOrRef extends ObjectParam<Types> ? ShapeFromTypeParam<Types, NameOrRef, false> : object, Interfaces extends InterfaceParam<Types>[], NameOrRef extends ObjectParam<Types> | string, IDShape extends bigint | number | string = string, Key extends bigint | number | string = IDShape, CacheKey = Key>(nameOrRef: NameOrRef, options: LoadableNodeOptions<Types, Shape, Interfaces, NameOrRef, IDShape, Key, CacheKey>) => LoadableNodeRef<Types, Key | Shape, Shape, IDShape, Key, CacheKey> : "@pothos/plugin-relay is required to use this method";
        }
        export interface RootFieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> {
            loadable: <Args extends InputFieldMap, Type extends TypeParam<Types>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<Type> = Types["DefaultFieldNullability"], ByPath extends boolean = boolean>(options: LoadableFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, Kind, ByPath>) => FieldRef<Types, unknown, Kind>;
            loadableList: <Args extends InputFieldMap, Type extends OutputType<Types>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<[
                Type
            ]> = Types["DefaultFieldNullability"], ByPath extends boolean = boolean>(options: LoadableListFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, Kind, ByPath>) => FieldRef<Types, unknown>;
            loadableGroup: <Args extends InputFieldMap, Type extends OutputType<Types>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<[
                Type
            ]> = Types["DefaultFieldNullability"], ByPath extends boolean = boolean>(options: LoadableGroupFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, Kind, ByPath>) => FieldRef<Types, unknown>;
        }
    }
}

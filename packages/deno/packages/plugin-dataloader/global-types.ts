// @ts-nocheck
import { FieldKind, FieldNullability, FieldRef, InputFieldMap, InterfaceParam, ObjectParam, PluginName, SchemaTypes, ShapeFromTypeParam, TypeParam, } from '../core/index.ts';
import { LoadableInterfaceRef } from './refs/interface.ts';
import { LoadableObjectRef } from './refs/object.ts';
import { LoadableUnionRef } from './refs/union.ts';
import { DataloaderObjectTypeOptions, LoadableFieldOptions, LoadableNodeOptions } from './types.ts';
import { GiraphQLDataloaderPlugin, LoadableInterfaceOptions, LoadableUnionOptions } from './index.ts';
declare global {
    export namespace GiraphQLSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            dataloader: GiraphQLDataloaderPlugin<Types>;
        }
        export interface SchemaBuilder<Types extends SchemaTypes> {
            loadableObject: <Shape extends NameOrRef extends ObjectParam<Types> ? ShapeFromTypeParam<Types, NameOrRef, false> : object, Key extends bigint | number | string, Interfaces extends InterfaceParam<Types>[], NameOrRef extends ObjectParam<Types> | string, CacheKey = Key>(nameOrRef: NameOrRef, options: DataloaderObjectTypeOptions<Types, Shape, Key, Interfaces, NameOrRef, CacheKey>) => LoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>;
            loadableInterface: <Shape extends NameOrRef extends InterfaceParam<Types> ? ShapeFromTypeParam<Types, NameOrRef, false> : object, Key extends bigint | number | string, Interfaces extends InterfaceParam<Types>[], NameOrRef extends InterfaceParam<Types> | string, CacheKey = Key>(nameOrRef: NameOrRef, options: LoadableInterfaceOptions<Types, Shape, Key, Interfaces, NameOrRef, CacheKey>) => LoadableInterfaceRef<Types, Key | Shape, Shape, Key, CacheKey>;
            loadableUnion: <Key extends bigint | number | string, Member extends ObjectParam<Types>, CacheKey = Key, Shape = ShapeFromTypeParam<Types, Member, false>>(name: string, options: LoadableUnionOptions<Types, Key, Member, CacheKey, Shape>) => LoadableUnionRef<Types, Key | Shape, Shape, Key, CacheKey>;
            loadableNode: "relay" extends PluginName ? <Shape extends NameOrRef extends ObjectParam<Types> ? ShapeFromTypeParam<Types, NameOrRef, false> : object, Key extends bigint | number | string, Interfaces extends InterfaceParam<Types>[], NameOrRef extends ObjectParam<Types> | string, CacheKey = Key>(nameOrRef: NameOrRef, options: LoadableNodeOptions<Types, Shape, Key, Interfaces, NameOrRef, CacheKey>) => Omit<LoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>, "implement"> : "@giraphql/plugin-relay is required to use this method";
        }
        export interface RootFieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> {
            loadable: <Args extends InputFieldMap, Type extends TypeParam<Types>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<Type> = Types["DefaultFieldNullability"]>(options: LoadableFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, Kind>) => FieldRef<unknown>;
        }
    }
}

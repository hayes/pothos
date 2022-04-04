// @ts-nocheck
import DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import { FieldKind, FieldNullability, FieldOptionsFromKind, InputFieldMap, InputShapeFromFields, InterfaceParam, InterfaceRef, InterfaceTypeOptions, MaybePromise, ObjectParam, ObjectRef, ObjectTypeOptions, OutputShape, OutputType, Resolver, SchemaTypes, ShapeFromTypeParam, TypeParam, } from '../core/index.ts';
export type DataloaderKey = bigint | number | string;
export type LoadableFieldOptions<Types extends SchemaTypes, ParentShape, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>, Args extends InputFieldMap, ResolveReturnShape, Key, CacheKey, Kind extends FieldKind = FieldKind> = Omit<FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind, Key, ResolveReturnShape>, "resolve"> & {
    load: (keys: Key[], context: Types["Context"]) => Promise<(Error | LoaderShapeFromType<Types, Type, Nullable>)[]>;
    loaderOptions?: DataLoader.Options<Key, LoaderShapeFromType<Types, Type, Nullable>, CacheKey>;
    sort?: (value: LoaderShapeFromType<Types, Type, false>) => Key;
    resolve: Resolver<ParentShape, InputShapeFromFields<Args>, Types["Context"], Type extends unknown[] ? Key[] : Key, ResolveReturnShape>;
};
export type LoadableListFieldOptions<Types extends SchemaTypes, ParentShape, Type extends OutputType<Types>, Nullable extends FieldNullability<[
    Type
]>, Args extends InputFieldMap, ResolveReturnShape, Key, CacheKey, Kind extends FieldKind = FieldKind> = Omit<FieldOptionsFromKind<Types, ParentShape, [
    Type
], Nullable, Args, Kind, Key, ResolveReturnShape>, "resolve" | "type"> & {
    type: Type;
    load: (keys: Key[], context: Types["Context"]) => Promise<(Error | ShapeFromTypeParam<Types, [
        Type
    ], Nullable>)[]>;
    loaderOptions?: DataLoader.Options<Key, ShapeFromTypeParam<Types, [
        Type
    ], Nullable>, CacheKey>;
    sort?: (value: ShapeFromTypeParam<Types, [
        Type
    ], false>) => Key;
    resolve: Resolver<ParentShape, InputShapeFromFields<Args>, Types["Context"], Key, ResolveReturnShape>;
};
export type DataLoaderOptions<Types extends SchemaTypes, Shape, Key extends bigint | number | string, CacheKey> = {
    load: (keys: Key[], context: Types["Context"]) => Promise<(Error | Shape)[]>;
    loaderOptions?: DataLoader.Options<Key, Shape, CacheKey>;
} & ({
    toKey: (value: Shape) => Key;
    cacheResolved?: boolean;
    sort?: boolean;
} | {
    toKey?: undefined;
    cacheResolved?: (value: Shape) => Key;
    sort?: (value: Shape) => Key;
});
export type DataloaderObjectTypeOptions<Types extends SchemaTypes, Shape, Key extends bigint | number | string, Interfaces extends InterfaceParam<Types>[], NameOrRef extends ObjectParam<Types> | string, CacheKey> = ObjectTypeOptions<Types, NameOrRef extends ObjectParam<Types> ? NameOrRef : ObjectRef<Shape>, Shape, Interfaces> & DataLoaderOptions<Types, Shape, Key, CacheKey>;
export type LoadableInterfaceOptions<Types extends SchemaTypes, Shape, Key extends bigint | number | string, Interfaces extends InterfaceParam<Types>[], NameOrRef extends InterfaceParam<Types> | string, CacheKey> = InterfaceTypeOptions<Types, NameOrRef extends InterfaceParam<Types> ? NameOrRef : InterfaceRef<Shape>, Shape, Interfaces> & DataLoaderOptions<Types, Shape, Key, CacheKey>;
export type LoadableUnionOptions<Types extends SchemaTypes, Key extends bigint | number | string, Member extends ObjectParam<Types>, CacheKey, Shape> = PothosSchemaTypes.UnionTypeOptions<Types, Member> & DataLoaderOptions<Types, Shape, Key, CacheKey>;
export type LoaderShapeFromType<Types extends SchemaTypes, Type extends TypeParam<Types>, Nullable extends FieldNullability<Type>> = Type extends [
    TypeParam<Types>
] ? ShapeFromTypeParam<Types, Type[0], Nullable> : ShapeFromTypeParam<Types, Type, Nullable>;
export interface LoadableRef<K, V, C> {
    getDataloader: (context: C) => DataLoader<K, V>;
}
export interface LoadableNodeId<Types extends SchemaTypes, Shape extends object> {
    id: Omit<FieldOptionsFromKind<Types, Shape, "ID", false, {}, "Object", Shape, MaybePromise<OutputShape<Types, "ID">>>, "args" | "nullable" | "type">;
}
export type LoadableNodeOptions<Types extends SchemaTypes, Shape extends object, Key extends bigint | number | string, Interfaces extends InterfaceParam<Types>[], NameOrRef extends ObjectParam<Types> | string, CacheKey> = DataloaderObjectTypeOptions<Types, Shape, Key, Interfaces, NameOrRef, CacheKey> & LoadableNodeId<Types, Shape>;

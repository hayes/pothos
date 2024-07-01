// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { FieldKind, FieldNullability, FieldRef, InputFieldMap, InputShapeFromFields, OutputType, RootFieldBuilder, SchemaTypes, ShapeFromTypeParam, TypeParam, } from '../core/index.ts';
import type { LoadableGroupFieldOptions, LoadableListFieldOptions } from './types.ts';
import { LoadableFieldOptions, LoaderShapeFromType } from './types.ts';
import { pathDataloaderGetter, rejectErrors } from './util.ts';
const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>;
fieldBuilderProto.loadable = function loadable<Args extends InputFieldMap, Type extends TypeParam<SchemaTypes>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<Type> = SchemaTypes["DefaultFieldNullability"], ByPath extends boolean = boolean>({ load, sort, loaderOptions, resolve, type, byPath, ...options }: LoadableFieldOptions<SchemaTypes, unknown, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, FieldKind, ByPath>): FieldRef<SchemaTypes, unknown> {
    const getLoader = pathDataloaderGetter<Key, LoaderShapeFromType<SchemaTypes, Type, Nullable>, CacheKey, InputShapeFromFields<Args>>(loaderOptions, (keys, ctx, args) => load(keys, ctx, args as never), undefined, sort as (value: LoaderShapeFromType<SchemaTypes, Type, Nullable>) => Key, byPath);
    return this.field({
        ...options,
        type,
        // @ts-expect-error types don't match because this handles both lists and single objects
        resolve: async (parent: unknown, args: InputShapeFromFields<Args>, context: {}, info: GraphQLResolveInfo) => {
            const ids = await resolve(parent, args, context, info);
            if (ids == null) {
                return null;
            }
            const loader = getLoader(args, context, info);
            if (Array.isArray(type)) {
                return rejectErrors((ids as Key[]).map((id) => (id == null ? id : loader.load(id))));
            }
            return loader.load(ids as Key);
        },
    });
};
fieldBuilderProto.loadableList = function loadableList<Args extends InputFieldMap, Type extends OutputType<SchemaTypes>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<[
    Type
]> = SchemaTypes["DefaultFieldNullability"], ByPath extends boolean = boolean>({ load, sort, loaderOptions, resolve, type, byPath, ...options }: LoadableListFieldOptions<SchemaTypes, unknown, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, FieldKind, ByPath>): FieldRef<SchemaTypes, unknown> {
    const getLoader = pathDataloaderGetter<Key, ShapeFromTypeParam<SchemaTypes, [
        Type
    ], Nullable>, CacheKey, InputShapeFromFields<Args>>(loaderOptions, (keys, ctx, args) => load(keys, ctx, args as never), undefined, sort as (value: ShapeFromTypeParam<SchemaTypes, [
        Type
    ], Nullable>) => Key, byPath);
    return this.field({
        ...options,
        type: [type],
        // @ts-expect-error types don't match because this handles both lists and single objects
        resolve: async (parent: unknown, args: InputShapeFromFields<Args>, context: {}, info: GraphQLResolveInfo) => {
            const ids = await resolve(parent, args, context, info);
            const loader = getLoader(args, context, info);
            return loader.load(ids as Key);
        },
    });
};
fieldBuilderProto.loadableGroup = function loadableGroup<Args extends InputFieldMap, Type extends OutputType<SchemaTypes>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<[
    Type
]> = SchemaTypes["DefaultFieldNullability"], ByPath extends boolean = false>({ load, group, loaderOptions, byPath, resolve, type, ...options }: LoadableGroupFieldOptions<SchemaTypes, unknown, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, FieldKind, ByPath>): FieldRef<SchemaTypes, unknown> {
    const getLoader = pathDataloaderGetter<Key, ShapeFromTypeParam<SchemaTypes, Type, true>[], CacheKey, InputShapeFromFields<Args>>(loaderOptions, async (keys, ctx, args) => {
        const values = await load(keys, ctx, args as never);
        const groups = new Map<Key, ShapeFromTypeParam<SchemaTypes, Type, true>[]>();
        for (const value of values) {
            if (value == null) {
                // eslint-disable-next-line no-continue
                continue;
            }
            const groupKey = group(value);
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(value);
        }
        return keys.map((key) => groups.get(key) ?? []);
    }, undefined, false, byPath);
    return this.field({
        ...options,
        type: [type],
        // @ts-expect-error types don't match because this handles both lists and single objects
        resolve: async (parent: unknown, args: InputShapeFromFields<Args>, context: {}, info: GraphQLResolveInfo) => {
            const ids = await resolve(parent, args, context, info);
            const loader = getLoader(args, context, info);
            return loader.load(ids as Key);
        },
    });
};

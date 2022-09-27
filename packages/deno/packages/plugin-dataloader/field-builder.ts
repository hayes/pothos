// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { FieldKind, FieldNullability, FieldRef, InputFieldMap, InputShapeFromFields, OutputType, RootFieldBuilder, SchemaTypes, ShapeFromTypeParam, TypeParam, } from '../core/index.ts';
import type { LoadableListFieldOptions } from './types.ts';
import { LoadableFieldOptions, LoaderShapeFromType } from './types.ts';
import { dataloaderGetter, rejectErrors } from './util.ts';
const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>;
fieldBuilderProto.loadable = function loadable<Args extends InputFieldMap, Type extends TypeParam<SchemaTypes>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<Type> = SchemaTypes["DefaultFieldNullability"]>({ load, sort, loaderOptions, resolve, type, ...options }: LoadableFieldOptions<SchemaTypes, unknown, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, FieldKind>): FieldRef<unknown> {
    const getLoader = dataloaderGetter<Key, LoaderShapeFromType<SchemaTypes, Type, Nullable>, CacheKey>(loaderOptions, load, undefined, sort as (value: LoaderShapeFromType<SchemaTypes, Type, Nullable>) => Key);
    return this.field({
        ...options,
        type,
        // @ts-expect-error types don't match because this handles both lists and single objects
        resolve: async (parent: unknown, args: InputShapeFromFields<Args>, context: {}, info: GraphQLResolveInfo) => {
            const ids = await resolve(parent, args, context, info);
            if (ids == null) {
                return null;
            }
            const loader = getLoader(context);
            if (Array.isArray(type)) {
                return rejectErrors((ids as Key[]).map((id) => (id == null ? id : loader.load(id))));
            }
            return loader.load(ids as Key);
        },
    });
};
fieldBuilderProto.loadableList = function loadableList<Args extends InputFieldMap, Type extends OutputType<SchemaTypes>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<[
    Type
]> = SchemaTypes["DefaultFieldNullability"]>({ load, sort, loaderOptions, resolve, type, ...options }: LoadableListFieldOptions<SchemaTypes, unknown, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, FieldKind>): FieldRef<unknown> {
    const getLoader = dataloaderGetter<Key, ShapeFromTypeParam<SchemaTypes, [
        Type
    ], Nullable>, CacheKey>(loaderOptions, load, undefined, sort as (value: ShapeFromTypeParam<SchemaTypes, [
        Type
    ], Nullable>) => Key);
    return this.field({
        ...options,
        type: [type],
        // @ts-expect-error types don't match because this handles both lists and single objects
        resolve: async (parent: unknown, args: InputShapeFromFields<Args>, context: {}, info: GraphQLResolveInfo) => {
            const ids = await resolve(parent, args, context, info);
            const loader = getLoader(context);
            return loader.load(ids as Key);
        },
    });
};

// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { FieldKind, FieldNullability, FieldRef, InputFieldMap, InputShapeFromFields, RootFieldBuilder, SchemaTypes, TypeParam, } from '../core/index.ts';
import { LoadableFieldOptions, LoaderShapeFromType } from './types.ts';
import { rejectErrors } from './util.ts';
import { dataloaderGetter } from './index.ts';
const fieldBuilderProto = RootFieldBuilder.prototype as GiraphQLSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>;
fieldBuilderProto.loadable = function loadable<Args extends InputFieldMap, Type extends TypeParam<SchemaTypes>, Key, CacheKey, ResolveReturnShape, Nullable extends FieldNullability<Type> = SchemaTypes["DefaultFieldNullability"]>({ load, sort, loaderOptions, resolve, type, ...options }: LoadableFieldOptions<SchemaTypes, unknown, Type, Nullable, Args, ResolveReturnShape, Key, CacheKey, FieldKind>): FieldRef<unknown> {
    const getLoader = dataloaderGetter<Key, LoaderShapeFromType<SchemaTypes, Type, Nullable>, CacheKey>(loaderOptions, load, undefined, sort);
    return this.field({
        ...options,
        type,
        // @ts-expect-error types don't match because this handles both lists and single objects
        resolve: async (parent: unknown, args: InputShapeFromFields<Args>, context: {}, info: GraphQLResolveInfo) => {
            const ids = await resolve(parent, args, context, info);
            const loader = getLoader(context);
            if (Array.isArray(type)) {
                return rejectErrors(loader.loadMany(ids as Key[]));
            }
            return loader.load(ids as Key);
        },
    });
};

import './global-types';
import DataLoader from 'dataloader';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  FieldKind,
  FieldNullability,
  FieldRef,
  GiraphQLOutputFieldConfig,
  InputFieldMap,
  InputShapeFromFields,
  InterfaceParam,
  isThenable,
  MaybePromise,
  OutputShape,
  RootFieldBuilder,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@giraphql/core';
import { DataloaderObjectTypeOptions, LoadableFieldOptions, LoaderShapeFromType } from './types';

export * from './types';

const pluginName = 'dataloader' as const;

export class GiraphQLDataloaderPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const isList = fieldConfig.type.kind === 'List';
    const type = fieldConfig.type.kind === 'List' ? fieldConfig.type.type : fieldConfig.type;

    if (type.kind !== 'Object') {
      return resolver;
    }

    const getDataloader = this.buildCache.getTypeConfig(type.ref, 'Object').extensions
      ?.getDataloader as (context: object) => DataLoader<unknown, unknown>;

    if (!getDataloader) {
      return resolver;
    }

    function loadIfID(idOrResult: unknown, loader: DataLoader<unknown, unknown>): unknown {
      if (idOrResult == null) {
        return idOrResult;
      }

      if (isThenable(idOrResult)) {
        return idOrResult.then((result) => loadIfID(result, loader));
      }

      switch (typeof idOrResult) {
        case 'number':
        case 'bigint':
        case 'string':
          return loader.load(idOrResult);
        default:
          return idOrResult;
      }
    }

    if (isList) {
      return (parent, args, context, info) => {
        const loader = getDataloader(context);
        const promiseOrResults = resolver(parent, args, context, info) as MaybePromise<
          unknown[] | null | undefined
        >;

        if (isThenable(promiseOrResults)) {
          return promiseOrResults.then((results) => results?.map((item) => loadIfID(item, loader)));
        }

        return promiseOrResults?.map((item) => loadIfID(item, loader));
      };
    }

    return (parent, args, context, info) =>
      loadIfID(resolver(parent, args, context, info), getDataloader(context));
  }
}

SchemaBuilder.registerPlugin(pluginName, GiraphQLDataloaderPlugin);

const schemaBuilderProto = SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;
const inputFieldBuilderProto = RootFieldBuilder.prototype as GiraphQLSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

function createCache<T>(create: () => T) {
  const cache = new WeakMap<object, T>();

  return (context: object) => {
    if (cache.has(context)) {
      return cache.get(context)!;
    }

    const entry = create();

    cache.set(context, entry);

    return entry;
  };
}

schemaBuilderProto.loadableObject = function loadableObject<
  Interfaces extends InterfaceParam<SchemaTypes>[],
  Shape extends OutputShape<SchemaTypes, Interfaces[number]> & object,
  Key extends bigint | number | string,
  CacheKey = Key
>(
  name: string,
  {
    load,
    loaderOptions,
    ...options
  }: DataloaderObjectTypeOptions<SchemaTypes, Interfaces, Shape, Key, CacheKey>,
) {
  const getDataloader = createCache(
    () => new DataLoader(load as (keys: readonly Key[]) => Promise<Shape[]>, loaderOptions),
  );

  return this.objectRef<Shape>(name).implement({
    ...options,
    extensions: {
      getDataloader,
    },
  });
};

inputFieldBuilderProto.loadable = function loadable<
  Args extends InputFieldMap,
  Type extends TypeParam<SchemaTypes>,
  Key,
  CacheKey,
  ResolveReturnShape,
  Nullable extends FieldNullability<Type> = SchemaTypes['DefaultFieldNullability']
>({
  load,
  loaderOptions,
  resolve,
  type,
  ...options
}: LoadableFieldOptions<
  SchemaTypes,
  unknown,
  Type,
  Nullable,
  Args,
  ResolveReturnShape,
  Key,
  CacheKey,
  FieldKind
>): FieldRef<unknown> {
  const getLoader = createCache(
    () =>
      new DataLoader(
        load as (
          keys: readonly Key[],
        ) => Promise<LoaderShapeFromType<SchemaTypes, Type, Nullable>[]>,
        loaderOptions,
      ),
  );

  return this.field({
    ...options,
    type,
    resolve: async (
      parent: unknown,
      args: InputShapeFromFields<Args>,
      context: {},
      info: GraphQLResolveInfo,
    ) => {
      const ids = await resolve(parent, args, context, info);
      const loader = getLoader(context);

      if (Array.isArray(type)) {
        return loader.loadMany(ids as Key[]) as Promise<
          ShapeFromTypeParam<SchemaTypes, Type, Nullable>
        >;
      }

      return loader.load(ids as Key) as Promise<ShapeFromTypeParam<SchemaTypes, Type, Nullable>>;
    },
  });
};

export default pluginName;

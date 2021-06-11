import DataLoader from 'dataloader';
import { GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  createContextCache,
  FieldRef,
  InterfaceParam,
  InterfaceRef,
  SchemaTypes,
} from '@giraphql/core';
import { DataloaderObjectTypeOptions, LoadableNodeOptions } from './types';
import { LoadableObjectRef } from './util';

const schemaBuilderProto =
  SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.loadableObject = function loadableObject<
  Shape extends object,
  Key extends bigint | number | string,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  CacheKey = Key,
>(
  name: string,
  {
    load,
    loaderOptions,
    ...options
  }: DataloaderObjectTypeOptions<SchemaTypes, Shape, Key, Interfaces, CacheKey>,
) {
  const getDataloader = createContextCache(
    (context: SchemaTypes['Context']) =>
      new DataLoader<Key, Shape, CacheKey>(
        (keys: readonly Key[]) =>
          (load as (keys: readonly Key[], context: SchemaTypes['Context']) => Promise<Shape[]>)(
            keys,
            context,
          ),
        loaderOptions,
      ),
  );

  const ref = new LoadableObjectRef<SchemaTypes, Shape, Shape, Key, CacheKey>(
    this,
    name,
    getDataloader,
  );

  ref.implement({
    ...options,
    extensions: {
      getDataloader,
    },
  } as never);

  return ref;
};

const TloadableNode = schemaBuilderProto.loadableNode;

schemaBuilderProto.loadableNode = function loadableNode<
  Shape extends object,
  Key extends bigint | number | string,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  CacheKey = Key,
>(
  this: GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  name: string,
  {
    load,
    loaderOptions,
    ...options
  }: LoadableNodeOptions<SchemaTypes, Shape, Key, Interfaces, CacheKey>,
) {
  if (
    typeof (this as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes> & Record<string, unknown>)
      .nodeInterfaceRef !== 'function'
  ) {
    throw new TypeError('builder.loadableNode requires @giraphql/plugin-relay to be installed');
  }

  const getDataloader = createContextCache(
    (context: SchemaTypes['Context']) =>
      new DataLoader<Key, Shape, CacheKey>(
        (keys: readonly Key[]) =>
          (load as (keys: readonly Key[], context: SchemaTypes['Context']) => Promise<Shape[]>)(
            keys,
            context,
          ),
        loaderOptions,
      ),
  );

  const ref = new LoadableObjectRef<SchemaTypes, Shape, Shape, Key, CacheKey>(
    this,
    name,
    getDataloader,
  );

  const extendedOptions = {
    ...options,
    interfaces: [
      (
        this as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes> & {
          nodeInterfaceRef: () => InterfaceRef<unknown>;
        }
      ).nodeInterfaceRef(),
    ],
    loadMany: (ids: Key[], context: SchemaTypes['Context']) => getDataloader(context).loadMany(ids),
    extensions: {
      getDataloader,
    },
  };

  ref.implement(extendedOptions as never);

  this.configStore.onTypeConfig(ref, (nodeConfig) => {
    this.objectField(ref, 'id', (t) =>
      (
        t as unknown as {
          globalID: (options: Record<string, unknown>) => FieldRef<unknown>;
        }
      ).globalID({
        ...options.id,
        nullable: false,
        args: {},
        resolve: async (
          parent: Shape,
          args: object,
          context: object,
          info: GraphQLResolveInfo,
        ) => ({
          type: nodeConfig.name,
          id: await options.id.resolve(parent, args, context, info),
        }),
      }),
    );
  });

  return ref;
} as unknown as typeof TloadableNode;

import DataLoader from 'dataloader';
import { GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  createContextCache,
  FieldRef,
  InterfaceParam,
  InterfaceRef,
  ObjectParam,
  SchemaTypes,
  ShapeFromTypeParam,
} from '@giraphql/core';
import { LoadableInterfaceRef } from './refs/interface';
import { LoadableObjectRef } from './refs/object';
import { LoadableUnionRef } from './refs/union';
import { DataloaderObjectTypeOptions, LoadableNodeOptions } from './types';
import { dataloaderGetter, DataloaderKey, LoadableInterfaceOptions, LoadableUnionOptions } from '.';

const schemaBuilderProto =
  SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.loadableObject = function loadableObject<
  Shape extends NameOrRef extends ObjectParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : object,
  Key extends DataloaderKey,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends ObjectParam<SchemaTypes> | string,
  CacheKey = Key,
>(
  nameOrRef: NameOrRef,
  {
    load,
    loaderOptions,
    ...options
  }: DataloaderObjectTypeOptions<SchemaTypes, Shape, Key, Interfaces, NameOrRef, CacheKey>,
) {
  const name =
    typeof nameOrRef === 'string'
      ? nameOrRef
      : (options as { name?: string }).name ?? (nameOrRef as { name: string }).name;

  const getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load);

  const ref = new LoadableObjectRef<SchemaTypes, Shape, Shape, Key, CacheKey>(name, getDataloader);

  this.objectType(ref, {
    ...options,
    extensions: {
      getDataloader,
    },
  } as never);

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateRefWithName(nameOrRef, name);
  }

  return ref;
};

schemaBuilderProto.loadableInterface = function loadableInterface<
  Shape extends NameOrRef extends InterfaceParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : object,
  Key extends DataloaderKey,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends InterfaceParam<SchemaTypes> | string,
  CacheKey = Key,
>(
  nameOrRef: NameOrRef,
  {
    load,
    loaderOptions,
    ...options
  }: LoadableInterfaceOptions<SchemaTypes, Shape, Key, Interfaces, NameOrRef, CacheKey>,
) {
  const name =
    typeof nameOrRef === 'string'
      ? nameOrRef
      : (options as { name?: string }).name ?? (nameOrRef as { name: string }).name;

  const getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load);

  const ref = new LoadableInterfaceRef<SchemaTypes, Shape, Shape, Key, CacheKey>(
    name,
    getDataloader,
  );

  this.interfaceType(ref, {
    ...options,
    extensions: {
      getDataloader,
    },
  });

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateRefWithName(nameOrRef, name);
  }

  return ref;
};

schemaBuilderProto.loadableUnion = function loadableUnion<
  Key extends DataloaderKey,
  Member extends ObjectParam<SchemaTypes>,
  CacheKey = Key,
  Shape = ShapeFromTypeParam<SchemaTypes, Member, false>,
>(
  name: string,
  {
    load,
    loaderOptions,
    ...options
  }: LoadableUnionOptions<SchemaTypes, Key, Member, CacheKey, Shape>,
) {
  const getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load);

  const ref = new LoadableUnionRef<SchemaTypes, Shape, Shape, Key, CacheKey>(name, getDataloader);

  this.unionType(name, {
    ...options,
    extensions: {
      getDataloader,
    },
  });

  this.configStore.associateRefWithName(ref, name);

  return ref;
};

const TloadableNode = schemaBuilderProto.loadableNode;

schemaBuilderProto.loadableNode = function loadableNode<
  Shape extends NameOrRef extends ObjectParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : object,
  Key extends DataloaderKey,
  Interfaces extends InterfaceParam<SchemaTypes>[],
  NameOrRef extends ObjectParam<SchemaTypes> | string,
  CacheKey = Key,
>(
  this: GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  nameOrRef: NameOrRef,
  {
    load,
    loaderOptions,
    ...options
  }: LoadableNodeOptions<SchemaTypes, Shape, Key, Interfaces, NameOrRef, CacheKey>,
) {
  if (
    typeof (this as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes> & Record<string, unknown>)
      .nodeInterfaceRef !== 'function'
  ) {
    throw new TypeError('builder.loadableNode requires @giraphql/plugin-relay to be installed');
  }

  const name =
    typeof nameOrRef === 'string'
      ? nameOrRef
      : (options as { name?: string }).name ?? (nameOrRef as { name: string }).name;

  const getDataloader = createContextCache(
    (context: SchemaTypes['Context']) =>
      new DataLoader<Key, Shape, CacheKey>(
        (keys: readonly Key[]) =>
          (
            load as unknown as (
              keys: readonly Key[],
              context: SchemaTypes['Context'],
            ) => Promise<Shape[]>
          )(keys, context),
        loaderOptions,
      ),
  );

  const ref = new LoadableObjectRef<SchemaTypes, Shape, Shape, Key, CacheKey>(name, getDataloader);

  const extendedOptions = {
    ...options,
    interfaces: [
      (
        this as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes> & {
          nodeInterfaceRef: () => InterfaceRef<unknown>;
        }
      ).nodeInterfaceRef(),
      ...(options.interfaces ?? []),
    ],
    loadMany: (ids: Key[], context: SchemaTypes['Context']) => getDataloader(context).loadMany(ids),
    extensions: {
      getDataloader,
    },
  };

  this.objectType(ref, extendedOptions as never);

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateRefWithName(nameOrRef, name);
  }

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

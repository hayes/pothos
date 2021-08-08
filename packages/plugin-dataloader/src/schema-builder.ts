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
import { DataloaderObjectTypeOptions, LoadableNodeOptions } from './types.js';
import { LoadableObjectRef } from './util.js';

const schemaBuilderProto =
  SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.loadableObject = function loadableObject<
  Shape extends NameOrRef extends ObjectParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : object,
  Key extends bigint | number | string,
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

  if (typeof nameOrRef !== 'string') {
    this.configStore.associateRefWithName(nameOrRef, name);
  }

  return ref;
};

const TloadableNode = schemaBuilderProto.loadableNode;

schemaBuilderProto.loadableNode = function loadableNode<
  Shape extends NameOrRef extends ObjectParam<SchemaTypes>
    ? ShapeFromTypeParam<SchemaTypes, NameOrRef, false>
    : object,
  Key extends bigint | number | string,
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
      ...(options.interfaces ?? []),
    ],
    loadMany: (ids: Key[], context: SchemaTypes['Context']) => getDataloader(context).loadMany(ids),
    extensions: {
      getDataloader,
    },
  };

  ref.implement(extendedOptions as never);

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

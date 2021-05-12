import DataLoader from 'dataloader';
import SchemaBuilder, { createContextCache, InterfaceRef, SchemaTypes } from '@giraphql/core';
import { DataloaderObjectTypeOptions, LoadableNodeOptions } from './types';
import { LoadableObjectRef } from './util';

const schemaBuilderProto = SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.loadableObject = function loadableObject<
  Shape extends object,
  Key extends bigint | number | string,
  CacheKey = Key
>(
  name: string,
  {
    load,
    loaderOptions,
    ...options
  }: DataloaderObjectTypeOptions<SchemaTypes, Shape, Key, CacheKey>,
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
  });

  return ref;
};

const TloadableNode = schemaBuilderProto.loadableNode;

schemaBuilderProto.loadableNode = (function loadableNode<
  Shape extends object,
  Key extends bigint | number | string,
  CacheKey = Key
>(
  this: GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  name: string,
  { load, loaderOptions, ...options }: LoadableNodeOptions<SchemaTypes, Shape, Key, CacheKey>,
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

  const extendedOptions = {
    ...options,
    interfaces: [
      (this as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes> & {
        nodeInterfaceRef: () => InterfaceRef<unknown>;
      }).nodeInterfaceRef(),
    ] as never[],
    loadMany: (ids: Key[], context: SchemaTypes['Context']) => getDataloader(context).loadMany(ids),
    extensions: {
      getDataloader,
    },
  };

  ref.implement(extendedOptions);

  return ref;
} as unknown) as typeof TloadableNode;

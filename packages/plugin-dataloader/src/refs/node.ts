import { ImplementableObjectRef, type ObjectRef, type SchemaTypes } from '@pothos/core';
import type { DataLoaderOptions, LoadableNodeId } from '../types';
import { dataloaderGetter } from '../util';
import { LoadableObjectRef } from './object';

export class LoadableNodeRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  IDShape extends bigint | number | string = string,
  Key extends bigint | number | string = IDShape,
  CacheKey = Key,
> extends LoadableObjectRef<Types, RefShape, Shape, Key, CacheKey> {
  parseId: ((id: string, ctx: object) => IDShape) | undefined;

  builder: PothosSchemaTypes.SchemaBuilder<Types>;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      id,
      loaderOptions,
      load,
      toKey,
      sort,
    }: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape> &
      LoadableNodeId<Types, Shape, IDShape>,
  ) {
    super(name, dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort));

    this.builder = builder;

    this.parseId = id.parse;
  }
}

export class ImplementableLoadableNodeRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  IDShape extends bigint | number | string = string,
  Key extends bigint | number | string = IDShape,
  CacheKey = Key,
> extends ImplementableObjectRef<Types, RefShape, Shape> {
  parseId: ((id: string, ctx: object) => IDShape) | undefined;

  getDataloader;

  protected cacheResolved;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      id,
      loaderOptions,
      load,
      toKey,
      sort,
      cacheResolved,
    }: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape> &
      LoadableNodeId<Types, Shape, IDShape>,
  ) {
    super(builder, name);
    this.parseId = id.parse;
    this.builder = builder;

    this.getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort);
    this.cacheResolved =
      typeof cacheResolved === 'function' ? cacheResolved : cacheResolved && toKey;

    (
      this.builder as typeof builder & {
        nodeRef: (ref: ObjectRef<Types, unknown>, options: Record<string, unknown>) => void;
      }
    ).nodeRef(this, {
      id,
      loadManyWithoutCache: (ids: Key[], context: SchemaTypes['Context']) =>
        this.getDataloader(context).loadMany(ids),
    });

    this.updateConfig((config) => ({
      ...config,
      extensions: {
        ...config.extensions,
        getDataloader: this.getDataloader,
        cacheResolved: this.cacheResolved,
      },
    }));
  }
}

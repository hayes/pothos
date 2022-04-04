/* eslint-disable max-classes-per-file */
import DataLoader from 'dataloader';
import {
  ImplementableObjectRef,
  InterfaceParam,
  ObjectRef,
  ObjectTypeOptions,
  SchemaTypes,
} from '@pothos/core';
import { DataLoaderOptions } from '../types';
import { dataloaderGetter } from '../util';

export class LoadableObjectRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  Key,
  CacheKey,
> extends ObjectRef<RefShape, Shape> {
  getDataloader;

  constructor(
    name: string,
    getDataloader: (context: Types['Context']) => DataLoader<Key, Shape, CacheKey>,
  ) {
    super(name);

    this.getDataloader = getDataloader;
  }
}

export class ImplementableLoadableObjectRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  Key extends bigint | number | string,
  CacheKey,
> extends ImplementableObjectRef<Types, RefShape, Shape> {
  getDataloader;

  protected cacheResolved;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      loaderOptions,
      load,
      toKey,
      sort,
      cacheResolved,
    }: DataLoaderOptions<Types, Shape, Key, CacheKey>,
  ) {
    super(builder, name);

    this.getDataloader = dataloaderGetter<Key, Shape, CacheKey>(loaderOptions, load, toKey, sort);
    this.cacheResolved =
      typeof cacheResolved === 'function' ? cacheResolved : cacheResolved && toKey;
  }

  override implement<Interfaces extends InterfaceParam<Types>[]>(
    options: Omit<
      ObjectTypeOptions<Types, ImplementableObjectRef<Types, RefShape, Shape>, Shape, Interfaces>,
      'name'
    >,
  ): PothosSchemaTypes.ObjectRef<RefShape, Shape> {
    return super.implement({
      ...options,
      extensions: {
        ...options.extensions,
        getDataloader: this.getDataloader,
        cacheResolved: this.cacheResolved,
      },
    });
  }
}

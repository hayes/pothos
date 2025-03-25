import {
  ImplementableInterfaceRef,
  type InterfaceParam,
  InterfaceRef,
  type InterfaceTypeOptions,
  type SchemaTypes,
} from '@pothos/core';
import type DataLoader from 'dataloader';
import type { DataLoaderOptions } from '../types';
import { dataloaderGetter } from '../util';

export class LoadableInterfaceRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  Key,
  CacheKey,
> extends InterfaceRef<Types, RefShape, Shape> {
  getDataloader;

  constructor(
    name: string,
    getDataloader: (context: Types['Context']) => DataLoader<Key, Shape, CacheKey>,
  ) {
    super(name);

    this.getDataloader = getDataloader;
  }
}

export class ImplementableLoadableInterfaceRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  Key extends bigint | number | string,
  CacheKey,
> extends ImplementableInterfaceRef<Types, RefShape, Shape> {
  cacheResolved;

  getDataloader;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      loaderOptions,
      load,
      toKey,
      sort,
      cacheResolved,
    }: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape>,
  ) {
    super(builder, name);

    this.getDataloader = dataloaderGetter<Key, Shape, CacheKey>(
      loaderOptions,
      load as never,
      toKey,
      sort,
    );
    this.cacheResolved =
      typeof cacheResolved === 'function' ? cacheResolved : cacheResolved && toKey;
  }

  override implement<const Interfaces extends InterfaceParam<Types>[]>(
    options: InterfaceTypeOptions<
      Types,
      ImplementableInterfaceRef<Types, RefShape, Shape>,
      Shape,
      Interfaces
    >,
  ): InterfaceRef<Types, RefShape, Shape> {
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

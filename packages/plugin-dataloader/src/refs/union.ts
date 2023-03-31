import DataLoader from 'dataloader';
import { SchemaTypes, UnionRef } from '@pothos/core';

export class LoadableUnionRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  Key,
  CacheKey,
> extends UnionRef<Types, RefShape, Shape> {
  getDataloader;

  constructor(
    name: string,
    getDataloader: (context: Types['Context']) => DataLoader<Key, Shape, CacheKey>,
  ) {
    super(name);

    this.getDataloader = getDataloader;
  }
}

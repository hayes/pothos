import DataLoader from 'dataloader';
import { InterfaceRef, SchemaTypes } from '@giraphql/core';

export class LoadableInterfaceRef<
  Types extends SchemaTypes,
  RefShape,
  Shape,
  Key,
  CacheKey,
> extends InterfaceRef<RefShape, Shape> {
  getDataloader;

  constructor(
    name: string,
    getDataloader: (context: Types['Context']) => DataLoader<Key, Shape, CacheKey>,
  ) {
    super(name);

    this.getDataloader = getDataloader;
  }
}

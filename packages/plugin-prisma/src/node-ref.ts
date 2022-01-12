import { abstractReturnShapeKey, brandWithType, typeBrandKey } from '@pothos/core';
import { PrismaObjectRef } from './object-ref';
import { WithBrand } from './types';
import { PrismaModelTypes } from '.';

export default class PrismaNodeRef<Model extends PrismaModelTypes, T> extends PrismaObjectRef<
  Model,
  T
> {
  [abstractReturnShapeKey]: WithBrand<T>;

  addBrand<V extends T | T[]>(
    value: V,
  ): V extends T[] ? { [K in keyof V]: WithBrand<V[K]> } : WithBrand<V> {
    if (Array.isArray(value)) {
      value.forEach((val) => void brandWithType(val, this.name as never));

      return value as never;
    }

    brandWithType(value, this.name as never);

    return value as never;
  }

  hasBrand(value: unknown) {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeBrandKey in value &&
      (value as { [typeBrandKey]?: unknown })[typeBrandKey] === this.name
    );
  }
}

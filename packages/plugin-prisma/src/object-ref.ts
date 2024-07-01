import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { PrismaModelTypes, WithBrand } from './types';

export const prismaModelKey = Symbol.for('Pothos.prismaModelKey');

export class PrismaObjectRef<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  T = {},
> extends ObjectRef<Types, T> {
  [prismaModelKey]!: Model;

  [abstractReturnShapeKey]!: WithBrand<T>;

  modelName: string;

  constructor(name: string, modelName: string) {
    super(name);

    this.modelName = modelName;
  }

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

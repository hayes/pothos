import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { WithBrand } from './types';

export const drizzleTableKey = Symbol.for('Pothos.drizzleTableKey');

export class DrizzleObjectRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationSchema'] = keyof Types['DrizzleRelationSchema'],
  T = {},
> extends ObjectRef<Types, T> {
  [drizzleTableKey]!: Types['DrizzleRelationSchema'][Table];

  [abstractReturnShapeKey]!: WithBrand<T>;

  tableName: string;

  constructor(name: string, tableName: string) {
    super(name);

    this.tableName = tableName;
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

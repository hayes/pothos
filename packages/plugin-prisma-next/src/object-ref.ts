import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  type SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { ModelName, Row } from './types.js';

export const prismaModelKey = Symbol.for('Pothos.prismaNextModelKey');

type WithBrand<T> = T & { [typeBrandKey]: string };
// The index signature keeps a shape of optional keys alone (a type without `select`) from being a
// weak type, which a row sharing none of its keys would fail.
type Brandable<Shape> = Shape & Record<string, unknown>;
type Branded<V> = V extends readonly unknown[] ? { [K in keyof V]: WithBrand<V[K]> } : WithBrand<V>;

export class PrismaNextObjectRef<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
> extends ObjectRef<Types, Shape> {
  declare readonly [prismaModelKey]: M;

  declare readonly [abstractReturnShapeKey]: WithBrand<Shape>;

  readonly modelName: M;

  constructor(name: string, modelName: M) {
    super(name);
    this.modelName = modelName;
  }

  /** Brands rows (or a list of them) as this type, for abstract positions such as unions. */
  addBrand<V extends Brandable<Shape> | readonly Brandable<Shape>[]>(value: V): Branded<V> {
    for (const row of Array.isArray(value) ? value : [value]) {
      brandWithType(row as object, this.name as never);
    }
    return value as Branded<V>;
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

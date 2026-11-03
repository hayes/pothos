import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  type SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { ModelKey, ModelReturnShape, Row } from './types/models.js';

export const prismaModelBrand = Symbol.for('Pothos.prismaNextModelBrand');
/** Type-only: the contract a ref's builder was created with. */
export const prismaContractBrand = Symbol.for('Pothos.prismaNextContractBrand');

/** Marks a row shape with its model. It is an interface so that declaration emit can name it. */
export interface ModelBrand<M> {
  readonly [prismaModelBrand]?: M;
}

type WithBrand<T> = T & { [typeBrandKey]: string };
// The index signature stops a shape of only optional keys, such as a type without `select`, from
// being a weak type. A row that shares none of those keys would otherwise fail to match it.
type Brandable<Shape> = Shape & Record<string, unknown>;
type Branded<V> = V extends readonly unknown[] ? { [K in keyof V]: WithBrand<V[K]> } : WithBrand<V>;

export class PrismaNextObjectRef<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape = Row<Types, M>,
> extends ObjectRef<Types, ModelReturnShape<Types, M>, Shape> {
  declare readonly [prismaModelBrand]: M;

  declare readonly [prismaContractBrand]: Types['PrismaNextContract'];

  declare readonly [abstractReturnShapeKey]: WithBrand<Shape>;

  readonly modelKey: M;

  constructor(name: string, modelKey: M) {
    super(name);
    this.modelKey = modelKey;
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

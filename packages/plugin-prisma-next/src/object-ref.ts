import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  type SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { ModelKey, ObjectReturnShape, Row } from './types/models.js';

export const prismaModelBrand = Symbol.for('Pothos.prismaNextModelBrand');
/** Type-only: the contract a ref's builder was created with. */
export const prismaContractBrand = Symbol.for('Pothos.prismaNextContractBrand');

/** Type-only: marks the rows the loader planned, see `PlannedRow`. */
export const plannedRowBrand = Symbol.for('Pothos.prismaNextPlannedRow');

/** Marks a row the loader planned. It is an interface so that declaration emit can name it. */
export interface PlannedRowBrand {
  readonly [plannedRowBrand]: true;
}

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
> extends ObjectRef<Types, ObjectReturnShape<Types, M, Shape>, Shape> {
  declare readonly [prismaModelBrand]: M;

  declare readonly [prismaContractBrand]: Types['PrismaNextContract'];

  declare readonly [abstractReturnShapeKey]: WithBrand<ObjectReturnShape<Types, M, Shape>>;

  readonly modelKey: M;

  constructor(name: string, modelKey: M) {
    super(name);
    this.modelKey = modelKey;
  }

  /**
   * Brands rows (or a list of them) as this type, for abstract positions such as unions or a
   * non-prisma interface like relay's `Node`. A row must hold what a field returning this type
   * needs.
   */
  addBrand<
    V extends
      | Brandable<ObjectReturnShape<Types, M, Shape>>
      | readonly Brandable<ObjectReturnShape<Types, M, Shape>>[],
  >(value: V): Branded<V> {
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

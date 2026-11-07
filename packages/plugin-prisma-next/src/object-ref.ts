import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  type SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { ModelKey, ObjectBaseShape, ObjectReturnShape } from './types/models.js';

export const prismaNextModelBrand = Symbol.for('Pothos.prismaNextModelBrand');
/** Type-only: the contract a ref's builder was created with. */
export const prismaNextContractBrand = Symbol.for('Pothos.prismaNextContractBrand');

/**
 * Type-only: marks the rows the loader planned, see `PlannedRow`. No row holds it at runtime. It is
 * exported so that a module whose declarations name a planned row, such as an exported function
 * returning one without an annotation, can import it for declaration emit.
 */
export const plannedRowBrand = Symbol.for('Pothos.prismaNextPlannedRowBrand');

/**
 * Marks a row the loader planned as a row of model `M`. It is an interface so that declaration emit
 * can name it.
 */
export interface PlannedRowBrand<M> {
  readonly [plannedRowBrand]: M;
}

/** Marks a row shape with its model. It is an interface so that declaration emit can name it. */
export interface ModelBrand<M> {
  readonly [prismaNextModelBrand]?: M;
}

/** A row branded with its GraphQL type. It is an interface so that declaration emit can name it. */
export interface TypeBrand {
  [typeBrandKey]: string;
}

type WithBrand<T> = T & TypeBrand;
// The index signature stops a shape of only optional keys, such as a type without `select`, from
// being a weak type. A row that shares none of those keys would otherwise fail to match it. A
// planned row is never weak, and leaving it without the index signature keeps tsc from blaming
// its brand when a row lacks what the type's `select` needs.
type Brandable<Shape> =
  Shape extends PlannedRowBrand<unknown> ? Shape : Shape & Record<string, unknown>;
type Branded<V> = V extends readonly unknown[] ? { [K in keyof V]: WithBrand<V[K]> } : WithBrand<V>;

// The variance annotations are the measured variances. Measuring them walks the row and return
// shapes, which each file that relates two refs, such as `t.variant(ref)`, would pay for.
export class PrismaNextObjectRef<
  in out Types extends SchemaTypes,
  out M extends ModelKey<Types>,
  out Shape = ObjectBaseShape<Types, M>,
> extends ObjectRef<Types, ObjectReturnShape<Types, M, Shape>, Shape> {
  declare readonly [prismaNextModelBrand]: M;

  declare readonly [prismaNextContractBrand]: Types['PrismaNextContract'];

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

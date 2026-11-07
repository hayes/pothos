import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  type SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { ModelKey, ObjectBaseShape, VariantModelKeys } from './types/models.js';

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

/**
 * What a field returning a type of model `M` resolves to, named for the error a row without the
 * brand gets. It is an interface so that the error names it rather than the brand.
 */
export interface ReturnRowsFromCollectionFromInfoOrTheParentsPlan<M> extends PlannedRowBrand<M> {}

/** Marks a row shape with its model. It is an interface so that declaration emit can name it. */
export interface ModelBrand<M> {
  readonly [prismaNextModelBrand]?: M;
}

/** A row branded with its GraphQL type. It is an interface so that declaration emit can name it. */
export interface TypeBrand {
  [typeBrandKey]: string;
}

type WithBrand<T> = T & TypeBrand;
type Branded<V> = V extends readonly unknown[] ? { [K in keyof V]: WithBrand<V[K]> } : WithBrand<V>;

// The variance annotations are the measured variances. Measuring them walks the row and return
// shapes, which each file that relates two refs, such as `t.variant(ref)`, would pay for.
export class PrismaNextObjectRef<
  in out Types extends SchemaTypes,
  out M extends ModelKey<Types>,
  out Shape = ObjectBaseShape<Types, M>,
> extends ObjectRef<
  Types,
  // Not `ObjectReturnShape`, so that errors name the interface rather than the alias.
  ReturnRowsFromCollectionFromInfoOrTheParentsPlan<
    M | VariantModelKeys<Types['PrismaNextContract'], M>
  >,
  Shape
> {
  declare readonly [prismaNextModelBrand]: M;

  declare readonly [prismaNextContractBrand]: Types['PrismaNextContract'];

  declare readonly [abstractReturnShapeKey]: WithBrand<
    ReturnRowsFromCollectionFromInfoOrTheParentsPlan<
      M | VariantModelKeys<Types['PrismaNextContract'], M>
    >
  >;

  readonly modelKey: M;

  constructor(name: string, modelKey: M) {
    super(name);
    this.modelKey = modelKey;
  }

  /**
   * Brands rows (or a list of them) as this type, for abstract positions such as unions or a
   * non-prisma interface like relay's `Node`. A row must be one a field returning this type
   * accepts.
   */
  addBrand<
    V extends
      | ReturnRowsFromCollectionFromInfoOrTheParentsPlan<
          M | VariantModelKeys<Types['PrismaNextContract'], M>
        >
      | readonly ReturnRowsFromCollectionFromInfoOrTheParentsPlan<
          M | VariantModelKeys<Types['PrismaNextContract'], M>
        >[],
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

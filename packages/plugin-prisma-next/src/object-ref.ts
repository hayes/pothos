import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  type SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { ModelKey, ObjectBaseShape, VariantModelKeys } from './types/models.js';

export const prismaModelBrand = Symbol.for('Pothos.prismaModelBrand');
/** Type-only: the contract a ref's builder was created with. */
export const prismaContractBrand = Symbol.for('Pothos.prismaContractBrand');

/**
 * Type-only: marks the rows the loader planned, see `PrismaPlanned`. No row holds it at runtime.
 * Exported so that a module whose declarations name a planned row can import it for declaration
 * emit.
 */
export const plannedRowBrand = Symbol.for('Pothos.prismaPlannedRowBrand');

/**
 * Marks a row the loader planned as a row of model `M`. It is an interface so that declaration emit
 * can name it.
 */
export interface PlannedRowBrand<M> {
  readonly [plannedRowBrand]: M;
}

/**
 * A row the plugin loaded for model `M`. A field returning a type of `M` resolves to one: a row
 * loaded through `collectionFromInfo`, a `prismaField` or the connection helpers, the parent, or a
 * relation row loaded with the parent.
 */
// An interface so that errors name it rather than the brand.
export interface PrismaPlanned<M> extends PlannedRowBrand<M> {}

/** Marks a row shape with its model. It is an interface so that declaration emit can name it. */
export interface ModelBrand<M> {
  readonly [prismaModelBrand]?: M;
}

/** A row branded with its GraphQL type. It is an interface so that declaration emit can name it. */
export interface TypeBrand {
  [typeBrandKey]: string;
}

type WithBrand<T> = T & TypeBrand;
type Branded<V> = V extends readonly unknown[] ? { [K in keyof V]: WithBrand<V[K]> } : WithBrand<V>;

// The variance annotations are the measured variances. Measuring them walks the row and return
// shapes, which each file that relates two refs, such as `t.variant(ref)`, would pay for.
export class PrismaObjectRef<
  in out Types extends SchemaTypes,
  out M extends ModelKey<Types>,
  out Shape = ObjectBaseShape<Types, M>,
> extends ObjectRef<
  Types,
  // Keep the planned-row marker named in diagnostics and emitted declarations.
  PrismaPlanned<M | VariantModelKeys<Types['PrismaContract'], M>>,
  Shape
> {
  declare readonly [prismaModelBrand]: M;

  declare readonly [prismaContractBrand]: Types['PrismaContract'];

  declare readonly [abstractReturnShapeKey]: WithBrand<
    PrismaPlanned<M | VariantModelKeys<Types['PrismaContract'], M>>
  >;

  readonly modelKey: M;

  constructor(name: string, modelKey: M) {
    super(name);
    this.modelKey = modelKey;
  }

  /**
   * Brands a row (or a list of rows) as this type, so it can be returned where the field's type
   * is a union or a non-prisma interface like relay's `Node`. The row must be one a field
   * returning this type accepts.
   */
  addBrand<
    V extends
      | PrismaPlanned<M | VariantModelKeys<Types['PrismaContract'], M>>
      | readonly PrismaPlanned<M | VariantModelKeys<Types['PrismaContract'], M>>[],
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

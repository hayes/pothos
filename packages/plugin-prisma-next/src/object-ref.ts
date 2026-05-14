import {
  abstractReturnShapeKey,
  brandWithType,
  ObjectRef,
  type SchemaTypes,
  typeBrandKey,
} from '@pothos/core';
import type { ModelName, Row } from './types';

export const prismaModelKey = Symbol.for('Pothos.prismaNextModelKey');

export class PrismaNextObjectRef<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
> extends ObjectRef<Types, Shape> {
  declare readonly [prismaModelKey]: M;

  // Signals to Pothos core that when this ref appears in an abstract
  // position (Node interface, union, prismaInterface), rows are
  // expected to carry the type brand. Users opt in by calling
  // `ref.addBrand(row)` at the boundary that returns the row into an
  // abstract position.
  declare readonly [abstractReturnShapeKey]: Shape & { [typeBrandKey]: string };

  readonly modelName: M;

  constructor(name: string, modelName: M) {
    super(name);
    this.modelName = modelName;
  }

  addBrand<V extends Shape | Shape[]>(value: V): V {
    if (Array.isArray(value)) {
      for (const v of value) {
        brandWithType(v as object, this.name as never);
      }
      return value;
    }
    brandWithType(value as object, this.name as never);
    return value;
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

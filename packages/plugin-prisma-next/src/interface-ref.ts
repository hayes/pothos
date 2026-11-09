import { InterfaceRef, type SchemaTypes } from '@pothos/core';
import { type Planned, prismaContractBrand } from './object-ref.js';
import type { ModelKey, ObjectBaseShape, VariantModelKeys } from './types/models.js';

export const prismaInterfaceBrand = Symbol.for('Pothos.prismaInterfaceBrand');

export class PrismaInterfaceRef<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape = ObjectBaseShape<Types, M>,
> extends InterfaceRef<
  Types,
  // Keep the planned-row marker named in diagnostics and emitted declarations.
  Planned<M | VariantModelKeys<Types['PrismaContract'], M>>,
  Shape
> {
  declare readonly [prismaInterfaceBrand]: M;
  declare readonly [prismaContractBrand]: Types['PrismaContract'];
  readonly modelKey: M;

  constructor(name: string, modelKey: M) {
    super(name);
    this.modelKey = modelKey;
  }
}

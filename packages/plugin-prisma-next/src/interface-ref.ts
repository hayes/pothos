import { InterfaceRef, type SchemaTypes } from '@pothos/core';
import { prismaContractBrand } from './object-ref.js';
import type { InterfaceReturnShape, ModelKey, ObjectBaseShape } from './types/models.js';

export const prismaInterfaceBrand = Symbol.for('Pothos.prismaNextInterfaceBrand');

export class PrismaNextInterfaceRef<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape = ObjectBaseShape<Types, M>,
> extends InterfaceRef<Types, InterfaceReturnShape<Types, M, Shape>, Shape> {
  declare readonly [prismaInterfaceBrand]: M;
  declare readonly [prismaContractBrand]: Types['PrismaNextContract'];
  readonly modelKey: M;

  constructor(name: string, modelKey: M) {
    super(name);
    this.modelKey = modelKey;
  }
}

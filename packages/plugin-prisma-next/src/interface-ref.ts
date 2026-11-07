import { InterfaceRef, type SchemaTypes } from '@pothos/core';
import { prismaNextContractBrand } from './object-ref.js';
import type { InterfaceReturnShape, ModelKey, ObjectBaseShape } from './types/models.js';

export const prismaNextInterfaceBrand = Symbol.for('Pothos.prismaNextInterfaceBrand');

export class PrismaNextInterfaceRef<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape = ObjectBaseShape<Types, M>,
> extends InterfaceRef<Types, InterfaceReturnShape<Types, M, Shape>, Shape> {
  declare readonly [prismaNextInterfaceBrand]: M;
  declare readonly [prismaNextContractBrand]: Types['PrismaNextContract'];
  readonly modelKey: M;

  constructor(name: string, modelKey: M) {
    super(name);
    this.modelKey = modelKey;
  }
}

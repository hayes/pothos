import { InterfaceRef, type SchemaTypes } from '@pothos/core';
import { type Planned, prismaNextContractBrand } from './object-ref.js';
import type {
  DiscriminatorRow,
  ModelKey,
  ObjectBaseShape,
  VariantModelKeys,
} from './types/models.js';

export const prismaNextInterfaceBrand = Symbol.for('Pothos.prismaNextInterfaceBrand');

export class PrismaNextInterfaceRef<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape = ObjectBaseShape<Types, M>,
> extends InterfaceRef<
  Types,
  // Not `InterfaceReturnShape`, so that errors name the interface rather than the alias.
  Planned<M | VariantModelKeys<Types['PrismaNextContract'], M>> & DiscriminatorRow<Types, M>,
  Shape
> {
  declare readonly [prismaNextInterfaceBrand]: M;
  declare readonly [prismaNextContractBrand]: Types['PrismaNextContract'];
  readonly modelKey: M;

  constructor(name: string, modelKey: M) {
    super(name);
    this.modelKey = modelKey;
  }
}

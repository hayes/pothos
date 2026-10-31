import { InterfaceRef, type SchemaTypes } from '@pothos/core';
import { prismaContractKey } from './object-ref.js';
import type { InterfaceReturnShape, ModelName, Row } from './types.js';

export const prismaInterfaceKey = Symbol.for('Pothos.prismaNextInterfaceKey');

export class PrismaNextInterfaceRef<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
> extends InterfaceRef<Types, InterfaceReturnShape<Types, M>, Shape> {
  declare readonly [prismaInterfaceKey]: M;
  declare readonly [prismaContractKey]: Types['PrismaNextContract'];
  readonly modelName: M;

  constructor(name: string, modelName: M) {
    super(name);
    this.modelName = modelName;
  }
}

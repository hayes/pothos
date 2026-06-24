import { InterfaceRef, type SchemaTypes } from '@pothos/core';
import type { ModelName, Row } from './types';

export const prismaInterfaceKey = Symbol.for('Pothos.prismaNextInterfaceKey');

export class PrismaNextInterfaceRef<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
> extends InterfaceRef<Types, Shape, Shape> {
  declare readonly [prismaInterfaceKey]: M;
  readonly modelName: M;

  constructor(name: string, modelName: M) {
    super(name);
    this.modelName = modelName;
  }
}

import type { SchemaTypes } from '@pothos/core';
import { PrismaNextObjectRef } from './object-ref';
import type { ModelName, Row } from './types';

export const relayIDShapeKey = Symbol.for('Pothos.prismaNextRelayIDShapeKey');

export class PrismaNextNodeRef<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape = Row<Types, M>,
  IDShape = string,
> extends PrismaNextObjectRef<Types, M, Shape> {
  declare readonly [relayIDShapeKey]: IDShape;
  readonly parseId?: (id: string, ctx: object) => IDShape;

  constructor(
    name: string,
    modelName: M,
    options: { parseId?: (id: string, ctx: object) => IDShape } = {},
  ) {
    super(name, modelName);
    if (options.parseId) {
      this.parseId = options.parseId;
    }
  }
}

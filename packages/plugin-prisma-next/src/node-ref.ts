import type { SchemaTypes } from '@pothos/core';
import { PrismaNextObjectRef } from './object-ref.js';
import type { ModelKey, ObjectBaseShape } from './types/models.js';

export const relayIDShapeBrand = Symbol.for('Pothos.prismaNextRelayIDShapeBrand');

export class PrismaNextNodeRef<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape = ObjectBaseShape<Types, M>,
  IDShape = string,
> extends PrismaNextObjectRef<Types, M, Shape> {
  declare readonly [relayIDShapeBrand]: IDShape;
  readonly parseId?: (id: string, ctx: object) => IDShape;

  constructor(
    name: string,
    modelKey: M,
    options: { parseId?: (id: string, ctx: object) => IDShape } = {},
  ) {
    super(name, modelKey);
    if (options.parseId) {
      this.parseId = options.parseId;
    }
  }
}

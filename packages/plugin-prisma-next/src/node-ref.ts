import type { SchemaTypes } from '@pothos/core';
import { PrismaObjectRef } from './object-ref.js';
import type { ModelKey, ObjectBaseShape } from './types/models.js';

export const relayIDShapeBrand = Symbol.for('Pothos.prismaRelayIDShapeBrand');

export class PrismaNodeRef<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape = ObjectBaseShape<Types, M>,
  IDShape = string,
> extends PrismaObjectRef<Types, M, Shape> {
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

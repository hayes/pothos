import type { SchemaTypes } from '@pothos/core';
import { DrizzleObjectRef } from './object-ref';

export const relayIDShapeKey = Symbol.for('Pothos.relayIDShapeKey');

export class DrizzleNodeRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationsConfig'] = keyof Types['DrizzleRelationsConfig'],
  T = {},
  IDShape = string,
> extends DrizzleObjectRef<Types, Table, T> {
  [relayIDShapeKey]!: IDShape;
  parseId: ((id: string, ctx: object) => IDShape) | undefined;

  constructor(
    name: string,
    tableName: string,
    options: {
      parseId?: (id: string, ctx: object) => IDShape;
    },
  ) {
    super(name, tableName);
    this.parseId = options.parseId;
  }
}

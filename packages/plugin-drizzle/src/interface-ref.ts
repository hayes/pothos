import { InterfaceRef, type SchemaTypes } from '@pothos/core';
import type { DrizzleNodeRef } from './node-ref';
import { type DrizzleObjectRef, drizzleTableKey } from './object-ref';

export type DrizzleRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationsConfig'] = keyof Types['DrizzleRelationsConfig'],
  T = {},
> =
  | DrizzleInterfaceRef<Types, Table, T>
  | DrizzleObjectRef<Types, Table, T>
  | DrizzleNodeRef<Types, Table, T>;

export class DrizzleInterfaceRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationsConfig'] = keyof Types['DrizzleRelationsConfig'],
  T = {},
> extends InterfaceRef<Types, T> {
  [drizzleTableKey]!: Types['DrizzleRelationsConfig'][Table];

  tableName: string;

  constructor(name: string, tableName: string) {
    super(name);

    this.tableName = tableName;
  }
}

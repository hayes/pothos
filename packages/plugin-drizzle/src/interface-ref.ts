import { InterfaceRef, type SchemaTypes } from '@pothos/core';
import type { DrizzleNodeRef } from './node-ref';
import { type DrizzleObjectRef, drizzleTableKey } from './object-ref';

export type DrizzleRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelations'] = keyof Types['DrizzleRelations'],
  T = {},
> =
  | DrizzleInterfaceRef<Types, Table, T>
  | DrizzleObjectRef<Types, Table, T>
  | DrizzleNodeRef<Types, Table, T>;

export class DrizzleInterfaceRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelations'] = keyof Types['DrizzleRelations'],
  T = {},
> extends InterfaceRef<
  Types,
  | T
  | {
      $pothosQueryFor: Table | undefined;
    },
  T
> {
  [drizzleTableKey]!: Types['DrizzleRelations'][Table];

  tableName: string;

  constructor(name: string, tableName: string) {
    super(name);

    this.tableName = tableName;
  }
}

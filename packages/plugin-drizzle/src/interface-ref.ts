import { InterfaceRef, SchemaTypes } from '@pothos/core';
import { DrizzleObjectRef, drizzleTableKey } from './object-ref';

export type DrizzleRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationSchema'] = keyof Types['DrizzleRelationSchema'],
  T = {},
> = DrizzleInterfaceRef<Types, Table, T> | DrizzleObjectRef<Types, Table, T>;

export class DrizzleInterfaceRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationSchema'] = keyof Types['DrizzleRelationSchema'],
  T = {},
> extends InterfaceRef<Types, T> {
  [drizzleTableKey]!: Table;

  tableName: string;

  constructor(name: string, tableName: string) {
    super(name);

    this.tableName = tableName;
  }
}

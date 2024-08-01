import type { SchemaTypes } from '@pothos/core';
import { DrizzleObjectRef } from './object-ref';

export class DrizzleNodeRef<
  Types extends SchemaTypes,
  Table extends keyof Types['DrizzleRelationSchema'] = keyof Types['DrizzleRelationSchema'],
  T = {},
> extends DrizzleObjectRef<Types, Table, T> {}

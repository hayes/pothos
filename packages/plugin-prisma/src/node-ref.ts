import { SchemaTypes } from '@pothos/core';
import { PrismaObjectRef } from './object-ref';
import type { PrismaModelTypes } from './types';

export class PrismaNodeRef<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  T,
> extends PrismaObjectRef<Types, Model, T> {}

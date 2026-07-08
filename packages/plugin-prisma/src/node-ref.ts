import type { SchemaTypes } from '@pothos/core';
import { PrismaObjectRef } from './object-ref.js';
import type { PrismaModelTypes } from './types.js';

export class PrismaNodeRef<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  T,
> extends PrismaObjectRef<Types, Model, T> {}

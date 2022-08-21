import { PrismaObjectRef } from './object-ref';
import type { PrismaModelTypes } from './types';

export default class PrismaNodeRef<Model extends PrismaModelTypes, T> extends PrismaObjectRef<
  Model,
  T
> {}

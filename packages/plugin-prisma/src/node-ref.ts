import { PrismaObjectRef } from './object-ref';
import type { PrismaModelTypes } from './types';

export class PrismaNodeRef<Model extends PrismaModelTypes, T> extends PrismaObjectRef<Model, T> {}

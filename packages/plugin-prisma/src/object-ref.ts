import { ObjectRef } from '@pothos/core';
import type { PrismaModelTypes } from './types';

export const prismaModelKey = Symbol.for('Pothos.prismaModelKey');

export class PrismaObjectRef<Model extends PrismaModelTypes, T = {}> extends ObjectRef<T> {
  [prismaModelKey]!: Model;
}

import { ObjectRef } from '@pothos/core';
import { PrismaModelTypes } from '.';

export const prismaModelKey = Symbol.for('Pothos.prismaModelKey');

export class PrismaObjectRef<Model extends PrismaModelTypes, T = {}> extends ObjectRef<T> {
  [prismaModelKey]!: Model;
}

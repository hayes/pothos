import { InterfaceRef } from '@pothos/core';
import { prismaModelKey, PrismaObjectRef } from './object-ref';
import type { PrismaModelTypes } from './types';

export type PrismaRef<Model extends PrismaModelTypes, T = {}> =
  | PrismaObjectRef<Model, T>
  | PrismaInterfaceRef<Model, T>;

export class PrismaInterfaceRef<Model extends PrismaModelTypes, T = {}> extends InterfaceRef<T> {
  [prismaModelKey]!: Model;
  modelName: string;

  constructor(name: string, modelName: string) {
    super(name);

    this.modelName = modelName;
  }
}

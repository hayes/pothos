import { InterfaceRef, SchemaTypes } from '@pothos/core';
import { prismaModelKey, PrismaObjectRef } from './object-ref';
import type { PrismaModelTypes } from './types';

export type PrismaRef<Types extends SchemaTypes, Model extends PrismaModelTypes, T = {}> =
  | PrismaInterfaceRef<Types, Model, T>
  | PrismaObjectRef<Types, Model, T>;

export class PrismaInterfaceRef<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  T = {},
> extends InterfaceRef<Types, T> {
  [prismaModelKey]!: Model;

  modelName: string;

  constructor(name: string, modelName: string) {
    super(name);

    this.modelName = modelName;
  }
}

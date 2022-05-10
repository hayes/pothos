// Type map: https://github.com/prisma/prisma/blob/main/packages/client/src/runtime/utils/common.ts#L63

import { InputRef, SchemaTypes } from '@pothos/core';
import { PrismaModelTypes } from '@pothos/plugin-prisma';

export interface PrismaCrudTypes {
  ScalarFilters: {};
}

export type GetPrismaCrud<Types extends SchemaTypes> =
  Types['PrismaCrudTypes'] extends PrismaCrudTypes ? Types['PrismaCrudTypes'] : never;

export type ScalarFilterName<Types extends SchemaTypes> =
  keyof GetPrismaCrud<Types>['ScalarFilters'];

export interface PrismaWhereOptions<Types extends SchemaTypes, Model extends PrismaModelTypes> {
  fields: PrismaWhereFields<Types, Model> | (() => PrismaWhereFields<Types, Model>);
}

export type PrismaWhereFields<Types extends SchemaTypes, Model extends PrismaModelTypes> = {
  [K in keyof Model['Where']]?: K extends Model['RelationName']
    ? K extends Model['ListRelations']
      ? {
          [F in keyof NonNullable<Model['Where'][K]>]: InputRef<
            Model['Relations'][K]['Types']['Where']
          >;
        }
      : InputRef<Model['Relations'][K]['Types']['Where']>
    : ScalarWhereFilterOptions<Types, Model, K>;
};

export type ScalarFilters<T> = T extends { equals?: unknown }
  ? keyof T | { [K in keyof T]: boolean }
  : never;

export type ScalarWhereFilterOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Field extends keyof Model['Where'],
> =
  | boolean
  | ScalarFilters<Model['Where'][Field]>
  | {
      alias?: string;
      filters: ScalarFilters<Model['Where'][Field]>;
    };

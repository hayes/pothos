/* eslint-disable @typescript-eslint/no-unused-vars */
// Type map: https://github.com/prisma/prisma/blob/main/packages/client/src/runtime/utils/common.ts#L63

import { BaseEnum, InputRef, InputTypeParam, SchemaTypes } from '@pothos/core';
import { PrismaModelTypes } from '@pothos/plugin-prisma';

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

export type FilterListOps = 'every' | 'some' | 'none';

export interface FilterShape<T> {
  equals?: T;
  in?: T[];
  notIn?: T[];
  lt?: T;
  lte?: T;
  gt?: T;
  gte?: T;
  not?: FilterShape<T>;
  contains?: T;
  startsWith?: T;
  endsWith?: T;
  is?: T;
  isNot?: T;
}

export type FilterOps = keyof FilterShape<unknown>;

export type PrismaOrderByFields<Types extends SchemaTypes, Model extends PrismaModelTypes> = {
  [K in keyof Model['OrderBy'] as K extends Model['ListRelations']
    ? never
    : K]?: K extends Model['RelationName']
    ?
        | InputRef<Model['Relations'][K]['Types']['OrderBy']>
        | (() => InputRef<Model['Relations'][K]['Types']['OrderBy']>)
    : boolean;
};

export interface PrismaOrderByOptions<Types extends SchemaTypes, Model extends PrismaModelTypes> {
  fields: PrismaOrderByFields<Types, Model>;
}

export interface PrismaWhereOptions<Types extends SchemaTypes, Model extends PrismaModelTypes> {
  fields: PrismaWhereFields<Types, Model> | (() => PrismaWhereFields<Types, Model>);
}

export type PrismaWhereFields<Types extends SchemaTypes, Model extends PrismaModelTypes> = {
  [K in keyof Model['Where']]?: K extends Model['RelationName']
    ? InputRef<Model['Where'][K]>
    : InputWithShape<Types, Model['Shape'][K]> | InputRef<Model['Where'][K]>;
};

type InputWithShape<Types extends SchemaTypes, T> =
  | InputRef<T>
  | (BaseEnum & Record<string, T>)
  | (new (...args: any[]) => T)
  | (Types['inputShapes'][keyof Types['inputShapes']] extends infer Input extends T
      ? Input
      : never);

type SI = InputWithShape<PothosSchemaTypes.ExtendDefaultTypes<{}>, string>;

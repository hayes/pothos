/* eslint-disable @typescript-eslint/no-unused-vars */
// Type map: https://github.com/prisma/prisma/blob/main/packages/client/src/runtime/utils/common.ts#L63

import {
  BaseEnum,
  InputRef,
  InputShapeFromTypeParam,
  InputType,
  InputTypeParam,
  SchemaTypes,
} from '@pothos/core';
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
        | (() => PothosSchemaTypes.InputFieldOptions<
            Types,
            InputRef<Model['Relations'][K]['Types']['OrderBy']>
          >)
    : boolean | (() => Omit<PothosSchemaTypes.InputFieldOptions<Types>, 'type'>);
};

export interface PrismaOrderByOptions<Types extends SchemaTypes, Model extends PrismaModelTypes> {
  name?: string;
  fields: PrismaOrderByFields<Types, Model> | (() => PrismaOrderByFields<Types, Model>);
}

export interface PrismaWhereOptions<Types extends SchemaTypes, Model extends PrismaModelTypes> {
  name?: string;
  fields: PrismaWhereFields<Types, Model> | (() => PrismaWhereFields<Types, Model>);
}

export type PrismaWhereFields<Types extends SchemaTypes, Model extends PrismaModelTypes> = {
  [K in keyof Model['Where']]?:
    | PrismaWhereFieldType<Types, Model, K>
    | (() => PrismaWhereFieldOptions<Types, Model, K>);
};

export interface PrismaWhereFieldOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  K extends keyof Model['Where'],
> extends Omit<PothosSchemaTypes.InputFieldOptions<Types, InputRef<Model['Where'][K]>>, 'type'> {
  type: PrismaWhereFieldType<Types, Model, K>;
}

export type PrismaWhereFieldType<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  K extends keyof Model['Where'],
> = K extends Model['RelationName']
  ? InputRef<Model['Where'][K]>
  : InputWithShape<Types, Model['Shape'][K]> | InputRef<Model['Where'][K]>;

type InputWithShape<Types extends SchemaTypes, T> =
  | InputRef<T>
  | (BaseEnum & Record<string, T>)
  | (new (...args: any[]) => T)
  | (keyof Types['inputShapes'] extends infer U extends string
      ? U extends string
        ? Types['inputShapes'][U & keyof Types['inputShapes']] extends T
          ? U
          : never
        : never
      : never);

export type OpsOptions<
  Types extends SchemaTypes,
  Type extends InputType<Types>,
  Ops extends string,
> = Ops[] | Record<Ops, Omit<PothosSchemaTypes.InputFieldOptions<Types, Type>, 'type'>>;
export interface PrismaFilterOptions<
  Types extends SchemaTypes,
  Type extends InputType<Types>,
  Ops extends OpsOptions<Types, Type, FilterOps>,
> {
  name?: string;
  ops: Ops;
}

export interface PrismaListFilterOptions<
  Types extends SchemaTypes,
  Type extends InputType<Types>,
  Ops extends OpsOptions<Types, Type, FilterListOps>,
> {
  name?: string;
  ops: Ops;
}

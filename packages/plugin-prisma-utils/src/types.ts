// Type map: https://github.com/prisma/prisma/blob/main/packages/client/src/runtime/utils/common.ts#L63

import {
  BaseEnum,
  InputFieldMap,
  InputFieldRef,
  InputRef,
  InputType,
  SchemaTypes,
} from '@pothos/core';
import { PrismaModelTypes } from '@pothos/plugin-prisma';

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
  search?: T;
}

export type FilterOps = keyof FilterShape<unknown>;

export type TypesFromName<
  Types extends SchemaTypes,
  Name extends string,
> = Name extends keyof Types['PrismaTypes'] ? Types['PrismaTypes'][Name] & PrismaModelTypes : never;

export type PrismaOrderByFields<Types extends SchemaTypes, Model extends PrismaModelTypes> = {
  [K in keyof Model['OrderBy'] as K extends Model['ListRelations']
    ? never
    : K]?: K extends Model['RelationName']
    ?
        | InputRef<TypesFromName<Types, Model['Relations'][K]['Name']>['OrderBy']>
        | (() => PothosSchemaTypes.InputFieldOptions<
            Types,
            InputRef<TypesFromName<Types, Model['Relations'][K]['Name']>['OrderBy']>
          >)
    : boolean | (() => Omit<PothosSchemaTypes.InputFieldOptions<Types>, 'type'>);
};

export interface PrismaOrderByOptions<Types extends SchemaTypes, Model extends PrismaModelTypes>
  extends Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, InputFieldMap>, 'fields'> {
  name?: string;
  fields: PrismaOrderByFields<Types, Model> | (() => PrismaOrderByFields<Types, Model>);
}

export interface PrismaWhereOptions<Types extends SchemaTypes, Model extends PrismaModelTypes>
  extends Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, InputFieldMap>, 'fields'> {
  name?: string;
  fields:
    | PrismaWhereFields<Types, Model>
    | ((
        t: PothosSchemaTypes.InputFieldBuilder<Types, 'InputObject'>,
      ) => PrismaWhereFields<Types, Model>);
}

export type PrismaWhereFields<Types extends SchemaTypes, Model extends PrismaModelTypes> = {
  [K in keyof Model['Where']]?: K extends 'AND' | 'OR'
    ? boolean | Omit<PothosSchemaTypes.InputFieldOptions<Types, InputRef<Model['Where'][]>>, 'type'>
    : K extends 'NOT'
    ? boolean | Omit<PothosSchemaTypes.InputFieldOptions<Types, InputRef<Model['Where']>>, 'type'>
    : PrismaWhereFieldType<Types, Model, K>;
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
  ? InputRef<Model['Where'][K]> | InputFieldRef<Model['Where'][K]>
  :
      | InputWithShape<Types, Model['Shape'][K]>
      | InputRef<Model['Where'][K]>
      | InputFieldRef<Model['Where'][K] | null | undefined>;

type InputWithShape<Types extends SchemaTypes, T> =
  | InputRef<T>
  | InputFieldRef<T | null | undefined>
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
> = readonly Ops[] | Record<Ops, Omit<PothosSchemaTypes.InputFieldOptions<Types, Type>, 'type'>>;

export interface PrismaFilterOptions<
  Types extends SchemaTypes,
  Type extends InputType<Types>,
  Ops extends OpsOptions<Types, Type, FilterOps>,
> extends Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, InputFieldMap>, 'fields'> {
  name?: string;
  ops: Ops;
}

export interface PrismaListFilterOptions<
  Types extends SchemaTypes,
  Type extends InputType<Types>,
  Ops extends OpsOptions<Types, Type, FilterListOps>,
> extends Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, InputFieldMap>, 'fields'> {
  name?: string;
  ops: Ops;
}

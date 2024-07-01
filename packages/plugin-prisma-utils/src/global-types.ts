import { InputShapeFromTypeParam, InputType, SchemaTypes } from '@pothos/core';
import { PrismaModelTypes } from '@pothos/plugin-prisma';
import {
  FilterListOps,
  FilterOps,
  FilterShape,
  OpsOptions,
  PickFields,
  PrismaCreateManyRelationOptions,
  PrismaCreateOneRelationOptions,
  PrismaCreateOptions,
  PrismaFilterOptions,
  PrismaListFilterOptions,
  PrismaOrderByOptions,
  PrismaScalarListFilterOptions,
  PrismaUpdateManyRelationOptions,
  PrismaUpdateOneRelationOptions,
  PrismaUpdateOptions,
  PrismaWhereOptions,
  PrismaWhereUniqueOptions,
  ScalarListFilterShape,
  ScalarListOps,
} from './types';

import type {
  IntFieldUpdateOperationsInput,
  IntUpdateOps,
  PothosPrismaUtilsPlugin,
  PrismaIntAtomicUpdateOptions,
} from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prismaUtils: PothosPrismaUtilsPlugin<Types>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      prismaListFilter: <
        Type extends InputType<Types>,
        Ops extends OpsOptions<Types, Type, FilterListOps>,
      >(
        type: Type,
        options: PrismaListFilterOptions<Types, Type, Ops>,
      ) => InputObjectRef<
        Types,
        {
          [K in Ops extends string[] ? Ops[number] : keyof Ops]: InputShapeFromTypeParam<
            Types,
            Type,
            true
          >;
        }
      >;

      prismaScalarListFilter: <
        Type extends InputType<Types>,
        Ops extends OpsOptions<Types, Type, ScalarListOps>,
      >(
        type: Type,
        options: PrismaScalarListFilterOptions<Types, Type, Ops>,
      ) => InputObjectRef<
        Types,
        Pick<
          ScalarListFilterShape<InputShapeFromTypeParam<Types, Type, true>>,
          Ops extends readonly string[] ? Ops[number] : keyof Ops
        >
      >;

      prismaFilter: <Type extends InputType<Types>, Ops extends OpsOptions<Types, Type, FilterOps>>(
        type: Type,
        options: PrismaFilterOptions<Types, Type, Ops>,
      ) => InputObjectRef<
        Types,
        Pick<
          FilterShape<InputShapeFromTypeParam<Types, Type, true>>,
          Ops extends readonly string[] ? Ops[number] : keyof Ops
        >
      >;

      prismaStringFilterModeEnum: () => EnumRef<Types, 'default' | 'insensitive'>;

      prismaOrderBy: <
        Name extends keyof Types['PrismaTypes'],
        Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
          ? Types['PrismaTypes'][Name]
          : never,
      >(
        name: Name,
        options: PrismaOrderByOptions<Types, Model>,
      ) => InputObjectRef<Types, Model['OrderBy']>;

      orderByEnum: () => EnumRef<Types, 'asc' | 'desc'>;

      prismaWhere: <
        Name extends keyof Types['PrismaTypes'],
        Fields extends Partial<Record<keyof Model['Where'], unknown>>,
        Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
          ? Types['PrismaTypes'][Name]
          : never,
      >(
        type: Name,
        options: PrismaWhereOptions<Types, Model, Fields>,
      ) => InputObjectRef<Types, PickFields<Model['Where'], Fields>>;

      prismaWhereUnique: <
        Name extends keyof Types['PrismaTypes'],
        Fields extends Partial<Record<keyof Model['WhereUnique'], unknown>>,
        Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
          ? Types['PrismaTypes'][Name]
          : never,
      >(
        type: Name,
        options: PrismaWhereUniqueOptions<Types, Model, Fields>,
      ) => InputObjectRef<Types, Model['WhereUnique']>;

      prismaCreate: <
        Name extends keyof Types['PrismaTypes'],
        Fields extends Partial<Record<keyof Model['Create'], unknown>>,
        Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
          ? Types['PrismaTypes'][Name]
          : never,
      >(
        type: Name,
        options: PrismaCreateOptions<Types, Model, Fields>,
      ) => InputObjectRef<Types, PickFields<Model['Create'], Fields>>;

      prismaCreateRelation: <
        Name extends keyof Types['PrismaTypes'],
        Relation extends Model['RelationName'],
        Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
          ? Types['PrismaTypes'][Name]
          : never,
      >(
        type: Name,
        relation: Relation,
        options: Relation extends Model['ListRelations']
          ? PrismaCreateManyRelationOptions<Types, Relation, Model>
          : PrismaCreateOneRelationOptions<Types, Relation, Model>,
      ) => InputObjectRef<Types, NonNullable<Model['Create'][Relation & keyof Model['Update']]>>;

      prismaUpdate: <
        Name extends keyof Types['PrismaTypes'],
        Fields extends Partial<Record<keyof Model['Update'], unknown>>,
        Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
          ? Types['PrismaTypes'][Name]
          : never,
      >(
        type: Name,
        options: PrismaUpdateOptions<Types, Model, Fields>,
      ) => InputObjectRef<Types, PickFields<Model['Update'], Fields>>;

      prismaUpdateRelation: <
        Name extends keyof Types['PrismaTypes'],
        Relation extends Model['RelationName'],
        Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
          ? Types['PrismaTypes'][Name]
          : never,
      >(
        type: Name,
        relation: Relation,
        options: Relation extends Model['ListRelations']
          ? PrismaUpdateManyRelationOptions<Types, Relation, Model>
          : PrismaUpdateOneRelationOptions<Types, Relation, Model>,
      ) => InputObjectRef<Types, NonNullable<Model['Update'][Relation & keyof Model['Update']]>>;

      prismaIntAtomicUpdate: <Ops extends IntUpdateOps>(
        options?: PrismaIntAtomicUpdateOptions<Types, Ops>,
      ) => InputObjectRef<Types, Pick<IntFieldUpdateOperationsInput, Ops>>;
    }
  }
}

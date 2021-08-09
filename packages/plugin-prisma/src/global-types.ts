/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-interface */
import {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  NormalizeArgs,
  ObjectRef,
  OutputType,
  PluginName,
  SchemaTypes,
} from '@giraphql/core';
import { PrismaPlugin } from './index.js';
import PrismaNodeRef from './node-ref.js';
import {
  ModelTypes,
  PrismaConnectionFieldOptions,
  PrismaDelegate,
  PrismaFieldOptions,
  PrismaModelTypes,
  PrismaNodeOptions,
  PrismaObjectTypeOptions,
} from './types.js';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prisma: PrismaPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      prisma: {
        client: {
          $connect: () => Promise<void>;
        };
      };
    }

    export interface UserSchemaTypes {
      PrismaClient?: 'This type has been replaced with `PrismaTypes` see docs for more details.';
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      prismaObject: <
        Delegate extends PrismaDelegate,
        Interfaces extends InterfaceParam<Types>[],
        FindUnique,
        Model extends ModelTypes<Delegate>,
      >(
        type: Delegate,
        options: PrismaObjectTypeOptions<Types, Model, Interfaces, FindUnique>,
      ) => ObjectRef<Model['Shape']>;

      prismaNode: 'relay' extends PluginName
        ? <Type extends PrismaDelegate, Interfaces extends InterfaceParam<Types>[]>(
            delegate: Type,
            options: PrismaNodeOptions<Types, ModelTypes<Type>, Interfaces>,
          ) => PrismaNodeRef<ModelTypes<Type>['Shape']>
        : '@giraphql/plugin-relay is required to use this method';
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      prismaField: <
        Args extends InputFieldMap,
        TypeParam extends PrismaDelegate | [PrismaDelegate],
        Nullable extends FieldNullability<
          TypeParam extends [PrismaDelegate]
            ? [ObjectRef<Model['Shape']>]
            : ObjectRef<Model['Shape']>
        >,
        ResolveReturnShape,
        Model extends PrismaModelTypes = TypeParam extends [PrismaDelegate]
          ? ModelTypes<TypeParam[0]>
          : ModelTypes<TypeParam>,
      >(
        options: PrismaFieldOptions<
          Types,
          ParentShape,
          TypeParam,
          Model,
          TypeParam extends [PrismaDelegate]
            ? [ObjectRef<Model['Shape']>]
            : ObjectRef<Model['Shape']>,
          Args,
          Nullable,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<Model['Shape']>;

      prismaConnection: 'relay' extends PluginName
        ? <
            Type extends PrismaDelegate,
            Nullable extends boolean,
            ResolveReturnShape,
            Args extends InputFieldMap = {},
            Model extends PrismaModelTypes = ModelTypes<Type>,
          >(
            ...args: NormalizeArgs<
              [
                options: PrismaConnectionFieldOptions<
                  Types,
                  ParentShape,
                  Type,
                  Model,
                  ObjectRef<Model['Shape']>,
                  Nullable,
                  Args,
                  ResolveReturnShape,
                  Kind
                >,
                connectionOptions?: ConnectionObjectOptions<
                  Types,
                  ObjectRef<Model['Shape']>,
                  ResolveReturnShape
                >,
                edgeOptions?: ConnectionEdgeObjectOptions<
                  Types,
                  ObjectRef<Model['Shape']>,
                  ResolveReturnShape
                >,
              ]
            >
          ) => FieldRef<ConnectionShapeHelper<Types, Model['Shape'], Nullable>['shape']>
        : '@giraphql/plugin-relay is required to use this method';
    }

    export interface ConnectionFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends OutputType<Types>,
      Nullable extends boolean,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > {}

    export interface ConnectionObjectOptions<
      Types extends SchemaTypes,
      Type extends OutputType<Types>,
      Resolved,
    > {}

    export interface ConnectionEdgeObjectOptions<
      Types extends SchemaTypes,
      Type extends OutputType<Types>,
      Resolved,
    > {}

    export interface DefaultConnectionArguments {
      first?: number | null | undefined;
      last?: number | null | undefined;
      before?: string | null | undefined;
      after?: string | null | undefined;
    }

    export interface ConnectionShapeHelper<Types extends SchemaTypes, T, Nullable> {
      shape: unknown;
    }
  }
}

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
  DelegateFromName,
  ModelName,
  PrismaConnectionFieldOptions,
  PrismaFieldOptions,
  PrismaNodeOptions,
  PrismaObjectTypeOptions,
  ShapeFromPrismaDelegate,
} from './types.js';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prisma: PrismaPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      prisma: {
        client: Types['PrismaClient'];
      };
    }

    export interface UserSchemaTypes {
      PrismaClient: {};
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      PrismaClient: undefined extends PartialTypes['PrismaClient']
        ? {}
        : PartialTypes['PrismaClient'] & {};
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      prismaObject: <
        Name extends ModelName<Types>,
        Interfaces extends InterfaceParam<Types>[],
        FindUnique,
      >(
        type: Name,
        options: PrismaObjectTypeOptions<Types, Name, Interfaces, FindUnique>,
      ) => ObjectRef<ShapeFromPrismaDelegate<DelegateFromName<Types, Name>>>;

      prismaNode: 'relay' extends PluginName
        ? <Name extends ModelName<Types>, Interfaces extends InterfaceParam<Types>[]>(
            name: Name,
            options: PrismaNodeOptions<Types, Name, Interfaces>,
          ) => PrismaNodeRef<ShapeFromPrismaDelegate<DelegateFromName<Types, Name>>>
        : '@giraphql/plugin-relay is required to use this method';
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      prismaField: <
        Args extends InputFieldMap,
        TypeParam extends ModelName<Types> | [ModelName<Types>],
        Name extends TypeParam extends [ModelName<Types>]
          ? TypeParam[0]
          : TypeParam extends ModelName<Types>
          ? TypeParam
          : never,
        Type extends DelegateFromName<Types, Name>,
        Nullable extends FieldNullability<
          TypeParam extends [Name]
            ? [ObjectRef<ShapeFromPrismaDelegate<Type>>]
            : ObjectRef<ShapeFromPrismaDelegate<Type>>
        >,
        ResolveReturnShape,
      >(
        options: PrismaFieldOptions<
          Types,
          ParentShape,
          TypeParam,
          TypeParam extends [Name]
            ? [ObjectRef<ShapeFromPrismaDelegate<Type>>]
            : ObjectRef<ShapeFromPrismaDelegate<Type>>,
          Args,
          Nullable,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<ShapeFromPrismaDelegate<Type>>;

      prismaConnection: 'relay' extends PluginName
        ? <
            Name extends ModelName<Types>,
            Type extends DelegateFromName<Types, Name>,
            Nullable extends boolean,
            ResolveReturnShape,
            Args extends InputFieldMap = {},
          >(
            ...args: NormalizeArgs<
              [
                options: PrismaConnectionFieldOptions<
                  Types,
                  ParentShape,
                  Name,
                  DelegateFromName<Types, Name>,
                  ObjectRef<ShapeFromPrismaDelegate<Type>>,
                  Nullable,
                  Args,
                  ResolveReturnShape,
                  Kind
                >,
                connectionOptions?: ConnectionObjectOptions<
                  Types,
                  ObjectRef<ShapeFromPrismaDelegate<Type>>,
                  ResolveReturnShape
                >,
                edgeOptions?: ConnectionEdgeObjectOptions<
                  Types,
                  ObjectRef<ShapeFromPrismaDelegate<Type>>,
                  ResolveReturnShape
                >,
              ]
            >
          ) => FieldRef<
            ConnectionShapeHelper<Types, ShapeFromPrismaDelegate<Type>, Nullable>['shape']
          >
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

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
  ModelName,
  PrismaConnectionFieldOptions,
  PrismaFieldOptions,
  PrismaModelTypes,
  PrismaNodeOptions,
  PrismaObjectTypeOptions,
  ShapeFromName,
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
      PrismaTypes: Record<string, PrismaModelTypes>;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      PrismaTypes: undefined extends PartialTypes['PrismaTypes']
        ? {}
        : PartialTypes['PrismaTypes'] & {};
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      prismaObject: <
        Name extends ModelName<Types>,
        Interfaces extends InterfaceParam<Types>[],
        FindUnique,
      >(
        type: Name,
        options: PrismaObjectTypeOptions<Types, Name, Interfaces, FindUnique>,
      ) => ObjectRef<ShapeFromName<Types, Name>>;

      prismaNode: 'relay' extends PluginName
        ? <Name extends ModelName<Types>, Interfaces extends InterfaceParam<Types>[]>(
            name: Name,
            options: PrismaNodeOptions<Types, Name, Interfaces>,
          ) => PrismaNodeRef<ShapeFromName<Types, Name>>
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
        Nullable extends FieldNullability<
          TypeParam extends [Name]
            ? [ObjectRef<ShapeFromName<Types, Name>>]
            : ObjectRef<ShapeFromName<Types, Name>>
        >,
        ResolveReturnShape,
      >(
        options: PrismaFieldOptions<
          Types,
          ParentShape,
          TypeParam,
          Types['PrismaTypes'][Name],
          TypeParam extends [Name]
            ? [ObjectRef<ShapeFromName<Types, Name>>]
            : ObjectRef<ShapeFromName<Types, Name>>,
          Args,
          Nullable,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<ShapeFromName<Types, Name>>;

      prismaConnection: 'relay' extends PluginName
        ? <
            Name extends ModelName<Types>,
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
                  ObjectRef<ShapeFromName<Types, Name>>,
                  Nullable,
                  Args,
                  ResolveReturnShape,
                  Kind
                >,
                connectionOptions?: ConnectionObjectOptions<
                  Types,
                  ObjectRef<ShapeFromName<Types, Name>>,
                  ResolveReturnShape
                >,
                edgeOptions?: ConnectionEdgeObjectOptions<
                  Types,
                  ObjectRef<ShapeFromName<Types, Name>>,
                  ResolveReturnShape
                >,
              ]
            >
          ) => FieldRef<ConnectionShapeHelper<Types, ShapeFromName<Types, Name>, Nullable>['shape']>
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

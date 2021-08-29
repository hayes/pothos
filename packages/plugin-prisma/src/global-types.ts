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
  ShapeFromTypeParam,
} from '@giraphql/core';
import PrismaNodeRef from './node-ref';
import {
  PrismaConnectionFieldOptions,
  PrismaFieldOptions,
  PrismaModelTypes,
  PrismaNodeOptions,
  PrismaObjectTypeOptions,
  ShapeWithInclude,
} from './types';
import { PrismaPlugin } from '.';

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
      PrismaTypes: {};
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      PrismaTypes: undefined extends PartialTypes['PrismaTypes']
        ? {}
        : PartialTypes['PrismaTypes'] & {};
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      prismaObject: <
        Name extends keyof Types['PrismaTypes'],
        Interfaces extends InterfaceParam<Types>[],
        FindUnique,
        Model extends PrismaModelTypes & Types['PrismaTypes'][Name],
        Include extends Model['Include'] = {},
        Shape extends object = ShapeWithInclude<Model, Include>,
      >(
        name: Name,
        options: PrismaObjectTypeOptions<Types, Model, Interfaces, FindUnique, Include, Shape>,
      ) => ObjectRef<Shape>;

      prismaNode: 'relay' extends PluginName
        ? <
            Name extends keyof Types['PrismaTypes'],
            Interfaces extends InterfaceParam<Types>[],
            Model extends PrismaModelTypes & Types['PrismaTypes'][Name],
            Include extends Model['Include'] = {},
            Shape extends object = ShapeWithInclude<Model, Include>,
          >(
            name: Name,
            options: PrismaNodeOptions<Types, Model, Interfaces, Include, Shape>,
          ) => PrismaNodeRef<Shape>
        : '@giraphql/plugin-relay is required to use this method';
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      prismaField: <
        Args extends InputFieldMap,
        TypeParam extends keyof Types['PrismaTypes'] | [keyof Types['PrismaTypes']],
        Nullable extends FieldNullability<Type>,
        ResolveReturnShape,
        Type extends TypeParam extends [keyof Types['PrismaTypes']]
          ? [ObjectRef<Model['Shape']>]
          : ObjectRef<Model['Shape']>,
        Model extends PrismaModelTypes = PrismaModelTypes &
          (TypeParam extends [keyof Types['PrismaTypes']]
            ? Types['PrismaTypes'][TypeParam[0]]
            : TypeParam extends keyof Types['PrismaTypes']
            ? Types['PrismaTypes'][TypeParam]
            : never),
      >(
        options: PrismaFieldOptions<
          Types,
          ParentShape,
          TypeParam,
          Model,
          Type,
          Args,
          Nullable,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<ShapeFromTypeParam<Types, Type, Nullable>>;

      prismaConnection: 'relay' extends PluginName
        ? <
            Type extends keyof Types['PrismaTypes'],
            Nullable extends boolean,
            ResolveReturnShape,
            Args extends InputFieldMap = {},
            Model extends PrismaModelTypes = PrismaModelTypes & Types['PrismaTypes'][Type],
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

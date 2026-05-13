import type {
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  ObjectRef,
  PluginName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { PothosPrismaNextPlugin } from '.';
import type { PrismaNextInterfaceRef } from './interface-ref';
import type { ParamToModelName, ParamToTypeParam } from './internal-types';
import type { PrismaNextNodeRef } from './node-ref';
import type { PrismaNextObjectRef } from './object-ref';
import type {
  AnyContract,
  CursorSpec,
  ModelName,
  PrismaNextConnectionFieldOptions,
  PrismaNextObjectFieldOptions,
  PrismaNextObjectOptions,
  PrismaNextPluginOptions,
  PrismaNextRootFieldOptions,
  PrismaNextRootFieldWithInputOptions,
  Row,
} from './types';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prismaNext: PothosPrismaNextPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      prismaNext: PrismaNextPluginOptions<Types['PrismaNextContract']>;
    }

    export interface UserSchemaTypes {
      PrismaNextContract: AnyContract;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      PrismaNextContract: undefined extends PartialTypes['PrismaNextContract']
        ? AnyContract
        : PartialTypes['PrismaNextContract'] & object;
    }

    export interface PothosKindToGraphQLType {
      PrismaNextObject: 'Object';
    }

    // Empty fallbacks so scope-auth-typed references compile when
    // plugin-scope-auth isn't loaded. plugin-scope-auth declaration-merges
    // real fields onto these.
    export interface ScopeAuthFieldAuthScopes<
      Types extends SchemaTypes,
      Parent,
      Args extends {} = {},
    > {}
    export interface ScopeAuthContextForAuth<Types extends SchemaTypes, Scopes extends {}> {}

    export interface FieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      PrismaNextObject: PrismaNextObjectFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      >;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      prismaObject: <
        const Interfaces extends InterfaceParam<Types>[],
        M extends ModelName<Types>,
        Shape = Row<Types, M>,
      >(
        modelName: M,
        options: PrismaNextObjectOptions<Types, M, Shape, Interfaces>,
      ) => PrismaNextObjectRef<Types, M, Shape>;

      prismaInterface: <
        const Interfaces extends InterfaceParam<Types>[],
        M extends ModelName<Types>,
        Shape = Row<Types, M>,
      >(
        modelName: M,
        options: PrismaNextObjectOptions<Types, M, Shape, Interfaces>,
      ) => PrismaNextInterfaceRef<Types, M, Shape>;

      prismaObjectField: <M extends ModelName<Types>, Shape = Row<Types, M>>(
        type: M | PrismaNextObjectRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: import('./prisma-next-object-field-builder').PrismaNextObjectFieldBuilder<
            Types,
            M,
            Shape
          >,
        ) => FieldRef<Types, unknown>,
      ) => void;

      prismaObjectFields: <M extends ModelName<Types>, Shape = Row<Types, M>>(
        type: M | PrismaNextObjectRef<Types, M, Shape>,
        fields: (
          t: import('./prisma-next-object-field-builder').PrismaNextObjectFieldBuilder<
            Types,
            M,
            Shape
          >,
        ) => FieldMap,
      ) => void;

      prismaInterfaceField: <M extends ModelName<Types>, Shape = Row<Types, M>>(
        type: M | PrismaNextInterfaceRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: import('./prisma-next-object-field-builder').PrismaNextObjectFieldBuilder<
            Types,
            M,
            Shape
          >,
        ) => FieldRef<Types, unknown>,
      ) => void;

      prismaInterfaceFields: <M extends ModelName<Types>, Shape = Row<Types, M>>(
        type: M | PrismaNextInterfaceRef<Types, M, Shape>,
        fields: (
          t: import('./prisma-next-object-field-builder').PrismaNextObjectFieldBuilder<
            Types,
            M,
            Shape
          >,
        ) => FieldMap,
      ) => void;

      prismaNode: 'relay' extends PluginName
        ? <
            const Interfaces extends InterfaceParam<Types>[],
            M extends ModelName<Types>,
            Shape = Row<Types, M>,
            IDShape = string,
          >(
            modelName: M,
            options: PrismaNextObjectOptions<Types, M, Shape, Interfaces> & {
              id: {
                /** Column name or non-empty tuple for composite primary keys (encoded as a JSON array). */
                field:
                  | (keyof Row<Types, M> & string)
                  | readonly [keyof Row<Types, M> & string, ...(keyof Row<Types, M> & string)[]];
                description?: string;
                parse?: (id: string, ctx: Types['Context']) => IDShape;
                resolve?: (parent: Shape, ctx: Types['Context']) => string | number;
              };
              collection:
                | import('@prisma-next/sql-orm-client').Collection<
                    Types['PrismaNextContract'] & AnyContract,
                    M
                  >
                | ((
                    ctx: Types['Context'],
                  ) => import('@prisma-next/sql-orm-client').Collection<
                    Types['PrismaNextContract'] & AnyContract,
                    M
                  >);
            },
          ) => PrismaNextNodeRef<Types, M, Shape, IDShape>
        : '@pothos/plugin-relay is required to use this method';
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      prismaField: <
        Args extends InputFieldMap,
        Param extends
          | ModelName<Types>
          | [ModelName<Types>]
          | PrismaNextObjectRef<Types, ModelName<Types>, unknown>
          | [PrismaNextObjectRef<Types, ModelName<Types>, unknown>],
        Nullable extends FieldNullability<Type>,
        ResolveReturnShape,
        M extends ModelName<Types> = ParamToModelName<Types, Param>,
        ShapeForType = Row<Types, M>,
        Type extends TypeParam<Types> = ParamToTypeParam<Types, Param, ShapeForType>,
      >(
        options: PrismaNextRootFieldOptions<
          Types,
          ParentShape,
          Param,
          Type,
          Nullable,
          Args,
          ResolveReturnShape
        >,
      ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>>;

      prismaFieldWithInput: 'withInput' extends PluginName
        ? <
            Args extends InputFieldMap,
            Param extends
              | ModelName<Types>
              | [ModelName<Types>]
              | PrismaNextObjectRef<Types, ModelName<Types>, unknown>
              | [PrismaNextObjectRef<Types, ModelName<Types>, unknown>],
            Nullable extends FieldNullability<Type>,
            ResolveReturnShape,
            Fields extends InputFieldMap = {},
            InputName extends string = 'input',
            ArgRequired extends boolean = boolean extends (Types & {
              WithInputArgRequired: boolean;
            })['WithInputArgRequired']
              ? true
              : (Types & { WithInputArgRequired: boolean })['WithInputArgRequired'],
            M extends ModelName<Types> = ParamToModelName<Types, Param>,
            ShapeForType = Row<Types, M>,
            Type extends TypeParam<Types> = ParamToTypeParam<Types, Param, ShapeForType>,
          >(
            options: PrismaNextRootFieldWithInputOptions<
              Types,
              ParentShape,
              Param,
              Type,
              Nullable,
              Args,
              Fields,
              InputName,
              ResolveReturnShape,
              ArgRequired
            >,
          ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>>
        : '@pothos/plugin-with-input is required to use this method';

      prismaConnection: 'relay' extends PluginName
        ? <
            Args extends InputFieldMap,
            Param extends
              | ModelName<Types>
              | [ModelName<Types>]
              | PrismaNextObjectRef<Types, ModelName<Types>, unknown>
              | [PrismaNextObjectRef<Types, ModelName<Types>, unknown>],
            Nullable extends boolean,
            ResolveReturnShape,
            ConnectionInterfaces extends InterfaceParam<Types>[] = [],
            EdgeInterfaces extends InterfaceParam<Types>[] = [],
            M extends ModelName<Types> = ParamToModelName<Types, Param>,
            Cursor extends CursorSpec<Types, M> = CursorSpec<Types, M>,
          >(
            options: PrismaNextConnectionFieldOptions<
              Types,
              ParentShape,
              M,
              Param,
              Nullable,
              Args,
              Cursor,
              ResolveReturnShape
            >,
            connectionOptions?:
              | PothosSchemaTypes.ConnectionObjectOptions<
                  Types,
                  PrismaNextObjectRef<Types, M, unknown>,
                  false,
                  false,
                  unknown,
                  ConnectionInterfaces
                >
              | ObjectRef<Types, unknown>,
            edgeOptions?:
              | PothosSchemaTypes.ConnectionEdgeObjectOptions<
                  Types,
                  PrismaNextObjectRef<Types, M, unknown>,
                  false,
                  unknown,
                  EdgeInterfaces
                >
              | ObjectRef<Types, unknown>,
          ) => FieldRef<Types, unknown>
        : '@pothos/plugin-relay is required to use this method';
    }
  }
}

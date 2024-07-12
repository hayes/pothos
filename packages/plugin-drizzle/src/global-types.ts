/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-interface */
import type {
  BuildQueryResult,
  DBQueryConfig,
  ExtractTablesWithRelations,
  TableRelationalConfig,
} from 'drizzle-orm';
import {
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  NormalizeArgs,
  OutputType,
  PluginName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import { DrizzleObjectFieldBuilder } from './drizzle-field-builder';
import { DrizzleInterfaceRef, DrizzleRef } from './interface-ref';
import { DrizzleObjectRef, drizzleTableKey } from './object-ref';
import type {
  DrizzleConnectionFieldOptions,
  DrizzleConnectionShape,
  DrizzleFieldOptions,
  DrizzleInterfaceOptions,
  DrizzleObjectFieldOptions,
  DrizzleObjectOptions,
  DrizzlePluginOptions,
  drizzleTableName,
  ShapeFromConnection,
} from './types';

import type { PothosDrizzlePlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      drizzle: PothosDrizzlePlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      drizzle: DrizzlePluginOptions<Types>;
    }

    export interface UserSchemaTypes {
      DrizzleSchema: Record<string, unknown>;
      DrizzleRelationSchema: Record<string, TableRelationalConfig>;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      DrizzleSchema: PartialTypes['DrizzleSchema'] & {};
      DrizzleRelationSchema: ExtractTablesWithRelations<PartialTypes['DrizzleSchema'] & {}>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      drizzleObject: <
        Interfaces extends InterfaceParam<Types>[],
        Table extends keyof Types['DrizzleRelationSchema'],
        Selection extends
          | DBQueryConfig<
              'one',
              false,
              Types['DrizzleRelationSchema'],
              Types['DrizzleRelationSchema'][Table]
            >
          | true,
        Shape = BuildQueryResult<
          Types['DrizzleRelationSchema'],
          Types['DrizzleRelationSchema'][Table],
          Selection
        >,
      >(
        table: Table,
        options: DrizzleObjectOptions<Types, Table, Shape, Selection, Interfaces>,
      ) => DrizzleObjectRef<Types, Table, Shape>;

      drizzleInterface: <
        Interfaces extends InterfaceParam<Types>[],
        Table extends keyof Types['DrizzleRelationSchema'],
        Selection extends
          | DBQueryConfig<
              'one',
              false,
              Types['DrizzleRelationSchema'],
              Types['DrizzleRelationSchema'][Table]
            >
          | true,
        Shape = BuildQueryResult<
          Types['DrizzleRelationSchema'],
          Types['DrizzleRelationSchema'][Table],
          Selection
        >,
      >(
        table: Table,
        options: DrizzleInterfaceOptions<Types, Table, Shape, Selection, Interfaces>,
      ) => DrizzleInterfaceRef<Types, Table, Shape>;

      drizzleObjectField: <
        Type extends DrizzleObjectRef<Types> | keyof Types['DrizzleRelationSchema'],
        TableConfig extends TableRelationalConfig = Type extends DrizzleObjectRef<Types>
          ? Type[typeof drizzleTableKey]
          : Types['DrizzleRelationSchema'][Type & keyof Types['DrizzleRelationSchema']],
        Shape extends {} = Type extends DrizzleObjectRef<
          Types,
          keyof Types['DrizzleRelationSchema'],
          infer S
        >
          ? S & { [drizzleTableName]?: TableConfig['tsName'] }
          : BuildQueryResult<Types['DrizzleRelationSchema'], TableConfig, true> & {
              [drizzleTableName]?: Type;
            },
      >(
        type: Type,
        fieldName: string,
        field: (t: DrizzleObjectFieldBuilder<Types, TableConfig, false, Shape>) => FieldRef<Types>,
      ) => void;

      drizzleInterfaceField: <
        Type extends DrizzleInterfaceRef<Types> | keyof Types['DrizzleRelationSchema'],
        TableConfig extends TableRelationalConfig = Type extends DrizzleObjectRef<Types>
          ? Type[typeof drizzleTableKey]
          : Types['DrizzleRelationSchema'][Type & keyof Types['DrizzleRelationSchema']],
        Shape extends {} = Type extends DrizzleInterfaceRef<
          Types,
          keyof Types['DrizzleRelationSchema'],
          infer S
        >
          ? S & { [drizzleTableName]?: TableConfig['tsName'] }
          : BuildQueryResult<Types['DrizzleRelationSchema'], TableConfig, true> & {
              [drizzleTableName]?: Type;
            },
      >(
        type: Type,
        fieldName: string,
        field: (t: DrizzleObjectFieldBuilder<Types, TableConfig, false, Shape>) => FieldRef<Types>,
      ) => void;

      drizzleObjectFields: <
        Type extends DrizzleObjectRef<Types> | keyof Types['DrizzleRelationSchema'],
        TableConfig extends TableRelationalConfig = Type extends DrizzleObjectRef<Types>
          ? Type[typeof drizzleTableKey]
          : Types['DrizzleRelationSchema'][Type & keyof Types['DrizzleRelationSchema']],
        Shape extends {} = Type extends DrizzleObjectRef<
          Types,
          keyof Types['DrizzleRelationSchema'],
          infer S
        >
          ? S & { [drizzleTableName]?: TableConfig['tsName'] }
          : BuildQueryResult<Types['DrizzleRelationSchema'], TableConfig, true> & {
              [drizzleTableName]?: Type;
            },
      >(
        type: Type,
        fields: (t: DrizzleObjectFieldBuilder<Types, TableConfig, false, Shape>) => FieldMap,
      ) => void;

      drizzleInterfaceFields: <
        Type extends DrizzleInterfaceRef<Types> | keyof Types['DrizzleRelationSchema'],
        TableConfig extends TableRelationalConfig = Type extends DrizzleObjectRef<Types>
          ? Type[typeof drizzleTableKey]
          : Types['DrizzleRelationSchema'][Type & keyof Types['DrizzleRelationSchema']],
        Shape extends {} = Type extends DrizzleInterfaceRef<
          Types,
          keyof Types['DrizzleRelationSchema'],
          infer S
        >
          ? S & { [drizzleTableName]?: TableConfig['tsName'] }
          : BuildQueryResult<Types['DrizzleRelationSchema'], TableConfig, true> & {
              [drizzleTableName]?: Type;
            },
      >(
        type: Type,
        fields: (t: DrizzleObjectFieldBuilder<Types, TableConfig, false, Shape>) => FieldMap,
      ) => void;
    }

    export interface PothosKindToGraphQLType {
      DrizzleObject: 'Object';
    }

    export interface FieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      DrizzleObject: DrizzleObjectFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      >;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      drizzleField: <
        Args extends InputFieldMap,
        Param extends keyof Types['DrizzleRelationSchema'] | [keyof Types['DrizzleRelationSchema']],
        Nullable extends FieldNullability<Type>,
        ResolveShape,
        ResolveReturnShape,
        Type extends TypeParam<Types> = Param extends [unknown]
          ? [
              ObjectRef<
                Types,
                BuildQueryResult<
                  Types['DrizzleRelationSchema'],
                  Types['DrizzleRelationSchema'][Param[0] & keyof Types['DrizzleRelationSchema']],
                  true
                >
              >,
            ]
          : ObjectRef<
              Types,
              BuildQueryResult<
                Types['DrizzleRelationSchema'],
                Types['DrizzleRelationSchema'][Param & keyof Types['DrizzleRelationSchema']],
                true
              >
            >,
      >(
        options: DrizzleFieldOptions<
          Types,
          ParentShape,
          Type,
          Nullable,
          Args,
          Kind,
          ResolveShape,
          ResolveReturnShape,
          Param
        >,
      ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>>;

      drizzleConnection: 'relay' extends PluginName
        ? <
            Type extends
              | DrizzleRef<Types, keyof Types['DrizzleRelationSchema']>
              | keyof Types['DrizzleRelationSchema'],
            Nullable extends boolean,
            ResolveReturnShape,
            Args extends InputFieldMap = {},
            Shape = Type extends DrizzleRef<Types, keyof Types['DrizzleRelationSchema'], infer S>
              ? S
              : BuildQueryResult<
                  Types['DrizzleRelationSchema'],
                  Types['DrizzleRelationSchema'][Type & keyof Types['DrizzleRelationSchema']],
                  true
                >,
            ConnectionInterfaces extends InterfaceParam<Types>[] = [],
            EdgeInterfaces extends InterfaceParam<Types>[] = [],
          >(
            options: DrizzleConnectionFieldOptions<
              Types,
              ParentShape,
              Type,
              Types['DrizzleRelationSchema'][Type & keyof Types['DrizzleRelationSchema']],
              ObjectRef<Types, Shape>,
              Nullable,
              Args,
              ResolveReturnShape,
              Kind
            >,
            ...args: NormalizeArgs<
              [
                connectionOptions:
                  | ConnectionObjectOptions<
                      Types,
                      ObjectRef<Types, Shape>,
                      false,
                      false,
                      DrizzleConnectionShape<Types, Shape, ParentShape, Args>,
                      ConnectionInterfaces
                    >
                  | ObjectRef<
                      Types,
                      ShapeFromConnection<ConnectionShapeHelper<Types, Shape, false>>
                    >,
                edgeOptions:
                  | ConnectionEdgeObjectOptions<
                      Types,
                      ObjectRef<Types, Shape>,
                      false,
                      DrizzleConnectionShape<Types, Shape, ParentShape, Args>,
                      EdgeInterfaces
                    >
                  | ObjectRef<
                      Types,
                      {
                        cursor: string;
                        node?: Shape | null | undefined;
                      }
                    >,
              ],
              0
            >
          ) => FieldRef<Types, ShapeFromConnection<ConnectionShapeHelper<Types, Shape, Nullable>>>
        : '@pothos/plugin-relay is required to use this method';
    }

    export interface ConnectionFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends OutputType<Types>,
      Nullable extends boolean,
      EdgeNullability extends FieldNullability<[unknown]>,
      NodeNullability extends boolean,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > {}

    export interface ConnectionObjectOptions<
      Types extends SchemaTypes,
      Type extends OutputType<Types>,
      EdgeNullability extends FieldNullability<[unknown]>,
      NodeNullability extends boolean,
      Resolved,
      Interfaces extends InterfaceParam<Types>[] = [],
    > {}

    export interface ConnectionEdgeObjectOptions<
      Types extends SchemaTypes,
      Type extends OutputType<Types>,
      NodeNullability extends boolean,
      Resolved,
      Interfaces extends InterfaceParam<Types>[] = [],
    > {}

    export interface DefaultConnectionArguments {
      first?: number | null | undefined;
      last?: number | null | undefined;
      before?: string | null | undefined;
      after?: string | null | undefined;
    }
    export interface ConnectionShapeHelper<Types extends SchemaTypes, T, Nullable> {}
  }
}

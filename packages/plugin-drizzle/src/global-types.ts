import type {
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
import type {
  AnyRelations,
  BuildQueryResult,
  Column,
  DBQueryConfig,
  ExtractTablesWithRelations,
  SQL,
  TableRelationalConfig,
  TablesRelationalConfig,
} from 'drizzle-orm';
import type { DrizzleObjectFieldBuilder } from './drizzle-field-builder';
import type { DrizzleInterfaceRef, DrizzleRef } from './interface-ref';
import type { DrizzleObjectRef, drizzleTableKey } from './object-ref';
import type {
  AddGraphQLInputTypeOptions,
  DrizzleConnectionFieldOptions,
  DrizzleConnectionShape,
  DrizzleFieldOptions,
  DrizzleFieldWithInputOptions,
  DrizzleInterfaceOptions,
  DrizzleNodeOptions,
  DrizzleObjectFieldOptions,
  DrizzleObjectOptions,
  DrizzlePluginOptions,
  ShapeFromConnection,
  drizzleTableName,
} from './types';

import type { GraphQLInputObjectType } from 'graphql';
import type { PothosDrizzlePlugin } from '.';
import type { DrizzleNodeRef } from './node-ref';

type MapToDbName<T> = {
  [K in keyof T as T[K] extends { dbName: infer K2 extends string } ? K2 : K]: T[K];
};

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      drizzle: PothosDrizzlePlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      drizzle: DrizzlePluginOptions<Types>;
    }

    export interface UserSchemaTypes {
      DrizzleRelations: AnyRelations;
      DrizzleRelationsConfig: TablesRelationalConfig;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      DrizzleRelations: PartialTypes['DrizzleRelations'] & {};
      DrizzleRelationsConfig: ExtractTablesWithRelations<PartialTypes['DrizzleRelations'] & {}>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      drizzleObject: <
        const Interfaces extends InterfaceParam<Types>[],
        Table extends keyof Types['DrizzleRelations']['tables'],
        Selection extends
          | DBQueryConfig<
              'one',
              Types['DrizzleRelationsConfig'],
              Types['DrizzleRelationsConfig'][Table]
            >
          | true,
        Shape = BuildQueryResult<
          Types['DrizzleRelationsConfig'],
          Types['DrizzleRelationsConfig'][Table],
          Selection
        >,
      >(
        table: Table,
        options: DrizzleObjectOptions<Types, Table, Shape, Selection, Interfaces>,
      ) => DrizzleObjectRef<Types, Table, Shape>;

      drizzleInterface: <
        const Interfaces extends InterfaceParam<Types>[],
        Table extends keyof Types['DrizzleRelationsConfig'],
        Selection extends
          | DBQueryConfig<
              'one',
              Types['DrizzleRelationsConfig'],
              Types['DrizzleRelationsConfig'][Table]
            >
          | true,
        Shape = BuildQueryResult<
          Types['DrizzleRelationsConfig'],
          Types['DrizzleRelationsConfig'][Table],
          Selection
        >,
      >(
        table: Table,
        options: DrizzleInterfaceOptions<Types, Table, Shape, Selection, Interfaces>,
      ) => DrizzleInterfaceRef<Types, Table, Shape>;

      drizzleNode: 'relay' extends PluginName
        ? <
            const Interfaces extends InterfaceParam<Types>[],
            Table extends keyof Types['DrizzleRelationsConfig'],
            Selection extends
              | DBQueryConfig<
                  'one',
                  Types['DrizzleRelationsConfig'],
                  Types['DrizzleRelationsConfig'][Table]
                >
              | true,
            IDColumn extends Column,
            Shape = BuildQueryResult<
              Types['DrizzleRelationsConfig'],
              Types['DrizzleRelationsConfig'][Table],
              Selection
            >,
          >(
            table: Table,
            options: DrizzleNodeOptions<Types, Table, Shape, Selection, Interfaces, IDColumn>,
          ) => DrizzleNodeRef<
            Types,
            Table,
            Shape,
            {
              [K in IDColumn['_']['name']]: Extract<IDColumn, { _: { name: K } }>['_']['data'];
            }
          >
        : '@pothos/plugin-relay is required to use this method';

      drizzleObjectField: <
        Type extends DrizzleObjectRef<Types> | keyof Types['DrizzleRelationsConfig'],
        TableConfig extends TableRelationalConfig = Type extends DrizzleObjectRef<Types>
          ? Type[typeof drizzleTableKey]
          : Types['DrizzleRelationsConfig'][Type & keyof Types['DrizzleRelationsConfig']],
        Shape extends {} = Type extends DrizzleObjectRef<
          Types,
          keyof Types['DrizzleRelationsConfig'],
          infer S
        >
          ? S & { [drizzleTableName]?: TableConfig['tsName'] }
          : BuildQueryResult<Types['DrizzleRelationsConfig'], TableConfig, true> & {
              [drizzleTableName]?: Type;
            },
      >(
        type: Type,
        fieldName: string,
        field: (t: DrizzleObjectFieldBuilder<Types, TableConfig, false, Shape>) => FieldRef<Types>,
      ) => void;

      drizzleInterfaceField: <
        Type extends DrizzleInterfaceRef<Types> | keyof Types['DrizzleRelationsConfig'],
        TableConfig extends TableRelationalConfig = Type extends DrizzleObjectRef<Types>
          ? Type[typeof drizzleTableKey]
          : Types['DrizzleRelationsConfig'][Type & keyof Types['DrizzleRelationsConfig']],
        Shape extends {} = Type extends DrizzleInterfaceRef<
          Types,
          keyof Types['DrizzleRelationsConfig'],
          infer S
        >
          ? S & { [drizzleTableName]?: TableConfig['tsName'] }
          : BuildQueryResult<Types['DrizzleRelationsConfig'], TableConfig, true> & {
              [drizzleTableName]?: Type;
            },
      >(
        type: Type,
        fieldName: string,
        field: (t: DrizzleObjectFieldBuilder<Types, TableConfig, false, Shape>) => FieldRef<Types>,
      ) => void;

      drizzleObjectFields: <
        Type extends DrizzleObjectRef<Types> | keyof Types['DrizzleRelationsConfig'],
        TableConfig extends TableRelationalConfig = Type extends DrizzleObjectRef<Types>
          ? Type[typeof drizzleTableKey]
          : Types['DrizzleRelationsConfig'][Type & keyof Types['DrizzleRelationsConfig']],
        Shape extends {} = Type extends DrizzleObjectRef<
          Types,
          keyof Types['DrizzleRelationsConfig'],
          infer S
        >
          ? S & { [drizzleTableName]?: TableConfig['tsName'] }
          : BuildQueryResult<Types['DrizzleRelationsConfig'], TableConfig, true> & {
              [drizzleTableName]?: Type;
            },
      >(
        type: Type,
        fields: (t: DrizzleObjectFieldBuilder<Types, TableConfig, false, Shape>) => FieldMap,
      ) => void;

      drizzleInterfaceFields: <
        Type extends DrizzleInterfaceRef<Types> | keyof Types['DrizzleRelationsConfig'],
        TableConfig extends TableRelationalConfig = Type extends DrizzleObjectRef<Types>
          ? Type[typeof drizzleTableKey]
          : Types['DrizzleRelationsConfig'][Type & keyof Types['DrizzleRelationsConfig']],
        Shape extends {} = Type extends DrizzleInterfaceRef<
          Types,
          keyof Types['DrizzleRelationsConfig'],
          infer S
        >
          ? S & { [drizzleTableName]?: TableConfig['tsName'] }
          : BuildQueryResult<Types['DrizzleRelationsConfig'], TableConfig, true> & {
              [drizzleTableName]?: Type;
            },
      >(
        type: Type,
        fields: (t: DrizzleObjectFieldBuilder<Types, TableConfig, false, Shape>) => FieldMap,
      ) => void;

      drizzleGraphQLOrderBy: 'addGraphQL' extends PluginName
        ? <Table extends keyof Types['DrizzleRelationsConfig']>(
            table: Table,
            type: GraphQLInputObjectType,
            ...args: NormalizeArgs<[options: AddGraphQLInputTypeOptions<Types, {}>]>
          ) => InputObjectRef<Types, SQL | SQL[]>
        : '@pothos/plugin-add-graphql is required to use this method';

      drizzleGraphQLFilters: 'addGraphQL' extends PluginName
        ? <Table extends keyof Types['DrizzleRelationsConfig']>(
            table: Table,
            type: GraphQLInputObjectType,
            ...args: NormalizeArgs<[options: AddGraphQLInputTypeOptions<Types, {}>]>
          ) => InputObjectRef<Types, SQL>
        : '@pothos/plugin-add-graphql is required to use this method';

      drizzleGraphQLInsert: 'addGraphQL' extends PluginName
        ? <Table extends keyof Types['DrizzleRelationsConfig']>(
            table: Table,
            type: GraphQLInputObjectType,
            ...args: NormalizeArgs<[options: AddGraphQLInputTypeOptions<Types, {}>]>
          ) => InputObjectRef<Types, Record<string, unknown>>
        : '@pothos/plugin-add-graphql is required to use this method';

      drizzleGraphQLUpdate: 'addGraphQL' extends PluginName
        ? <Table extends keyof Types['DrizzleRelationsConfig']>(
            table: Table,
            type: GraphQLInputObjectType,
            ...args: NormalizeArgs<[options: AddGraphQLInputTypeOptions<Types, {}>]>
          ) => InputObjectRef<Types, Record<string, unknown>>
        : '@pothos/plugin-add-graphql is required to use this method';
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
        Param extends
          | keyof Types['DrizzleRelationsConfig']
          | [keyof Types['DrizzleRelationsConfig']]
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          | DrizzleRef<any>
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          | [DrizzleRef<any>],
        Nullable extends FieldNullability<Type>,
        ResolveShape,
        ResolveReturnShape,
        Table extends
          keyof Types['DrizzleRelationsConfig'] = Param extends keyof Types['DrizzleRelationsConfig']
          ? Param
          : Param extends [keyof Types['DrizzleRelationsConfig']]
            ? Param[0]
            : // biome-ignore lint/suspicious/noExplicitAny: <explanation>
              Param extends DrizzleRef<any, infer T>
              ? T & keyof Types['DrizzleRelationsConfig']
              : // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                Param extends [DrizzleRef<any, infer T>]
                ? T & keyof Types['DrizzleRelationsConfig']
                : never,
        Type extends TypeParam<Types> = Param extends [unknown]
          ? [
              ObjectRef<
                Types,
                BuildQueryResult<
                  Types['DrizzleRelationsConfig'],
                  Types['DrizzleRelationsConfig'][Table],
                  true
                >
              >,
            ]
          : ObjectRef<
              Types,
              BuildQueryResult<
                Types['DrizzleRelationsConfig'],
                Types['DrizzleRelationsConfig'][Table],
                true
              >
            >,
      >(
        options: DrizzleFieldOptions<
          Types,
          ParentShape,
          Table,
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
            Type extends // biome-ignore lint/suspicious/noExplicitAny: <explanation>
              | DrizzleRef<any, keyof Types['DrizzleRelationsConfig']>
              | keyof Types['DrizzleRelationsConfig'],
            Nullable extends boolean,
            ResolveReturnShape,
            Args extends InputFieldMap = {},
            Shape = Type extends DrizzleRef<
              // biome-ignore lint/suspicious/noExplicitAny: <explanation>
              any,
              keyof Types['DrizzleRelationsConfig'],
              infer S
            >
              ? S
              : BuildQueryResult<
                  Types['DrizzleRelationsConfig'],
                  Types['DrizzleRelationsConfig'][Type & keyof Types['DrizzleRelationsConfig']],
                  true
                >,
            const ConnectionInterfaces extends InterfaceParam<Types>[] = [],
            const EdgeInterfaces extends InterfaceParam<Types>[] = [],
          >(
            options: DrizzleConnectionFieldOptions<
              Types,
              ParentShape,
              Type,
              // biome-ignore lint/suspicious/noExplicitAny: <explanation>
              Types['DrizzleRelationsConfig'][Type extends DrizzleRef<any, infer K>
                ? K
                : Type & keyof Types['DrizzleRelationsConfig']],
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
      drizzleFieldWithInput: 'withInput' extends PluginName
        ? <
            Param extends
              | keyof Types['DrizzleRelationsConfig']
              | [keyof Types['DrizzleRelationsConfig']]
              // biome-ignore lint/suspicious/noExplicitAny: <explanation>
              | DrizzleRef<any>
              // biome-ignore lint/suspicious/noExplicitAny: <explanation>
              | [DrizzleRef<any>],
            Nullable extends FieldNullability<Type>,
            ResolveShape,
            ResolveReturnShape,
            ArgRequired extends boolean,
            Fields extends InputFieldMap = {},
            Args extends InputFieldMap = {},
            InputName extends string = 'input',
            Table extends
              keyof Types['DrizzleRelationsConfig'] = Param extends keyof Types['DrizzleRelationsConfig']
              ? Param
              : Param extends [keyof Types['DrizzleRelationsConfig']]
                ? Param[0]
                : // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                  Param extends DrizzleRef<any, infer T>
                  ? T & keyof Types['DrizzleRelationsConfig']
                  : // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                    Param extends [DrizzleRef<any, infer T>]
                    ? T & keyof Types['DrizzleRelationsConfig']
                    : never,
            Type extends TypeParam<Types> = ObjectRef<
              Types,
              BuildQueryResult<
                Types['DrizzleRelationsConfig'],
                Types['DrizzleRelationsConfig'][Table],
                true
              >
            >,
          >(
            options: DrizzleFieldWithInputOptions<
              Types,
              ParentShape,
              Table,
              Type,
              Nullable,
              Args,
              Kind,
              ResolveShape,
              ResolveReturnShape,
              Param,
              InputName,
              Fields,
              boolean extends ArgRequired
                ? (Types & { WithInputArgRequired: boolean })['WithInputArgRequired']
                : ArgRequired
            >,
          ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>>
        : '@pothos/plugin-with-input is required to use this method';
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

    export interface FieldWithInputBaseOptions<
      Types extends SchemaTypes,
      Args extends InputFieldMap,
      Fields extends InputFieldMap,
      InputName extends string,
      ArgRequired extends boolean,
    > {}
  }
}

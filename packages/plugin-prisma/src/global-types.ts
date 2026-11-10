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
import type { GraphQLResolveInfo } from 'graphql';
import type { PothosPrismaPlugin } from './index.js';
import type { PrismaInterfaceRef, PrismaRef } from './interface-ref.js';
import type { PrismaNodeRef } from './node-ref.js';
import type { PrismaObjectRef, prismaModelKey } from './object-ref.js';
import type { PrismaObjectFieldBuilder as InternalPrismaObjectFieldBuilder } from './prisma-field-builder.js';
import {
  type PrismaClient,
  type PrismaConnectionFieldOptions,
  type PrismaConnectionShape,
  type PrismaFieldOptions,
  type PrismaFieldWithInputOptions,
  type PrismaInterfaceTypeOptions,
  type PrismaModelTypes,
  type PrismaNodeOptions,
  type PrismaObjectFieldOptions,
  type PrismaObjectTypeOptions,
  prismaModelName,
  type ShapeFromConnection,
  type ShapeFromSelection,
} from './types.js';

// Without models in `PrismaTypes` (not set, or set to an empty type), model names would be checked
// against `never`. The model names are then this sentinel, which accepts no name and names the
// setup in the error. It is a branded string, not a string literal, so editors never offer it as a
// completion.
type NoModelsInPrismaTypes<Hint extends string> = string & { readonly noModelsInPrismaTypes: Hint };

type NoModelsInPrismaTypesHint =
  'Set PrismaTypes to the generated types: new SchemaBuilder<{ PrismaTypes: PrismaTypes }>(...)';

// `true` when `Names` is a union and `Model` is the same type as `Default`. Mutual assignability
// is not enough: `any`, or a model that adds optional properties, is assignable both ways. A single
// name reads the same shape either way, so it skips the comparison, which a generic `Model` would
// leave unresolved.
type IsDefaultModelOfNames<Names, Model, Default> =
  IsUnion<Names> extends true
    ? (<T>() => T extends Model ? 1 : 2) extends <T>() => T extends Default ? 1 : 2
      ? true
      : false
    : false;

type IsUnion<T, All = T> = T extends unknown ? ([All] extends [T] ? false : true) : never;

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prisma: PothosPrismaPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      prisma:
        | {
            filterConnectionTotalCount?: boolean;
            client: (ctx: Types['Context']) => PrismaClient;
            dmmf: { datamodel: unknown };
            exposeDescriptions?:
              | boolean
              | {
                  models?: boolean;
                  fields?: boolean;
                };
            onUnusedQuery?: 'error' | 'warn' | ((info: GraphQLResolveInfo) => void) | null;
            maxConnectionSize?: number;
            defaultConnectionSize?: number;
            skipDeferredFragments?: boolean;
          }
        | {
            filterConnectionTotalCount?: boolean;
            client: PrismaClient;
            dmmf: { datamodel: unknown };
            exposeDescriptions?:
              | boolean
              | {
                  models?: boolean;
                  fields?: boolean;
                };
            onUnusedQuery?: 'error' | 'warn' | ((info: GraphQLResolveInfo) => void) | null;
            maxConnectionSize?: number;
            defaultConnectionSize?: number;
            skipDeferredFragments?: boolean;
          };
    }

    export interface UserSchemaTypes {
      PrismaTypes: {};
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      PrismaTypes: [keyof (PartialTypes['PrismaTypes'] & {})] extends [never]
        ? { [Name in NoModelsInPrismaTypes<NoModelsInPrismaTypesHint>]: never }
        : PartialTypes['PrismaTypes'] & {};
    }

    export interface PothosKindToGraphQLType {
      PrismaObject: 'Object';
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
      PrismaObject: PrismaObjectFieldOptions<
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
        Name extends keyof Types['PrismaTypes'],
        const Interfaces extends InterfaceParam<Types>[],
        Model extends PrismaModelTypes & Types['PrismaTypes'][Name],
        Include = unknown,
        Select = unknown,
      >(
        name: Name,
        options: PrismaObjectTypeOptions<
          Types,
          Model,
          Interfaces,
          Include,
          Select,
          ShapeFromSelection<Types, Model, { select: Select; include: Include }>
        >,
      ) => PrismaObjectRef<
        Types,
        Model,
        ShapeFromSelection<Types, Model, { select: Select; include: Include }>
      >;

      prismaInterface: <
        Name extends keyof Types['PrismaTypes'],
        const Interfaces extends InterfaceParam<Types>[],
        Model extends PrismaModelTypes & Types['PrismaTypes'][Name],
        Include = unknown,
        Select = unknown,
      >(
        name: Name,
        options: PrismaInterfaceTypeOptions<
          Types,
          Model,
          Interfaces,
          Include,
          Select,
          ShapeFromSelection<Types, Model, { select: Select; include: Include }>
        >,
      ) => PrismaInterfaceRef<
        Types,
        Model,
        ShapeFromSelection<Types, Model, { select: Select; include: Include }>
      >;

      // While a name is being completed, `Type` is every name at once and `Model` every model. When
      // `Model` is its own default, the `Shape` default reads each name's own shape rather than
      // pairing every name with every model's shape. Any other explicit `Model` keeps
      // `Model['Shape']`. The same holds for the methods below.
      prismaObjectField: <
        Type extends PrismaObjectRef<Types, PrismaModelTypes, {}> | keyof Types['PrismaTypes'],
        Model extends PrismaModelTypes = Type extends PrismaObjectRef<Types, infer M, {}>
          ? M
          : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']],
        Shape extends {} = IsDefaultModelOfNames<
          Type,
          Model,
          Type extends PrismaObjectRef<Types, infer M, {}>
            ? M
            : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']]
        > extends true
          ? Type extends PrismaObjectRef<Types, PrismaModelTypes, infer S>
            ? S & { [prismaModelName]?: Model['Name'] }
            : (PrismaModelTypes &
                Types['PrismaTypes'][Type & keyof Types['PrismaTypes']])['Shape'] & {
                [prismaModelName]?: Type;
              }
          : Type extends PrismaObjectRef<Types, PrismaModelTypes, infer S>
            ? S & { [prismaModelName]?: Model['Name'] }
            : Model['Shape'] & {
                [prismaModelName]?: Type;
              },
      >(
        type: Type,
        fieldName: string,
        field: (t: PrismaObjectFieldBuilder<Types, Model, Shape>) => FieldRef<Types>,
      ) => void;

      prismaInterfaceField: <
        Type extends PrismaInterfaceRef<Types, PrismaModelTypes, {}> | keyof Types['PrismaTypes'],
        Model extends PrismaModelTypes = Type extends PrismaInterfaceRef<Types, infer M, {}>
          ? M
          : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']],
        Shape extends {} = IsDefaultModelOfNames<
          Type,
          Model,
          Type extends PrismaInterfaceRef<Types, infer M, {}>
            ? M
            : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']]
        > extends true
          ? Type extends PrismaInterfaceRef<Types, PrismaModelTypes, infer S>
            ? S & { [prismaModelName]?: Model['Name'] }
            : (PrismaModelTypes &
                Types['PrismaTypes'][Type & keyof Types['PrismaTypes']])['Shape'] & {
                [prismaModelName]?: Type;
              }
          : Type extends PrismaInterfaceRef<Types, PrismaModelTypes, infer S>
            ? S & { [prismaModelName]?: Model['Name'] }
            : Model['Shape'] & {
                [prismaModelName]?: Type;
              },
      >(
        type: Type,
        fieldName: string,
        field: (t: PrismaObjectFieldBuilder<Types, Model, Shape>) => FieldRef<Types>,
      ) => void;

      prismaObjectFields: <
        Type extends PrismaObjectRef<Types, PrismaModelTypes, {}> | keyof Types['PrismaTypes'],
        Model extends PrismaModelTypes = Type extends PrismaObjectRef<Types, infer M, {}>
          ? M
          : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']],
        Shape extends {} = IsDefaultModelOfNames<
          Type,
          Model,
          Type extends PrismaObjectRef<Types, infer M, {}>
            ? M
            : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']]
        > extends true
          ? Type extends PrismaObjectRef<Types, PrismaModelTypes, infer S>
            ? S & { [prismaModelName]?: Model['Name'] }
            : (PrismaModelTypes &
                Types['PrismaTypes'][Type & keyof Types['PrismaTypes']])['Shape'] & {
                [prismaModelName]?: Type;
              }
          : Type extends PrismaObjectRef<Types, PrismaModelTypes, infer S>
            ? S & { [prismaModelName]?: Model['Name'] }
            : Model['Shape'] & {
                [prismaModelName]?: Type;
              },
      >(
        type: Type,
        fields: (t: PrismaObjectFieldBuilder<Types, Model, Shape>) => FieldMap,
      ) => void;

      prismaInterfaceFields: <
        Type extends PrismaInterfaceRef<Types, PrismaModelTypes, {}> | keyof Types['PrismaTypes'],
        Model extends PrismaModelTypes = Type extends PrismaInterfaceRef<Types, infer M, {}>
          ? M
          : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']],
        Shape extends {} = IsDefaultModelOfNames<
          Type,
          Model,
          Type extends PrismaInterfaceRef<Types, infer M, {}>
            ? M
            : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']]
        > extends true
          ? Type extends PrismaInterfaceRef<Types, PrismaModelTypes, infer S>
            ? S & { [prismaModelName]?: Model['Name'] }
            : (PrismaModelTypes &
                Types['PrismaTypes'][Type & keyof Types['PrismaTypes']])['Shape'] & {
                [prismaModelName]?: Type;
              }
          : Type extends PrismaInterfaceRef<Types, PrismaModelTypes, infer S>
            ? S & { [prismaModelName]?: Model['Name'] }
            : Model['Shape'] & {
                [prismaModelName]?: Type;
              },
      >(
        type: Type,
        fields: (t: PrismaObjectFieldBuilder<Types, Model, Shape>) => FieldMap,
      ) => void;

      prismaNode: 'relay' extends PluginName
        ? <
            Name extends keyof Types['PrismaTypes'],
            Interfaces extends InterfaceParam<Types>[] = [],
            Include = unknown,
            Select = unknown,
            UniqueField = unknown,
          >(
            name: Name,
            options: PrismaNodeOptions<
              Types,
              PrismaModelTypes & Types['PrismaTypes'][Name],
              Interfaces,
              Include,
              Select,
              ShapeFromSelection<
                Types,
                PrismaModelTypes & Types['PrismaTypes'][Name],
                { select: Select; include: Include }
              >,
              UniqueField
            >,
          ) => PrismaNodeRef<
            Types,
            PrismaModelTypes & Types['PrismaTypes'][Name],
            ShapeFromSelection<
              Types,
              PrismaModelTypes & Types['PrismaTypes'][Name],
              { select: Select; include: Include }
            >
          >
        : '@pothos/plugin-relay is required to use this method';
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      prismaField: <
        Args extends InputFieldMap,
        TypeParam extends // biome-ignore lint/suspicious/noExplicitAny: this is fine
          | PrismaRef<any, PrismaModelTypes>
          | keyof Types['PrismaTypes']
          | [keyof Types['PrismaTypes']]
          // biome-ignore lint/suspicious/noExplicitAny: this is fine
          | [PrismaRef<any, PrismaModelTypes>],
        Nullable extends FieldNullability<Type>,
        ResolveShape,
        ResolveReturnShape,
        Type extends TypeParam extends [unknown]
          ? [ObjectRef<Types, Model['Shape']>]
          : ObjectRef<Types, Model['Shape']>,
        Model extends PrismaModelTypes = PrismaModelTypes &
          (TypeParam extends [keyof Types['PrismaTypes']]
            ? Types['PrismaTypes'][TypeParam[0]]
            : // biome-ignore lint/suspicious/noExplicitAny: this is fine
              TypeParam extends [PrismaRef<any, PrismaModelTypes>]
              ? TypeParam[0][typeof prismaModelKey]
              : // biome-ignore lint/suspicious/noExplicitAny: this is fine
                TypeParam extends PrismaRef<any, PrismaModelTypes>
                ? TypeParam[typeof prismaModelKey]
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
          ResolveShape,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>>;

      prismaConnection: 'relay' extends PluginName
        ? <
            // biome-ignore lint/suspicious/noExplicitAny: this is fine
            Type extends PrismaRef<any, PrismaModelTypes> | keyof Types['PrismaTypes'],
            Nullable extends boolean,
            ResolveReturnShape,
            Args extends InputFieldMap = {},
            // biome-ignore lint/suspicious/noExplicitAny: this is fine
            Model extends PrismaModelTypes = Type extends PrismaRef<any, infer T>
              ? T
              : PrismaModelTypes & Types['PrismaTypes'][Type & keyof Types['PrismaTypes']],
            // biome-ignore lint/suspicious/noExplicitAny: this is fine
            Shape = Type extends PrismaRef<any, PrismaModelTypes, infer S> ? S : Model['Shape'],
            const ConnectionInterfaces extends InterfaceParam<Types>[] = [],
            const EdgeInterfaces extends InterfaceParam<Types>[] = [],
          >(
            options: PrismaConnectionFieldOptions<
              Types,
              ParentShape,
              Type,
              Model,
              ObjectRef<Types, Model['Shape']>,
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
                      PrismaConnectionShape<Types, Shape, ParentShape, Args>,
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
                      PrismaConnectionShape<Types, Shape, ParentShape, Args>,
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
          ) => FieldRef<
            Types,
            ShapeFromConnection<ConnectionShapeHelper<Types, Model['Shape'], Nullable>>
          >
        : '@pothos/plugin-relay is required to use this method';

      prismaFieldWithInput: 'withInput' extends PluginName
        ? <
            Fields extends InputFieldMap,
            TypeParam extends // biome-ignore lint/suspicious/noExplicitAny: this is fine
              | PrismaRef<any, PrismaModelTypes>
              | keyof Types['PrismaTypes']
              | [keyof Types['PrismaTypes']]
              // biome-ignore lint/suspicious/noExplicitAny: this is fine
              | [PrismaRef<any, PrismaModelTypes>],
            Type extends TypeParam extends [unknown]
              ? [ObjectRef<Types, Model['Shape']>]
              : ObjectRef<Types, Model['Shape']>,
            ResolveShape,
            ResolveReturnShape,
            ArgRequired extends boolean,
            Args extends InputFieldMap = {},
            Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
            InputName extends string = 'input',
            Model extends PrismaModelTypes = PrismaModelTypes &
              (TypeParam extends [keyof Types['PrismaTypes']]
                ? Types['PrismaTypes'][TypeParam[0]]
                : // biome-ignore lint/suspicious/noExplicitAny: this is fine
                  TypeParam extends [PrismaRef<any, PrismaModelTypes>]
                  ? TypeParam[0][typeof prismaModelKey]
                  : // biome-ignore lint/suspicious/noExplicitAny: this is fine
                    TypeParam extends PrismaRef<any, PrismaModelTypes>
                    ? TypeParam[typeof prismaModelKey]
                    : TypeParam extends keyof Types['PrismaTypes']
                      ? Types['PrismaTypes'][TypeParam]
                      : never),
          >(
            options: PrismaFieldWithInputOptions<
              Types,
              ParentShape,
              Kind,
              Args,
              Fields,
              TypeParam,
              Model,
              Type,
              Nullable,
              InputName,
              ResolveShape,
              ResolveReturnShape,
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

    export interface ScopeAuthFieldAuthScopes<
      Types extends SchemaTypes,
      Parent,
      Args extends {} = {},
    > {}
    export interface ScopeAuthContextForAuth<Types extends SchemaTypes, Scopes extends {}> {}

    // `in out Types` is the variance TypeScript measures. Stating it saves measuring it through
    // every method of the schema builder, a fixed cost per program (about 25 ms on TypeScript 7).
    export interface PrismaObjectFieldBuilder<
      in out Types extends SchemaTypes,
      Model extends PrismaModelTypes,
      Shape extends object = Model['Shape'],
    > extends InternalPrismaObjectFieldBuilder<Types, Model, Shape>,
        RootFieldBuilder<Types, Shape, 'PrismaObject'> {}

    export interface FieldWithInputBaseOptions<
      Types extends SchemaTypes,
      Args extends InputFieldMap,
      Fields extends InputFieldMap,
      InputName extends string,
      ArgRequired extends boolean,
    > {}
  }
}

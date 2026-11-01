import type {
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  ObjectRef,
  OutputType,
  PluginName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { PothosPrismaNextPlugin } from './index.js';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type {
  FieldParentShape,
  InterfaceSelectShape,
  ModelInterfaceRefKey,
  ModelObjectRefKey,
  ObjectBaseShape,
  ParamToModelName,
  ParamToTypeParam,
  SelectCheck,
  SelectObjectSpec,
  ShapeFromObjectSelect,
} from './internal-types.js';
import type { PrismaNextNodeRef } from './node-ref.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
import type {
  AnyContract,
  CursorSpec,
  ModelName,
  NameOrVariant,
  PrismaNextConnectionFieldOptions,
  PrismaNextInterfaceOptions,
  PrismaNextObjectFieldOptions,
  PrismaNextObjectOptions,
  PrismaNextPluginOptions,
  PrismaNextRootFieldOptions,
  PrismaNextRootFieldWithInputOptions,
  ResolverCollection,
  Row,
  ShapeFromConnection,
} from './types.js';

/** What a model's root field or connection may name as its `type`. */
type ModelParam<Types extends SchemaTypes> =
  | ModelName<Types>
  | ModelObjectRefKey<ModelName<Types>, Types['PrismaNextContract']>
  | ModelInterfaceRefKey<ModelName<Types>, Types['PrismaNextContract']>;

/** A root field's `type`: a model's type, or a list of it. */
type FieldParam<Types extends SchemaTypes> =
  | ModelName<Types>
  | [ModelName<Types>]
  | ModelObjectRefKey<ModelName<Types>, Types['PrismaNextContract']>
  | ModelInterfaceRefKey<ModelName<Types>, Types['PrismaNextContract']>
  | [ModelObjectRefKey<ModelName<Types>, Types['PrismaNextContract']>]
  | [ModelInterfaceRefKey<ModelName<Types>, Types['PrismaNextContract']>];

/**
 * Checks a type's `select` and offers completions for it. It sits beside a plain `select?: Select`,
 * which stays the only inference site, because inferring through an intersection would narrow a
 * union `Select` to one member.
 */
type TypeSelectCheck<Types extends SchemaTypes, M extends ModelName<Types>, Select> = {
  select?: (readonly (keyof Row<Types, M> & string)[] | SelectObjectSpec<Types, M>) &
    NoInfer<SelectCheck<Types, M, Select>>;
};

/** Node IDs must load back as the same row, so they can't use a nullable column. */
type IdColumn<Types extends SchemaTypes, M extends ModelName<Types>> = {
  [K in keyof Row<Types, M> & string]: null extends Row<Types, M>[K] ? never : K;
}[keyof Row<Types, M> & string];

/** A node ID's decoded values: the column's value, or a tuple for a compound ID. */
type IdValues<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  IDFields,
> = IDFields extends readonly (keyof Row<Types, M>)[]
  ? { -readonly [K in keyof IDFields]: Row<Types, M>[IDFields[K] & keyof Row<Types, M>] }
  : IDFields extends keyof Row<Types, M>
    ? Row<Types, M>[IDFields]
    : never;

/**
 * What `id.parse` may return. A compound ID's array isn't contextually typed as a tuple there, so
 * any array of its columns' values is accepted. The loader checks its length.
 */
type ParsedIdValues<Types extends SchemaTypes, M extends ModelName<Types>, IDFields> =
  | IdValues<Types, M, IDFields>
  | (IDFields extends readonly (keyof Row<Types, M>)[]
      ? readonly Row<Types, M>[IDFields[number] & keyof Row<Types, M>][]
      : never);

type IdFieldShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  IDFields,
> = IDFields extends readonly (infer K extends keyof Row<Types, M>)[]
  ? Pick<Row<Types, M>, K>
  : IDFields extends keyof Row<Types, M>
    ? Pick<Row<Types, M>, IDFields>
    : unknown;

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prismaNext: PothosPrismaNextPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      prismaNext: PrismaNextPluginOptions<Types['PrismaNextContract'], Types['Context']>;
    }

    export interface UserSchemaTypes {
      PrismaNextContract: AnyContract;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      // `Extract` drops `undefined` and keeps the user's exact contract. `Collection` is invariant
      // in its contract, so a new type such as `Contract & object` would not match it.
      PrismaNextContract: undefined extends PartialTypes['PrismaNextContract']
        ? AnyContract
        : Extract<PartialTypes['PrismaNextContract'], AnyContract>;
    }

    export interface PothosKindToGraphQLType {
      PrismaNextObject: 'Object';
    }

    // Filled in by plugin-scope-auth when it's loaded.
    export interface ScopeAuthFieldAuthScopes<
      Types extends SchemaTypes,
      Parent,
      Args extends {} = {},
    > {}
    export interface ScopeAuthContextForAuth<Types extends SchemaTypes, Scopes extends {}> {}

    // Filled in by plugin-relay when it's loaded.
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

    // Filled in by plugin-relay when it's loaded.
    export interface ConnectionShapeHelper<Types extends SchemaTypes, T, Nullable> {}

    export interface DefaultConnectionArguments {
      first?: number | null | undefined;
      last?: number | null | undefined;
      before?: string | null | undefined;
      after?: string | null | undefined;
    }

    // Filled in by plugin-with-input when it's loaded.
    export interface FieldWithInputBaseOptions<
      Types extends SchemaTypes,
      Args extends InputFieldMap,
      Fields extends InputFieldMap,
      InputName extends string,
      ArgRequired extends boolean,
    > {}

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
      // In these options, `Omit` flattens the `NameOrVariant` union, so it is added back.
      prismaObject: <
        const Interfaces extends InterfaceParam<Types>[],
        M extends ModelName<Types>,
        const Select = unknown,
        Shape = ShapeFromObjectSelect<Types, M, Select> &
          InterfaceSelectShape<Types, M, Interfaces>,
      >(
        modelName: M,
        options: Omit<PrismaNextObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
          select?: Select;
        } & TypeSelectCheck<Types, M, Select> &
          NameOrVariant,
      ) => PrismaNextObjectRef<Types, M, Shape>;

      prismaInterface: <
        const Interfaces extends InterfaceParam<Types>[],
        M extends ModelName<Types>,
        const Select = unknown,
        Shape = ShapeFromObjectSelect<Types, M, Select> &
          InterfaceSelectShape<Types, M, Interfaces>,
      >(
        modelName: M,
        options: Omit<PrismaNextInterfaceOptions<Types, M, Shape, Interfaces>, 'select'> & {
          select?: Select;
        } & TypeSelectCheck<Types, M, Select> &
          NameOrVariant,
      ) => PrismaNextInterfaceRef<Types, M, Shape>;

      prismaObjectField: <M extends ModelName<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextObjectRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: PrismaNextObjectFieldBuilder<Types, M, FieldParentShape<Types, M, Shape>>,
        ) => FieldRef<Types, unknown>,
      ) => void;

      prismaObjectFields: <M extends ModelName<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextObjectRef<Types, M, Shape>,
        fields: (
          t: PrismaNextObjectFieldBuilder<Types, M, FieldParentShape<Types, M, Shape>>,
        ) => FieldMap,
      ) => void;

      prismaInterfaceField: <M extends ModelName<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextInterfaceRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: PrismaNextObjectFieldBuilder<Types, M, FieldParentShape<Types, M, Shape>>,
        ) => FieldRef<Types, unknown>,
      ) => void;

      prismaInterfaceFields: <M extends ModelName<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextInterfaceRef<Types, M, Shape>,
        fields: (
          t: PrismaNextObjectFieldBuilder<Types, M, FieldParentShape<Types, M, Shape>>,
        ) => FieldMap,
      ) => void;

      prismaNode: 'relay' extends PluginName
        ? <
            const Interfaces extends InterfaceParam<Types>[],
            M extends ModelName<Types>,
            const Select = unknown,
            Shape = ShapeFromObjectSelect<Types, M, Select> &
              InterfaceSelectShape<Types, M, Interfaces>,
            const IDFields extends
              | IdColumn<Types, M>
              | readonly [IdColumn<Types, M>, ...IdColumn<Types, M>[]] = IdColumn<Types, M>,
            IDShape extends ParsedIdValues<Types, M, IDFields> = IdValues<Types, M, IDFields>,
          >(
            modelName: M,
            options: Omit<PrismaNextObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
              select?: Select;
              id: {
                /** A column, or a tuple of columns for a composite key. */
                field: IDFields;
                description?: string;
                /**
                 * Replaces the default decoding. IDs are then encoded as the plain value, or as a
                 * JSON tuple for a composite key.
                 */
                parse?: (id: string, ctx: Types['Context']) => IDShape;
                resolve?: (
                  parent: Shape & IdFieldShape<Types, M, IDFields>,
                  ctx: Types['Context'],
                ) => string | number;
              };
              /**
               * The collection a node loads from. It defaults to the client's collection for the
               * model, and a variant loads through `orm.Base.variant(value)`.
               */
              collection?:
                | ResolverCollection<Types, M>
                | ((ctx: Types['Context']) => ResolverCollection<Types, M>);
            } & TypeSelectCheck<Types, M, Select> &
              NameOrVariant,
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
        Param extends FieldParam<Types>,
        ResolveReturnShape,
        Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
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
            Param extends FieldParam<Types>,
            ResolveReturnShape,
            Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
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
            Param extends ModelParam<Types>,
            ResolveReturnShape,
            Nullable extends boolean = Types['DefaultFieldNullability'],
            const ConnectionInterfaces extends InterfaceParam<Types>[] = [],
            const EdgeInterfaces extends InterfaceParam<Types>[] = [],
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
          ) => FieldRef<
            Types,
            ShapeFromConnection<
              PothosSchemaTypes.ConnectionShapeHelper<Types, Row<Types, M>, Nullable>
            >
          >
        : '@pothos/plugin-relay is required to use this method';
    }
  }
}

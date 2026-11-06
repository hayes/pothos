import type {
  FieldKind,
  FieldMap,
  FieldNullability,
  InputFieldMap,
  InterfaceParam,
  MaybePromise,
  OutputShape,
  OutputType,
  PluginName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { PothosPrismaNextPlugin } from './index.js';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type { PrismaNextNodeRef } from './node-ref.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { PrismaNextObjectFieldBuilder } from './prisma-next-field-builder.js';
import type { ResolverCollection } from './types/collections.js';
import type {
  ConnectionOrderBy,
  ConnectionResultShape,
  PrismaNextConnectionFieldOptions,
  ShapeFromConnection,
} from './types/connections.js';
import type {
  FieldParam,
  ModelParam,
  NameOrVariant,
  NodeIdFieldOptions,
  ParamToModelKey,
  ParamToTypeParam,
  PrismaNextInterfaceOptions,
  PrismaNextObjectFieldOptions,
  PrismaNextObjectOptions,
  PrismaNextRootFieldOptions,
  PrismaNextRootFieldWithInputOptions,
} from './types/fields.js';
import type {
  AnyContract,
  FieldParentShape,
  IdColumn,
  IdFieldShape,
  IdValues,
  ModelKey,
  ObjectBaseShape,
  ParsedIdValues,
  Row,
} from './types/models.js';
import type { PrismaNextPluginOptions } from './types/plugin-options.js';
import type {
  InterfaceSelectShape,
  ShapeFromObjectSelect,
  TypeSelectCheck,
} from './types/selections.js';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prismaNext: PothosPrismaNextPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      prismaNext: PrismaNextPluginOptions<Types>;
    }

    export interface UserSchemaTypes {
      PrismaNextContract: AnyContract;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      // `Extract` drops `undefined` and keeps the user's exact contract type. `Collection` is
      // invariant in its contract, so even `Contract & object` would not match it.
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
        M extends ModelKey<Types>,
        const Select = unknown,
        Shape = ShapeFromObjectSelect<Types, M, Select> &
          InterfaceSelectShape<Types, M, Interfaces>,
      >(
        modelKey: M,
        options: Omit<PrismaNextObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
          select?: Select;
        } & TypeSelectCheck<Types, M, Select> &
          NameOrVariant,
      ) => PrismaNextObjectRef<Types, M, Shape>;

      prismaInterface: <
        const Interfaces extends InterfaceParam<Types>[],
        M extends ModelKey<Types>,
        const Select = unknown,
        Shape = ShapeFromObjectSelect<Types, M, Select> &
          InterfaceSelectShape<Types, M, Interfaces>,
      >(
        modelKey: M,
        options: Omit<PrismaNextInterfaceOptions<Types, M, Shape, Interfaces>, 'select'> & {
          select?: Select;
        } & TypeSelectCheck<Types, M, Select> &
          NameOrVariant,
      ) => PrismaNextInterfaceRef<Types, M, Shape>;

      // The row argument is `NoInfer`: `M` comes from `type`, and inferring from the row would
      // measure the variance of upstream's row types.
      prismaObjectField: <M extends ModelKey<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextObjectRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: PrismaNextObjectFieldBuilder<
            Types,
            M,
            FieldParentShape<Types, M, Shape>,
            NoInfer<Row<Types, M>>
          >,
        ) => FieldRef<Types, unknown>,
      ) => void;

      prismaObjectFields: <M extends ModelKey<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextObjectRef<Types, M, Shape>,
        fields: (
          t: PrismaNextObjectFieldBuilder<
            Types,
            M,
            FieldParentShape<Types, M, Shape>,
            NoInfer<Row<Types, M>>
          >,
        ) => FieldMap,
      ) => void;

      prismaInterfaceField: <M extends ModelKey<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextInterfaceRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: PrismaNextObjectFieldBuilder<
            Types,
            M,
            FieldParentShape<Types, M, Shape>,
            NoInfer<Row<Types, M>>
          >,
        ) => FieldRef<Types, unknown>,
      ) => void;

      prismaInterfaceFields: <M extends ModelKey<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextInterfaceRef<Types, M, Shape>,
        fields: (
          t: PrismaNextObjectFieldBuilder<
            Types,
            M,
            FieldParentShape<Types, M, Shape>,
            NoInfer<Row<Types, M>>
          >,
        ) => FieldMap,
      ) => void;

      prismaNode: 'relay' extends PluginName
        ? <
            const Interfaces extends InterfaceParam<Types>[],
            M extends ModelKey<Types>,
            const Select = unknown,
            Shape = ShapeFromObjectSelect<Types, M, Select> &
              InterfaceSelectShape<Types, M, Interfaces>,
            const IDFields extends
              | IdColumn<Types, M>
              | readonly [IdColumn<Types, M>, ...IdColumn<Types, M>[]] = IdColumn<Types, M>,
            IDShape extends ParsedIdValues<Types, M, IDFields> = IdValues<Types, M, IDFields>,
          >(
            modelKey: M,
            options: Omit<PrismaNextObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
              select?: Select;
              id: NodeIdFieldOptions<Types, Shape & IdFieldShape<Types, M, IDFields>> & {
                /** A column, or a tuple of columns for a composite key. */
                field: IDFields;
              } & (
                  | { parse?: undefined; resolve?: undefined }
                  | {
                      /**
                       * Replaces the default decoding. IDs are then encoded as the plain value, or
                       * as a JSON tuple for a composite key, unless `resolve` encodes them.
                       */
                      parse: (id: string, ctx: Types['Context']) => IDShape;
                      /** Encodes the ID, which `parse` must decode, so it needs `parse`. */
                      resolve?: (
                        parent: Shape & IdFieldShape<Types, M, IDFields>,
                        ctx: Types['Context'],
                      ) => MaybePromise<OutputShape<Types, 'ID'>>;
                    }
                );
              /**
               * Returns the collection `node` and `nodes` lookups load from, which is used as given.
               * It defaults to the client's collection for the model, narrowed to the model's
               * variant, as with `orm.Base.variant(value)`.
               */
              collection?: (ctx: Types['Context']) => ResolverCollection<Types, NoInfer<M>>;
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
        Param extends FieldParam<Types>,
        ResolveShape,
        ResolveReturnShape,
        Args extends InputFieldMap = {},
        Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
        M extends ModelKey<Types> = ParamToModelKey<Types, Param>,
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
          ResolveShape,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>>;

      prismaFieldWithInput: 'withInput' extends PluginName
        ? <
            Param extends FieldParam<Types>,
            ResolveShape,
            ResolveReturnShape,
            Args extends InputFieldMap = {},
            Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
            Fields extends InputFieldMap = {},
            InputName extends string = 'input',
            ArgRequired extends boolean = boolean extends (Types & {
              WithInputArgRequired: boolean;
            })['WithInputArgRequired']
              ? true
              : (Types & { WithInputArgRequired: boolean })['WithInputArgRequired'],
            M extends ModelKey<Types> = ParamToModelKey<Types, Param>,
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
              ResolveShape,
              ResolveReturnShape,
              ArgRequired,
              Kind
            >,
          ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>>
        : '@pothos/plugin-with-input is required to use this method';

      prismaConnection: 'relay' extends PluginName
        ? <
            Param extends ModelParam<Types>,
            ResolveShape,
            ResolveReturnShape,
            Args extends InputFieldMap = {},
            Nullable extends boolean = Types['DefaultFieldNullability'],
            const ConnectionInterfaces extends InterfaceParam<Types>[] = [],
            const EdgeInterfaces extends InterfaceParam<Types>[] = [],
            M extends ModelKey<Types> = ParamToModelKey<Types, Param>,
            OrderBy extends ConnectionOrderBy<Types, M> = ConnectionOrderBy<Types, M>,
          >(
            options: PrismaNextConnectionFieldOptions<
              Types,
              ParentShape,
              M,
              Param,
              Nullable,
              Args,
              OrderBy,
              ResolveReturnShape,
              Kind,
              ResolveShape
            >,
            connectionOptions?:
              | PothosSchemaTypes.ConnectionObjectOptions<
                  Types,
                  PrismaNextObjectRef<Types, M, unknown>,
                  false,
                  false,
                  ConnectionResultShape<ParentShape, Args>,
                  ConnectionInterfaces
                >
              | ObjectRef<Types, unknown>,
            edgeOptions?:
              | PothosSchemaTypes.ConnectionEdgeObjectOptions<
                  Types,
                  PrismaNextObjectRef<Types, M, unknown>,
                  false,
                  ConnectionResultShape<ParentShape, Args>,
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

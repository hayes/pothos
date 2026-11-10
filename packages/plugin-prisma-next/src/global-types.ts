import type {
  FieldKind,
  FieldMap,
  FieldNullability,
  InputFieldMap,
  InterfaceParam,
  OutputType,
  PluginName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { PothosPrismaNextPlugin } from './index.js';
import type { PrismaInterfaceRef } from './interface-ref.js';
import type { PrismaNodeRef } from './node-ref.js';
import type { PrismaObjectRef } from './object-ref.js';
import type { PrismaObjectFieldBuilder as InternalPrismaObjectFieldBuilder } from './prisma-field-builder.js';
import type { ResolverCollection } from './types/collections.js';
import type {
  ConnectionResultShape,
  DefaultEdgesNullability,
  DefaultNodeNullability,
  PrismaConnectionFieldOptions,
  RootConnectionQueryLiteral,
  ShapeFromConnection,
} from './types/connections.js';
import type {
  FieldParam,
  ModelParam,
  NameOrVariant,
  ParamToModelKey,
  ParamToTypeParam,
  PrismaInterfaceOptions,
  PrismaNodeOptions,
  PrismaObjectFieldOptions,
  PrismaObjectOptions,
  PrismaRootFieldOptions,
  PrismaRootFieldWithInputOptions,
} from './types/fields.js';
import type {
  AnyContract,
  DiscriminatorField,
  FieldParentShape,
  IdColumn,
  IdValues,
  ModelKey,
  ObjectBaseShape,
  ParsedIdValues,
  Row,
} from './types/models.js';
import type { PrismaPluginOptions } from './types/plugin-options.js';
import type { FieldQueryLiteral } from './types/relations.js';
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
      prisma: PrismaPluginOptions<Types>;
    }

    export interface UserSchemaTypes {
      PrismaContract: AnyContract;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      // `Extract` drops `undefined` and keeps the user's exact contract type. `Collection` is
      // invariant in its contract, so even `Contract & object` would not match it.
      PrismaContract: undefined extends PartialTypes['PrismaContract']
        ? AnyContract
        : Extract<PartialTypes['PrismaContract'], AnyContract>;
    }

    export interface PothosKindToGraphQLType {
      PrismaObject: 'Object';
    }

    // The `t` of prisma type fields. Other plugins extend it by declaration merging.
    export interface PrismaObjectFieldBuilder<
      in out Types extends SchemaTypes,
      in out M extends ModelKey<Types>,
      Shape = unknown,
      in out ExposableShape = Row<Types, M>,
    > extends InternalPrismaObjectFieldBuilder<Types, M, Shape, ExposableShape> {}

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
      // In these options, `Omit` flattens the `NameOrVariant` union, so it is added back.
      prismaObject: <
        const Interfaces extends InterfaceParam<Types>[],
        M extends ModelKey<Types>,
        const Select = unknown,
        Shape = ShapeFromObjectSelect<Types, M, Select> &
          InterfaceSelectShape<Types, M, Interfaces>,
      >(
        modelKey: M,
        options: Omit<PrismaObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
          select?: Select;
        } & TypeSelectCheck<Types, M, Select> &
          NameOrVariant,
      ) => PrismaObjectRef<Types, M, Shape>;

      prismaInterface: <
        const Interfaces extends InterfaceParam<Types>[],
        M extends ModelKey<Types>,
        const Select = unknown,
        // The plugin adds a discriminated model's discriminator to the interface's select.
        Shape = ShapeFromObjectSelect<Types, M, Select> &
          InterfaceSelectShape<Types, M, Interfaces> &
          Pick<Row<Types, M>, DiscriminatorField<Types, M>>,
      >(
        modelKey: M,
        options: Omit<PrismaInterfaceOptions<Types, M, Shape, Interfaces>, 'select'> & {
          select?: Select;
        } & TypeSelectCheck<Types, M, Select> &
          NameOrVariant,
      ) => PrismaInterfaceRef<Types, M, Shape>;

      // The row argument is `NoInfer`: `M` comes from `type`, and inferring from the row would
      // measure the variance of upstream's row types.
      prismaObjectField: <M extends ModelKey<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaObjectRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: PrismaObjectFieldBuilder<
            Types,
            M,
            FieldParentShape<Types, M, Shape>,
            NoInfer<Row<Types, M>>
          >,
        ) => FieldRef<Types, unknown>,
      ) => void;

      prismaObjectFields: <M extends ModelKey<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaObjectRef<Types, M, Shape>,
        fields: (
          t: PrismaObjectFieldBuilder<
            Types,
            M,
            FieldParentShape<Types, M, Shape>,
            NoInfer<Row<Types, M>>
          >,
        ) => FieldMap,
      ) => void;

      prismaInterfaceField: <M extends ModelKey<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaInterfaceRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: PrismaObjectFieldBuilder<
            Types,
            M,
            FieldParentShape<Types, M, Shape>,
            NoInfer<Row<Types, M>>
          >,
        ) => FieldRef<Types, unknown>,
      ) => void;

      prismaInterfaceFields: <M extends ModelKey<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaInterfaceRef<Types, M, Shape>,
        fields: (
          t: PrismaObjectFieldBuilder<
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
            options: PrismaNodeOptions<Types, M, Interfaces, Select, Shape, IDFields, IDShape>,
          ) => PrismaNodeRef<Types, M, Shape, IDShape>
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
        QueryLiteral extends FieldQueryLiteral<Types, M> = FieldQueryLiteral<Types, M>,
      >(
        options: PrismaRootFieldOptions<
          Types,
          ParentShape,
          Param,
          Type,
          Nullable,
          Args,
          ResolveShape,
          ResolveReturnShape,
          Kind,
          M,
          QueryLiteral
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
            QueryLiteral extends FieldQueryLiteral<Types, M> = FieldQueryLiteral<Types, M>,
          >(
            options: PrismaRootFieldWithInputOptions<
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
              Kind,
              M,
              QueryLiteral
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
            QueryLiteral extends RootConnectionQueryLiteral<Types, M> = RootConnectionQueryLiteral<
              Types,
              M
            >,
            Returned extends ResolverCollection<Types, M> | null = ResolverCollection<Types, M>,
            EdgeNullability extends FieldNullability<[unknown]> = DefaultEdgesNullability<Types>,
            NodeNullability extends boolean = DefaultNodeNullability<Types>,
          >(
            options: PrismaConnectionFieldOptions<
              Types,
              ParentShape,
              M,
              Param,
              Nullable,
              Args,
              QueryLiteral,
              ResolveReturnShape,
              Kind,
              ResolveShape,
              Returned,
              EdgeNullability,
              NodeNullability
            >,
            connectionOptions?:
              | PothosSchemaTypes.ConnectionObjectOptions<
                  Types,
                  PrismaObjectRef<Types, M, unknown>,
                  EdgeNullability,
                  NodeNullability,
                  ConnectionResultShape<ParentShape, Args>,
                  ConnectionInterfaces
                >
              | ObjectRef<Types, unknown>,
            edgeOptions?:
              | PothosSchemaTypes.ConnectionEdgeObjectOptions<
                  Types,
                  PrismaObjectRef<Types, M, unknown>,
                  NodeNullability,
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

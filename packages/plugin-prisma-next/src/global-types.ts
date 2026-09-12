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
import type { PothosPrismaNextPlugin } from './index.js';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type {
  ObjectBaseShape,
  ParamToModelName,
  ParamToTypeParam,
  SelectObjectSpec,
  ShapeFromObjectSelect,
} from './internal-types.js';
import type { PrismaNextNodeRef } from './node-ref.js';
import type { PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
import type {
  AnyContract,
  CollectionFor,
  CursorSpec,
  ModelName,
  PrismaNextConnectionFieldOptions,
  PrismaNextObjectFieldOptions,
  PrismaNextObjectOptions,
  PrismaNextPluginOptions,
  PrismaNextRootFieldOptions,
  PrismaNextRootFieldWithInputOptions,
  Row,
} from './types.js';

/**
 * Shape inferred from a `prismaObject`'s `select` option.
 *
 * Carries only what the user has explicitly declared as a dependency,
 * plus the `[prismaModelKey]?: M` brand the field builder uses to
 * recognise prismaObject parents. Defaulting to the full `Row<M>`
 * would lie about what's actually loaded at runtime — the plugin only
 * pulls columns that some `select` or `t.expose*` named.
 *
 *   - undefined select → brand only.
 *   - Array form `['col', ...]` → brand + picked columns.
 *   - Object form `{ col: true, rel: true, … }` → brand + columns +
 *     relations + function-form keys (counts, aggregates).
 *
 * Field-level `select` on individual `t.field` declarations layers
 * additively on top of this via `ShapeFromSelect`.
 */
type ObjectLevelShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Select,
> = ShapeFromObjectSelect<Types, M, never, Select>;

/**
 * Keys an object-form `select` names that the model doesn't have. Only the object form
 * needs this: TypeScript's excess-property check fires on a fresh literal only against a
 * *concrete* target, so once `Select` is a type parameter `{ email: true, emial: true }`
 * satisfies `SelectObjectSpec` structurally and `emial` rides along.
 */
type UnknownSelectKeys<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Select,
> = Select extends readonly unknown[]
  ? never
  : Select extends object
    ? Exclude<keyof Select, keyof SelectObjectSpec<Types, M>>
    : never;

/**
 * `unknown` when every object-form `select` key is real, otherwise a type that nothing
 * satisfies and whose text names the offending keys. Applied as a second intersected
 * `select` member beside the bare `select?: Select` that does the inferring: `unknown` is
 * the identity of `&`, so a valid select is untouched and an invalid one fails *on the
 * `select` property*.
 *
 * Not a defaulted phantom type parameter: TypeScript checks a parameter default against
 * its constraint at the declaration site, where `Select` is still unresolved.
 */
type ExactSelectCheck<Types extends SchemaTypes, M extends ModelName<Types>, Select> = [
  UnknownSelectKeys<Types, M, Select>,
] extends [never]
  ? unknown
  : {
      // The key *is* the message: TypeScript names the missing required property, so the
      // diagnostic reads as a sentence. The `never` value makes it unsatisfiable.
      [K in UnknownSelectKeys<Types, M, Select> & string as `Unknown key in select: ${K}`]: never;
    };

/**
 * Columns a `prismaNode`'s `id.field` declares — the single column, or every column of a
 * compound tuple.
 *
 * `id.field` is a dependency declaration in its own right: the schema builder registers
 * those columns in the ID field's own selection extensions (`PRISMA_NEXT_FIELD_SELECT`,
 * `schema-builder.ts`) before it calls `id.resolve`, so a custom ID resolver really is
 * handed them. Scoped to `id.resolve`: the selection lives on the `id` field, so other
 * field resolvers on the same type still can't assume the ID columns are present.
 */
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
      // `Extract<…, AnyContract>` drops the optional `undefined` (so this
      // satisfies the `SchemaTypes` constraint that `PrismaNextContract` is an
      // `AnyContract`) while resolving to exactly the user's contract — unlike
      // `& object`, which produced a distinct `Contract & object` type that,
      // because orm-client's `Collection` is invariant in its contract param,
      // degraded the contract-derived method types. Cast-free resolvers that
      // return `db.orm.<M>` are accepted via the model-scoped `ResolverCollection`
      // in `./types` (which omits the mutation terminals — the only part of the
      // surface the constrained contract copy computes differently).
      PrismaNextContract: undefined extends PartialTypes['PrismaNextContract']
        ? AnyContract
        : Extract<PartialTypes['PrismaNextContract'], AnyContract>;
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
        const Select = unknown,
        Shape = ObjectLevelShape<Types, M, Select>,
      >(
        modelName: M,
        options: Omit<PrismaNextObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
          select?: Select;
        },
      ) => PrismaNextObjectRef<Types, M, Shape>;

      prismaInterface: <
        const Interfaces extends InterfaceParam<Types>[],
        M extends ModelName<Types>,
        const Select = unknown,
        Shape = ObjectLevelShape<Types, M, Select>,
      >(
        modelName: M,
        options: Omit<PrismaNextObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
          select?: Select;
        },
      ) => PrismaNextInterfaceRef<Types, M, Shape>;

      /**
       * Add one field to an already-registered prismaObject from another file.
       *
       * A `PrismaNextObjectRef` carries the shape the registered object declared; a
       * model-name string can't see that declaration, so the parent is
       * `ObjectBaseShape` — the brand and nothing else — and the field declares the
       * columns its resolver reads with its own `select`, which layers onto the base
       * additively. `Shape` is the second positional type argument for a caller who
       * wants the full row back.
       */
      prismaObjectField: <M extends ModelName<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextObjectRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: import('./prisma-next-object-field-builder.js').PrismaNextObjectFieldBuilder<
            Types,
            M,
            Shape & { [prismaModelKey]?: M }
          >,
        ) => FieldRef<Types, unknown>,
      ) => void;

      /**
       * Add fields to an already-registered prismaObject from another file. Same
       * parent-shape rule as `prismaObjectField`: a ref carries the declared shape, a
       * model-name string gives the brand-only `ObjectBaseShape`, and each field's own
       * `select` adds the columns its resolver reads.
       */
      prismaObjectFields: <M extends ModelName<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextObjectRef<Types, M, Shape>,
        fields: (
          t: import('./prisma-next-object-field-builder.js').PrismaNextObjectFieldBuilder<
            Types,
            M,
            Shape & { [prismaModelKey]?: M }
          >,
        ) => FieldMap,
      ) => void;

      /**
       * Add one field to an already-registered prismaInterface from another file. Same
       * parent-shape rule as `prismaObjectField`: a ref carries the declared shape, a
       * model-name string gives the brand-only `ObjectBaseShape`, and each field's own
       * `select` adds the columns its resolver reads.
       */
      prismaInterfaceField: <M extends ModelName<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextInterfaceRef<Types, M, Shape>,
        fieldName: string,
        field: (
          t: import('./prisma-next-object-field-builder.js').PrismaNextObjectFieldBuilder<
            Types,
            M,
            Shape & { [prismaModelKey]?: M }
          >,
        ) => FieldRef<Types, unknown>,
      ) => void;

      /**
       * Add fields to an already-registered prismaInterface from another file. Same
       * parent-shape rule as `prismaObjectField`: a ref carries the declared shape, a
       * model-name string gives the brand-only `ObjectBaseShape`, and each field's own
       * `select` adds the columns its resolver reads.
       */
      prismaInterfaceFields: <M extends ModelName<Types>, Shape = ObjectBaseShape<Types, M>>(
        type: M | PrismaNextInterfaceRef<Types, M, Shape>,
        fields: (
          t: import('./prisma-next-object-field-builder.js').PrismaNextObjectFieldBuilder<
            Types,
            M,
            Shape & { [prismaModelKey]?: M }
          >,
        ) => FieldMap,
      ) => void;

      /**
       * Register a prismaObject that also implements the Relay `Node` interface. The
       * parent shape is computed from `select` exactly as `prismaObject` computes it
       * (`ObjectLevelShape`). `Select` is the third positional type argument and `Shape`
       * the fourth, matching `prismaObject`'s ordering.
       */
      prismaNode: 'relay' extends PluginName
        ? <
            const Interfaces extends InterfaceParam<Types>[],
            M extends ModelName<Types>,
            // `undefined`, not `unknown`, is the no-select default so the constraint
            // stays satisfiable; `ShapeFromObjectSelect` maps either to the brand-only
            // base.
            const Select extends
              | readonly (keyof Row<Types, M> & string)[]
              | SelectObjectSpec<Types, M>
              | undefined = undefined,
            Shape = ObjectLevelShape<Types, M, Select>,
            IDShape = string,
            const IDFields extends
              | (keyof Row<Types, M> & string)
              | readonly [
                  keyof Row<Types, M> & string,
                  ...(keyof Row<Types, M> & string)[],
                ] = keyof Row<Types, M> & string,
          >(
            modelName: M,
            options: Omit<PrismaNextObjectOptions<Types, M, Shape, Interfaces>, 'select'> & {
              select?: Select;
              id: {
                /** Column name or non-empty tuple for composite primary keys (encoded as a JSON array). */
                field: IDFields;
                description?: string;
                /** Restore nonstandard ORM values such as Temporal and Decimal IDs. */
                codecs?: {
                  [Key in keyof Row<Types, M>]?: import('./utils/cursors.js').CursorValueCodec<
                    Row<Types, M>[Key]
                  >;
                };
                parse?: (id: string, ctx: Types['Context']) => IDShape;
                /**
                 * The parent is the object-level shape plus whatever `id.field`
                 * named — those columns are selected for this field, so reading
                 * them needs no extra `select`.
                 */
                resolve?: (
                  parent: Shape & IdFieldShape<Types, M, IDFields>,
                  ctx: Types['Context'],
                ) => string | number;
              };
              collection:
                | CollectionFor<Types, M>
                | ((ctx: Types['Context']) => CollectionFor<Types, M>);
              // The bare `select?: Select` above is the inference site; this intersected
              // member is the exactness check.
            } & { select?: ExactSelectCheck<Types, M, Select> },
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

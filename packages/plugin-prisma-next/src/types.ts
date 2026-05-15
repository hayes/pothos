/**
 * `AnyContract = Contract<SqlStorage>` because orm-client's `Collection`
 * type requires SQL storage and the mapper emits SQL-shaped calls
 * (`combine`, callback-form `.where`). Mongo support would need a
 * parallel mapper + field builders, not a generalization of this one.
 */
import type {
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldOptionsFromKind,
  InferredFieldOptionKeys,
  InputFieldMap,
  InputFieldsFromShape,
  InputShapeFromFields,
  InterfaceParam,
  MaybePromise,
  ObjectRef,
  ObjectTypeOptions,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { Contract } from '@prisma-next/contract/types';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import type {
  Collection,
  CollectionModelName,
  DefaultCollectionTypeState,
  DefaultModelRow,
  IncludeRefinementCollection,
  IsToManyRelation,
  ModelAccessor,
  ShorthandWhereFilter,
} from '@prisma-next/sql-orm-client';
import type { GraphQLResolveInfo } from 'graphql';
import type {
  ExtractModel,
  RelationRef,
  SelectObjectSpec,
  ShapeFromSelect,
  ValidateFieldSelect,
} from './internal-types';
import type { PrismaNextObjectRef, prismaModelKey } from './object-ref';
import type { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder';

export type AnyContract = Contract<SqlStorage>;

// When `PrismaNextContract` is left at the loose `AnyContract` default,
// `CollectionModelName` collapses to a wide `string`. Rewriting to a
// sentinel literal makes autocomplete point at the setup step instead
// of silently typing every relation-name arg as `string`.
type ModelNameSentinel =
  'Set PrismaNextContract on SchemaTypes: new SchemaBuilder<{ PrismaNextContract: typeof contract }>(...)';

export type ModelName<Types extends SchemaTypes> = Types['PrismaNextContract'] extends AnyContract
  ? CollectionModelName<Types['PrismaNextContract']> extends infer N extends string
    ? string extends N
      ? ModelNameSentinel
      : N
    : ModelNameSentinel
  : ModelNameSentinel;

export type Row<Types extends SchemaTypes, M extends ModelName<Types>> = DefaultModelRow<
  Types['PrismaNextContract'],
  M
>;

// `& AnyContract` satisfies orm-client's `Collection` constraint when
// `Types['PrismaNextContract']` is a subtype TS can't otherwise narrow.
export type CollectionFor<Types extends SchemaTypes, M extends ModelName<Types>> = Collection<
  Types['PrismaNextContract'] & AnyContract,
  M
>;

export interface PrismaNextPluginOptions<TContract extends AnyContract> {
  readonly contract: TContract;
  readonly defaultConnectionSize?: number;
  readonly maxConnectionSize?: number;
  /** When true (default), `@defer`-ed fragments don't drive the preload. */
  readonly skipDeferredFragments?: boolean;
}

// orm-client's `RelationNames<C, M>` / `RelatedModelName<C, M, R>` pass
// through `RelationsOf` → `ExactRecord` which collapses to
// `Record<string, never>` in generic positions. Hand-rolled indexed
// access defers resolution and unifies cleanly.
export type RelationKeys<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
> = keyof Types['PrismaNextContract']['models'][M]['relations'] & string;

export type RelatedModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = Types['PrismaNextContract']['models'][M]['relations'][R] extends {
  readonly to: infer To extends ModelName<Types>;
}
  ? To
  : never;

export type IsToMany<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = IsToManyRelation<Types['PrismaNextContract'], M, R>;

// Falls back to wide `RelationKeys` when the contract is loose — without
// literal cardinality info, the narrowing would collapse to `never` and
// reject every call. The runtime cardinality check still fires.
export type ToManyRelationKeys<Types extends SchemaTypes, M extends ModelName<Types>> =
  string extends RelationKeys<Types, M>
    ? RelationKeys<Types, M>
    : {
        [R in RelationKeys<Types, M>]: IsToMany<Types, M, R> extends true ? R : never;
      }[RelationKeys<Types, M>];

// TODO: drop in favor of orm-client's `IsToOneRelationNullable` once exported.
type AnyFieldNullable<
  TContract extends AnyContract,
  M extends string,
  Locals extends readonly string[],
> = Locals[number] extends infer F extends string
  ? TContract['models'][M] extends {
      readonly fields: infer Fields extends Record<string, { readonly nullable: boolean }>;
    }
    ? F extends keyof Fields
      ? Fields[F]['nullable'] extends true
        ? true
        : false
      : false
    : false
  : false;

export type DefaultRelationNullable<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> =
  IsToMany<Types, M, R> extends true
    ? false
    : Types['PrismaNextContract']['models'][M]['relations'][R] extends {
          readonly on: { readonly localFields: infer Locals extends readonly string[] };
        }
      ? AnyFieldNullable<Types['PrismaNextContract'], M, Locals> extends true
        ? true
        : false
      : true;

export interface RelationQueryLiteral<Types extends SchemaTypes, M extends ModelName<Types>> {
  where?:
    | ShorthandWhereFilter<Types['PrismaNextContract'], M>
    | ((accessor: ModelAccessor<Types['PrismaNextContract'], M>) => unknown);
  orderBy?: (accessor: ModelAccessor<Types['PrismaNextContract'], M>) => unknown;
  take?: number;
  skip?: number;
}

export type RelationQuery<
  Types extends SchemaTypes,
  ParentModel extends ModelName<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Args extends InputFieldMap,
> =
  | RelationQueryLiteral<Types, RelatedModel<Types, ParentModel, RelName>>
  | ((
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
    ) => RelationQueryLiteral<Types, RelatedModel<Types, ParentModel, RelName>>);

export type RelationRefinementCollection<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = IncludeRefinementCollection<
  Types['PrismaNextContract'],
  RelatedModel<Types, M, R>,
  DefaultModelRow<Types['PrismaNextContract'], RelatedModel<Types, M, R>>,
  DefaultCollectionTypeState,
  IsToMany<Types, M, R>
>;

export type PrismaNextRelationOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelName<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  RelatedShape,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Row<Types, ParentModel>,
    RelationRef<Types, ParentModel, RelName, RelatedShape>,
    Nullable,
    Args,
    RelatedShape
  >,
  'type' | 'resolve' | InferredFieldOptionKeys
> & {
  description?: string | false;
  type?: PrismaNextObjectRef<Types, RelatedModel<Types, ParentModel, RelName>, RelatedShape>;
  query?: RelationQuery<Types, ParentModel, RelName, Args>;
};

export type PrismaNextObjectOptions<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<ObjectTypeOptions<Types, ObjectRef<Types, Shape>, Shape, Interfaces>, 'fields'> & {
  name?: string;
  /** Synonym for `name` that communicates intent: multiple GraphQL types backed by the same contract model. Wins over `name` when both are set. */
  variant?: string;
  /**
   * Columns and relations to always load when this type is selected,
   * independent of GraphQL field selection. Accepts the legacy
   * column-name array form or the object form (matching `t.field`'s
   * select):
   *
   *   - Array: `select: ['firstName', 'email']` (columns only)
   *   - Object: `select: { firstName: true, posts: true }` — columns
   *     + relations; relations get auto-included on every row, visible
   *     to any field's resolver via `parent[rel]`.
   *
   * Function values for relations work too: `select: { posts: (sub) => ({...}) }`
   * — inner keys become flat properties on each row.
   */
  select?: readonly (keyof Row<Types, M> & string)[] | SelectObjectSpec<Types, M>;
  fields?: (
    // ExposableShape passed explicitly as Row<Types, M> rather than
    // relying on the class default. Monaco's TS doesn't aggressively
    // expand the default `Row<Types, M>` when Types is a complex
    // SchemaTypes, leaving ExposableShape opaque inside ExposeNullability
    // — which then takes the strict branch and demands `nullable: true`
    // on every column.
    t: PrismaNextObjectFieldBuilder<Types, M, Shape & { [prismaModelKey]?: M }, Row<Types, M>>,
  ) => FieldMap;
};

export type PrismaNextRootFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Param,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  ResolveReturnShape,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args,
    FieldKind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | InferredFieldOptionKeys
> & {
  type: Param;
  // Resolver returns either a `Collection` (the plugin auto-applies
  // the selection mapper and materializes via `.all()`, picking
  // single-row vs list based on the GraphQL return type) or the
  // already-materialized row(s) for advanced cases.
  resolve: (
    parent: ParentShape,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<
    | ShapeFromTypeParam<Types, Type, Nullable>
    | import('@prisma-next/sql-orm-client').Collection<
        Types['PrismaNextContract'] & AnyContract,
        // The walker is parametric in the model — keep the Collection
        // generic loose so users can return any model's Collection from
        // a t.prismaField (rare, but legal for proxy fields).
        string
      >
  >;
};

export type PrismaNextRootFieldWithInputOptions<
  Types extends SchemaTypes,
  ParentShape,
  Param,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Fields extends InputFieldMap,
  InputName extends string,
  ResolveReturnShape,
  ArgRequired extends boolean,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args & {
      [K in InputName]: import('@pothos/core').InputFieldRef<
        Types,
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    },
    FieldKind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | 'args' | InferredFieldOptionKeys
> & {
  type: Param;
  args?: Args;
  input: Fields;
  typeOptions?: import('@pothos/plugin-with-input').WithInputTypeOptions<Types, Fields>;
  argOptions?: import('@pothos/plugin-with-input').WithInputArgOptions<
    Types,
    Fields,
    InputName,
    ArgRequired
  >;
  resolve: (
    parent: ParentShape,
    args: InputShapeFromFields<Args> & {
      [K in InputName]: InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null);
    },
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<
    | ShapeFromTypeParam<Types, Type, Nullable>
    | import('@prisma-next/sql-orm-client').Collection<
        Types['PrismaNextContract'] & AnyContract,
        string
      >
  >;
};

/** Single scalar column or a tuple for lexicographic compound cursors. */
export type CursorSpec<Types extends SchemaTypes, M extends ModelName<Types>> =
  | (keyof Row<Types, M> & string)
  | readonly [keyof Row<Types, M> & string, ...(keyof Row<Types, M> & string)[]];

export type PrismaNextConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  M extends ModelName<Types>,
  Param,
  Nullable extends boolean,
  Args extends InputFieldMap,
  Cursor extends CursorSpec<Types, M>,
  ResolveReturnShape,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    PrismaNextObjectRef<Types, M, Row<Types, M>>,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'Arg'> &
      (InputFieldMap extends Args ? {} : Args),
    FieldKind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | 'args' | InferredFieldOptionKeys
> &
  // Nullability generics pinned to `false` to match sister plugins;
  // loosening would need extra type params through `t.prismaConnection`.
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      ParentShape,
      PrismaNextObjectRef<Types, M, Row<Types, M>>,
      Nullable,
      false,
      false,
      Args,
      ResolveReturnShape
    >,
    InferredFieldOptionKeys | 'type' | 'resolve' | 'args'
  > & {
    type: Param;
    cursor: Cursor;
    defaultSize?:
      | number
      | ((
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => number);
    maxSize?:
      | number
      | ((
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => number);
    args?: Args;
    totalCount?:
      | boolean
      | ((
          parent: ParentShape,
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>);
    resolve: (
      parent: ParentShape,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<CollectionFor<Types, M>>;
    /** Sentinel for plugin-prisma porters: chain `.where(...).orderBy(...)` on the collection inside `resolve` instead. */
    query?: 'plugin-prisma-next: chain `.where(...).orderBy(...)` on the collection inside `resolve` instead of passing a `query` option';
  };

export type PrismaNextRelatedConnectionOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelName<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  Cursor extends CursorSpec<Types, RelatedModel<Types, ParentModel, RelName>>,
  RelatedShape = unknown,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Row<Types, ParentModel>,
    PrismaNextObjectRef<Types, RelatedModel<Types, ParentModel, RelName>, RelatedShape>,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'Arg'> &
      (InputFieldMap extends Args ? {} : Args),
    unknown
  >,
  // `resolve` is stripped — t.relatedConnection installs its own
  // resolver. A user-passed resolve would be silently clobbered.
  'type' | 'args' | 'resolve' | InferredFieldOptionKeys
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      Row<Types, ParentModel>,
      PrismaNextObjectRef<Types, RelatedModel<Types, ParentModel, RelName>, RelatedShape>,
      Nullable,
      false,
      false,
      Args,
      unknown
    >,
    InferredFieldOptionKeys | 'type' | 'resolve' | 'args'
  > & {
    cursor: Cursor;
    type?: PrismaNextObjectRef<Types, RelatedModel<Types, ParentModel, RelName>, RelatedShape>;
    defaultSize?:
      | number
      | ((
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => number);
    maxSize?:
      | number
      | ((
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          ctx: Types['Context'],
        ) => number);
    args?: Args;
    totalCount?:
      | boolean
      | ((
          parent: Row<Types, ParentModel>,
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>);
    where?:
      | ShorthandWhereFilter<Types['PrismaNextContract'], RelatedModel<Types, ParentModel, RelName>>
      | ((
          accessor: ModelAccessor<
            Types['PrismaNextContract'],
            RelatedModel<Types, ParentModel, RelName>
          >,
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          context: Types['Context'],
        ) => unknown);
  };

/**
 * Strongly-typed object-form select spec. Resolves `M` from
 * `ParentShape`'s `[prismaModelKey]?: M` brand so keys auto-complete to
 * the parent model's columns + relations, and `sub` in function-form
 * entries is typed as the real prisma-next refinement collection for
 * the relation.
 *
 *   - `true` for columns (load onto parent.col) or simple relation includes
 *   - function `(sub) => { [userKey]: prismaNextValue }` for multi-variant
 *     loads — each inner key surfaces as a parent property via the
 *     per-field overlay wrap. Inner values can be refined Collections
 *     (→ readonly Row[]) or `IncludeScalar` returns from `.count()` /
 *     `.aggregate(…)` / future SQL primitives.
 *
 * The `sub` callback receives the real prisma-next refinement
 * collection; the plugin doesn't intercept `.where`, `.count`, etc. —
 * those pass through to the orm-client unchanged.
 */
export type PrismaNextSelectSpec<Types extends SchemaTypes, ParentShape> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? SelectObjectSpec<Types, M>
      : never
    : never;

// Array-form column keys come from the model's full Row, NOT from the
// parent shape. The parent shape is what's already been declared as a
// dependency; the field-level `select` is what _adds_ new ones, so
// constraining it to current-parent keys would block every valid
// column on a freshly-typed prismaObject (parent starts as just the
// brand sentinel).
type FieldSelectArray<Types extends SchemaTypes, ParentShape> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? readonly (keyof Row<Types, M> & string)[]
      : readonly never[]
    : readonly never[];

export type PrismaNextFieldSelect<Types extends SchemaTypes, ParentShape, Args> =
  | FieldSelectArray<Types, ParentShape>
  | ((args: Args, ctx: Types['Context']) => FieldSelectArray<Types, ParentShape>)
  | PrismaNextSelectSpec<Types, ParentShape>
  | ((args: Args, ctx: Types['Context']) => PrismaNextSelectSpec<Types, ParentShape>);

export type PrismaNextObjectFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Select,
  ResolveReturnShape,
  ShapeWithSelection = ShapeFromSelect<Types, ParentShape, Select>,
> = PothosSchemaTypes.ObjectFieldOptions<
  Types,
  ShapeWithSelection,
  Type,
  Nullable,
  Args,
  ResolveReturnShape
> &
  import('@pothos/core').InferredFieldOptionsByKind<
    Types,
    Types['InferredFieldOptionsKind'],
    ShapeWithSelection,
    Type,
    Nullable,
    Args,
    ResolveReturnShape
  > & {
    select?: Select &
      PrismaNextFieldSelect<Types, ParentShape, InputShapeFromFields<Args>> &
      ValidateFieldSelect<Types, ParentShape, Select>;
  };

export type { Contract } from '@prisma-next/contract/types';
export type { SqlStorage } from '@prisma-next/sql-contract/types';
export type { DefaultModelRow } from '@prisma-next/sql-orm-client';

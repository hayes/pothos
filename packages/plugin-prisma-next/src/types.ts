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
  ScalarName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type {
  ExtractAggregateTypes,
  ExtractCodecTypes,
  SqlStorage,
} from '@prisma/orm-family-sql/contract/types';
import type {
  AggregateBuilder,
  Collection,
  CollectionModelName,
  CollectionTypeState,
  DefaultCollectionTypeState,
  DefaultModelRow,
  ModelAccessor,
  NumericFieldNames,
  ShorthandWhereFilter,
} from '@prisma/orm-family-sql/orm-client';
import type { Contract } from '@prisma/orm-framework/contract/types';
import type { GraphQLResolveInfo } from 'graphql';
import type {
  ExtractModel,
  ParamToModelName,
  RelationRef,
  SelectObjectSpec,
  ShapeFromSelect,
  ValidateFieldSelect,
} from './internal-types.js';
import type { PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
import type { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';

export type AnyContract = Contract<SqlStorage>;

// prisma-next ADR 221 moved model defs from a flat `contract.models` map to
// `contract.domain.namespaces.<nsId>.models`. Scan every namespace so single-
// and multi-namespace contracts both resolve. This mirrors orm-client's
// internal `ScannedModelDef` and keeps the hand-rolled indexed-access strategy
// (deferred resolution unifies cleanly where `RelationsOf` collapses to
// `Record<string, never>` in generic positions).
export type ModelDefOf<TContract extends AnyContract, M extends string> = {
  [Ns in keyof TContract['domain']['namespaces']]: M extends keyof TContract['domain']['namespaces'][Ns]['models']
    ? TContract['domain']['namespaces'][Ns]['models'][M]
    : never;
}[keyof TContract['domain']['namespaces']];

type RelationsOfModel<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, M> extends {
    readonly relations: infer Rels extends Record<string, unknown>;
  }
    ? Rels
    : Record<string, never>;

// The current ORM declares these internally without exporting them.
// `IncludeRefinementCollection` and `IsToManyRelation` reconstruct faithfully
// from the public `Collection` type and the contract's relation cardinality, so
// the plugin keeps re-exporting them. `IncludeRefinementResult` is *not*
// reproduced — it unions orm-client's `IncludeScalar`/`IncludeCombine`, which
// brand their result through a module-private symbol (`RowSelection<T>`'s
// `[RowType]: T`) that can't be matched outside the package, so it is not
// re-exported.
// Revisit these reconstructions when upstream exports the refinement types.
// RC9 still keeps them internal. Aggregate reducer names must follow the emitted
// contract because targets and extensions can contribute new operations.
type IncludeRefinementTerminals =
  | 'all'
  | 'first'
  | 'aggregate'
  | 'groupBy'
  | 'create'
  | 'createAll'
  | 'createAndCount'
  | 'update'
  | 'updateAll'
  | 'updateAndCount'
  | 'delete'
  | 'deleteAll'
  | 'deleteAndCount'
  | 'upsert';
type IncludeRefinementScalarMethods<C extends AnyContract, M extends string> =
  | keyof AggregateBuilder<C, M>
  | 'combine';

export type IncludeRefinementCollection<
  TContract extends AnyContract,
  ModelName extends string,
  RowShape,
  State extends CollectionTypeState,
  IsToManyRel extends boolean,
> = Omit<
  Collection<TContract, ModelName, RowShape, State>,
  | IncludeRefinementTerminals
  | (IsToManyRel extends true ? never : IncludeRefinementScalarMethods<TContract, ModelName>)
>;

export type IsToManyRelation<
  TContract extends AnyContract,
  ModelName extends string,
  RelName extends string,
> = RelName extends keyof RelationsOfModel<TContract, ModelName>
  ? RelationsOfModel<TContract, ModelName>[RelName] extends { readonly cardinality: infer C }
    ? C extends '1:N' | 'N:M'
      ? true
      : false
    : false
  : false;

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

// The namespace id that owns model `M` (ADR 221). For single-namespace
// contracts this resolves to the sole namespace (e.g. `'__unbound__'`).
export type NsIdOf<TContract extends AnyContract, M extends string> = {
  [Ns in keyof TContract['domain']['namespaces']]: M extends keyof TContract['domain']['namespaces'][Ns]['models']
    ? Ns & string
    : never;
}[keyof TContract['domain']['namespaces']];

export type NamespaceOf<Types extends SchemaTypes, M extends ModelName<Types>> = NsIdOf<
  Types['PrismaNextContract'],
  M
>;

// orm-client binds each `db.orm.<Model>` collection to its namespace through
// `WithNsId` (which it does not export). Reconstruct it so `CollectionFor`
// unifies with the namespace-bound collections users hand the plugin
// (`db.orm.User` etc.) without a cast.
type WithNsId<State extends CollectionTypeState, NsId extends string> = Omit<State, 'nsId'> & {
  readonly nsId: NsId;
};

// `PrismaNextContract` is constrained to `AnyContract` on `SchemaTypes`
// (see global-types), so it already satisfies orm-client's `Collection`
// constraint — pass it bare (intersecting with the wide `AnyContract` would
// collapse the concrete model's field/relation accessors to `never`). Bind the
// row + state to the model's namespace so this matches `db.orm.<M>` exactly,
// which is what `ModelCollection`/`orm` produce in 0.14.0.
export type CollectionFor<Types extends SchemaTypes, M extends ModelName<Types>> = Collection<
  Types['PrismaNextContract'],
  M,
  DefaultModelRow<Types['PrismaNextContract'], M, NsIdOf<Types['PrismaNextContract'], M>>,
  WithNsId<DefaultCollectionTypeState, NsIdOf<Types['PrismaNextContract'], M>>
>;

// Mutation terminals (`create`/`update`/`delete`/`upsert` family). The plugin
// only READS a resolver-returned collection (layers `.select`/`.include` and
// materializes); it never calls these.
type CollectionMutationTerminals =
  | 'create'
  | 'createAll'
  | 'createAndCount'
  | 'upsert'
  | 'update'
  | 'updateAll'
  | 'updateAndCount'
  | 'delete'
  | 'deleteAll'
  | 'deleteAndCount';

// What a `t.prismaField`/`prismaNode` resolver may return for model `M`: the
// model-scoped `CollectionFor<Types, M>` with the mutation terminals omitted.
//
// - Model-scoped: it IS `CollectionFor<Types, M>`, so returning another model's
//   collection from an `M` field is a type error.
// - Permissive about construction: omitting the mutation terminals makes the
//   type LESS demanding, so any value carrying the read surface unifies —
//   `db.orm.M` or a filtered collection (the plugin only reads it). This is also what makes a cast-free return work at
//   all: the ONLY part of `Collection` that `Types['PrismaNextContract']` (a
//   constrained copy of the user's contract, forced by the `SchemaTypes`
//   constraint) computes differently from the raw `db.orm` contract is the
//   mutation INPUT shapes (`CreateInput`/`conflictOn` unique-constraints).
//   `Collection` is invariant in its contract param, so without omitting them a
//   raw `Collection<Contract, …>` would not unify; the read surface is identical.
export type ResolverCollection<Types extends SchemaTypes, M extends ModelName<Types>> = Omit<
  CollectionFor<Types, M>,
  CollectionMutationTerminals
>;

/** Existing ordering must match a prefix of the cursor order for the requested direction. */
export type ConnectionCollection<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
> = ResolverCollection<Types, M>;

export type PrismaNextCollections<TContract extends AnyContract> = {
  [M in CollectionModelName<TContract>]?: Collection<
    TContract,
    M,
    DefaultModelRow<TContract, M, NsIdOf<TContract, M>>,
    WithNsId<DefaultCollectionTypeState, NsIdOf<TContract, M>>
  >;
};

export interface PrismaNextPluginOptions<TContract extends AnyContract, Context = object> {
  readonly contract: TContract;
  /** Base model collections for batched fallback loads, including request filters/transactions. */
  readonly collections?:
    | PrismaNextCollections<TContract>
    | ((context: Context) => PrismaNextCollections<TContract>);
  /** Defaults to true when collections are configured; otherwise selections are loaded eagerly. */
  readonly skipDeferredFragments?: boolean;
  readonly defaultConnectionSize?: number;
  readonly maxConnectionSize?: number;
}

// Hand-rolled indexed access into the contract's relation map. orm-client DOES
// export equivalent helpers (`RelationNames<C, M>` / `RelatedModelName`), and at
// 0.14.0 they stay precise through generic positions — their `ExactRecord` only
// collapses when the contract itself is the wide `AnyContract`, which the
// `ModelName` sentinel already guards. TODO(prisma-next bump): consider swapping
// `RelationKeys`/`RelatedModel` to the public `RelationNames`/`RelatedModelName`
// to track upstream (verify type-test precision first).
export type RelationKeys<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
> = keyof RelationsOfModel<Types['PrismaNextContract'], M> & string;

export type RelatedModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = RelationsOfModel<Types['PrismaNextContract'], M>[R] extends {
  // ADR 221: relation targets are `CrossReference` objects, not bare model
  // names. The literal model name lives at `.to.model`.
  readonly to: { readonly model: infer To extends ModelName<Types> };
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
  ? ModelDefOf<TContract, M> extends {
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
    : RelationsOfModel<Types['PrismaNextContract'], M>[R] extends {
          readonly on: { readonly localFields: infer Locals extends readonly string[] };
        }
      ? true extends AnyFieldNullable<Types['PrismaNextContract'], M, Locals>
        ? true
        : false
      : true;

export interface RelationQueryLiteral<Types extends SchemaTypes, M extends ModelName<Types>> {
  where?:
    | ShorthandWhereFilter<Types['PrismaNextContract'], NamespaceOf<Types, M>, M>
    | ((accessor: ModelAccessor<Types['PrismaNextContract'], M, NamespaceOf<Types, M>>) => unknown);
  orderBy?: (
    accessor: ModelAccessor<Types['PrismaNextContract'], M, NamespaceOf<Types, M>>,
  ) => unknown;
  limit?: number;
  offset?: number;
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

/**
 * Numeric columns of a relation's target model — the only valid
 * `field` arg for `sum`/`avg`/`min`/`max`. Falls back to the wide
 * column union when the contract is loose (mirrors `ToManyRelationKeys`'s
 * loose-contract handling so a missing contract doesn't collapse to
 * `never` and reject every call).
 */
export type RelationNumericField<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> =
  string extends ModelName<Types>
    ? string
    : NumericFieldNames<Types['PrismaNextContract'], RelatedModel<Types, M, R>>;

/** A `where` refine on the related rows, before the aggregate runs. */
type RelationAggregateWhere<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  Args extends InputFieldMap,
> =
  | ShorthandWhereFilter<
      Types['PrismaNextContract'],
      NamespaceOf<Types, RelatedModel<Types, M, R>>,
      RelatedModel<Types, M, R>
    >
  | ((
      accessor: ModelAccessor<
        Types['PrismaNextContract'],
        RelatedModel<Types, M, R>,
        NamespaceOf<Types, RelatedModel<Types, M, R>>
      >,
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
    ) => unknown);

/**
 * Shared option surface for the field-level relation-aggregate helpers
 * (`t.relationCount` / `t.relationAggregate`). Strips the inferred field
 * keys (`type`, `resolve`, `select`) the helper owns, then re-adds an
 * optional `where` and `args`. Result type (`number` vs `number | null`)
 * is fixed by the helper, not the option type.
 */
type RelationAggregateBaseOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelName<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Result,
  Nullable extends boolean,
  Args extends InputFieldMap,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Row<Types, ParentModel>,
    TypeParam<Types>,
    Nullable,
    Args,
    Result
  >,
  'type' | 'resolve' | 'select' | InferredFieldOptionKeys
> & {
  description?: string | false;
  where?: RelationAggregateWhere<Types, ParentModel, RelName, Args>;
};

/** Options for `t.relationCount(relation, options?)`. Result is always `number`. */
export type PrismaNextRelationCountOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelName<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
> = RelationAggregateBaseOptions<Types, ParentModel, RelName, number, Nullable, Args>;

/** Aggregate operations are provided by the emitted contract, including extensions. */
export type RelationAggregateOp<Types extends SchemaTypes> = keyof ExtractAggregateTypes<
  Types['PrismaNextContract']
> &
  string;

type AggregateMethod<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Op extends string,
> = Op extends keyof AggregateBuilder<Types['PrismaNextContract'], M, NamespaceOf<Types, M>>
  ? AggregateBuilder<Types['PrismaNextContract'], M, NamespaceOf<Types, M>>[Op]
  : never;

export type RelationAggregateField<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Op extends string,
> =
  AggregateMethod<Types, M, Op> extends (...args: infer Args) => unknown ? Args[0] & string : never;

type StorageFieldCodec<C extends AnyContract, M extends string, F extends string> =
  ModelDefOf<C, M> extends {
    readonly storage: {
      readonly namespaceId: infer Ns extends keyof C['storage']['namespaces'];
      readonly table: infer Table extends string;
      readonly fields: infer Fields;
    };
  }
    ? F extends keyof Fields
      ? Fields[F] extends { readonly column: infer Column extends string }
        ? C['storage']['namespaces'][Ns]['entries']['table'] extends infer Tables
          ? Table extends keyof Tables
            ? Tables[Table] extends { readonly columns: infer Columns }
              ? Column extends keyof Columns
                ? Columns[Column] extends { readonly codecId: infer Id extends string }
                  ? Id
                  : never
                : never
              : never
            : never
          : never
        : never
      : never
    : never;

type AggregateOperation<
  C extends AnyContract,
  Op extends string,
> = Op extends keyof ExtractAggregateTypes<C> ? ExtractAggregateTypes<C>[Op] : never;
type AggregateMetadata<C extends AnyContract, Op extends string, Id> = [Id] extends [never]
  ? AggregateOperation<C, Op> extends { readonly withoutInput: infer Result }
    ? Result
    : never
  : AggregateOperation<C, Op> extends { readonly byCodec: infer Rows }
    ? Id extends keyof Rows
      ? Rows[Id]
      : AggregateOperation<C, Op> extends { readonly anyInput: infer Result }
        ? Result
        : never
    : never;

export type RelationAggregateResult<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Op extends string,
  Field extends string | undefined,
> =
  AggregateMetadata<
    Types['PrismaNextContract'],
    Op,
    Field extends string ? StorageFieldCodec<Types['PrismaNextContract'], M, Field> : never
  > extends { readonly output: infer Codec; readonly nullable: infer Nullable }
    ? Codec extends keyof ExtractCodecTypes<Types['PrismaNextContract']>
      ? ExtractCodecTypes<Types['PrismaNextContract']>[Codec] extends {
          readonly output: infer Result;
        }
        ? Result | (true extends Nullable ? null : never)
        : never
      : never
    : never;

type AggregateScalar<Types extends SchemaTypes, Result> = {
  [Name in ScalarName<Types>]: Types['Scalars'][Name] extends { Output: infer Output }
    ? NonNullable<Result> extends Output
      ? Name
      : never
    : never;
}[ScalarName<Types>];

/** Non-number results require an explicit GraphQL scalar. */
export type PrismaNextRelationAggregateOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelName<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Op extends RelationAggregateOp<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  Field extends
    | RelationAggregateField<Types, RelatedModel<Types, ParentModel, RelName>, Op>
    | undefined = undefined,
> = RelationAggregateBaseOptions<
  Types,
  ParentModel,
  RelName,
  RelationAggregateResult<Types, RelatedModel<Types, ParentModel, RelName>, Op, Field>,
  Nullable,
  Args
> & { op: Op; field?: Field } & (NoInfer<Field> extends string
    ? { field: Field }
    : AggregateOperation<Types['PrismaNextContract'], Op> extends { readonly withoutInput: unknown }
      ? { field?: undefined }
      : { field: never }) &
  (NonNullable<
    RelationAggregateResult<Types, RelatedModel<Types, ParentModel, RelName>, Op, Field>
  > extends number
    ? {
        type?: AggregateScalar<
          Types,
          RelationAggregateResult<Types, RelatedModel<Types, ParentModel, RelName>, Op, Field>
        >;
      }
    : {
        type: AggregateScalar<
          Types,
          RelationAggregateResult<Types, RelatedModel<Types, ParentModel, RelName>, Op, Field>
        >;
      });

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
  // The field's model, derived from `Param`. A defaulted generic (not an inline
  // `ParamToModelName<Types, Param>` in the resolve return) so the resolver
  // isn't an inference source for `Param` — that would pin `Param` to the bare
  // model name and reject the `[Model]` array form passed to `type`.
  M extends ModelName<Types> = ParamToModelName<Types, Param>,
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
  // Resolver returns a `Collection` (the plugin auto-applies
  // the selection mapper and materializes via `.all()`, picking
  // single-row vs list based on the GraphQL return type).
  resolve: (
    parent: ParentShape,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<
    // Only collections preserve the selection needed for nested GraphQL fields.
    | ResolverCollection<Types, NoInfer<M>>
    | Extract<ShapeFromTypeParam<Types, Type, Nullable>, null | undefined>
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
  M extends ModelName<Types> = ParamToModelName<Types, Param>,
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
      // An optional input arg may be omitted entirely, which GraphQL surfaces as
      // `undefined` rather than `null`.
      [K in InputName]:
        | InputShapeFromFields<Fields>
        | (true extends ArgRequired ? never : null | undefined);
    },
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<
    | ResolverCollection<Types, NoInfer<M>>
    | Extract<ShapeFromTypeParam<Types, Type, Nullable>, null | undefined>
  >;
};

/** Cursor columns define the complete, deterministic ordering of a connection. */
export type CursorColumn<Types extends SchemaTypes, M extends ModelName<Types>> = {
  [Key in keyof Row<Types, M> & string]: NonNullable<Row<Types, M>[Key]> extends
    | string
    | number
    | bigint
    | boolean
    | Date
    | Uint8Array
    ?
        | Key
        | {
            field: Key;
            direction?: 'asc' | 'desc';
            nulls?: 'first' | 'last';
            codec?: import('./utils/cursors.js').CursorValueCodec<NonNullable<Row<Types, M>[Key]>>;
          }
    : {
        field: Key;
        direction?: 'asc' | 'desc';
        nulls?: 'first' | 'last';
        codec: import('./utils/cursors.js').CursorValueCodec<NonNullable<Row<Types, M>[Key]>>;
      };
}[keyof Row<Types, M> & string];

export type CursorSpec<Types extends SchemaTypes, M extends ModelName<Types>> =
  | CursorColumn<Types, M>
  | readonly [CursorColumn<Types, M>, ...CursorColumn<Types, M>[]];

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
    ) => MaybePromise<ConnectionCollection<Types, M>>;
    /** Sentinel for plugin-prisma porters: chain `.where(...)` on the collection inside `resolve` instead. */
    query?: 'plugin-prisma-next: chain `.where(...)` on the collection inside `resolve` instead of passing a `query` option';
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
      | ShorthandWhereFilter<
          Types['PrismaNextContract'],
          NamespaceOf<Types, RelatedModel<Types, ParentModel, RelName>>,
          RelatedModel<Types, ParentModel, RelName>
        >
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

export type { SqlStorage } from '@prisma/orm-family-sql/contract/types';
export type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
export type { Contract } from '@prisma/orm-framework/contract/types';

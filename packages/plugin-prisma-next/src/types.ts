import type {
  ArgumentRef,
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldOptionsFromKind,
  InferredFieldOptionKeys,
  InferredFieldOptionsByKind,
  InputFieldMap,
  InputFieldsFromShape,
  InputShapeFromFields,
  InterfaceParam,
  InterfaceRef,
  InterfaceTypeOptions,
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
  CollectionTypeState,
  DefaultCollectionTypeState,
  DefaultModelRow,
  HasRow,
  HasTypeState,
  ModelAccessor,
  ModelCallbackTools,
  OrderableFieldNames,
  RelationPredicate,
  ShorthandWhereFilter,
} from '@prisma/orm-family-sql/orm-client';
import type { OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import type { Contract } from '@prisma/orm-framework/contract/types';
import type { GraphQLResolveInfo } from 'graphql';
import type {
  ExtractModel,
  ObjectBaseShape,
  ParamToModelName,
  RelationRef,
  SelectObjectSpec,
  ShapeFromSelect,
  ValidateFieldSelect,
} from './internal-types.js';
import type { PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
import type { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';

export type AnyContract = Contract<SqlStorage>;

// Mirrors orm-client's internal `ScannedModelDef`; upstream's `RelationsOf` collapses to
// `Record<string, never>` in generic positions.
export type ModelDefOf<
  TContract extends AnyContract,
  M extends string,
> = M extends `${infer Ns}.${infer Bare}`
  ? TContract['domain']['namespaces'][Ns]['models'][Bare]
  : {
      [Ns in keyof TContract['domain']['namespaces']]: M extends keyof TContract['domain']['namespaces'][Ns]['models']
        ? TContract['domain']['namespaces'][Ns]['models'][M]
        : never;
    }[keyof TContract['domain']['namespaces']];

/** A model key is a bare name, or `namespace.Model` for a name several namespaces share. */
export type BareModelName<M extends string> = M extends `${string}.${infer Bare}` ? Bare : M;

type NamespacesWithModel<TContract extends AnyContract, M extends string> = {
  [Ns in keyof TContract['domain']['namespaces']]: M extends keyof TContract['domain']['namespaces'][Ns]['models']
    ? Ns & string
    : never;
}[keyof TContract['domain']['namespaces']];

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

/** Bare unless another namespace shares the name. `to.namespace` may be a branded `NamespaceId`. */
export type ModelKey<TContract extends AnyContract, Ns extends string, M extends string> =
  IsUnion<NamespacesWithModel<TContract, M>> extends true
    ? `${{
        [Key in NamespacesWithModel<TContract, M>]: Ns extends Key ? Key : never;
      }[NamespacesWithModel<TContract, M>]}.${M}`
    : M;

export type ModelKeys<TContract extends AnyContract> = {
  [Ns in keyof TContract['domain']['namespaces'] & string]: {
    [M in keyof TContract['domain']['namespaces'][Ns]['models'] & string]: ModelKey<
      TContract,
      Ns,
      M
    >;
  }[keyof TContract['domain']['namespaces'][Ns]['models'] & string];
}[keyof TContract['domain']['namespaces'] & string];

// A model without relations emits `Record<string, never>`, whose index signature would make every
// string a relation key, so it is dropped.
type OwnRelationsOfModel<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, M> extends {
    readonly relations: infer Rels extends Record<string, unknown>;
  }
    ? string extends keyof Rels
      ? [Rels[string]] extends [never]
        ? {}
        : Rels
      : Rels
    : {};

type RelationsOfModel<TContract extends AnyContract, M extends string> = [
  BaseModelKey<TContract, M>,
] extends [never]
  ? OwnRelationsOfModel<TContract, M>
  : OwnRelationsOfModel<TContract, M> & OwnRelationsOfModel<TContract, BaseModelKey<TContract, M>>;

// orm-client doesn't export its include refinement types, so these are reconstructed.
// `IncludeRefinementResult` can't be: it brands results with a module-private symbol.
type IncludeRefinementTerminals =
  | 'all'
  | 'first'
  | 'firstOrThrow'
  | 'whereUnique'
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

// Without a `PrismaNextContract`, model names would widen to `string`; the sentinel points
// autocomplete at the missing setup instead.
type ModelNameSentinel =
  'Set PrismaNextContract on SchemaTypes: new SchemaBuilder<{ PrismaNextContract: typeof contract }>(...)';

export type ModelName<Types extends SchemaTypes> = Types['PrismaNextContract'] extends AnyContract
  ? ModelKeys<Types['PrismaNextContract']> extends infer N extends string
    ? string extends N
      ? ModelNameSentinel
      : N
    : ModelNameSentinel
  : ModelNameSentinel;

/** `never` for models that aren't variants. */
export type BaseModelKey<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, M> extends {
    readonly base: {
      readonly model: infer Base extends string;
      readonly namespace: infer Ns extends string;
    };
  }
    ? ModelKey<TContract, Ns, Base>
    : never;

// A variant's contract entry holds only its own fields; its rows also carry its base's.
export type Row<Types extends SchemaTypes, M extends ModelName<Types>> = [
  BaseModelKey<Types['PrismaNextContract'], M>,
] extends [never]
  ? DefaultModelRow<
      Types['PrismaNextContract'],
      BareModelName<M>,
      NsIdOf<Types['PrismaNextContract'], M>
    >
  : DefaultModelRow<
      Types['PrismaNextContract'],
      BareModelName<M>,
      NsIdOf<Types['PrismaNextContract'], M>
    > &
      DefaultModelRow<
        Types['PrismaNextContract'],
        BareModelName<BaseModelKey<Types['PrismaNextContract'], M>>,
        NsIdOf<Types['PrismaNextContract'], BaseModelKey<Types['PrismaNextContract'], M>>
      >;

export type VariantModelKeys<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, M> extends { readonly variants: infer Variants }
    ? {
        [Value in keyof Variants]: Variants[Value] extends {
          readonly model: infer Variant extends string;
          readonly namespace: infer Ns extends string;
        }
          ? ModelKey<TContract, Ns, Variant>
          : never;
      }[keyof Variants]
    : never;

type VariantValue<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, BaseModelKey<TContract, M>> extends {
    readonly variants: infer Variants;
  }
    ? {
        [Value in keyof Variants]: Variants[Value] extends { readonly model: BareModelName<M> }
          ? Value
          : never;
      }[keyof Variants]
    : never;

/** `orm.Task.variant('bug')`: the variant's own accessor (`orm.Bug`) isn't filtered. */
export type VariantCollection<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
> = HasTypeState<{
  readonly variantValue: VariantValue<Types['PrismaNextContract'], M>;
}> & {
  readonly modelName: BareModelName<BaseModelKey<Types['PrismaNextContract'], M>>;
};

export type NsIdOf<
  TContract extends AnyContract,
  M extends string,
> = M extends `${infer Ns}.${string}` ? Ns : NamespacesWithModel<TContract, M>;

export type NamespaceOf<Types extends SchemaTypes, M extends ModelName<Types>> = NsIdOf<
  Types['PrismaNextContract'],
  M
>;

// orm-client's `WithNsId` isn't exported; needed so `CollectionFor` matches `db.orm.<Model>`.
type WithNsId<State extends CollectionTypeState, NsId extends string> = Omit<State, 'nsId'> & {
  readonly nsId: NsId;
};

// Intersecting the contract with `AnyContract` would collapse the model's accessors to `never`.
export type CollectionFor<Types extends SchemaTypes, M extends ModelName<Types>> = Collection<
  Types['PrismaNextContract'],
  BareModelName<M>,
  DefaultModelRow<
    Types['PrismaNextContract'],
    BareModelName<M>,
    NsIdOf<Types['PrismaNextContract'], M>
  >,
  WithNsId<DefaultCollectionTypeState, NsIdOf<Types['PrismaNextContract'], M>>
>;

// Upstream's receiver type for collection helpers: it doesn't depend on mutation input types,
// which `Types['PrismaNextContract']` computes differently from `db.orm`.
export type ResolverCollection<Types extends SchemaTypes, M extends ModelName<Types>> = [
  BaseModelKey<Types['PrismaNextContract'], M>,
] extends [never]
  ? HasRow<
      DefaultModelRow<
        Types['PrismaNextContract'],
        BareModelName<M>,
        NsIdOf<Types['PrismaNextContract'], M>
      >
    > &
      HasTypeState<{
        readonly variantValue: undefined;
        readonly nsId: NsIdOf<Types['PrismaNextContract'], M>;
      }> & { readonly modelName: BareModelName<M> }
  : VariantCollection<Types, M>;

/** Existing ordering must match a prefix of the cursor order for the requested direction. */
export type ConnectionCollection<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
> = ResolverCollection<Types, M>;

// A contract typed only as `AnyContract` has no model keys to check collections against.
export type PrismaNextCollections<TContract extends AnyContract> =
  string extends keyof TContract['domain']['namespaces'] ? object : TypedCollections<TContract>;

type TypedCollections<TContract extends AnyContract> = {
  [M in ModelKeys<TContract>]?: Collection<
    TContract,
    BareModelName<M>,
    DefaultModelRow<TContract, BareModelName<M>, NsIdOf<TContract, M>>,
    WithNsId<DefaultCollectionTypeState, NsIdOf<TContract, M>>
  >;
} & {
  [Ns in keyof TContract['domain']['namespaces'] & string]?: {
    [M in keyof TContract['domain']['namespaces'][Ns]['models'] & string]?: Collection<
      TContract,
      M,
      DefaultModelRow<TContract, M, Ns>,
      WithNsId<DefaultCollectionTypeState, Ns>
    >;
  };
};

/** The parts of a client's `context` the plugin reads: the contract and its column codecs. */
export interface PrismaNextExecutionContext<TContract extends AnyContract> {
  readonly contract: TContract;
  readonly contractCodecs: {
    forColumn(namespaceId: string, table: string, column: string): unknown;
  };
}

/** The parts of a Prisma ORM client the plugin reads. */
export interface PrismaNextClient<TContract extends AnyContract> {
  readonly orm: PrismaNextCollections<TContract>;
  readonly context: PrismaNextExecutionContext<TContract>;
}

/** A client for one request, such as a transaction, which may not expose `context`. */
export interface PrismaNextRequestClient<TContract extends AnyContract> {
  readonly orm: PrismaNextCollections<TContract>;
  readonly context?: PrismaNextExecutionContext<TContract>;
}

export type PrismaNextPluginOptions<TContract extends AnyContract, Context = object> = {
  /** Defaults to true: deferred fragments load after the initial result. */
  readonly skipDeferredFragments?: boolean;
  readonly defaultConnectionSize?: number;
  readonly maxConnectionSize?: number;
} & (
  | { readonly client: PrismaNextClient<TContract>; readonly contract?: never }
  | {
      readonly client: (context: Context) => PrismaNextRequestClient<TContract>;
      /** Read when the schema is built, before any request provides a client. */
      readonly contract: TContract;
    }
);

// Upstream's `RelationNames` omits the relations a variant inherits from its base.
export type RelationKeys<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
> = keyof RelationsOfModel<Types['PrismaNextContract'], M> & string;

export type RelatedModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = RelationsOfModel<Types['PrismaNextContract'], M>[R] extends {
  readonly to: {
    readonly model: infer To extends string;
    readonly namespace: infer Ns extends string;
  };
}
  ? ModelKey<Types['PrismaNextContract'], Ns, To> & ModelName<Types>
  : never;

/** A relation's `type` may be the target model's ref or a variant's, which narrows the load. */
export type RelationTypeModel<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> =
  | RelatedModel<Types, M, R>
  | (VariantModelKeys<Types['PrismaNextContract'], RelatedModel<Types, M, R>> & ModelName<Types>);

export type IsToMany<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = IsToManyRelation<Types['PrismaNextContract'], M, R>;

// A loose contract has no literal cardinality, so this falls back to every relation.
export type ToManyRelationKeys<Types extends SchemaTypes, M extends ModelName<Types>> =
  string extends RelationKeys<Types, M>
    ? RelationKeys<Types, M>
    : {
        [R in RelationKeys<Types, M>]: IsToMany<Types, M, R> extends true ? R : never;
      }[RelationKeys<Types, M>];

export type DefaultRelationNullable<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> =
  IsToMany<Types, M, R> extends true
    ? false
    : RelationsOfModel<Types['PrismaNextContract'], M>[R] extends {
          readonly nullable: infer Nullable extends boolean;
        }
      ? Nullable
      : true;

/** A relation's `where`: a shorthand filter object, or the ORM's predicate callback. */
export type RelationWhere<Types extends SchemaTypes, M extends ModelName<Types>> =
  | ShorthandWhereFilter<Types['PrismaNextContract'], NamespaceOf<Types, M>, BareModelName<M>>
  | RelationPredicate<Types['PrismaNextContract'], NamespaceOf<Types, M>, BareModelName<M>>;

export interface RelationQueryLiteral<Types extends SchemaTypes, M extends ModelName<Types>> {
  where?: RelationWhere<Types, M>;
  orderBy?: (
    accessor: ModelAccessor<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>,
    tools: ModelCallbackTools<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>,
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
  BareModelName<RelatedModel<Types, M, R>>,
  DefaultModelRow<
    Types['PrismaNextContract'],
    BareModelName<RelatedModel<Types, M, R>>,
    NamespaceOf<Types, RelatedModel<Types, M, R>>
  >,
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
  // Only what the type's `select` declared; other columns load only if the query selects them.
  ParentShape = ObjectBaseShape<Types, ParentModel>,
  Query = RelationQuery<Types, ParentModel, RelName, Args>,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    ParentShape,
    RelationRef<Types, ParentModel, RelName, RelatedShape>,
    Nullable,
    Args,
    RelatedShape
  >,
  'type' | 'resolve' | InferredFieldOptionKeys
> & {
  description?: string | false;
  type?: PrismaNextObjectRef<Types, RelationTypeModel<Types, ParentModel, RelName>, RelatedShape>;
  query?: Query & NoInfer<ExactRelationQuery<Query>>;
};

/** `Query` is inferred from the literal rather than checked, so unknown keys need rejecting. */
type ExactRelationQuery<Query> = Query extends (...args: never[]) => unknown
  ? unknown
  : { [K in Exclude<keyof Query, keyof RelationQueryLiteral<SchemaTypes, never>>]: never };

/** A `query` can filter a to-one relation's row out, so it makes the field nullable by default. */
export type RelationNullable<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  Query,
> = undefined extends Query
  ? DefaultRelationNullable<Types, M, R>
  : IsToMany<Types, M, R> extends true
    ? false
    : true;

type RelationAggregateWhere<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  Args extends InputFieldMap,
> =
  | ShorthandWhereFilter<
      Types['PrismaNextContract'],
      NamespaceOf<Types, RelatedModel<Types, M, R>>,
      BareModelName<RelatedModel<Types, M, R>>
    >
  | ((
      accessor: ModelAccessor<
        Types['PrismaNextContract'],
        BareModelName<RelatedModel<Types, M, R>>,
        NamespaceOf<Types, RelatedModel<Types, M, R>>
      >,
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
      tools: ModelCallbackTools<
        Types['PrismaNextContract'],
        BareModelName<RelatedModel<Types, M, R>>,
        NamespaceOf<Types, RelatedModel<Types, M, R>>
      >,
    ) => unknown);

type RelationAggregateBaseOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelName<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Result,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ParentShape = ObjectBaseShape<Types, ParentModel>,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    ParentShape,
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

export type PrismaNextRelationCountOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelName<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ParentShape = ObjectBaseShape<Types, ParentModel>,
> = RelationAggregateBaseOptions<Types, ParentModel, RelName, number, Nullable, Args, ParentShape>;

/** MySQL contracts emit `Record<string, never>`: the target has no aggregate operations. */
export type HasAggregates<Types extends SchemaTypes> = string extends keyof ExtractAggregateTypes<
  Types['PrismaNextContract']
>
  ? false
  : true;

/** `totalCount: true` runs a count aggregate, so it needs a target that has them. */
export type TotalCountFlag<Types extends SchemaTypes> =
  HasAggregates<Types> extends true ? boolean : false;

export type RelationAggregateOp<Types extends SchemaTypes> =
  HasAggregates<Types> extends true
    ? keyof ExtractAggregateTypes<Types['PrismaNextContract']> & string
    : never;

type AggregateMethod<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Op extends string,
> = Op extends keyof AggregateBuilder<
  Types['PrismaNextContract'],
  BareModelName<M>,
  NamespaceOf<Types, M>
>
  ? AggregateBuilder<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>[Op]
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

/** The fields mapped to a model's primary key columns; `never` when its table declares none. */
type PrimaryKeyFields<C extends AnyContract, M extends string> =
  ModelDefOf<C, M> extends {
    readonly storage: {
      readonly namespaceId: infer Ns extends keyof C['storage']['namespaces'];
      readonly table: infer Table extends string;
      readonly fields: infer Fields;
    };
  }
    ? C['storage']['namespaces'][Ns]['entries']['table'] extends infer Tables
      ? Table extends keyof Tables
        ? Tables[Table] extends {
            readonly primaryKey: { readonly columns: infer Columns extends readonly string[] };
          }
          ? {
              [F in keyof Fields]: Fields[F] extends { readonly column: Columns[number] }
                ? F
                : never;
            }[keyof Fields] &
              string
          : never
        : never
      : never
    : never;

/** The key the loader reloads a model's rows by. A variant shares its base's key. */
export type IdentityFields<Types extends SchemaTypes, M extends ModelName<Types>> = [
  PrimaryKeyFields<Types['PrismaNextContract'], M>,
] extends [never]
  ? PrimaryKeyFields<Types['PrismaNextContract'], BaseModelKey<Types['PrismaNextContract'], M>>
  : PrimaryKeyFields<Types['PrismaNextContract'], M>;

/**
 * What a field returning a model's type may resolve to: a row with its key, from which the loader
 * reloads any columns the type's fields need. A model without a key needs the whole row.
 */
export type ModelReturnShape<Types extends SchemaTypes, M extends ModelName<Types>> = [
  IdentityFields<Types, M>,
] extends [never]
  ? Row<Types, M>
  : Pick<Row<Types, M>, IdentityFields<Types, M> & keyof Row<Types, M>> & Partial<Row<Types, M>>;

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
  ParentShape = ObjectBaseShape<Types, ParentModel>,
> = RelationAggregateBaseOptions<
  Types,
  ParentModel,
  RelName,
  RelationAggregateResult<Types, RelatedModel<Types, ParentModel, RelName>, Op, Field>,
  Nullable,
  Args,
  ParentShape
> & {
  op: Op;
  // The `NoInfer` alternative gives editors completions while `Field` is still uninferred.
  field?:
    | Field
    | NoInfer<RelationAggregateField<Types, RelatedModel<Types, ParentModel, RelName>, Op>>;
} & (NoInfer<Field> extends string
    ? { field: Field }
    : AggregateOperation<Types['PrismaNextContract'], Op> extends { readonly withoutInput: unknown }
      ? { field?: RelationAggregateField<Types, RelatedModel<Types, ParentModel, RelName>, Op> }
      : { field: RelationAggregateField<Types, RelatedModel<Types, ParentModel, RelName>, Op> }) &
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
> = Omit<
  ObjectTypeOptions<Types, ObjectRef<Types, Shape>, Shape, Interfaces>,
  'fields' | 'isTypeOf'
> &
  PrismaNextTypeOptions<Types, M, Shape> & {
    /** Receives the row as loaded for this type, so read columns listed in `select`. */
    isTypeOf?: (
      row: Shape,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<boolean>;
  };

export type PrismaNextInterfaceOptions<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Shape,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<InterfaceTypeOptions<Types, InterfaceRef<Types, Shape>, Shape, Interfaces>, 'fields'> &
  PrismaNextTypeOptions<Types, M, Shape>;

type PrismaNextTypeOptions<Types extends SchemaTypes, M extends ModelName<Types>, Shape> = {
  name?: string;
  /** Alias for `name` when several types share a model; takes precedence over `name`. */
  variant?: string;
  /** Columns and relations to always load for this type, as a column array or a `select` object. */
  select?: readonly (keyof Row<Types, M> & string)[] | SelectObjectSpec<Types, M>;
  fields?: (
    // Passed explicitly: Monaco leaves the defaulted `Row<Types, M>` opaque, which makes
    // `t.expose*` demand `nullable: true` on every column.
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
  // A defaulted generic so `resolve` doesn't infer `Param` as the bare model and reject `[Model]`.
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
  resolve: (
    parent: ParentShape,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<
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
      [K in InputName]: ArgumentRef<
        Types,
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    },
    FieldKind,
    ParentShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | 'args' | InferredFieldOptionKeys
> &
  PothosSchemaTypes.FieldWithInputBaseOptions<Types, Args, Fields, InputName, ArgRequired> & {
    type: Param;
    resolve: (
      parent: ParentShape,
      args: InputShapeFromFields<Args> & {
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

/** Columns whose codec can be ordered (not bytes, for example). */
type OrderableColumn<Types extends SchemaTypes, M extends ModelName<Types>> =
  | OrderableFieldNames<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>
  | BaseOrderableColumn<Types['PrismaNextContract'], BaseModelKey<Types['PrismaNextContract'], M>>;

type BaseOrderableColumn<TContract extends AnyContract, Base extends string> = [Base] extends [
  never,
]
  ? never
  : OrderableFieldNames<TContract, BareModelName<Base>, NsIdOf<TContract, Base>>;

/** Cursor columns define the complete, deterministic ordering of a connection. */
export type CursorColumn<Types extends SchemaTypes, M extends ModelName<Types>> = {
  [Key in keyof Row<Types, M> & string]: Key extends OrderableColumn<Types, M>
    ? CursorColumnEntry<Key>
    : never;
}[keyof Row<Types, M> & string];

type CursorColumnEntry<Key extends string> =
  | Key
  | {
      field: Key;
      direction?: 'asc' | 'desc';
      /** Placement in the forward order; nullable columns default to last. */
      nulls?: 'first' | 'last';
    };

type ExactCursorEntry<Entry> = Entry extends { field: unknown }
  ? Entry & Record<Exclude<keyof Entry, 'field' | 'direction' | 'nulls'>, never>
  : Entry;

/** Rejects unknown keys on cursor entries, which inference would otherwise accept. */
export type ExactCursor<Cursor> = Cursor extends readonly unknown[]
  ? { [K in keyof Cursor]: ExactCursorEntry<Cursor[K]> }
  : ExactCursorEntry<Cursor>;

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
    cursor: Cursor & NoInfer<ExactCursor<Cursor>>;
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
    /**
     * Direction and null placement for this request. Each item names a cursor column, in cursor
     * order; backward pages reverse it.
     */
    orderBy?: (
      model: ModelAccessor<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
    ) => OrderByItem | readonly OrderByItem[];
    totalCount?:
      | TotalCountFlag<Types>
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
    ) => MaybePromise<
      ConnectionCollection<Types, NoInfer<M>> | (Nullable extends true ? null : never)
    >;
    /** Not supported: chain `.where(...)` on the collection in `resolve` instead. */
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
  ParentShape = ObjectBaseShape<Types, ParentModel>,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    ParentShape,
    PrismaNextObjectRef<Types, RelatedModel<Types, ParentModel, RelName>, RelatedShape>,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'Arg'> &
      (InputFieldMap extends Args ? {} : Args),
    unknown
  >,
  'type' | 'args' | 'resolve' | InferredFieldOptionKeys
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      ParentShape,
      PrismaNextObjectRef<Types, RelatedModel<Types, ParentModel, RelName>, RelatedShape>,
      Nullable,
      false,
      false,
      Args,
      unknown
    >,
    InferredFieldOptionKeys | 'type' | 'resolve' | 'args'
  > & {
    cursor: Cursor & NoInfer<ExactCursor<Cursor>>;
    type?: PrismaNextObjectRef<Types, RelationTypeModel<Types, ParentModel, RelName>, RelatedShape>;
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
    /**
     * Direction and null placement for this request. Each item names a cursor column, in cursor
     * order; backward pages reverse it.
     */
    orderBy?: (
      model: ModelAccessor<
        Types['PrismaNextContract'],
        BareModelName<RelatedModel<Types, ParentModel, RelName>>,
        NamespaceOf<Types, RelatedModel<Types, ParentModel, RelName>>
      >,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
    ) => OrderByItem | readonly OrderByItem[];
    totalCount?:
      | TotalCountFlag<Types>
      | ((
          parent: ParentShape,
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>);
    where?:
      | ShorthandWhereFilter<
          Types['PrismaNextContract'],
          NamespaceOf<Types, RelatedModel<Types, ParentModel, RelName>>,
          BareModelName<RelatedModel<Types, ParentModel, RelName>>
        >
      | ((
          accessor: ModelAccessor<
            Types['PrismaNextContract'],
            BareModelName<RelatedModel<Types, ParentModel, RelName>>,
            NamespaceOf<Types, RelatedModel<Types, ParentModel, RelName>>
          >,
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
          context: Types['Context'],
          tools: ModelCallbackTools<
            Types['PrismaNextContract'],
            BareModelName<RelatedModel<Types, ParentModel, RelName>>,
            NamespaceOf<Types, RelatedModel<Types, ParentModel, RelName>>
          >,
        ) => unknown);
  };

/**
 * `true` loads a column or includes a relation. A function `(sub) => ({ key: value })` receives
 * the relation's refinement collection, and each returned key becomes a property on the parent.
 */
export type PrismaNextSelectSpec<Types extends SchemaTypes, ParentShape> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? SelectObjectSpec<Types, M>
      : never
    : never;

// Keys come from the full row, not the parent shape: the field's `select` adds to the shape.
type FieldSelectArray<Types extends SchemaTypes, ParentShape> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? readonly (keyof Row<Types, M> & string)[]
      : readonly never[]
    : readonly never[];

export type PrismaNextFieldSelect<Types extends SchemaTypes, ParentShape, Args> =
  | FieldSelectArray<Types, ParentShape>
  | ((args: Args, ctx: Types['Context']) => MaybePromise<FieldSelectArray<Types, ParentShape>>)
  | PrismaNextSelectSpec<Types, ParentShape>
  | ((args: Args, ctx: Types['Context']) => MaybePromise<PrismaNextSelectSpec<Types, ParentShape>>);

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
  InferredFieldOptionsByKind<
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

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;

/** The rows a relation loads: a list for a to-many relation, nullable as the field is. */
export type RelationFieldShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  Nullable extends boolean,
> =
  IsToMany<Types, M, R> extends true
    ? readonly Row<Types, RelatedModel<Types, M, R>>[]
    : Row<Types, RelatedModel<Types, M, R>> | (Nullable extends true ? null : never);

export type { SqlStorage } from '@prisma/orm-family-sql/contract/types';
export type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
export type { Contract } from '@prisma/orm-framework/contract/types';

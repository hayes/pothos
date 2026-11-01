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
  Condition,
  DefaultCollectionTypeState,
  DefaultModelRow,
  HasRow,
  HasTypeState,
  ModelAccessor,
  ModelCallbackTools,
  RelationPredicate,
  ShorthandWhereFilter,
} from '@prisma/orm-family-sql/orm-client';
import type { OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import type { Contract } from '@prisma/orm-framework/contract/types';
import type { GraphQLResolveInfo } from 'graphql';
import type {
  ExtractModel,
  FieldParentShape,
  ObjectBaseShape,
  ParamToModelName,
  RelationRef,
  SelectObjectSpec,
  ShapeFromSelect,
  ValidateFieldSelect,
} from './internal-types.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';

export type AnyContract = Contract<SqlStorage>;

// Mirrors orm-client's internal `ScannedModelDef`; upstream's `RelationsOf` collapses to
// `Record<string, never>` in generic positions.
type ModelDefOf<
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
type BareModelName<M extends string> = M extends `${string}.${infer Bare}` ? Bare : M;

type NamespacesWithModel<TContract extends AnyContract, M extends string> = {
  [Ns in keyof TContract['domain']['namespaces']]: M extends keyof TContract['domain']['namespaces'][Ns]['models']
    ? Ns & string
    : never;
}[keyof TContract['domain']['namespaces']];

export type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

/** Bare unless another namespace shares the name. `to.namespace` may be a branded `NamespaceId`. */
type ModelKey<TContract extends AnyContract, Ns extends string, M extends string> =
  IsUnion<NamespacesWithModel<TContract, M>> extends true
    ? `${{
        [Key in NamespacesWithModel<TContract, M>]: Ns extends Key ? Key : never;
      }[NamespacesWithModel<TContract, M>]}.${M}`
    : M;

type ModelKeys<TContract extends AnyContract> = {
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
// Only to-many relations take a refinement, so it keeps the aggregate methods and combine().
type IncludeRefinementCollection<
  TContract extends AnyContract,
  ModelName extends string,
  RowShape,
  State extends CollectionTypeState,
> = Omit<Collection<TContract, ModelName, RowShape, State>, IncludeRefinementTerminals>;

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
type BaseModelKey<TContract extends AnyContract, M extends string> =
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
  ? DefaultModelRow<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>
  : DefaultModelRow<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>> &
      DefaultModelRow<
        Types['PrismaNextContract'],
        BareModelName<BaseModelKey<Types['PrismaNextContract'], M>>,
        NamespaceOf<Types, BaseModelKey<Types['PrismaNextContract'], M>>
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
type VariantCollection<Types extends SchemaTypes, M extends ModelName<Types>> = HasTypeState<{
  readonly variantValue: VariantValue<Types['PrismaNextContract'], M>;
}> & {
  readonly modelName: BareModelName<BaseModelKey<Types['PrismaNextContract'], M>>;
};

type NsIdOf<TContract extends AnyContract, M extends string> = M extends `${infer Ns}.${string}`
  ? Ns
  : NamespacesWithModel<TContract, M>;

type NamespaceOf<Types extends SchemaTypes, M extends string> = NsIdOf<
  Types['PrismaNextContract'],
  M
>;

// orm-client's `WithNsId` isn't exported; needed so `CollectionFor` matches `db.orm.<Model>`.
type WithNsId<State extends CollectionTypeState, NsId extends string> = Omit<State, 'nsId'> & {
  readonly nsId: NsId;
};

export type CollectionFor<Types extends SchemaTypes, M extends ModelName<Types>> = Collection<
  Types['PrismaNextContract'],
  BareModelName<M>,
  DefaultModelRow<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>,
  WithNsId<DefaultCollectionTypeState, NamespaceOf<Types, M>>
>;

// Upstream's receiver type for collection helpers: it doesn't depend on mutation input types,
// which `Types['PrismaNextContract']` computes differently from `db.orm`.
export type ResolverCollection<Types extends SchemaTypes, M extends ModelName<Types>> = [
  BaseModelKey<Types['PrismaNextContract'], M>,
] extends [never]
  ? HasRow<DefaultModelRow<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>> &
      HasTypeState<{
        readonly variantValue: undefined;
        readonly nsId: NamespaceOf<Types, M>;
      }> & { readonly modelName: BareModelName<M> }
  : VariantCollection<Types, M>;

/** What a connection's `resolve` returns: the collection the plugin pages. */
export type ConnectionCollection<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
> = ResolverCollection<Types, M>;

// A contract typed only as `AnyContract` has no model keys to check collections against.
type PrismaNextCollections<TContract extends AnyContract> =
  string extends keyof TContract['domain']['namespaces'] ? object : TypedCollections<TContract>;

// Collections are matched by model name and by the contract on their `ctx` (upstream's
// `CollectionBase.ctx`, internal in rc.22 but also read by Prisma's public types), not
// structurally: comparing each `Collection` against one built from `TContract` costs more than the
// rest of the builder setup, while comparing the contract to itself is an identity check.
interface CollectionOfModel<TContract extends AnyContract, M extends string> {
  readonly modelName: M;
  readonly ctx: { readonly context: { readonly contract: TContract } };
}

type TypedCollections<TContract extends AnyContract> = {
  [M in ModelKeys<TContract>]?: CollectionOfModel<TContract, BareModelName<M>>;
} & {
  [Ns in keyof TContract['domain']['namespaces'] & string]?: {
    [M in keyof TContract['domain']['namespaces'][Ns]['models'] & string]?: CollectionOfModel<
      TContract,
      M
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
  /**
   * Defaults to true: a `relatedConnection`'s `totalCount` applies its `query.where`, so it
   * counts the rows the connection pages. Set to false to count every related row.
   */
  readonly filterConnectionTotalCount?: boolean;
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
> = RelationsOfModel<Types['PrismaNextContract'], M>[R] extends {
  readonly cardinality: '1:N' | 'N:M';
}
  ? true
  : false;

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

/** One ordering of a relation's rows, as the ORM's `orderBy` takes it. */
export type RelationOrderSelector<Types extends SchemaTypes, M extends ModelName<Types>> = (
  accessor: ModelAccessor<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>,
  tools: ModelCallbackTools<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>,
) => OrderByItem;

/** A relation's `orderBy`: a selector, or several applied in order. */
export type RelationOrderBy<Types extends SchemaTypes, M extends ModelName<Types>> =
  | RelationOrderSelector<Types, M>
  | readonly RelationOrderSelector<Types, M>[];

interface RelationQueryLiteral<Types extends SchemaTypes, M extends ModelName<Types>> {
  where?: RelationWhere<Types, M>;
  orderBy?: RelationOrderBy<Types, M>;
  limit?: number;
  offset?: number;
}

/**
 * What a connection applies before paging. `orderBy` sets each cursor column's direction and null
 * placement, in cursor order; backward pages reverse it.
 */
interface ConnectionQueryLiteral<Types extends SchemaTypes, M extends ModelName<Types>> {
  where?: RelationWhere<Types, M>;
  orderBy?: RelationOrderBy<Types, M>;
}

export type ConnectionQuery<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Args extends InputFieldMap,
> =
  | ConnectionQueryLiteral<Types, M>
  | ((
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
    ) => ConnectionQueryLiteral<Types, M>);

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
  DefaultCollectionTypeState
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
  TypeModel extends RelationTypeModel<Types, ParentModel, RelName> = RelationTypeModel<
    Types,
    ParentModel,
    RelName
  >,
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
  type?: PrismaNextObjectRef<Types, TypeModel, RelatedShape>;
  query?: Query & NoInfer<ExactRelationQuery<Query>>;
};

/** `Query` is inferred from the literal rather than checked, so unknown keys need rejecting. */
type ExactRelationQuery<Query> = Query extends (...args: never[]) => unknown
  ? unknown
  : { [K in Exclude<keyof Query, keyof RelationQueryLiteral<SchemaTypes, never>>]: never };

/** Names the conflict in the error for `nullable: false` beside `isNull`. */
interface VariantIsNullRequiresNullable {
  readonly 'isNull can resolve the field to null, so nullable: false is not allowed': true;
}

/** `isNull` can resolve the field to null, so `nullable: false` can't accompany it. */
type VariantNullableOption<IsNull> = [IsNull] extends [never]
  ? boolean
  : true | VariantIsNullRequiresNullable;

/** Field options for `t.variant`: any object field option except those it infers or installs. */
export type PrismaNextVariantFieldOptions<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  ParentShape,
  VariantRef extends PrismaNextObjectRef<Types, M, unknown>,
  Args extends InputFieldMap,
  Nullable extends boolean,
  // Inferred from `isNull`'s result, so its parameters are typed before it is: `never` without one.
  IsNull extends MaybePromise<boolean>,
  Selected extends keyof Row<Types, M> & string,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, ParentShape, VariantRef, Nullable, Args, unknown>,
  'type' | 'nullable' | 'select' | InferredFieldOptionKeys
> & {
  nullable?: Nullable & NoInfer<VariantNullableOption<IsNull>>;
  /** Columns to load for `isNull`, whatever the query selects. */
  select?: readonly Selected[];
  /** Resolves the field to null when this returns true, which makes the field nullable. */
  isNull?: (
    parent: ParentShape & Pick<Row<Types, M>, Selected>,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => IsNull;
};

/** The row a variant field resolves to: its parent's, or null when it's nullable. */
export type VariantFieldShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Nullable extends boolean,
  IsNull,
> = Row<Types, M> | (Nullable extends true ? null : [IsNull] extends [never] ? never : null);

/**
 * A `query`, or a variant `type` that narrows the load, can filter a to-one relation's row out,
 * so either makes the field nullable by default.
 */
export type RelationNullable<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  Query,
  TypeModel,
> =
  IsToMany<Types, M, R> extends true
    ? false
    : undefined extends Query
      ? [TypeModel] extends [RelatedModel<Types, M, R>]
        ? DefaultRelationNullable<Types, M, R>
        : true
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
    ) => Condition);

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

/** A model's fields, its table entry, and the storage column each field maps to. */
type ModelTable<C extends AnyContract, M extends string> =
  ModelDefOf<C, M> extends {
    readonly fields: infer Fields;
    readonly storage: {
      readonly namespaceId: infer Ns extends keyof C['storage']['namespaces'];
      readonly table: infer Table extends string;
      readonly fields: infer StorageFields;
    };
  }
    ? C['storage']['namespaces'][Ns]['entries']['table'] extends infer Tables
      ? Table extends keyof Tables
        ? {
            readonly fields: Fields;
            readonly table: Tables[Table];
            readonly storageFields: StorageFields;
          }
        : never
      : never
    : never;

type StorageFieldCodec<C extends AnyContract, M extends string, F extends string> =
  ModelTable<C, M> extends {
    readonly table: { readonly columns: infer Columns };
    readonly storageFields: infer Storage;
  }
    ? F extends keyof Storage
      ? Storage[F] extends { readonly column: infer Column }
        ? ColumnCodec<Columns, Column>
        : never
      : never
    : never;

/** The fields mapped to a model's primary key columns; `never` when its table declares none. */
type PrimaryKeyFields<C extends AnyContract, M extends string> =
  ModelTable<C, M> extends {
    readonly table: {
      readonly primaryKey: { readonly columns: infer Columns extends readonly string[] };
    };
    readonly storageFields: infer Storage;
  }
    ? {
        [F in keyof Storage]: Storage[F] extends { readonly column: Columns[number] } ? F : never;
      }[keyof Storage] &
        string
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

/** The field naming a base model's variant; `never` for other models. */
type DiscriminatorField<Types extends SchemaTypes, M extends ModelName<Types>> =
  ModelDefOf<Types['PrismaNextContract'], M> extends {
    readonly discriminator: { readonly field: infer F extends string };
  }
    ? F & keyof Row<Types, M>
    : never;

/**
 * What a field returning a model's `prismaInterface` may resolve to. A discriminated model's rows
 * also need the discriminator: the interface routes rows to variants before any field runs.
 */
export type InterfaceReturnShape<Types extends SchemaTypes, M extends ModelName<Types>> = [
  DiscriminatorField<Types, M>,
] extends [never]
  ? ModelReturnShape<Types, M>
  : ModelReturnShape<Types, M> & Pick<Row<Types, M>, DiscriminatorField<Types, M>>;

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

/** Names the result in the error when no scalar can serialize it, where `never` says nothing. */
export interface NoAggregateScalar<Result> {
  readonly 'No scalar Output type matches the aggregate result': Result;
}

type AggregateScalarOption<Types extends SchemaTypes, Result> = [
  AggregateScalar<Types, Result>,
] extends [never]
  ? NoAggregateScalar<NonNullable<Result>>
  : AggregateScalar<Types, Result>;

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
        type: AggregateScalarOption<
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

/** `variant` is `name` for a type that shares its model with others; only one may be set. */
export type NameOrVariant = { name?: never; variant?: string } | { name?: string; variant?: never };

type PrismaNextTypeOptions<Types extends SchemaTypes, M extends ModelName<Types>, Shape> = {
  /** Columns and relations to always load for this type, as a column array or a `select` object. */
  select?: readonly (keyof Row<Types, M> & string)[] | SelectObjectSpec<Types, M>;
  fields?: (
    // Passed explicitly: Monaco leaves the defaulted `Row<Types, M>` opaque, which makes
    // `t.expose*` demand `nullable: true` on every column.
    t: PrismaNextObjectFieldBuilder<Types, M, FieldParentShape<Types, M, Shape>, Row<Types, M>>,
  ) => FieldMap;
} & NameOrVariant;

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

/**
 * The fields of a model whose column's codec can be ordered (not bytes, for example): upstream's
 * `OrderableFieldNames`, read from the model's table in one pass instead of resolving each field's
 * storage column through the ORM's per-field helpers. Shaped `keyof ... & string` like upstream's:
 * the cursor options constrain their `Cursor` parameter by these columns while the model is still
 * generic, and only a constraint that reduces to `string` keeps the inferred cursor a literal.
 */
type OrderableFields<C extends AnyContract, M extends string> = keyof OrderableFieldMap<C, M> &
  string;

type OrderableFieldMap<C extends AnyContract, M extends string> =
  ModelTable<C, M> extends {
    readonly fields: infer Fields;
    readonly table: { readonly columns: infer Columns };
    readonly storageFields: infer Storage;
  }
    ? {
        [F in keyof Fields & string as OrderableCodec<
          C,
          ColumnCodec<
            Columns,
            F extends keyof Storage
              ? Storage[F] extends { readonly column: infer Column }
                ? Column
                : F
              : F
          >
        > extends true
          ? F
          : never]: true;
      }
    : {};

type ColumnCodec<Columns, Column> = Column extends keyof Columns
  ? Columns[Column] extends { readonly codecId: infer Id }
    ? Id
    : never
  : never;

// Upstream's `IsOrderable`: the codec's traits include `order`.
type OrderableCodec<C extends AnyContract, Id> = Id extends keyof ExtractCodecTypes<C>
  ? ExtractCodecTypes<C>[Id] extends { readonly traits: infer Traits }
    ? ['order'] extends [Traits]
      ? true
      : false
    : false
  : false;

type OrderableColumn<Types extends SchemaTypes, M extends ModelName<Types>> =
  | OrderableFields<Types['PrismaNextContract'], M>
  | BaseOrderableColumn<Types['PrismaNextContract'], BaseModelKey<Types['PrismaNextContract'], M>>;

type BaseOrderableColumn<TContract extends AnyContract, Base extends string> = [Base] extends [
  never,
]
  ? never
  : OrderableFields<TContract, Base>;

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

/** The paging options `prismaConnection` and `relatedConnection` share. */
export type ConnectionPagingOptions<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
  Cursor,
> = {
  cursor: Cursor & ExactCursor<Cursor>;
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
    | TotalCountFlag<Types>
    | ((
        parent: ParentShape,
        args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => MaybePromise<number>);
};

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
  > &
  ConnectionPagingOptions<Types, ParentShape, Args, Cursor> & {
    type: Param;
    /**
     * Direction and null placement for this request. Each item names a cursor column, in cursor
     * order; backward pages reverse it.
     */
    orderBy?: (
      model: ModelAccessor<Types['PrismaNextContract'], BareModelName<M>, NamespaceOf<Types, M>>,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
    ) => OrderByItem | readonly OrderByItem[];
    resolve: (
      parent: ParentShape,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<
      ConnectionCollection<Types, NoInfer<M>> | (Nullable extends true ? null : never)
    >;
    /** Not supported: chain `.where(...)` on the collection in `resolve` instead. */
    query?: never;
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
  > &
  ConnectionPagingOptions<Types, ParentShape, Args, Cursor> & {
    type?: PrismaNextObjectRef<Types, RelationTypeModel<Types, ParentModel, RelName>, RelatedShape>;
    query?: ConnectionQuery<Types, RelatedModel<Types, ParentModel, RelName>, Args>;
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

/**
 * Tuples, so each returned array literal infers as its own tuple: branches selecting different
 * columns then stay a union (their columns optional) instead of merging into one array. Adding
 * `readonly K[]` here would lose that. An array variable is still accepted, with its columns
 * optional.
 */
type FieldSelectFunctionArray<Types extends SchemaTypes, ParentShape> =
  FieldSelectArray<Types, ParentShape> extends readonly (infer K)[]
    ? readonly [] | readonly [K, ...K[]]
    : never;

type PrismaNextFieldSelect<Types extends SchemaTypes, ParentShape, Args> =
  | FieldSelectArray<Types, ParentShape>
  | ((
      args: Args,
      ctx: Types['Context'],
    ) => MaybePromise<FieldSelectFunctionArray<Types, ParentShape>>)
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
      // Checked, not inferred from: inferring `Select` into it walks every branch of the check.
      NoInfer<ValidateFieldSelect<Types, ParentShape, Select>>;
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

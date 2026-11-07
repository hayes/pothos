import type {
  CheckAsyncSelection,
  InferredFieldOptionKeys,
  InputFieldMap,
  InputShapeFromFields,
  MaybeAsyncSelection,
  MaybePromise,
  SchemaTypes,
} from '@pothos/core';
import type {
  DefaultCollectionTypeState,
  RelationPredicate,
  ShorthandWhereFilter,
} from '@prisma/orm-family-sql/orm-client';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextInterfaceRef } from '../interface-ref.js';
import type { Planned, PrismaNextObjectRef } from '../object-ref.js';
import type { IncludeRefinementCollection, WithNsId } from './collections.js';
import type {
  BareModelName,
  BaseModelKey,
  IsUnion,
  LoadedRow,
  ModelKey,
  NamespacedModelKey,
  NamespaceOf,
  ObjectBaseShape,
  RelationKeys,
  RelationsOfModel,
  Row,
  VariantModelKeys,
} from './models.js';
import type { OrderByColumnsCheck, RelationOrderBy } from './order-by.js';

export type RelatedModel<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> = RelationsOfModel<Types['PrismaNextContract'], M>[R] extends {
  readonly to: {
    readonly model: infer To extends string;
    readonly namespace: infer Ns extends string;
  };
}
  ? NamespacedModelKey<Types['PrismaNextContract'], Ns, To> & ModelKey<Types>
  : never;

/** A relation's `type` may be the target model's ref or a variant's, which narrows the load. */
export type RelationTypeModel<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> =
  | RelatedModel<Types, M, R>
  | (VariantModelKeys<Types['PrismaNextContract'], RelatedModel<Types, M, R>> & ModelKey<Types>);

export type IsToMany<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> = RelationsOfModel<Types['PrismaNextContract'], M>[R] extends {
  readonly cardinality: '1:N' | 'N:M';
}
  ? true
  : false;

/** A loose contract has no literal cardinality, so this falls back to every relation. */
export type ToManyRelationKeys<Types extends SchemaTypes, M extends ModelKey<Types>> =
  string extends RelationKeys<Types, M>
    ? RelationKeys<Types, M>
    : {
        [R in RelationKeys<Types, M>]: IsToMany<Types, M, R> extends true ? R : never;
      }[RelationKeys<Types, M>];

export type DefaultRelationNullable<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> =
  IsToMany<Types, M, R> extends true
    ? false
    : RelationsOfModel<Types['PrismaNextContract'], M>[R] extends {
          readonly nullable: infer Nullable extends boolean;
        }
      ? Nullable
      : true;

/** A relation's `where`, as a shorthand filter object or the ORM's predicate callback. */
export type RelationWhere<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | ShorthandWhereFilter<
      Types['PrismaNextContract'],
      NamespaceOf<Types['PrismaNextContract'], M>,
      BareModelName<M>
    >
  | RelationPredicate<
      Types['PrismaNextContract'],
      NamespaceOf<Types['PrismaNextContract'], M>,
      BareModelName<M>
    >;

/**
 * The `where` of a root field or `prismaConnection`. A variant type's rows load through its base's
 * collection, `orm.Task.variant('bug')`, whose shorthand filter knows only the base's columns, so
 * only the predicate can name the variant's own. A relation loads a variant through its own.
 */
export type RootWhere<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | ShorthandWhereFilter<
      Types['PrismaNextContract'],
      NamespaceOf<Types['PrismaNextContract'], ShorthandModel<Types, M>>,
      BareModelName<ShorthandModel<Types, M>>
    >
  | RelationPredicate<
      Types['PrismaNextContract'],
      NamespaceOf<Types['PrismaNextContract'], M>,
      BareModelName<M>
    >;

/** The model a root shorthand `where` of `M`'s rows is checked against: its base, for a variant. */
type ShorthandModel<Types extends SchemaTypes, M extends ModelKey<Types>> = [
  BaseModelKey<Types['PrismaNextContract'], M>,
] extends [never]
  ? M
  : BaseModelKey<Types['PrismaNextContract'], M>;

/** A to-many relation's literal `query`. */
export interface RelationQueryLiteral<Types extends SchemaTypes, M extends ModelKey<Types>> {
  where?: RelationWhere<Types, M>;
  orderBy?: RelationOrderBy<Types, M>;
  limit?: number;
  offset?: number;
}

/**
 * The literal `query` a to-many relation takes, and its entry in a `select`. A to-one relation is
 * loaded whole, so it takes none.
 */
export type RelationQueryValue<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> =
  IsToMany<Types, M, R> extends true
    ? RelationQueryLiteral<Types, RelatedModel<Types, M, R>>
    : never;

/**
 * Refines a to-many relation's collection, as an `include()` refinement does, so it can apply
 * fragments (`posts.with(published)`) and the methods of custom collections.
 */
export type RelationRefinement<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> = (
  collection: RelationRefinementCollection<Types, M, R>,
) => RelationRefinementCollection<Types, M, R>;

/**
 * A to-many relation's `query`: the literal, or a callback of the args and context returning it or
 * a refinement of the relation's collection. A to-one relation is loaded whole and takes none, which
 * its error names.
 */
export type RelationQuery<
  Types extends SchemaTypes,
  ParentModel extends ModelKey<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Args extends InputFieldMap,
> =
  IsToMany<Types, ParentModel, RelName> extends true
    ?
        | RelationQueryValue<Types, ParentModel, RelName>
        | ((
            args: InputShapeFromFields<Args>,
            context: Types['Context'],
          ) => MaybeAsyncSelection<
            Types,
            | RelationQueryValue<Types, ParentModel, RelName>
            | RelationRefinement<Types, ParentModel, RelName>
            | undefined
          >)
    : { readonly [K in `A to-one relation takes no query: ${RelName}`]: never };

export type RelationRefinementCollection<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> = ModelRefinementCollection<Types, RelatedModel<Types, M, R>>;

/** The collection a refinement of a to-many relation to `M` takes and returns. */
export type ModelRefinementCollection<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
> = IncludeRefinementCollection<
  Types['PrismaNextContract'],
  BareModelName<M>,
  Row<Types, M>,
  WithNsId<DefaultCollectionTypeState, NamespaceOf<Types['PrismaNextContract'], M>>
>;

export type PrismaNextRelationOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelKey<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  RelatedShape,
  // The parent holds only what the type's `select` declared; a field's own `select` adds more.
  ParentShape = ObjectBaseShape<Types, ParentModel>,
  Query = RelationQuery<Types, ParentModel, RelName, Args>,
  TypeModel extends RelationTypeModel<Types, ParentModel, RelName> = RelationTypeModel<
    Types,
    ParentModel,
    RelName
  >,
  OnNull = RelationOnNull<Types, ParentShape, Args, TypeModel>,
> = RelationBaseOptions<
  Types,
  ParentModel,
  RelName,
  Nullable,
  Args,
  RelatedShape,
  ParentShape,
  Query,
  TypeModel
> & {
  /**
   * What a non-null field does when its relation resolves to null: `'error'` leaves the null for
   * GraphQL's non-null error, and a function returns a replacement or an error.
   */
  onNull?: OnNull;
};

/** The options of `t.relation` other than `onNull`. */
type RelationBaseOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelKey<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  RelatedShape,
  ParentShape,
  Query,
  TypeModel extends RelationTypeModel<Types, ParentModel, RelName>,
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
  type?:
    | PrismaNextObjectRef<Types, TypeModel, RelatedShape>
    | PrismaNextInterfaceRef<Types, TypeModel, RelatedShape>;
  query?: Query &
    QueryAsyncCheck<Types, Query> &
    NoInfer<
      ExactQuery<
        Types,
        RelatedModel<Types, ParentModel, RelName>,
        Query,
        keyof RelationQueryValue<Types, ParentModel, RelName>
      >
    >;
};

/**
 * `CheckAsyncSelection` for a `query`. A callback returning `any`, such as the ORM's predicate
 * passed as the query, already fails as itself, so it isn't reported as async first.
 */
export type QueryAsyncCheck<Types extends SchemaTypes, Query> = [Query] extends [
  (...args: never[]) => infer Result,
]
  ? 0 extends 1 & Result
    ? unknown
    : CheckAsyncSelection<Types, Query>
  : CheckAsyncSelection<Types, Query>;

/** What a non-null `t.relation` does with a null relation. A replacement row must be planned. */
export type RelationOnNull<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
  TypeModel extends ModelKey<Types>,
> =
  | 'error'
  | ((
      parent: ParentShape,
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<
      Error | Planned<TypeModel | VariantModelKeys<Types['PrismaNextContract'], TypeModel>>
    >);

/** Names why `nullable: false` isn't allowed in its error, as the type argument the error shows. */
export interface RequiresNullable<Reason extends string> {
  readonly 'nullable: false is not allowed': Reason;
}

/** Names why a relation field can't take `onNull`, as the type argument the error shows. */
export interface OnNullUnused<Reason extends string> {
  readonly 'onNull is never used': Reason;
}

/** Names why a non-null relation field needs `onNull`, as the type argument the error shows. */
export interface OnNullRequired<Reason extends string> {
  readonly 'onNull is required': Reason;
}

/**
 * Why a to-one relation can resolve to null: the contract makes it nullable, or a variant `type`
 * filters out the rows of other variants. `never` when it can't.
 */
type RelationNullReason<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  TypeModel,
> =
  IsToMany<Types, M, R> extends true
    ? never
    : [TypeModel] extends [RelatedModel<Types, M, R>]
      ? DefaultRelationNullable<Types, M, R> extends true
        ? `${M & string}.${R & string} can be null`
        : never
      : `${TypeModel & string} filters out other variants of ${M & string}.${R & string}`;

/**
 * Checks the name `t.relation` is called with and no options: a non-null field over a relation that
 * can be null needs `onNull`, which the error names the reason for. An unknown name leaves `R` as
 * every relation, and is left to fail as itself.
 */
export type RelationWithoutOptionsCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> = [Types['DefaultFieldNullability'], IsUnion<R>] extends [false, false]
  ? [RelationNullReason<Types, M, R, RelatedModel<Types, M, R>>] extends [
      infer Reason extends string,
    ]
    ? [Reason] extends [never]
      ? unknown
      : OnNullRequired<Reason>
    : unknown
  : unknown;

/**
 * The arguments of `t.relation`: `options` is required, with `onNull`, when the field is non-null
 * and the relation can resolve to null. Otherwise `onNull` is never used, so it is rejected.
 */
export type RelationFieldArgs<
  Types extends SchemaTypes,
  ParentModel extends ModelKey<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  RelatedShape,
  ParentShape,
  Query,
  TypeModel extends RelationTypeModel<Types, ParentModel, RelName>,
> = [Nullable] extends [false]
  ? [RelationNullReason<Types, ParentModel, RelName, TypeModel>] extends [
      infer Reason extends string,
    ]
    ? [Reason] extends [never]
      ? [
          options?: PrismaNextRelationOptions<
            Types,
            ParentModel,
            RelName,
            Nullable,
            Args,
            RelatedShape,
            ParentShape,
            Query,
            TypeModel,
            OnNullUnused<`${ParentModel & string}.${RelName & string} can't be null`>
          >,
        ]
      : [
          options: PrismaNextRelationOptions<
            Types,
            ParentModel,
            RelName,
            Nullable,
            Args,
            RelatedShape,
            ParentShape,
            Query,
            TypeModel,
            RelationOnNull<Types, ParentShape, Args, TypeModel> | OnNullRequired<Reason>
          > & {
            onNull: RelationOnNull<Types, ParentShape, Args, TypeModel> | OnNullRequired<Reason>;
          },
        ]
    : [
        options?: PrismaNextRelationOptions<
          Types,
          ParentModel,
          RelName,
          Nullable,
          Args,
          RelatedShape,
          ParentShape,
          Query,
          TypeModel,
          RelationOnNull<Types, ParentShape, Args, TypeModel>
        >,
      ]
  : [
      options?: PrismaNextRelationOptions<
        Types,
        ParentModel,
        RelName,
        Nullable,
        Args,
        RelatedShape,
        ParentShape,
        Query,
        TypeModel,
        OnNullUnused<'the field is nullable'>
      >,
    ];

/**
 * `Query` is inferred from the literal rather than checked, and a callback's result gets no excess
 * property check, so unknown keys and `orderBy` columns need rejecting in both. While `Query` is
 * still uninferred it is its constraint, which includes `undefined`, and a check then would hide
 * the option's contextual types.
 */
export type ExactQuery<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Query,
  Known extends PropertyKey,
> = undefined extends Query
  ? unknown
  : Query extends (...args: infer Args) => infer Result
    ? (
        ...args: Args
      ) => MaybePromise<
        | (ExactQueryLiteral<Awaited<Result>, Known> &
            OrderByColumnsCheck<Types, M, Awaited<Result>>)
        | undefined
      >
    : ExactQueryLiteral<Query, Known> & OrderByColumnsCheck<Types, M, Query>;

type UnknownQueryKeys<Literal, Known extends PropertyKey> = Exclude<
  Literal extends unknown ? keyof Literal : never,
  Known
>;

/**
 * A `query` of a root field or connection: a literal, or a callback of the args and context
 * returning one. `Literal` is inferred, which leaves the callback's `args` typed, and checked for
 * unknown keys and `orderBy` columns, which a callback's result gets no excess property check for.
 * The check sits beside the whole option so it fails for a literal and a callback alike; beside
 * `Literal` it stops TS 5.9 and 6 inferring it.
 */
export type QueryOption<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  ArgsShape,
  Literal,
  Known extends PropertyKey,
> = (Literal | ((args: ArgsShape, context: Types['Context']) => Literal | undefined)) &
  NoInfer<ExactQueryLiteral<Literal, Known> & OrderByColumnsCheck<Types, M, Literal>>;

/**
 * What a `prismaField`'s `query` takes, as a to-many relation's does. An alias rather than an
 * interface for the reason `ConnectionQueryLiteral` is one.
 */
export type FieldQueryLiteral<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  where?: RootWhere<Types, M>;
  orderBy?: RelationOrderBy<Types, M>;
  limit?: number;
  offset?: number;
};

/** Names `Literal`'s unknown keys in a required property, which no object has, for the error. */
export type ExactQueryLiteral<Literal, Known extends PropertyKey> = [
  UnknownQueryKeys<Literal, Known>,
] extends [never]
  ? unknown
  : {
      readonly [K in UnknownQueryKeys<
        Literal,
        Known
      > as `Unknown query option: ${K & string}`]: never;
    };

/** Planned rows of a relation, as a list for a to-many relation and nullable as the field is. */
export type RelationFieldShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  Nullable extends boolean,
> =
  | (IsToMany<Types, M, R> extends true
      ? readonly LoadedRow<Types, RelatedModel<Types, M, R>>[]
      : LoadedRow<Types, RelatedModel<Types, M, R>>)
  | (Nullable extends true ? null : never);

type RelationRef<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  RelatedShape,
> =
  IsToMany<Types, M, R> extends true
    ? [PrismaNextObjectRef<Types, RelatedModel<Types, M, R>, RelatedShape>]
    : PrismaNextObjectRef<Types, RelatedModel<Types, M, R>, RelatedShape>;

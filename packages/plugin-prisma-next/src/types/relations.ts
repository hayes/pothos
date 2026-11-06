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
  ModelAccessor,
  ModelCallbackTools,
  RelationPredicate,
  ShorthandWhereFilter,
} from '@prisma/orm-family-sql/orm-client';
import type { OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextInterfaceRef } from '../interface-ref.js';
import type { PrismaNextObjectRef } from '../object-ref.js';
import type { IncludeRefinementCollection, WithNsId } from './collections.js';
import type {
  BareModelName,
  ModelKey,
  NamespacedModelKey,
  NamespaceOf,
  ObjectBaseShape,
  RelationKeys,
  RelationsOfModel,
  Row,
  VariantModelKeys,
} from './models.js';

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

/** One ordering of a relation's rows, as the ORM's `orderBy` takes it. */
export type RelationOrderSelector<Types extends SchemaTypes, M extends ModelKey<Types>> = (
  accessor: ModelAccessor<
    Types['PrismaNextContract'],
    BareModelName<M>,
    NamespaceOf<Types['PrismaNextContract'], M>
  >,
  tools: ModelCallbackTools<
    Types['PrismaNextContract'],
    BareModelName<M>,
    NamespaceOf<Types['PrismaNextContract'], M>
  >,
) => OrderByItem;

/** A relation's `orderBy`, as one selector or several applied in order. */
export type RelationOrderBy<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | RelationOrderSelector<Types, M>
  | readonly RelationOrderSelector<Types, M>[];

interface RelationQueryLiteral<Types extends SchemaTypes, M extends ModelKey<Types>> {
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
type RelationRefinement<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> = (
  collection: RelationRefinementCollection<Types, M, R>,
) => RelationRefinementCollection<Types, M, R>;

/**
 * A to-many relation's `query`: the literal, or a callback of the args and context returning it or
 * a refinement of the relation's collection. A to-one relation takes none.
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
    : never;

export type RelationRefinementCollection<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> = IncludeRefinementCollection<
  Types['PrismaNextContract'],
  BareModelName<RelatedModel<Types, M, R>>,
  Row<Types, RelatedModel<Types, M, R>>,
  WithNsId<
    DefaultCollectionTypeState,
    NamespaceOf<Types['PrismaNextContract'], RelatedModel<Types, M, R>>
  >
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
    CheckAsyncSelection<Types, Query> &
    NoInfer<ExactQuery<Query, keyof RelationQueryValue<Types, ParentModel, RelName>>>;
  /**
   * What a non-null field does when its relation resolves to null: `'error'` leaves the null for
   * GraphQL's non-null error, and a function returns a replacement or an error.
   */
  onNull?: RelationOnNull<Types, ParentShape, Args, NoInfer<RelatedShape>>;
};

export type RelationOnNull<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
  RelatedShape,
> =
  | 'error'
  | ((
      parent: ParentShape,
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<Error | RelatedShape>);

/** Names why `nullable: false` isn't allowed in its error, as the type argument the error shows. */
export interface RequiresNullable<Reason extends string> {
  readonly 'nullable: false is not allowed': Reason;
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
 * The arguments of `t.relation`: `options` is required, with `onNull`, when the field is non-null
 * and the relation can resolve to null.
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
  Options = PrismaNextRelationOptions<
    Types,
    ParentModel,
    RelName,
    Nullable,
    Args,
    RelatedShape,
    ParentShape,
    Query,
    TypeModel
  >,
> = [Nullable] extends [false]
  ? [RelationNullReason<Types, ParentModel, RelName, TypeModel>] extends [
      infer Reason extends string,
    ]
    ? [Reason] extends [never]
      ? [options?: Options]
      : [
          options: Options & {
            onNull:
              | RelationOnNull<Types, ParentShape, Args, NoInfer<RelatedShape>>
              | OnNullRequired<Reason>;
          },
        ]
    : [options?: Options]
  : [options?: Options];

/**
 * `Query` is inferred from the literal rather than checked, and a callback's result gets no excess
 * property check, so unknown keys need rejecting in both. While `Query` is still uninferred it is
 * its constraint, which includes `undefined`, and a check then would hide the option's contextual
 * types.
 */
type ExactQuery<Query, Known extends PropertyKey> = undefined extends Query
  ? unknown
  : Query extends (...args: infer Args) => infer Result
    ? (...args: Args) => MaybePromise<ExactQueryLiteral<Awaited<Result>, Known> | undefined>
    : ExactQueryLiteral<Query, Known>;

type UnknownQueryKeys<Literal, Known extends PropertyKey> = Exclude<
  Literal extends unknown ? keyof Literal : never,
  Known
>;

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

/** The rows a relation loads, as a list for a to-many relation and nullable as the field is. */
export type RelationFieldShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  Nullable extends boolean,
> =
  | (IsToMany<Types, M, R> extends true
      ? readonly Row<Types, RelatedModel<Types, M, R>>[]
      : Row<Types, RelatedModel<Types, M, R>>)
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

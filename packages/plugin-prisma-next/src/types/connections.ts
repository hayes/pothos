import type {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  InferredFieldOptionKeys,
  InputFieldMap,
  InputFieldsFromShape,
  InputShapeFromFields,
  MaybePromise,
  SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaInterfaceRef } from '../interface-ref.js';
import type { PrismaObjectRef } from '../object-ref.js';
import type { TotalCountFlag } from './aggregates.js';
import type { ResolverCollection, UnorderedCollection } from './collections.js';
import type { RootResolveParent } from './fields.js';
import type { ModelKey, ObjectBaseShape, RelationKeys, Row } from './models.js';
import type { RelationOrderBy } from './order-by.js';
import type {
  QueryOption,
  RelatedModel,
  RelationTypeModel,
  RelationWhere,
  RootWhere,
} from './relations.js';

/**
 * A connection's `query`: `where` filters the rows and `orderBy` orders them before paging. The
 * model's key is appended to the order to break ties.
 */
// An alias rather than an interface: it is both a type parameter's constraint and its default, and
// TypeScript gives an interface constraint a `this` argument, so the default no longer matches it
// by identity and checking it computes the variance of `RelationWhere` and of upstream's
// `RelationPredicate`, which costs about 100 ms in each file with a connection.
export type ConnectionQueryLiteral<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  where?: RelationWhere<Types, M>;
  orderBy?: RelationOrderBy<Types, M>;
};

/** A `prismaConnection`'s `query`, whose `where` is a {@link RootWhere}. */
export type RootConnectionQueryLiteral<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  where?: RootWhere<Types, M>;
  orderBy?: RelationOrderBy<Types, M>;
};

/** A connection's `query`, as a {@link QueryOption} of its arguments and the connection's. */
export type ConnectionQueryOption<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap,
  Literal,
> = QueryOption<
  Types,
  M,
  InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
  Literal,
  'where' | 'orderBy'
>;

type SizeOption<Types extends SchemaTypes, Args extends InputFieldMap> =
  | number
  | ((
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      ctx: Types['Context'],
    ) => number);

/** Paging options shared by connection fields and connection helpers. */
export type ConnectionPagingOptions<
  Types extends SchemaTypes,
  ParentShape,
  Args extends InputFieldMap,
> = {
  defaultSize?: SizeOption<Types, Args>;
  maxSize?: SizeOption<Types, Args>;
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

export type PrismaConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  M extends ModelKey<Types>,
  Param,
  Nullable extends boolean,
  Args extends InputFieldMap,
  QueryLiteral,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind,
  ResolveShape = ParentShape,
  Returned extends ResolverCollection<Types, M> | null = ResolverCollection<Types, M>,
  EdgeNullability extends FieldNullability<[unknown]> = DefaultEdgesNullability<Types>,
  NodeNullability extends boolean = DefaultNodeNullability<Types>,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    PrismaObjectRef<Types, M, Row<Types, M>>,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'Arg'> &
      (InputFieldMap extends Args ? {} : Args),
    Kind,
    ResolveShape,
    ResolveReturnShape
  >,
  'type' | 'resolve' | 'args' | InferredFieldOptionKeys
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      ParentShape,
      PrismaObjectRef<Types, M, Row<Types, M>>,
      Nullable,
      EdgeNullability,
      NodeNullability,
      Args,
      ResolveReturnShape
    >,
    InferredFieldOptionKeys | 'type' | 'resolve' | 'args'
  > &
  ConnectionPagingOptions<
    Types,
    RootResolveParent<Types, ParentShape, ResolveShape, Kind>,
    Args
  > & {
    type: Param;
    /** Filters and orders the collection. */
    query?: ConnectionQueryOption<Types, M, Args, QueryLiteral>;
    /**
     * Returns the collection to page. Defaults to `orm.<Model>`, or `orm.<Base>.variant(value)` for
     * a variant. It is called with the parent, args (including pagination), context and info, and
     * can return a promise. The connection orders the collection by its `query`'s `orderBy`, so
     * return it without `include()` or `orderBy()`. Throws before running a query if it has
     * pagination or distinct settings.
     */
    collection?: (
      parent: RootResolveParent<Types, ParentShape, ResolveShape, Kind>,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<
      UnorderedCollection<Exclude<Returned, null>> | (Nullable extends true ? null : never)
    >;
  };

/**
 * A related connection's `query`. Rows narrowed to a variant, `TypeModel`, take its columns as a
 * `prismaConnection` of the variant does.
 */
export type RelatedConnectionQueryLiteral<
  Types extends SchemaTypes,
  RelatedModel extends ModelKey<Types>,
  TypeModel extends ModelKey<Types>,
> = {
  where?: [TypeModel] extends [RelatedModel]
    ? RelationWhere<Types, TypeModel>
    : RootWhere<Types, TypeModel>;
  orderBy?: RelationOrderBy<Types, TypeModel>;
};

export type PrismaRelatedConnectionOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelKey<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  RelatedShape = unknown,
  ParentShape = ObjectBaseShape<Types, ParentModel>,
  TypeModel extends RelationTypeModel<Types, ParentModel, RelName> = RelatedModel<
    Types,
    ParentModel,
    RelName
  >,
  QueryLiteral = RelatedConnectionQueryLiteral<
    Types,
    RelatedModel<Types, ParentModel, RelName>,
    TypeModel
  >,
  EdgeNullability extends FieldNullability<[unknown]> = DefaultEdgesNullability<Types>,
  NodeNullability extends boolean = DefaultNodeNullability<Types>,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    ParentShape,
    PrismaObjectRef<Types, RelatedModel<Types, ParentModel, RelName>, RelatedShape>,
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
      PrismaObjectRef<Types, RelatedModel<Types, ParentModel, RelName>, RelatedShape>,
      Nullable,
      EdgeNullability,
      NodeNullability,
      Args,
      unknown
    >,
    InferredFieldOptionKeys | 'type' | 'resolve' | 'args'
  > &
  ConnectionPagingOptions<Types, ParentShape, Args> & {
    type?:
      | TypeModel
      | PrismaObjectRef<Types, TypeModel, RelatedShape>
      | PrismaInterfaceRef<Types, TypeModel, RelatedShape>;
    query?: ConnectionQueryOption<Types, TypeModel, Args, QueryLiteral>;
  };

/** The relay plugin's default edge nullability, which `SchemaTypes` has once it's installed. */
export type DefaultEdgesNullability<Types> = Types extends {
  DefaultEdgesNullability: infer Nullability extends FieldNullability<[unknown]>;
}
  ? Nullability
  : false;

/** The relay plugin's default node nullability, which `SchemaTypes` has once it's installed. */
export type DefaultNodeNullability<Types> = Types extends {
  DefaultNodeNullability: infer Nullability extends boolean;
}
  ? Nullability
  : false;

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;

/**
 * What a connection's own fields read beyond the page: the field's parent and arguments, and the
 * count when the `totalCount` option is set.
 */
export type ConnectionResultShape<ParentShape, Args extends InputFieldMap> = {
  parent: ParentShape;
  args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments;
  totalCount?: number;
};

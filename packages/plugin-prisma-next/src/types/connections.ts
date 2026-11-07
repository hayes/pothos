import type {
  FieldKind,
  FieldOptionsFromKind,
  InferredFieldOptionKeys,
  InputFieldMap,
  InputFieldsFromShape,
  InputShapeFromFields,
  MaybePromise,
  SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextInterfaceRef } from '../interface-ref.js';
import type { PrismaNextObjectRef } from '../object-ref.js';
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
 * What a connection applies before paging: its filter, and its order, which the model's key breaks
 * ties in.
 *
 * An alias rather than an interface: it is both a type parameter's constraint and its default, and
 * TypeScript gives an interface constraint a `this` argument, so the default no longer matches it
 * by identity and checking it computes the variance of `RelationWhere` and of upstream's
 * `RelationPredicate`, which costs about 100 ms in each file with a connection.
 */
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
  keyof ConnectionQueryLiteral<SchemaTypes, never>
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

export type PrismaNextConnectionFieldOptions<
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
  Returned extends ResolverCollection<Types, M> = ResolverCollection<Types, M>,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    PrismaNextObjectRef<Types, M, Row<Types, M>>,
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
      PrismaNextObjectRef<Types, M, Row<Types, M>>,
      Nullable,
      false,
      false,
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
     * Returns the collection to page, without `include()` or `orderBy()`: the connection orders it
     * by its `query`'s `orderBy`. It defaults to `orm.<Model>`, or `orm.<Base>.variant(value)` for
     * a variant.
     */
    collection?: (
      parent: RootResolveParent<Types, ParentShape, ResolveShape, Kind>,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<
      (Returned & NoInfer<UnorderedCollection<Returned>>) | (Nullable extends true ? null : never)
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

export type PrismaNextRelatedConnectionOptions<
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
  ConnectionPagingOptions<Types, ParentShape, Args> & {
    type?:
      | TypeModel
      | PrismaNextObjectRef<Types, TypeModel, RelatedShape>
      | PrismaNextInterfaceRef<Types, TypeModel, RelatedShape>;
    query?: ConnectionQueryOption<Types, TypeModel, Args, QueryLiteral>;
  };

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

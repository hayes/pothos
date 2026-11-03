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
import type { OrderableFieldNames } from '@prisma/orm-family-sql/orm-client';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextInterfaceRef } from '../interface-ref.js';
import type { PrismaNextObjectRef } from '../object-ref.js';
import type { TotalCountFlag } from './aggregates.js';
import type { ResolverCollection } from './collections.js';
import type { RootResolveParent } from './fields.js';
import type {
  AnyContract,
  BareModelName,
  BaseModelKey,
  ModelKey,
  NamespaceOf,
  ObjectBaseShape,
  RelationKeys,
  Row,
} from './models.js';
import type {
  ExactQueryLiteral,
  RelatedModel,
  RelationTypeModel,
  RelationWhere,
} from './relations.js';

/** What a connection applies before paging. Its order is the connection's `orderBy`. */
export interface ConnectionQueryLiteral<Types extends SchemaTypes, M extends ModelKey<Types>> {
  where?: RelationWhere<Types, M>;
}

/**
 * A connection's `query`. `Literal` is inferred from what's written, and only checked for unknown
 * keys, which a callback's result gets no excess property check for. Inferring the literal rather
 * than the whole option leaves the callback's `args` typed once `Args` is known.
 */
export type ConnectionQueryOption<
  Types extends SchemaTypes,
  Args extends InputFieldMap,
  Literal,
> = (
  | Literal
  | ((
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
    ) => Literal | undefined)
) &
  NoInfer<UnknownConnectionQueryKeys<Literal>>;

/**
 * Sits beside the whole option, so it fails for an object and a callback alike. Written beside
 * `Literal` in the callback's result, it stops TS 5.9 and 6 inferring it.
 */
type UnknownConnectionQueryKeys<Literal> = ExactQueryLiteral<
  Literal,
  keyof ConnectionQueryLiteral<SchemaTypes, never>
>;

/** The fields whose column codec can be ordered (bytes can't, for example). */
type OrderableFields<C extends AnyContract, M extends string> = OrderableFieldNames<
  C,
  BareModelName<M>,
  NamespaceOf<C, M>
>;

type OrderableColumn<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | OrderableFields<Types['PrismaNextContract'], M>
  | BaseOrderableColumn<Types['PrismaNextContract'], BaseModelKey<Types['PrismaNextContract'], M>>;

type BaseOrderableColumn<TContract extends AnyContract, Base extends string> = [Base] extends [
  never,
]
  ? never
  : OrderableFields<TContract, Base>;

type OrderableColumnName<Types extends SchemaTypes, M extends ModelKey<Types>> = keyof Row<
  Types,
  M
> &
  OrderableColumn<Types, M>;

type OrderDirection = 'asc' | 'desc';

/**
 * A connection's order: a direction for each column, or `{ direction, nulls }` to place nulls,
 * which nullable columns put last by default. The model's key is appended to break ties.
 */
export type ConnectionOrderBy<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  readonly [Column in OrderableColumnName<Types, M>]?:
    | OrderDirection
    | {
        readonly direction?: OrderDirection;
        /** Where nulls sort. Only a nullable column has them. */
        readonly nulls?: null extends Row<Types, M>[Column] ? 'first' | 'last' : never;
      };
};

/**
 * A connection's `orderBy`. `Literal` is inferred from what's written and its columns are checked,
 * which a callback's result gets no excess property check for. A computed key widens to `string`
 * and is checked when the request runs.
 */
type ConnectionOrderByOption<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Args extends InputFieldMap,
  Literal,
> = (
  | Literal
  | ((
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
    ) => Literal | undefined)
) &
  NoInfer<
    UnknownOrderColumns<
      Exclude<Literal extends unknown ? keyof Literal : never, OrderableColumnName<Types, M>>
    >
  >;

type UnknownOrderColumns<Unknown> = [Unknown] extends [never]
  ? unknown
  : string extends Unknown
    ? unknown
    : { readonly [K in Unknown & string as `Not an orderable column: ${K}`]: never };

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
  M extends ModelKey<Types>,
  Args extends InputFieldMap,
  OrderBy,
> = {
  orderBy?: ConnectionOrderByOption<Types, M, Args, OrderBy>;
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
  OrderBy extends ConnectionOrderBy<Types, M>,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind,
  ResolveShape = ParentShape,
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
    M,
    Args,
    OrderBy
  > & {
    type: Param;
    /** Returns an unordered collection: the connection orders it by `orderBy`. */
    resolve: (
      parent: RootResolveParent<Types, ParentShape, ResolveShape, Kind>,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<
      ResolverCollection<Types, NoInfer<M>> | (Nullable extends true ? null : never)
    >;
  };

export type PrismaNextRelatedConnectionOptions<
  Types extends SchemaTypes,
  ParentModel extends ModelKey<Types>,
  RelName extends RelationKeys<Types, ParentModel>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  OrderBy extends ConnectionOrderBy<Types, RelatedModel<Types, ParentModel, RelName>>,
  RelatedShape = unknown,
  ParentShape = ObjectBaseShape<Types, ParentModel>,
  QueryLiteral = ConnectionQueryLiteral<Types, RelatedModel<Types, ParentModel, RelName>>,
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
  ConnectionPagingOptions<
    Types,
    ParentShape,
    RelatedModel<Types, ParentModel, RelName>,
    Args,
    OrderBy
  > & {
    type?:
      | PrismaNextObjectRef<Types, RelationTypeModel<Types, ParentModel, RelName>, RelatedShape>
      | PrismaNextInterfaceRef<Types, RelationTypeModel<Types, ParentModel, RelName>, RelatedShape>;
    query?: ConnectionQueryOption<Types, Args, QueryLiteral>;
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

import type { SchemaTypes } from '@pothos/core';
import type { OrderableFieldNames } from '@prisma/orm-family-sql/orm-client';
import type {
  AnyContract,
  BareModelName,
  BaseModelKey,
  ModelKey,
  NamespaceOf,
  Row,
} from './models.js';

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
 * The `orderBy` of a `query`: a direction for each column, or `{ direction, nulls }` to place
 * nulls, which nullable columns put last by default. A connection appends the model's key to break
 * ties.
 */
export type RelationOrderBy<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  readonly [Column in OrderableColumnName<Types, M>]?:
    | OrderDirection
    | {
        readonly direction?: OrderDirection;
        /** Where nulls sort. Only a nullable column has them. */
        readonly nulls?: null extends Row<Types, M>[Column] ? 'first' | 'last' : never;
      };
};

/** The columns a literal's `orderBy` names that `M` can't be ordered by. */
export type UnknownOrderByColumns<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Literal,
> = Exclude<
  Literal extends { readonly orderBy?: infer OrderBy } ? keyof NonNullable<OrderBy> : never,
  OrderableColumnName<Types, M>
>;

/**
 * Rejects the columns a `query` literal's `orderBy` names that `M` can't be ordered by, which an
 * inferred literal and a callback's result get no excess property check for. A computed key widens
 * to `string` and is checked when the request runs.
 */
export type OrderByColumnsCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Literal,
  Unknown = UnknownOrderByColumns<Types, M, Literal>,
> = [Unknown] extends [never]
  ? unknown
  : string extends Unknown
    ? unknown
    : { readonly orderBy: { readonly [K in Unknown & string]: never } };

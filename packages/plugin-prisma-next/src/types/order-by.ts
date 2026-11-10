import type { SchemaTypes } from '@pothos/core';
import type {
  ModelAccessor,
  ModelCallbackTools,
  OrderableFieldNames,
} from '@prisma/orm-family-sql/orm-client';
import type { OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import type {
  AnyContract,
  BareModelName,
  BaseModelKey,
  ModelKey,
  NamespaceOf,
  Row,
} from './models.js';

/** The fields whose column codec can be ordered (bytes can't, for example). */
type OrderableFields<C extends AnyContract, M extends string> = M extends string
  ? OrderableFieldNames<C, BareModelName<M>, NamespaceOf<C, M>>
  : never;

/** The columns `M` can be ordered by, which include those of a variant's base. */
type OrderableColumnName<Types extends SchemaTypes, M extends ModelKey<Types>> = keyof Row<
  Types,
  M
> &
  OrderableFields<Types['PrismaContract'], M | BaseModelKey<Types['PrismaContract'], M>>;

type OrderDirection = 'asc' | 'desc';

/**
 * The `orderBy` of a `query`: a direction for each column, or `{ direction, nulls }` to choose
 * where nulls sort. Nulls sort last by default. A connection appends the model's key to break
 * ties.
 */
export type RelationOrderBy<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  readonly [Column in OrderableColumnName<Types, M>]?:
    | OrderDirection
    | {
        readonly direction?: OrderDirection;
        /** Where nulls sort. Only allowed on a nullable column. */
        readonly nulls?: null extends Row<Types, M>[Column] ? 'first' | 'last' : never;
      };
};

/**
 * One ordering of a relation's rows as the ORM's `orderBy` takes it, such as
 * `(post) => post.createdAt.desc()`.
 */
export type RelationOrderSelector<Types extends SchemaTypes, M extends ModelKey<Types>> = (
  accessor: ModelAccessor<
    Types['PrismaContract'],
    BareModelName<M>,
    NamespaceOf<Types['PrismaContract'], M>
  >,
  tools: ModelCallbackTools<
    Types['PrismaContract'],
    BareModelName<M>,
    NamespaceOf<Types['PrismaContract'], M>
  >,
) => OrderByItem;

/**
 * A relation's `orderBy`: a declaration, or the ORM's selectors, one or several applied in order. A
 * connection pages by its columns, so it takes only a declaration.
 */
export type RelationQueryOrderBy<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | RelationOrderBy<Types, M>
  | RelationOrderSelector<Types, M>
  | readonly RelationOrderSelector<Types, M>[];

/** The columns a literal's declared `orderBy` names that `M` can't be ordered by. */
type UnknownOrderByColumns<Types extends SchemaTypes, M extends ModelKey<Types>, Literal> = Exclude<
  Literal extends { readonly orderBy?: infer OrderBy }
    ? NonNullable<OrderBy> extends ((...args: never[]) => unknown) | readonly unknown[]
      ? never
      : keyof NonNullable<OrderBy>
    : never,
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

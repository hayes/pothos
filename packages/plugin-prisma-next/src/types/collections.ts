import type { SchemaTypes } from '@pothos/core';
import type {
  Collection,
  CollectionRowOf,
  CollectionTypeState,
  DefaultCollectionTypeState,
  HasOrderBy,
  HasRow,
  HasTypeState,
  IncludeScalar,
} from '@prisma/orm-family-sql/orm-client';
import type { PlannedRowBrand } from '../object-ref.js';
import type {
  AnyContract,
  BareModelName,
  BaseModelKey,
  DiscriminatorField,
  ModelKey,
  ModelKeys,
  NamespacedModelKey,
  NamespaceOf,
  OwnRow,
  RelationKeys,
  Row,
  VariantModelKeyOf,
  VariantValue,
} from './models.js';

// orm-client doesn't export its include refinement types, but `combine()` takes its to-many
// refinement collection, so the terminals it omits are read from there.
// `IncludeRefinementResult` can't be, because it brands results with a module-private symbol.
type CombineRefinement<TContract extends AnyContract, ModelKey extends string> = Exclude<
  Parameters<Collection<TContract, ModelKey>['combine']>[0][string],
  IncludeScalar<unknown>
>;

/**
 * The collection of a to-many relation to `M` that an aggregate entry reduces, as `combine()`
 * passes it: the include refinement collection, with the aggregate methods.
 */
export type AggregateCollection<Types extends SchemaTypes, M extends ModelKey<Types>> = Omit<
  Collection<
    Types['PrismaNextContract'],
    BareModelName<M>,
    Row<Types, M>,
    WithNsId<DefaultCollectionTypeState, NamespaceOf<Types['PrismaNextContract'], M>>
  >,
  Exclude<
    keyof Collection<Types['PrismaNextContract'], BareModelName<M>>,
    keyof CombineRefinement<Types['PrismaNextContract'], BareModelName<M>>
  >
>;

/** The collection `orm.Task.variant('bug')` returns. The variant's own `orm.Bug` isn't filtered. */
type VariantCollection<Types extends SchemaTypes, M extends ModelKey<Types>> = HasTypeState<{
  readonly variantValue: VariantValue<Types['PrismaNextContract'], M>;
  readonly nsId: NamespaceOf<
    Types['PrismaNextContract'],
    BaseModelKey<Types['PrismaNextContract'], M>
  >;
}> & {
  readonly modelName: BareModelName<BaseModelKey<Types['PrismaNextContract'], M>>;
};

// orm-client doesn't export `WithNsId`, which `CollectionFor` needs to match `db.orm.<Model>`.
export type WithNsId<State extends CollectionTypeState, NsId extends string> = Omit<
  State,
  'nsId'
> & {
  readonly nsId: NsId;
};

export type CollectionFor<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R = OwnRow<Types, M>,
> = Collection<
  Types['PrismaNextContract'],
  BareModelName<M>,
  R,
  WithNsId<DefaultCollectionTypeState, NamespaceOf<Types['PrismaNextContract'], M>>
>;

/**
 * The collection a type's rows load from: `orm.<Model>`, or for a variant model its base narrowed
 * with `variant(value)`, as `orm.Task.variant('bug')` is.
 */
export type TypeCollection<Types extends SchemaTypes, M extends ModelKey<Types>> = [
  BaseModelKey<Types['PrismaNextContract'], M>,
] extends [never]
  ? CollectionFor<Types, M>
  : Collection<
      Types['PrismaNextContract'],
      BareModelName<BaseModelKey<Types['PrismaNextContract'], M>>,
      Row<Types, M> &
        Record<
          DiscriminatorField<
            Types,
            Extract<BaseModelKey<Types['PrismaNextContract'], M>, ModelKey<Types>>
          >,
          VariantValue<Types['PrismaNextContract'], M>
        >,
      {
        readonly hasOrderBy: boolean;
        readonly hasWhere: true;
        readonly variantValue: VariantValue<Types['PrismaNextContract'], M>;
        readonly nsId: NamespaceOf<
          Types['PrismaNextContract'],
          BaseModelKey<Types['PrismaNextContract'], M>
        >;
      }
    >;

/**
 * The receiver type upstream's collection helpers take. It leaves out mutation input types, which
 * can differ between a collection typed from `Types['PrismaNextContract']` and `db.orm`'s own. The
 * plugin includes what the query selects, so a collection that already includes a relation is
 * rejected.
 */
export type ResolverCollection<Types extends SchemaTypes, M extends ModelKey<Types>> = HasRow<
  IncludeFreeRow<Types, M>
> &
  ([BaseModelKey<Types['PrismaNextContract'], M>] extends [never]
    ? HasRow<OwnRow<Types, M>> &
        HasTypeState<{
          // A collection narrowed to a variant loads rows of the base type too.
          readonly variantValue: string | undefined;
          readonly nsId: NamespaceOf<Types['PrismaNextContract'], M>;
        }> & { readonly modelName: BareModelName<M> }
    : VariantCollection<Types, M>);

/**
 * Rejects an `include()`, which adds its relation to the collection's row: the plugin includes
 * what the query selects. The columns are listed too, so a row without relations shares a property
 * with this type, which only has optional ones.
 */
type IncludeFreeRow<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  readonly [K in keyof Row<Types, M> | RelationKeys<Types, M>]?: K extends RelationKeys<Types, M>
    ? never
    : unknown;
};

/**
 * Rejects an ordered collection: a connection orders its collection by its `query`'s `orderBy` and
 * the cursor.
 */
export type UnorderedCollection<Returned> = [Extract<Returned, HasOrderBy>] extends [never]
  ? unknown
  : never;

/**
 * The key of the model a collection's rows belong to: the model it reads, or the variant model
 * `variant()` narrowed it to. A collection of a contract with several namespaces that names no
 * namespace has every model of that name.
 */
type CollectionModelKey<C> = C extends {
  readonly modelName: infer Name extends string;
  readonly ctx: { readonly context: { readonly contract: infer TContract extends AnyContract } };
} & HasTypeState<infer State extends CollectionTypeState>
  ? (
      [State['nsId']] extends [never]
        ? Extract<ModelKeys<TContract>, Name | `${string}.${Name}`>
        : NamespacedModelKey<TContract, State['nsId'], Name>
    ) extends infer M extends string
    ? State['variantValue'] extends string
      ? VariantModelKeyOf<TContract, M, State['variantValue']>
      : M
    : never
  : never;

/** The rows of a planned collection: its own, branded as planned rows of its model. */
type PlannedRows<C> = C extends HasRow
  ? [CollectionModelKey<C>] extends [never]
    ? unknown
    : HasRow<CollectionRowOf<C> & PlannedRowBrand<CollectionModelKey<C>>>
  : unknown;

/**
 * The collection `collectionFromInfo` returns: its reads and writes return rows the loader planned,
 * so they fit a field returning a type of their model, as a `PlannedRow` does. It is `C` itself
 * with the rows branded, so a collection typed by a type parameter keeps its methods. Narrowing
 * the rows' columns with `select()` drops columns the selection planned, which the brand doesn't
 * track: return such rows only to types whose `select` they hold.
 */
export type PlannedCollection<C> = C & PlannedRows<C>;

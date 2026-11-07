import type {
  MaybeAsyncSelection,
  MaybePromise,
  Merge,
  OutputShape,
  OutputType,
  parentShapeKey,
  SchemaTypes,
  UnionToIntersection,
} from '@pothos/core';
import type { PathSegment } from '@pothos/selection-mapper';
import type { HasRow } from '@prisma/orm-family-sql/orm-client';
import type { prismaNextInterfaceBrand } from '../interface-ref.js';
import type { prismaNextModelBrand } from '../object-ref.js';
import type { CONNECTION_PAGE, NESTED_SELECTION, NODE_SELECTION } from '../utils/compile-select.js';
import type { ParamToModelKey } from './fields.js';
import type {
  BaseModelKey,
  ExtractModel,
  IsUnion,
  LoadedRow,
  ModelKey,
  ObjectBaseShape,
  OwnRelationsOfModel,
  PlannedRow,
  RelationKeys,
  Row,
  VariantModelKeys,
} from './models.js';
import type { UnknownOrderByColumns } from './order-by.js';
import type {
  DefaultRelationNullable,
  IsToMany,
  ModelRefinementCollection,
  RelatedModel,
  RelationFieldShape,
  RelationQueryLiteral,
  RelationQueryValue,
  RelationRefinement,
  RelationRefinementCollection,
  RelationTypeModel,
  ToManyRelationKeys,
} from './relations.js';

/**
 * `true` loads a column or includes a relation, and a to-many relation also takes a query or a
 * function refining its collection. Any other key is a computed value, `{ relation: (sub) => value }`,
 * written onto the parent.
 */
export type PrismaNextSelectSpec<Types extends SchemaTypes, ParentShape> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelKey<Types>
      ? SelectObjectSpec<Types, M>
      : never
    : never;

// Keys come from the full row rather than the parent shape, because the `select` adds to it.
type FieldSelectColumn<Types extends SchemaTypes, ParentShape> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelKey<Types>
      ? keyof Row<Types, M> & string
      : never
    : never;

/**
 * Tuples, so each array literal infers as its own tuple. Branches that select different columns
 * then stay a union, with their columns optional, instead of merging into one array. Adding
 * `readonly K[]` here would lose that. An array variable is also accepted, with its columns
 * optional, since it may hold any subset of them.
 */
type FieldSelectArray<Types extends SchemaTypes, ParentShape> =
  | readonly []
  | readonly [FieldSelectEntry<Types, ParentShape>, ...FieldSelectEntry<Types, ParentShape>[]];

/**
 * Any string, still completing the columns, so an unknown column reaches `ValidateFieldSelect`,
 * which names it. With only the columns here, an array of nothing but unknown columns fails as
 * `'titel'` not assignable to `never` on TypeScript 7.
 */
type FieldSelectEntry<Types extends SchemaTypes, ParentShape> =
  | FieldSelectColumn<Types, ParentShape>
  | (string & {});

/**
 * A column array, a `select` object, or a function of the args, the context and `nestedSelection`
 * returning a `select` object, which may be async with `AsyncSelections: true`. A function has one
 * form, the object.
 */
export type PrismaNextFieldSelect<
  Types extends SchemaTypes,
  ParentShape,
  Args,
  TypeModel extends ModelKey<Types> = never,
> =
  | FieldSelectArray<Types, ParentShape>
  | PrismaNextSelectSpec<Types, ParentShape>
  | ((
      args: Args,
      ctx: Types['Context'],
      nestedSelection: NestedSelectionFn<Types, TypeModel, Args>,
    ) => MaybeAsyncSelection<Types, PrismaNextSelectSpec<Types, ParentShape>>);

/** `PrismaNextFieldSelect` narrowed to the form `Select` is written in, so a failing object isn't reported against `undefined`. */
export type PrismaNextFieldSelectForm<
  Types extends SchemaTypes,
  ParentShape,
  Args,
  TypeModel extends ModelKey<Types>,
  Select,
> = unknown extends Select
  ? PrismaNextFieldSelect<Types, ParentShape, Args, TypeModel>
  : [Select] extends [readonly unknown[] | ((...args: never[]) => unknown)]
    ? PrismaNextFieldSelect<Types, ParentShape, Args, TypeModel>
    : PrismaNextSelectSpec<Types, ParentShape>;

/** The model of a field's type: of a `prismaObject` or `prismaInterface` ref, or a list of one. */
export type TypeParamModel<Types extends SchemaTypes, Type> = Type extends readonly [infer Item]
  ? TypeParamModel<Types, Item>
  : Type extends { readonly [prismaNextModelBrand]: infer M extends ModelKey<Types> }
    ? M
    : Type extends { readonly [prismaNextInterfaceBrand]: infer M extends ModelKey<Types> }
      ? M
      : never;

/**
 * A relation entry from `nestedSelection`: the relation's rows, with the selection planned beneath
 * them as a type of model `M`. `HasQuery` is whether it was given a query, which a to-one relation
 * takes none of. `Shape` is the type's shape, or `never` for rows typed as planned rows of `M`.
 * `Query` is a query given without a model, which the `select` checks as its relation's.
 */
export interface NestedSelectionEntry<M, HasQuery extends boolean, Shape = never, Query = unknown> {
  /** Type-only: what the entry plans. */
  readonly [NESTED_SELECTION]: {
    readonly model: M;
    readonly query: HasQuery;
    readonly shape: Shape;
    readonly untypedQuery: Query;
  };
}

/** What `nestedSelection`'s `type` takes: what a field's `type` takes, or a model's name. */
export type NestedSelectionType<Types extends SchemaTypes> = OutputType<Types> | ModelKey<Types>;

/** The shape of a `nestedSelection` type: a ref's, or `never` for a name. */
type NestedTypeShape<Types extends SchemaTypes, Type> = Type extends string
  ? never
  : OutputShape<Types, Type>;

/**
 * A query for rows of `M`. Without a model, such as for a wrapper type or a type named by a name
 * that isn't a model's, it isn't typed by one, and the `select` checks its keys.
 */
type NestedQueryLiteral<Types extends SchemaTypes, M extends ModelKey<Types>> = [M] extends [never]
  ? { where?: object; orderBy?: object; limit?: number; offset?: number }
  : RelationQueryLiteral<Types, M>;

/** The `query` of `nestedSelection`, as a to-many relation's `query` takes it. */
export type NestedSelectionQuery<Types extends SchemaTypes, M extends ModelKey<Types>, Args> =
  | NestedQueryLiteral<Types, M>
  | ((
      args: Args,
      ctx: Types['Context'],
    ) => MaybeAsyncSelection<
      Types,
      | NestedQueryLiteral<Types, M>
      | ([M] extends [never]
          ? never
          : (
              collection: ModelRefinementCollection<Types, M>,
            ) => ModelRefinementCollection<Types, M>)
      | undefined
    >);

/**
 * Plans the selection beneath a field into a relation entry of its `select`: the relation's rows
 * are loaded with `query`, and planned as `type` (by default the field's type) at `path` beneath
 * the field. `type` takes what a field's `type` does, or a model's name for its default type. The
 * query and rows are typed by its model and shape. With a `path` and no `type`, or a type name that
 * isn't a model's, the rows are typed as the relation's target, and the `select` checks the query's
 * keys as the relation's.
 */
export interface NestedSelectionFn<Types extends SchemaTypes, M extends ModelKey<Types>, Args> {
  (query?: true): NestedSelectionEntry<M, false>;
  (query: NestedSelectionQuery<Types, M, Args>): NestedSelectionEntry<M, true>;
  (query: true | undefined, path: PathSegment[] | undefined): NestedSelectionEntry<never, false>;
  <Query extends NestedSelectionQuery<Types, never, Args>>(
    query: Query,
    path: PathSegment[] | undefined,
  ): NestedSelectionEntry<never, true, never, Query>;
  <const Type extends NestedSelectionType<Types>>(
    query: true | undefined,
    path: PathSegment[] | undefined,
    type: Type,
  ): NestedSelectionEntry<ParamToModelKey<Types, Type>, false, NestedTypeShape<Types, Type>>;
  <
    const Type extends NestedSelectionType<Types>,
    Query extends NestedSelectionQuery<Types, ParamToModelKey<Types, NoInfer<Type>>, Args>,
  >(
    query: Query,
    path: PathSegment[] | undefined,
    type: Type,
  ): NestedSelectionEntry<ParamToModelKey<Types, Type>, true, NestedTypeShape<Types, Type>, Query>;
}

/**
 * A field `select` entry that loads one page of a to-many relation whose rows are `Row`s of model
 * `M`, from `prismaConnectionHelpers(...).getQuery`.
 */
export interface ConnectionPageEntry<M, Row> {
  /** Type-only: what the page loads. */
  readonly [CONNECTION_PAGE]: { readonly model: M; readonly row: Row };
}

/** Where a connection helper's `select` loads the nodes: the node selection is planned there. */
export interface NodeSelection {
  readonly [NODE_SELECTION]: true;
}

/** What a combine spec entry loads. A collection loads its rows, and a reducer its result. */
type SpecValueResult<V> =
  V extends HasRow<infer R>
    ? V extends { readonly kind: 'includeScalar' | 'includeCombine' }
      ? R
      : readonly R[]
    : unknown;

/**
 * What the `prismaInterface`s of the type's own model select, since they load for the type too. An
 * interface of another model adds nothing, so implementing it fails.
 */
export type InterfaceSelectShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Interfaces,
> = [Interfaces] extends [readonly unknown[]]
  ? UnionToIntersection<
      Interfaces[number] extends infer I
        ? // Inferring against the ref class would compare its whole structure, so read its keys.
          I extends {
            readonly [prismaNextInterfaceBrand]: infer IM extends string;
            readonly [parentShapeKey]: infer Shape;
          }
          ? M extends IM | VariantModelKeys<Types['PrismaNextContract'], IM>
            ? Shape
            : {}
          : {}
        : never
    >
  : unknown;

/**
 * Rejects a relation only a variant declares in a type's `select`, as an entry or read by a computed
 * value. A type's rows can load through the base model's collection, which can't include it, so it
 * goes in a field's `select` instead.
 */
type VariantRelationCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  BaseModelKey<Types['PrismaNextContract'], M>,
] extends [never]
  ? unknown
  : [Select] extends [readonly unknown[]]
    ? unknown
    : {
        [K in
          | (keyof Select & keyof OwnRelationsOfModel<Types['PrismaNextContract'], M>)
          | {
              [C in ComputedSelectKeys<Types, M, Select>]: keyof NonNullable<Select[C]> &
                keyof OwnRelationsOfModel<Types['PrismaNextContract'], M>;
            }[ComputedSelectKeys<
              Types,
              M,
              Select
            >] as `A variant's own relation loads only in a field's select, such as t.relation or t.field({ select }): ${K &
          string}`]: never;
      };

/** The keys a `select` names as they are: the model's columns and relations. */
type KnownSelectKeys<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | (keyof Row<Types, M> & string)
  | RelationKeys<Types, M>;

/** The keys of `Select` that are computed values. */
type ComputedSelectKeys<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = Exclude<
  keyof Select,
  KnownSelectKeys<Types, M>
>;

/**
 * The entries a `select` takes for the model's columns and relations. `Misplaced` is also accepted
 * for each, so a computed value under a column's or relation's key gets its types from the spec
 * and is then named by `InvalidSelectValueCheck`, which checks against the spec without it.
 */
type KnownSelectSpec<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Misplaced = never,
  Nested extends boolean = false,
> = {
  readonly [K in KnownSelectKeys<Types, M>]?:
    | Misplaced
    | (K extends RelationKeys<Types, M>
        ?
            | true
            | RelationQueryValue<Types, M, K>
            | RelationEntrySpec<Types, M, K>
            | ModelTypeRef<EntryTypeModel<Types, M, K>>
            | (IsToMany<Types, M, K> extends true
                ?
                    | RelationRefinement<Types, M, K>
                    // A connection helper's page, on a field's own `select` only.
                    | (Nested extends true
                        ? never
                        : ConnectionPageEntry<RelationTypeModel<Types, M, K>, unknown>)
                    | NestedSelectionEntry<RelationTypeModel<Types, M, K>, boolean, unknown>
                : // A to-one relation's rows load whole, so they're planned as its target.
                  NestedSelectionEntry<RelatedModel<Types, M, K>, false, unknown>)
        : K extends keyof Row<Types, M>
          ? true
          : never);
};

/** The `query` a relation entry with a nested `select` takes: a to-many relation's entry. */
type NestedSelectQuery<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> =
  IsToMany<Types, M, K> extends true
    ? RelationQueryValue<Types, M, K> | RelationRefinement<Types, M, K>
    : never;

/** A ref of a prisma type of model `M`, which a relation entry loads its rows as. */
export type ModelTypeRef<M> =
  | { readonly [prismaNextModelBrand]: M }
  | { readonly [prismaNextInterfaceBrand]: M };

/**
 * The models a relation entry's type can be of: the relation's target, or for a to-many relation
 * one of its variants, which narrows the rows to it. A to-one relation's row loads whole.
 */
type EntryTypeModel<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> = IsToMany<Types, M, K> extends true ? RelationTypeModel<Types, M, K> : RelatedModel<Types, M, K>;

/**
 * A relation entry as an object: the `type` its rows load as, a `select` of their own in the same
 * form one level down, and for a to-many relation a `query`. It has a type or a `select`, and a
 * bare ref is `{ type: ref }`.
 */
export type RelationEntrySpec<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> =
  | NestedSelectSpec<Types, M, K>
  | (EntryTypeModel<Types, M, K> extends infer TM extends ModelKey<Types>
      ? // One member per model, so a nested `select` is completed and inferred as that model's.
        TM extends unknown
        ? TypedRelationEntrySpec<Types, M, K, TM>
        : never
      : never);

export interface NestedSelectSpec<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> {
  readonly type?: undefined;
  readonly query?: NestedSelectQuery<Types, M, K>;
  readonly select: SelectObjectSpec<Types, RelatedModel<Types, M, K>, true>;
}

export interface TypedRelationEntrySpec<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  TM extends ModelKey<Types>,
> {
  readonly type: ModelTypeRef<TM>;
  readonly query?: NestedSelectQuery<Types, M, K>;
  readonly select?: SelectObjectSpec<Types, TM, true>;
}

/**
 * A computed value: one to-many relation, whose collection the function reduces, such as with
 * `count()`, or refines into the rows it loads.
 */
export type ComputedSelectEntry<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  readonly [K in ToManyRelationKeys<Types, M>]?: (
    sub: RelationRefinementCollection<Types, M, K>,
  ) => HasRow<unknown>;
};

/**
 * The model's columns and relations, and any other key as a computed value. The index signature
 * types the computed entries, and takes anything, so the model's own entries fit it too;
 * `SelectCheck` checks the computed entries. TypeScript types a known key's entry by its own
 * property rather than the index signature. Arrays, functions and interfaces have no index
 * signature, so the known entries alone are a member of their own, as they were before computed
 * keys.
 */
export type SelectObjectSpec<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Nested extends boolean = false,
> =
  | KnownSelectSpec<Types, M, ComputedSelectEntry<Types, M>, Nested>
  | (KnownSelectSpec<Types, M, ComputedSelectEntry<Types, M>, Nested> & {
      readonly [key: string]: ComputedSelectEntry<Types, M> | {} | undefined;
    });

/** What a computed entry loads: the result of its one relation's function. */
type ComputedValue<Entry> = Entry[keyof Entry] extends (sub: never) => infer R
  ? SpecValueResult<R>
  : never;

type ComputedShape<Types extends SchemaTypes, M extends ModelKey<Types>, S> = [
  ComputedSelectKeys<Types, M, S>,
] extends [never]
  ? unknown
  : {
      -readonly [K in ComputedSelectKeys<Types, M, S> as S[K] extends object
        ? K
        : never]: ComputedValue<S[K]>;
    };

type SimpleRelationShape<Types extends SchemaTypes, M extends ModelKey<Types>, S> = {
  [K in keyof S & RelationKeys<Types, M> as S[K] extends
    | ConnectionPageEntry<unknown, unknown>
    | NestedSelectionEntry<unknown, boolean, unknown>
    | ObjectRelationEntry
    ? never
    : S[K] extends true | RelationQueryValue<Types, M, K> | ((sub: never) => unknown)
      ? K
      : never]: RelationShape<Types, M, K>;
} & {
  // A connection helper's page: the rows it loaded, which its `resolve` takes.
  [K in keyof S & RelationKeys<Types, M> as S[K] extends ConnectionPageEntry<unknown, unknown>
    ? K
    : never]: S[K] extends ConnectionPageEntry<unknown, infer PageRow> ? readonly PageRow[] : never;
} & {
  // Rows `nestedSelection` planned as its type, or as the relation's target beneath a type
  // without a model.
  [K in keyof S & RelationKeys<Types, M> as S[K] extends NestedSelectionEntry<
    unknown,
    boolean,
    unknown
  >
    ? K
    : never]: S[K] extends NestedSelectionEntry<infer TypeModel, boolean, infer Shape>
    ? NestedRows<
        Types,
        M,
        K,
        [Shape] extends [never]
          ? PlannedRow<
              Types,
              [TypeModel] extends [never]
                ? RelatedModel<Types, M, K>
                : TypeModel & RelationTypeModel<Types, M, K>
            >
          : Shape
      >
    : never;
} & {
  // Rows of the entry's type, with what their nested `select` adds.
  [K in keyof S & RelationKeys<Types, M> as S[K] extends ObjectRelationEntry
    ? K
    : never]: NestedRows<
    Types,
    M,
    K,
    S[K] extends { readonly select: infer Nested }
      ? NestedSelectRow<Types, EntryModel<Types, M, K, S[K]>, Nested>
      : LoadedRow<Types, EntryModel<Types, M, K, S[K]>>
  >;
};

/** A relation entry with a type or a nested `select`, or a bare ref. A query has neither key. */
type ObjectRelationEntry =
  | { readonly select: object }
  | { readonly type: object }
  | ModelTypeRef<unknown>;

/** The model of a relation entry's type, or the relation's target for an entry without one. */
type EntryModel<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  Entry,
> =
  TypeParamModel<
    Types,
    Entry extends { readonly type: infer Type } ? Type : Entry
  > extends infer TM extends ModelKey<Types>
    ? [TM] extends [never]
      ? RelatedModel<Types, M, K>
      : TM
    : never;

/** A row of `M` loaded whole, with the relations and computed values its nested `select` adds. */
type NestedSelectRow<Types extends SchemaTypes, M extends ModelKey<Types>, S> = LoadedRow<
  Types,
  M
> &
  SimpleRelationShape<Types, M, S> &
  ComputedShape<Types, M, S>;

/** Planned rows of relation `R`: a list for a to-many relation, and nullable as the contract says. */
type NestedRows<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  PlannedRows,
> =
  IsToMany<Types, M, R> extends true
    ? readonly PlannedRows[]
    : PlannedRows | (DefaultRelationNullable<Types, M, R> extends true ? null : never);

type SimpleColumnShape<Types extends SchemaTypes, M extends ModelKey<Types>, S> = {
  [K in keyof S & keyof Row<Types, M> as S[K] extends true ? K : never]: Row<Types, M>[K];
};

/**
 * The entries of an object `select` that may be left out, as a spread of a conditional leaves them.
 * An entry that is only ever `undefined`, as normalizing a union of branches leaves it, selects
 * nothing.
 */
type OptionalSelectEntries<S> = {
  [K in keyof S as undefined extends S[K]
    ? [NonNullable<S[K]>] extends [never]
      ? never
      : K
    : never]-?: NonNullable<S[K]>;
};

/** What the entries of an object `select` that may be left out add, as optional keys. */
type OptionalSelectShape<Types extends SchemaTypes, M extends ModelKey<Types>, S> = [
  keyof OptionalSelectEntries<S>,
] extends [never]
  ? unknown
  : Partial<
      SimpleColumnShape<Types, M, OptionalSelectEntries<S>> &
        SimpleRelationShape<Types, M, OptionalSelectEntries<S>> &
        ComputedShape<Types, M, OptionalSelectEntries<S>>
    >;

/** Not distributed over `Select`, so a conditional's branches all reach `SelectCheck`. */
export type ValidateFieldSelect<Types extends SchemaTypes, ParentShape, Select> = [Select] extends [
  (...args: infer Args) => infer Result,
]
  ? (...args: Args) => MaybePromise<ValidateSelectResult<Types, ParentShape, Awaited<Result>>>
  : ValidateSelectValue<Types, ParentShape, Select>;

/**
 * Checks what a select function returns. `unknown` means no `select` to `SelectCheck`, but here it
 * would load nothing without saying so. `any` opts out of the check. A column array is a static
 * `select` only.
 */
type ValidateSelectResult<Types extends SchemaTypes, ParentShape, Result> = [unknown] extends [
  Result,
]
  ? 0 extends 1 & Result
    ? unknown
    : NotASelect<Result>
  : [Extract<Result, readonly unknown[]>] extends [never]
    ? ValidateSelectValue<Types, ParentShape, Result>
    : NotASelect<Result>;

/** Names an unknown column in an error, where a plain `never` would only say "not assignable". */
interface UnknownSelectColumn<Column> {
  readonly 'Unknown column in select': Column;
}

/**
 * Checks an array `select` entry. An unknown column becomes an object brand rather than `never` or
 * a message string, so the error names it (`'emial' & UnknownSelectColumn<'emial'>`) and the brand
 * is never offered as a string completion. A non-literal entry, such as the editor's placeholder
 * while completing, becomes the column names, so completions list only columns.
 */
export type SelectColumnCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Column,
> = Column extends keyof Row<Types, M> & string
  ? Column
  : Column extends string
    ? string extends Column
      ? keyof Row<Types, M> & string
      : UnknownSelectColumn<Column>
    : keyof Row<Types, M> & string;

type ValidateSelectValue<Types extends SchemaTypes, ParentShape, Select> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelKey<Types>
      ? SelectCheck<Types, M, Select>
      : never
    : never;

/**
 * Checks a field's or a type's `select`, which is inferred from the literal, not checked. Every
 * branch of a union must pass, so the branches' checks are intersected: as a union, a branch that
 * passes (`unknown`) would absorb one that doesn't.
 */
export type SelectCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
> = unknown extends Select
  ? unknown
  : // Valid arrays, the common case, need no walk of their branches.
    [Select] extends [readonly (keyof Row<Types, M>)[]]
    ? unknown
    : (
          Select extends unknown
            ? (check: [BranchSelectCheck<Types, M, Select>]) => void
            : never
        ) extends (check: [infer Check]) => void
      ? Check
      : never;

type BranchSelectCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
> = Select extends readonly unknown[]
  ? // Only an invalid array is mapped entry by entry, to name the unknown columns.
    Select extends readonly (keyof Row<Types, M>)[]
    ? unknown
    : { readonly [K in keyof Select]: SelectColumnCheck<Types, M, Select[K]> }
  : Select extends string | number | boolean | bigint | symbol | ((...args: never[]) => unknown)
    ? NotASelect<Select>
    : ExactSelectCheck<Types, M, Select>;

/** Names a primitive or function `select`, which the object spec's optional keys would accept. */
interface NotASelect<Value> {
  readonly 'A select is a column array or an object, not': Value;
}

/**
 * Whether a `select` entry is shaped as a computed value, `{ relation: fn }`, which under a column or
 * relation's key names the error after the collision rather than the entry's inner keys.
 */
type LooksComputed<Types extends SchemaTypes, M extends ModelKey<Types>, Value> = [
  keyof Value & ToManyRelationKeys<Types, M>,
] extends [never]
  ? false
  : true;

type UnknownSelectKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
> = Select extends object
  ? // A key that is neither the model's nor a computed value, such as a misspelled column.
      | {
          [K in ComputedSelectKeys<Types, M, Select>]: NonNullable<Select[K]> extends object
            ? never
            : K;
        }[ComputedSelectKeys<Types, M, Select>]
      | {
          [K in keyof Select & RelationKeys<Types, M> & string]: Select[K] extends
            | true
            | ((...args: never[]) => unknown)
            ? never
            : Select[K] extends ModelTypeRef<unknown>
              ? never
              : Select[K] extends { readonly select: object } | { readonly type: object }
                ? NestedEntryUnknownKeys<Types, M, K, Select[K]>
                : Select[K] extends NestedSelectionEntry<never, true, unknown, infer Query>
                  ? UntypedQueryUnknownKeys<Types, RelatedModel<Types, M, K>, K, Query>
                  :
                      | (Exclude<
                          keyof Select[K],
                          keyof RelationQueryValue<Types, M, K>
                        > extends infer Unknown
                          ? [Unknown] extends [never]
                            ? never
                            : LooksComputed<Types, M, Select[K]> extends true
                              ? never
                              : `${K}.${Unknown & (string | number)}`
                          : never)
                      | `${K}.orderBy.${UnknownOrderByColumns<Types, RelatedModel<Types, M, K>, Select[K]> & string}`;
        }[keyof Select & RelationKeys<Types, M> & string]
  : never;

/**
 * The unknown keys of a query `nestedSelection` was given without a model, as relation `K` to `M`
 * takes it: its options, and the columns its `where` and `orderBy` name. Only keys are checked, as
 * a callback's result isn't inferred with literal values.
 */
type UntypedQueryUnknownKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends string,
  Query,
> = (
  Query extends (...args: never[]) => infer Result
    ? Exclude<Awaited<Result>, undefined>
    : Query
) extends infer Literal
  ?
      | `${K}.query.${Exclude<keyof Literal, keyof RelationQueryLiteral<Types, M>> & (string | number)}`
      | `${K}.query.orderBy.${UnknownOrderByColumns<Types, M, Literal> & string}`
      | (Literal extends { readonly where?: infer Where }
          ? NonNullable<Where> extends (...args: never[]) => unknown
            ? never
            : `${K}.query.where.${Exclude<keyof NonNullable<Where>, keyof Row<Types, M>> & string}`
          : never)
  : never;

/** The unknown keys of a relation entry with a nested `select`, which is checked on its own. */
type NestedEntryUnknownKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M> & string,
  Entry,
> =
  | `${K}.${Exclude<keyof Entry, 'type' | 'query' | 'select'> & (string | number)}`
  | (Entry extends { readonly query?: infer Query }
      ? NonNullable<Query> extends (...args: never[]) => unknown
        ? never
        :
            | `${K}.query.${Exclude<
                keyof NonNullable<Query>,
                keyof RelationQueryLiteral<Types, RelatedModel<Types, M, K>>
              > &
                (string | number)}`
            | `${K}.query.orderBy.${UnknownOrderByColumns<
                Types,
                RelatedModel<Types, M, K>,
                NonNullable<Query>
              > &
                string}`
      : never);

/** An object `select`'s unknown keys and invalid values. */
type ExactSelectCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = ([
  UnknownSelectKeys<Types, M, Select>,
] extends [never]
  ? unknown
  : {
      [K in UnknownSelectKeys<Types, M, Select> &
        (string | number) as `Unknown key in select: ${K}`]: never;
    }) &
  InvalidSelectValueCheck<Types, M, Select> &
  ComputedEntryCheck<Types, M, Select> &
  NestedSelectCheck<Types, M, Select>;

/** The relation entries of `Select` whose nested `select` fails its check. */
type NestedSelectKeys<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  [K in keyof Select & RelationKeys<Types, M>]: [NonNullable<Select[K]>] extends [never]
    ? never
    : NonNullable<Select[K]> extends { readonly select: infer Nested extends object }
      ? unknown extends SelectCheck<Types, EntryModel<Types, M, K, NonNullable<Select[K]>>, Nested>
        ? never
        : K
      : never;
}[keyof Select & RelationKeys<Types, M>];

/**
 * Checks the nested `select` of each relation entry that has one, as a `select` of its type's
 * model or of its target.
 */
type NestedSelectCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  NestedSelectKeys<Types, M, Select>,
] extends [never]
  ? unknown
  : {
      [K in NestedSelectKeys<Types, M, Select>]?: NonNullable<Select[K]> extends {
        readonly select: infer Nested;
      }
        ? {
            readonly select: SelectCheck<
              Types,
              EntryModel<Types, M, K, NonNullable<Select[K]>>,
              Nested
            >;
          }
        : never;
    };

/** A single key, rather than none or a union of several. */
type IsOneKey<K> = [K] extends [never] ? false : IsUnion<K> extends true ? false : true;

/**
 * Names a computed value that doesn't read exactly one to-many relation with a function returning
 * a collection or reducer, such as `{ posts: fn, comments: fn }`. The spec's index signature
 * accepts any value, so this is the check.
 */
type ComputedEntryCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  ComputedSelectKeys<Types, M, Select>,
] extends [never]
  ? unknown
  : ComputedEntryErrors<Types, M, Select>;

type ComputedEntryErrors<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  [K in ComputedSelectKeys<Types, M, Select>]: NonNullable<Select[K]> extends infer Entry extends
    object
    ? IsOneKey<keyof Entry> extends true
      ? keyof Entry extends ToManyRelationKeys<Types, M>
        ? Entry extends ComputedSelectEntry<Types, M>
          ? never
          : K
        : K
      : K
    : never;
}[ComputedSelectKeys<Types, M, Select>] extends infer Invalid extends string | number
  ? [Invalid] extends [never]
    ? unknown
    : {
        [K in Invalid as `A computed value reads one to-many relation, as { relation: (collection) => value }: ${K}`]: never;
      }
  : unknown;

/**
 * Names a key whose value doesn't fit the spec, such as `email: { limit: 1 }`,
 * `posts: (sub) => 1` or `posts: { limit: 'x' }`. Checking `Select` against the spec misses
 * these. The spec's relation options are all optional, so its intersection with an inferred
 * function accepts any function, and a function's result is checked only for unknown keys. A
 * computed value under a column's or relation's key is named as such.
 */
type InvalidSelectValueCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  // A branch's spread or normalized union can leave a key undefined, which selects nothing.
  [K in keyof Select & KnownSelectKeys<Types, M>]: (
    [NonNullable<Select[K]>] extends [never]
      ? true
      : NonNullable<Select[K]> extends { readonly select: object } | { readonly type: object }
        ? // Its nested `select` is checked on its own.
          K extends RelationKeys<Types, M>
          ? Omit<NonNullable<Select[K]>, 'select'> extends {
              readonly type?: ModelTypeRef<EntryTypeModel<Types, M, K>>;
              readonly query?: NestedSelectQuery<Types, M, K>;
            }
            ? true
            : false
          : false
        : NonNullable<Select[K]> extends NonNullable<KnownSelectSpec<Types, M>[K]>
          ? true
          : false
  ) extends true
    ? never
    : K;
}[keyof Select & KnownSelectKeys<Types, M>] extends infer Invalid extends string
  ? [Invalid] extends [never]
    ? unknown
    : {
        [K in Invalid as LooksComputed<Types, M, NonNullable<Select[K & keyof Select]>> extends true
          ? `A computed key can't be a column or relation: ${K}`
          : InvalidValueMessage<Types, M, K, NonNullable<Select[K & keyof Select]>>]: never;
      }
  : unknown;

/** Names a relation entry whose type isn't of the relation's target, or a variant of it. */
type EntryTypeError<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  Entry,
> = (Entry extends { readonly type: infer Type } ? Type : Entry) extends infer Type
  ? Type extends ModelTypeRef<unknown>
    ? Type extends ModelTypeRef<EntryTypeModel<Types, M, K>>
      ? never
      : IsToMany<Types, M, K> extends true
        ? `A relation entry's type is of its target model or one of its variants: ${K}`
        : `A to-one relation entry's type is of its target model: ${K}`
    : never
  : never;

/** Names what's wrong with an invalid entry, `Entry`, under key `K`. */
type InvalidValueMessage<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends string,
  Entry,
> =
  K extends RelationKeys<Types, M>
    ? [EntryTypeError<Types, M, K, Entry>] extends [never]
      ? InvalidRelationValueMessage<Types, M, K, Entry>
      : EntryTypeError<Types, M, K, Entry>
    : `Invalid value in select: ${K}`;

type InvalidRelationValueMessage<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  Entry,
> =
  K extends ToManyRelationKeys<Types, M>
    ? `Invalid value in select: ${K}`
    : Entry extends
          | NestedSelectionEntry<unknown, true, unknown>
          | { readonly query: unknown }
          | { readonly where: unknown }
          | { readonly orderBy: unknown }
          | { readonly limit: unknown }
          | { readonly offset: unknown }
      ? `A to-one relation takes no query: ${K}`
      : `Invalid value in select: ${K}`;

/** A to-one relation is nullable when the contract says so. */
type RelationShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
> = RelationFieldShape<Types, M, R, DefaultRelationNullable<Types, M, R>>;

/**
 * A function-form `select` contributes what it returns. When its branches return different
 * selections, a column every branch selects is present and the others are optional.
 */
export type ShapeFromSelect<Types extends SchemaTypes, ParentShape, Select> = unknown extends Select
  ? ParentShape
  : Select extends (...args: never[]) => infer Result
    ? IsUnion<Awaited<Result>> extends true
      ? ShapeFromSelectValue<Types, ParentShape, Awaited<Result>> extends infer Branches
        ? // `keyof` a union is the keys every member has, typed as any branch loads them.
          Merge<
            ParentShape &
              Partial<Omit<UnionToIntersection<Branches>, keyof Branches>> &
              Pick<Branches, keyof Branches>
          >
        : never
      : Merge<
          ShapeFromSelectValue<Types, ParentShape, Awaited<Result>> &
            OptionalSelectShape<Types, ExtractModel<Types, ParentShape>, Awaited<Result>>
        >
    : ShapeFromSelectValue<Types, ParentShape, Select>;

// The unreachable `ParentShape` fallbacks make checks against a deferred shape cheaper.
type ShapeFromSelectValue<Types extends SchemaTypes, ParentShape, Select> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelKey<Types>
      ? Select extends readonly (infer K extends keyof Row<Types, M>)[]
        ? Merge<ParentShape & SelectedColumns<Pick<Row<Types, M>, K>, Select>>
        : Select extends Record<string, unknown>
          ? Merge<
              Omit<ParentShape, keyof SimpleRelationShape<Types, M, Select>> &
                SimpleColumnShape<Types, M, Select> &
                SimpleRelationShape<Types, M, Select> &
                ComputedShape<Types, M, Select>
            >
          : ParentShape
      : ParentShape
    : ParentShape;

/** An array that isn't a tuple, such as a variable, may hold any subset of its columns. */
type SelectedColumns<Columns, Select extends readonly unknown[]> = number extends Select['length']
  ? Partial<Columns>
  : Columns;

export type ShapeFromObjectSelect<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
> = unknown extends Select
  ? ObjectBaseShape<Types, M>
  : // The brand stays a named interface beside the columns, so exported refs can be emitted.
    ObjectBaseShape<
      Types,
      M,
      Select extends readonly (infer K extends keyof Row<Types, M>)[]
        ? SelectedColumns<Pick<Row<Types, M>, K>, Select>
        : Select extends Record<string, unknown>
          ? SimpleColumnShape<Types, M, Select> &
              SimpleRelationShape<Types, M, Select> &
              ComputedShape<Types, M, Select>
          : unknown
    >;

/**
 * Checks a type's `select` and offers completions for it. It sits beside a plain `select?: Select`,
 * which stays the only inference site, because inferring through an intersection would narrow a
 * union `Select` to one member.
 */
export type TypeSelectCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  // Picked by the form of `Select` rather than a union of both, which a failing object `select`
  // is reported against as not assignable to `undefined`. The checks below name what a type's
  // `select` can't take. While completing, `Select` is `unknown`, so both forms are offered.
  select?: (unknown extends Select
    ? readonly (keyof Row<Types, M> & string)[] | SelectObjectSpec<Types, M>
    : [Select] extends [readonly unknown[]]
      ? readonly (keyof Row<Types, M> & string)[]
      : SelectObjectSpec<Types, M>) &
    NoInfer<
      SelectCheck<Types, M, Select> &
        NoTypeLevelPage<Select> &
        VariantRelationCheck<Types, M, Select>
    >;
};

/** A connection helper's page loads for one field, so a type's `select` can't take one. */
type NoTypeLevelPage<Select> = {
  [K in keyof Select as Select[K] extends ConnectionPageEntry<unknown, unknown>
    ? `A connection page loads only in a field's select: ${K & string}`
    : never]: never;
};

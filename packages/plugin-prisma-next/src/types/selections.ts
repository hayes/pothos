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
import type { IncludeScalar } from '@prisma/orm-family-sql/orm-client';
import type { prismaNextInterfaceBrand } from '../interface-ref.js';
import type { prismaNextModelBrand } from '../object-ref.js';
import type { CONNECTION_PAGE, NESTED_SELECTION, NODE_SELECTION } from '../utils/compile-select.js';
import type { ParamToModelKey } from './fields.js';
import type {
  BaseModelKey,
  DiscriminatorField,
  DiscriminatorRow,
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
import type { OrderByColumnsCheck, UnknownOrderByColumns } from './order-by.js';
import type {
  DefaultRelationNullable,
  ExactQueryLiteral,
  IsToMany,
  RelatedModel,
  RelationFieldShape,
  RelationQueryLiteral,
  RelationRefinementCollection,
  RelationTypeModel,
} from './relations.js';

/**
 * Where a `select` is written. A type's `select` takes columns and relation entries. A field's also
 * takes `nestedSelection` entries, aggregates and connection pages, and the `select` nested in one
 * of its relation entries takes all but pages.
 */
type SelectLevel = 'type' | 'field' | 'nested';

/** A field's `select` object for the model of `ParentShape`. */
export type PrismaNextSelectSpec<Types extends SchemaTypes, ParentShape> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelKey<Types>
      ? SelectObjectSpec<Types, M, 'field'>
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
  TypeShape = never,
> =
  | FieldSelectArray<Types, ParentShape>
  | PrismaNextSelectSpec<Types, ParentShape>
  | ((
      args: Args,
      ctx: Types['Context'],
      nestedSelection: NestedSelectionFn<Types, TypeModel, TypeShape>,
    ) => MaybeAsyncSelection<Types, PrismaNextSelectSpec<Types, ParentShape>>);

/** `PrismaNextFieldSelect` narrowed to the form `Select` is written in, so a failing object isn't reported against `undefined`. */
export type PrismaNextFieldSelectForm<
  Types extends SchemaTypes,
  ParentShape,
  Args,
  TypeModel extends ModelKey<Types>,
  TypeShape,
  Select,
> = unknown extends Select
  ? PrismaNextFieldSelect<Types, ParentShape, Args, TypeModel, TypeShape>
  : [Select] extends [readonly unknown[] | ((...args: never[]) => unknown)]
    ? PrismaNextFieldSelect<Types, ParentShape, Args, TypeModel, TypeShape>
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
 * The rows `nestedSelection` plans as a field's type, when that type is a discriminated model's
 * `prismaInterface`: planned rows that hold the discriminator, which the interface's selection
 * includes. `never`, for planned rows of the field type's model, otherwise.
 */
export type InterfaceNestedRow<Types extends SchemaTypes, Type> = Type extends readonly [infer Item]
  ? InterfaceNestedRow<Types, Item>
  : Type extends { readonly [prismaNextInterfaceBrand]: infer M extends ModelKey<Types> }
    ? [DiscriminatorField<Types, M>] extends [never]
      ? never
      : PlannedRow<Types, M> & DiscriminatorRow<Types, M>
    : never;

/** A ref of a prisma type of model `M`. */
export type ModelTypeRef<M> =
  | { readonly [prismaNextModelBrand]: M }
  | { readonly [prismaNextInterfaceBrand]: M };

/** The query options of a to-many relation entry, as `t.relation`'s `query` takes them. */
type QueryKeys = 'where' | 'orderBy' | 'limit' | 'offset';

/**
 * A relation entry: its rows' query (a to-many relation's only), the `type` narrowing them to a
 * variant of the target, by a ref or a model's name, and a `select` of what to load beneath them,
 * in the same form one level down. One member per model, so the nested `select` is completed as
 * that model's.
 */
export type RelationSelect<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  Level extends SelectLevel = 'type',
> =
  IsToMany<Types, M, K> extends true
    ? RelationTypeModel<Types, M, K> extends infer TM extends ModelKey<Types>
      ? TM extends unknown
        ? RelationQueryLiteral<Types, RelatedModel<Types, M, K>> &
            EntrySelect<Types, TM, Level, [TM] extends [RelatedModel<Types, M, K>] ? false : true>
        : never
      : never
    : EntrySelect<Types, RelatedModel<Types, M, K>, Level, false>;

interface EntrySelect<
  Types extends SchemaTypes,
  TM extends ModelKey<Types>,
  Level extends SelectLevel,
  Narrows extends boolean,
> {
  readonly type?: Narrows extends true ? TM | ModelTypeRef<TM> : TM | ModelTypeRef<TM> | undefined;
  readonly select?: SelectOf<Types, TM, Level extends 'type' ? 'type' : 'nested'>;
}

/** A `select`: a column array or an object. */
type SelectOf<Types extends SchemaTypes, M extends ModelKey<Types>, Level extends SelectLevel> =
  | readonly (keyof Row<Types, M> & string)[]
  | SelectObjectSpec<Types, M, Level>;

/**
 * Reduces a to-many relation's collection to values written onto the parent under the keys
 * returned, such as `{ postCount: posts.count() }`.
 */
export type AggregateSelect<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> = (collection: RelationRefinementCollection<Types, M, K>) => {
  readonly [key: string]: IncludeScalar<unknown>;
};

export type SelectObjectSpec<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Level extends SelectLevel = 'type',
> = {
  readonly [K in (keyof Row<Types, M> & string) | RelationKeys<Types, M>]?: K extends RelationKeys<
    Types,
    M
  >
    ?
        | true
        | RelationSelect<Types, M, K, Level>
        | (Level extends 'type'
            ? never
            :
                | NestedSelectionEntry<
                    IsToMany<Types, M, K> extends true
                      ? RelationTypeModel<Types, M, K>
                      : RelatedModel<Types, M, K>,
                    object,
                    unknown
                  >
                | (IsToMany<Types, M, K> extends true
                    ?
                        | AggregateSelect<Types, M, K>
                        | (Level extends 'field'
                            ? ConnectionPageEntry<RelationTypeModel<Types, M, K>, unknown>
                            : never)
                    : never))
    : K extends keyof Row<Types, M>
      ? true
      : never;
};

/**
 * A relation entry from `nestedSelection`: the relation's rows, planned as a type of model `M`
 * (`never` for the relation's target), with `Options` it was given. `Shape` is the type's shape,
 * or `never` for rows typed as planned rows of `M`.
 */
export interface NestedSelectionEntry<M, Options, Shape = never> {
  /** Type-only: what the entry plans. */
  readonly [NESTED_SELECTION]: {
    readonly model: M;
    readonly options: Options;
    readonly shape: Shape;
  };
}

/** What `nestedSelection`'s `type` takes: what a field's `type` takes, or a model's name. */
export type NestedSelectionType<Types extends SchemaTypes> = OutputType<Types> | ModelKey<Types>;

/** The shape of a `nestedSelection` type: a ref's, or `never` for a name. */
type NestedTypeShape<Types extends SchemaTypes, Type> = Type extends string
  ? never
  : OutputShape<Types, Type>;

/**
 * The options of `nestedSelection` for rows of `M`. Without a model, such as at a path with no
 * `type`, the query isn't typed by one, and the `select` checks it as its relation's.
 */
type NestedOptions<Types extends SchemaTypes, M extends ModelKey<Types>> = [M] extends [never]
  ? {
      readonly where?: object;
      readonly orderBy?: object;
      readonly limit?: number;
      readonly offset?: number;
    }
  : RelationQueryLiteral<Types, M> & { readonly select?: SelectOf<Types, M, 'nested'> };

/** Checks what `nestedSelection` was given for rows of `M`: its keys, order and `select`. */
type NestedOptionsCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Options> = [
  M,
] extends [never]
  ? ExactQueryLiteral<Options, QueryKeys | 'path' | 'type'>
  : ExactQueryLiteral<Options, QueryKeys | 'path' | 'type' | 'select'> &
      OrderByColumnsCheck<Types, M, Options> &
      (Options extends { readonly select: infer Nested }
        ? { readonly select?: SelectCheck<Types, M, Nested, 'nested'> }
        : unknown);

/**
 * Plans the selection beneath a field into a relation entry of its `select`: the relation's rows
 * are loaded with the query options, and planned as `type` (by default the field's type) at
 * `path` beneath the field, with what `select` names loaded beneath them. `type` takes what a
 * field's `type` does, or a model's name for its default type. With a `path` and no `type`, the
 * rows are typed as the relation's target, and the `select` checks the query as the relation's.
 */
export interface NestedSelectionFn<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape = never,
> {
  <const Options extends NestedOptions<Types, M>>(
    options?: Options & { readonly path?: undefined; readonly type?: undefined } & NoInfer<
        NestedOptionsCheck<Types, M, Options>
      >,
  ): NestedSelectionEntry<M, NoInfer<Options>, Shape>;
  <const Options extends NestedOptions<Types, never>>(
    options: Options & {
      readonly path: readonly PathSegment[];
      readonly type?: undefined;
    } & NoInfer<NestedOptionsCheck<Types, never, Options>>,
  ): NestedSelectionEntry<never, NoInfer<Options>>;
  <
    const Type extends NestedSelectionType<Types>,
    const Options extends NestedOptions<Types, ParamToModelKey<Types, NoInfer<Type>>>,
  >(
    options: Options & { readonly path?: readonly PathSegment[]; readonly type: Type } & NoInfer<
        NestedOptionsCheck<Types, ParamToModelKey<Types, Type>, Options>
      >,
  ): NestedSelectionEntry<
    ParamToModelKey<Types, Type>,
    NoInfer<Options>,
    NestedTypeShape<Types, Type>
  >;
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
 * Rejects a relation only a variant declares in a type's `select`. A type's rows can load through
 * the base model's collection, which can't include it, so it goes in a field's `select` instead.
 */
type VariantRelationCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  BaseModelKey<Types['PrismaNextContract'], M>,
] extends [never]
  ? unknown
  : [Select] extends [readonly unknown[]]
    ? unknown
    : {
        [K in keyof Select &
          keyof OwnRelationsOfModel<
            Types['PrismaNextContract'],
            M
          > as `A variant's own relation loads only in a field's select, such as t.relation or t.field({ select }): ${K &
          string}`]: never;
      };

/** The keys a `select` names as they are: the model's columns and relations. */
type KnownSelectKeys<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | (keyof Row<Types, M> & string)
  | RelationKeys<Types, M>;

/** The model a relation entry's `type` names, or the relation's target for an entry without one. */
type EntryModel<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  Entry,
> = (
  Entry extends { readonly type: infer Type }
    ? Type extends string
      ? Type & ModelKey<Types>
      : TypeParamModel<Types, Type>
    : never
) extends infer TM extends ModelKey<Types>
  ? [TM] extends [never]
    ? RelatedModel<Types, M, K>
    : TM
  : never;

/** The model of the rows a `nestedSelection` entry plans as `TypeModel`. */
type PlannedModel<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  TypeModel,
> = [TypeModel] extends [never]
  ? RelatedModel<Types, M, K>
  : TypeModel & RelationTypeModel<Types, M, K>;

/** What a relation entry, other than an aggregate, writes under its relation's key. */
type EntryShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  Entry,
> = Entry extends true
  ? RelationShape<Types, M, K>
  : // A connection helper's page: the rows it loaded, which its `resolve` takes.
    Entry extends ConnectionPageEntry<unknown, infer PageRow>
    ? readonly PageRow[]
    : // Rows `nestedSelection` planned as its type, or as the relation's target beneath a type
      // without a model.
      Entry extends NestedSelectionEntry<infer TypeModel, infer Options, infer Shape>
      ? NestedRows<
          Types,
          M,
          K,
          ([Shape] extends [never]
            ? PlannedRow<Types, PlannedModel<Types, M, K, TypeModel>>
            : Shape) &
            (Options extends { readonly select: infer Nested }
              ? SelectAdds<Types, PlannedModel<Types, M, K, TypeModel>, Nested>
              : unknown)
        >
      : // Rows of the entry's type loaded whole, with what their nested `select` adds.
        NestedRows<
          Types,
          M,
          K,
          LoadedRow<Types, EntryModel<Types, M, K, Entry>> &
            (Entry extends { readonly select: infer Nested }
              ? SelectAdds<Types, EntryModel<Types, M, K, Entry>, Nested>
              : unknown)
        >;

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

/** What a nested `select` adds to rows of `M`: its columns, relations and aggregates. */
type SelectAdds<Types extends SchemaTypes, M extends ModelKey<Types>, S> =
  S extends Record<string, unknown>
    ? SimpleColumnShape<Types, M, S> &
        RelationEntriesShape<Types, M, S> &
        AggregateShape<Types, M, S>
    : unknown;

type SimpleColumnShape<Types extends SchemaTypes, M extends ModelKey<Types>, S> = {
  [K in keyof S & keyof Row<Types, M> as S[K] extends true ? K : never]: Row<Types, M>[K];
};

/** The relations a `select` loads. An entry that may be left out is added by `OptionalSelectShape`. */
type RelationEntriesShape<Types extends SchemaTypes, M extends ModelKey<Types>, S> = {
  [K in keyof S & RelationKeys<Types, M> as undefined extends S[K]
    ? never
    : S[K] extends (...args: never[]) => unknown
      ? never
      : K]: EntryShape<Types, M, K, S[K]>;
};

/** The values the aggregates of a `select` write onto the parent, under the keys they return. */
type AggregateShape<Types extends SchemaTypes, M extends ModelKey<Types>, S> = UnionToIntersection<
  {
    [K in keyof S & RelationKeys<Types, M>]: S[K] extends (collection: never) => infer R
      ? { -readonly [Key in keyof R]: R[Key] extends IncludeScalar<infer V> ? V : never }
      : {};
  }[keyof S & RelationKeys<Types, M>]
>;

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
        RelationEntriesShape<Types, M, OptionalSelectEntries<S>> &
        AggregateShape<Types, M, OptionalSelectEntries<S>>
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
      ? SelectCheck<Types, M, Select, 'field'>
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
  Level extends SelectLevel,
> = unknown extends Select
  ? unknown
  : // Valid arrays, the common case, need no walk of their branches.
    [Select] extends [readonly (keyof Row<Types, M>)[]]
    ? unknown
    : (
          Select extends unknown
            ? (check: [BranchSelectCheck<Types, M, Select, Level>]) => void
            : never
        ) extends (check: [infer Check]) => void
      ? Check
      : never;

type BranchSelectCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Level extends SelectLevel,
> = Select extends readonly unknown[]
  ? // Only an invalid array is mapped entry by entry, to name the unknown columns.
    Select extends readonly (keyof Row<Types, M>)[]
    ? unknown
    : { readonly [K in keyof Select]: SelectColumnCheck<Types, M, Select[K]> }
  : Select extends string | number | boolean | bigint | symbol | ((...args: never[]) => unknown)
    ? NotASelect<Select>
    : ExactSelectCheck<Types, M, Select, Level>;

/** Names a primitive or function `select`, which the object spec's optional keys would accept. */
interface NotASelect<Value> {
  readonly 'A select is a column array or an object, not': Value;
}

/** Whether `Entry` is a relation entry written as an object, rather than `true` or a helper's. */
type IsEntryObject<Entry> = Entry extends
  | true
  | ((...args: never[]) => unknown)
  | NestedSelectionEntry<unknown, unknown, unknown>
  | ConnectionPageEntry<unknown, unknown>
  ? false
  : Entry extends object
    ? true
    : false;

/** The options a relation entry of `K` takes. */
type EntryKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> = 'type' | 'select' | (IsToMany<Types, M, K> extends true ? QueryKeys : never);

/**
 * The unknown keys of a relation entry, and the columns its `orderBy` names that the target can't
 * be ordered by. A `nestedSelection` entry without a model is checked as the relation's here.
 */
type UnknownEntryKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M> & string,
  Entry,
> =
  IsEntryObject<Entry> extends true
    ?
        | `${K}.${Exclude<keyof Entry, EntryKeys<Types, M, K>> & (string | number)}`
        | `${K}.orderBy.${UnknownOrderByColumns<Types, RelatedModel<Types, M, K>, Entry> & string}`
    : Entry extends NestedSelectionEntry<infer TypeModel, infer Options, unknown>
      ?
          | `${K}.${Exclude<WrittenKeys<Options>, EntryKeys<Types, M, K> | 'path'> & (string | number)}`
          | ([TypeModel] extends [never]
              ?
                  | `${K}.orderBy.${UnknownOrderByColumns<
                      Types,
                      RelatedModel<Types, M, K>,
                      Options
                    > &
                      string}`
                  | (Options extends { readonly where?: infer Where }
                      ? NonNullable<Where> extends (...args: never[]) => unknown
                        ? never
                        : `${K}.where.${Exclude<
                            keyof NonNullable<Where>,
                            keyof Row<Types, RelatedModel<Types, M, K>>
                          > &
                            string}`
                      : never)
              : never)
      : never;

/** The keys an inferred literal was written with, rather than optional ones of a constraint. */
type WrittenKeys<Options> = {
  [P in keyof Options]-?: {} extends Pick<Options, P> ? never : P;
}[keyof Options];

type UnknownSelectKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
> = Select extends object
  ?
      | Exclude<keyof Select, KnownSelectKeys<Types, M>>
      | {
          [K in keyof Select & RelationKeys<Types, M> & string]: UnknownEntryKeys<
            Types,
            M,
            K,
            NonNullable<Select[K]>
          >;
        }[keyof Select & RelationKeys<Types, M> & string]
  : never;

/** An object `select`'s unknown keys, invalid values and nested `select`s. */
type ExactSelectCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Level extends SelectLevel,
> = ([UnknownSelectKeys<Types, M, Select>] extends [never]
  ? unknown
  : {
      [K in UnknownSelectKeys<Types, M, Select> &
        (string | number) as `Unknown key in select: ${K}`]: never;
    }) &
  InvalidSelectValueCheck<Types, M, Select, Level> &
  NestedSelectCheck<Types, M, Select, Level>;

/** The relation entries of `Select` whose nested `select` fails its check. */
type NestedSelectKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Level extends SelectLevel,
> = {
  [K in keyof Select & RelationKeys<Types, M>]: IsEntryObject<NonNullable<Select[K]>> extends true
    ? NonNullable<Select[K]> extends { readonly select: infer Nested extends object }
      ? unknown extends SelectCheck<
          Types,
          EntryModel<Types, M, K, NonNullable<Select[K]>>,
          Nested,
          Level extends 'type' ? 'type' : 'nested'
        >
        ? never
        : K
      : never
    : never;
}[keyof Select & RelationKeys<Types, M>];

/** Checks the nested `select` of each relation entry, as a `select` of its type's model. */
type NestedSelectCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Level extends SelectLevel,
> = [NestedSelectKeys<Types, M, Select, Level>] extends [never]
  ? unknown
  : {
      [K in NestedSelectKeys<Types, M, Select, Level>]?: NonNullable<Select[K]> extends {
        readonly select: infer Nested;
      }
        ? {
            readonly select: SelectCheck<
              Types,
              EntryModel<Types, M, K, NonNullable<Select[K]>>,
              Nested,
              Level extends 'type' ? 'type' : 'nested'
            >;
          }
        : never;
    };

/**
 * Names a key whose value doesn't fit the spec, such as `email: { limit: 1 }`,
 * `posts: (posts) => posts` or `posts: { limit: 'x' }`. Checking `Select` against the spec misses
 * these. The spec's relation options are all optional, so its intersection with an inferred
 * function accepts any function.
 */
type InvalidSelectValueCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Level extends SelectLevel,
> = {
  // A branch's spread or normalized union can leave a key undefined, which selects nothing.
  [K in keyof Select & KnownSelectKeys<Types, M>]: [NonNullable<Select[K]>] extends [never]
    ? never
    : (
          K extends RelationKeys<Types, M>
            ? IsEntryObject<NonNullable<Select[K]>> extends true
              ? // Unknown keys are named as such, and the nested `select` is checked on its own.
                Pick<
                  NonNullable<Select[K]>,
                  Exclude<EntryKeys<Types, M, K>, 'select'> & keyof NonNullable<Select[K]>
                > extends RelationSelect<Types, M, K, Level>
                ? true
                : false
              : NonNullable<Select[K]> extends NonNullable<SelectObjectSpec<Types, M, Level>[K]>
                ? true
                : false
            : NonNullable<Select[K]> extends true
              ? true
              : false
        ) extends true
      ? never
      : K;
}[keyof Select & KnownSelectKeys<Types, M>] extends infer Invalid extends string
  ? [Invalid] extends [never]
    ? unknown
    : {
        [K in Invalid as K extends RelationKeys<Types, M>
          ? [PlannedModelError<Types, M, K, NonNullable<Select[K & keyof Select]>>] extends [never]
            ? `Invalid value in select: ${K}`
            : PlannedModelError<Types, M, K, NonNullable<Select[K & keyof Select]>>
          : `Invalid value in select: ${K}`]: never;
      }
  : unknown;

/**
 * Names a relation entry whose rows are of a model relation `K` doesn't load: a `type` or a
 * `nestedSelection` or connection helper entry planning another model's rows.
 */
type PlannedModelError<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  Entry,
> =
  Entry extends NestedSelectionEntry<infer Planned, unknown, unknown>
    ? ModelMismatch<Types, M, K, 'nestedSelection', Planned>
    : Entry extends ConnectionPageEntry<infer Planned, unknown>
      ? ModelMismatch<Types, M, K, 'getQuery', Planned>
      : Entry extends { readonly type: unknown }
        ? ModelMismatch<Types, M, K, 'type', EntryModel<Types, M, K, Entry>>
        : never;

type ModelMismatch<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  Source extends string,
  Planned,
> = [Planned] extends [never]
  ? never
  : [Planned] extends [
        IsToMany<Types, M, K> extends true
          ? RelationTypeModel<Types, M, K>
          : RelatedModel<Types, M, K>,
      ]
    ? never
    : `${Source} plans ${Planned & string}, but ${K} loads ${RelatedModel<Types, M, K> & string}`;

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
              Omit<ParentShape, keyof RelationEntriesShape<Types, M, Select>> &
                SelectAdds<Types, M, Select>
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
        : SelectAdds<Types, M, Select>
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
    ? SelectOf<Types, M, 'type'>
    : [Select] extends [readonly unknown[]]
      ? readonly (keyof Row<Types, M> & string)[]
      : SelectObjectSpec<Types, M>) &
    NoInfer<SelectCheck<Types, M, Select, 'type'> & VariantRelationCheck<Types, M, Select>>;
};

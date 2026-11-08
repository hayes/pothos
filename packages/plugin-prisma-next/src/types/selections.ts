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
import type { AggregateCollection } from './collections.js';
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
import type { RelationOrderBy, RelationOrderSelector } from './order-by.js';
import type {
  DefaultRelationNullable,
  IsToMany,
  QueryKeys,
  RelatedModel,
  RelationQueryLiteral,
  RelationTypeModel,
  RelationWhere,
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

/** A column, or any string, so an unknown one is reported by the check with its suggestions. */
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
type ModelTypeRef<M> =
  | { readonly [prismaNextModelBrand]: M }
  | { readonly [prismaNextInterfaceBrand]: M };

/**
 * A relation entry: its rows' query (a to-many relation's only), the `type` narrowing them to a
 * variant of the target, by a ref or a model's name, and a `select` of what to load beneath them,
 * in the same form one level down. One member per model, so the query and nested `select` are
 * typed as that model's.
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
        ? EntryQuery<Types, RelatedModel<Types, M, K>, TM> & EntrySelect<Types, TM, Level>
        : never
      : never
    : EntrySelect<Types, RelatedModel<Types, M, K>, Level>;

/**
 * The query of a to-many relation entry whose rows are of `TM`, the relation's target or, named by
 * `type`, one of its variants, whose declared `orderBy` then takes the variant's columns. `where`
 * and `orderBy` selectors are the target's: a narrowed collection's shorthand filter knows only the
 * base's columns, and callbacks typed per member would leave a callback in the union untyped.
 */
type EntryQuery<
  Types extends SchemaTypes,
  Target extends ModelKey<Types>,
  TM extends ModelKey<Types>,
> = [TM] extends [Target]
  ? RelationQueryLiteral<Types, Target>
  : Omit<RelationQueryLiteral<Types, Target>, 'orderBy'> & {
      readonly type: unknown;
      readonly orderBy?:
        | RelationOrderBy<Types, TM>
        | RelationOrderSelector<Types, Target>
        | readonly RelationOrderSelector<Types, Target>[];
    };

interface EntrySelect<
  Types extends SchemaTypes,
  TM extends ModelKey<Types>,
  Level extends SelectLevel,
> {
  readonly type?: TM | ModelTypeRef<TM>;
  readonly select?: SelectOf<Types, TM, NestedLevel<Level>>;
}

type NestedLevel<Level extends SelectLevel> = Level extends 'type' ? 'type' : 'nested';

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
> = (
  // Inferring from the ORM's collection type would measure its variance, which costs a lot.
  collection: NoInfer<AggregateCollection<Types, RelatedModel<Types, M, K>>>,
) => {
  readonly [key: string]: IncludeScalar<unknown>;
};

/** An aggregate in a type's `select`, typed so the error says where aggregates go. */
type TypeLevelAggregate<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> = (
  collection: NoInfer<AggregateCollection<Types, RelatedModel<Types, M, K>>>,
) => 'Aggregates only work in a field-level select';

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
            ? IsToMany<Types, M, K> extends true
              ? TypeLevelAggregate<Types, M, K>
              : never
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
    : true;
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
type NestedSelectionType<Types extends SchemaTypes> = OutputType<Types> | ModelKey<Types>;

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

/** Checks what `nestedSelection` was given for rows of `M`: its keys, `orderBy` and `select`. */
type NestedOptionsCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Options> = (
  [M] extends [never]
    ? { readonly [P in keyof Options]?: P extends QueryKeys | 'path' | 'type' ? unknown : never }
    : EntryOptionsMirror<Types, M, M, Options, QueryKeys | 'path' | 'type' | 'select', 'nested'>
) extends infer Mirror
  ? [Options] extends [Mirror]
    ? unknown
    : Mirror
  : never;

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
        readonly [K in keyof Select &
          keyof OwnRelationsOfModel<Types['PrismaNextContract'], M>]?: never;
      };

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
  ? NestedRows<Types, M, K, LoadedRow<Types, RelatedModel<Types, M, K>>>
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
  : Partial<SelectAdds<Types, M, OptionalSelectEntries<S>>>;

/** Not distributed over `Select`, so a conditional's branches all reach `SelectCheck`. */
export type ValidateFieldSelect<Types extends SchemaTypes, ParentShape, Select> = [Select] extends [
  (...args: infer Args) => infer Result,
]
  ? // A promise, which has none of a `select`'s keys, would pass the check of its value.
    (
      ...args: Args
    ) => [Result] extends [PromiseLike<unknown>]
      ? Promise<ValidateSelectResult<Types, ParentShape, Awaited<Result>>>
      : MaybePromise<ValidateSelectResult<Types, ParentShape, Awaited<Result>>>
  : ValidateSelectValue<Types, ParentShape, Select>;

/**
 * A select function returns an object `select`, so a column array or `unknown` fails. `any` opts
 * out of the check.
 */
type ValidateSelectResult<Types extends SchemaTypes, ParentShape, Result> = 0 extends 1 & Result
  ? unknown
  : [unknown] extends [Result]
    ? never
    : [Extract<Result, readonly unknown[]>] extends [never]
      ? ValidateSelectValue<Types, ParentShape, Result>
      : never;

type ValidateSelectValue<Types extends SchemaTypes, ParentShape, Select> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelKey<Types>
      ? SelectCheck<Types, M, Select, 'field'>
      : never
    : never;

/**
 * Checks a field's or a type's `select`, which is inferred from the literal, not checked. A branch
 * that passes checks as `unknown`, and one that fails as its `SelectMirror`. The branches' checks
 * are intersected, so every branch of a union must pass.
 */
export type SelectCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Level extends SelectLevel,
  All = Select,
> = unknown extends Select
  ? unknown
  : // Valid arrays, the common case, need no walk of their branches.
    [Select] extends [readonly (keyof Row<Types, M>)[]]
    ? unknown
    : (
          Select extends unknown
            ? (
                check: [
                  SelectMirror<Types, M, Select, Level> extends infer Mirror
                    ? [Select] extends [Mirror]
                      ? unknown
                      : // The other branches pass the check of this one.
                        Mirror | Exclude<All, Select>
                    : never,
                ],
              ) => void
            : never
        ) extends (check: [infer Check]) => void
      ? Check
      : never;

/**
 * What each value of `S` may be: `true` for a column, the options of a relation entry, and `never`
 * for an unknown key or a value its level doesn't take, so an error lands on the key. A branch can
 * leave an entry undefined or null, which selects nothing.
 */
type SelectMirror<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  S,
  Level extends SelectLevel,
> = S extends (...args: never[]) => unknown
  ? never
  : S extends readonly unknown[]
    ? readonly (keyof Row<Types, M> & string)[]
    : S extends object
      ? {
          readonly [K in keyof S]: [NonNullable<S[K]>] extends [never]
            ? unknown
            : K extends keyof Row<Types, M>
              ? NonNullable<S[K]> extends true
                ? true | null
                : never
              : K extends RelationKeys<Types, M>
                ? EntryMirror<Types, M, K, NonNullable<S[K]>, Level> | null
                : never;
        }
      : S extends null | undefined
        ? S
        : never;

/** What relation entry `E` of `K` may be at `Level`. */
type EntryMirror<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
  E,
  Level extends SelectLevel,
> = E extends true
  ? true
  : E extends NestedSelectionEntry<infer TM, infer Options, unknown>
    ? Level extends 'type'
      ? never
      : PlannedCheck<
          ModelMismatch<Types, M, K, 'nestedSelection', TM>,
          // The options were checked for rows of `TM`, but not as the relation's, or, for rows
          // without a model, not against any model.
          NestedSelectionEntry<
            unknown,
            ([TM] extends [never] ? RelatedModel<Types, M, K> : TM) extends infer OM extends
              ModelKey<Types>
              ? EntryOptionsMirror<
                  Types,
                  OM,
                  OM,
                  Pick<Options, WrittenKeys<Options>>,
                  EntryKeys<Types, M, K> | 'path',
                  'nested'
                >
              : never,
            unknown
          >
        >
    : E extends ConnectionPageEntry<infer TM, unknown>
      ? Level extends 'field'
        ? PlannedCheck<ModelMismatch<Types, M, K, 'getQuery', TM>, E>
        : never
      : E extends (...args: never[]) => unknown
        ? IsToMany<Types, M, K> extends false
          ? // Not `never`, which would fail the whole `select` rather than the entry.
            true
          : Level extends 'type'
            ? TypeLevelAggregate<Types, M, K>
            : AggregateSelect<Types, M, K>
        : E extends object
          ? EntryOptionsMirror<
              Types,
              RelatedModel<Types, M, K>,
              EntryModel<Types, M, K, E>,
              E,
              EntryKeys<Types, M, K>,
              NestedLevel<Level>,
              PlannedCheck<ModelMismatch<Types, M, K, 'type', EntryModel<Types, M, K, E>>, unknown>
            >
          : never;

/** The options a relation entry of `K` takes. */
type EntryKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  K extends RelationKeys<Types, M>,
> = 'type' | 'select' | (IsToMany<Types, M, K> extends true ? QueryKeys : never);

type PlannedCheck<Mismatch, Ok> = [Mismatch] extends [never] ? Ok : Mismatch;

/** The keys an inferred literal was written with, rather than optional ones of a constraint. */
type WrittenKeys<Options> = {
  [P in keyof Options]-?: {} extends Pick<Options, P> ? never : P;
}[keyof Options];

/**
 * Mirrors a relation entry, or `nestedSelection`'s options, whose rows are of `TM`: `Target` or a
 * variant of it. Keys outside `Known` and the columns a literal `where` or `orderBy` names that the
 * rows lack are `never`. `Level` is the nested `select`'s.
 */
type EntryOptionsMirror<
  Types extends SchemaTypes,
  Target extends ModelKey<Types>,
  TM extends ModelKey<Types>,
  E,
  Known extends PropertyKey,
  Level extends SelectLevel,
  TypeCheck = unknown,
> = {
  readonly [P in keyof E]: [NonNullable<E[P]>] extends [never]
    ? unknown
    : P extends Known
      ? P extends 'select'
        ? SelectMirror<Types, TM, NonNullable<E[P]>, Level>
        : P extends 'where'
          ? ColumnsMirror<NonNullable<E[P]>, keyof Row<Types, Target>, RelationWhere<Types, Target>>
          : P extends 'orderBy'
            ? OrderByMirror<
                NonNullable<E[P]>,
                RelationOrderBy<Types, TM>,
                RelationOrderSelector<Types, Target>
              >
            : P extends 'limit' | 'offset'
              ? number | undefined
              : P extends 'type'
                ? TypeCheck
                : unknown
      : never;
};

/** A `where`: the ORM's predicate, or a literal with the columns outside `Columns` as `never`. */
type ColumnsMirror<V, Columns, Where> = V extends (...args: never[]) => unknown
  ? Extract<Where, (...args: never[]) => unknown>
  : { readonly [C in keyof V]: C extends Columns ? unknown : never };

/**
 * An `orderBy`: the ORM's selectors, or a declaration with each column it can't order by, or whose
 * value `Decl` rejects, as `never`. Values are compared rather than intersected, since
 * `'up' & { direction?: ... }` accepts `'up'`.
 */
type OrderByMirror<V, Decl, Selector> = V extends (...args: never[]) => unknown
  ? Selector
  : V extends readonly unknown[]
    ? readonly Selector[]
    : V extends object
      ? {
          readonly [C in keyof V]: C extends keyof Decl
            ? V[C] extends Decl[C]
              ? unknown
              : never
            : never;
        }
      : never;

/**
 * Names a relation entry whose rows are of a model relation `K` doesn't load: a `type` or a
 * `nestedSelection` or connection helper entry planning another model's rows.
 */
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
  // is reported against as not assignable to `undefined`. While completing, `Select` is
  // `unknown`, so both forms are offered.
  select?: (unknown extends Select
    ? SelectOf<Types, M, 'type'>
    : [Select] extends [readonly unknown[]]
      ? readonly (keyof Row<Types, M> & string)[]
      : SelectObjectSpec<Types, M>) &
    NoInfer<SelectCheck<Types, M, Select, 'type'> & VariantRelationCheck<Types, M, Select>>;
};

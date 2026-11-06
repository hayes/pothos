import type {
  MaybeAsyncSelection,
  MaybePromise,
  Merge,
  parentShapeKey,
  SchemaTypes,
  UnionToIntersection,
} from '@pothos/core';
import type { HasRow } from '@prisma/orm-family-sql/orm-client';
import type { prismaInterfaceBrand } from '../interface-ref.js';
import type { CONNECTION_PAGE, NODE_SELECTION } from '../utils/selections.js';
import type {
  BaseModelKey,
  ExtractModel,
  IsUnion,
  ModelKey,
  ObjectBaseShape,
  OwnRelationsOfModel,
  RelationKeys,
  Row,
  VariantModelKeys,
} from './models.js';
import type { UnknownOrderByColumns } from './order-by.js';
import type {
  DefaultRelationNullable,
  IsToMany,
  RelatedModel,
  RelationFieldShape,
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
 * A column array, a `select` object, or a function of the args and context returning a `select`
 * object, which may be async with `AsyncSelections: true`. A function has one form, the object.
 */
export type PrismaNextFieldSelect<Types extends SchemaTypes, ParentShape, Args> =
  | FieldSelectArray<Types, ParentShape>
  | PrismaNextSelectSpec<Types, ParentShape>
  | ((
      args: Args,
      ctx: Types['Context'],
    ) => MaybeAsyncSelection<Types, PrismaNextSelectSpec<Types, ParentShape>>);

/** `PrismaNextFieldSelect` narrowed to the form `Select` is written in, so a failing object isn't reported against `undefined`. */
export type PrismaNextFieldSelectForm<
  Types extends SchemaTypes,
  ParentShape,
  Args,
  Select,
> = unknown extends Select
  ? PrismaNextFieldSelect<Types, ParentShape, Args>
  : [Select] extends [readonly unknown[] | ((...args: never[]) => unknown)]
    ? PrismaNextFieldSelect<Types, ParentShape, Args>
    : PrismaNextSelectSpec<Types, ParentShape>;

/**
 * A field `select` entry that loads one page of a to-many relation whose rows are `Row`s of model
 * `M`, from `prismaConnectionHelpers(...).page`.
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
            readonly [prismaInterfaceBrand]: infer IM extends string;
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
type KnownSelectSpec<Types extends SchemaTypes, M extends ModelKey<Types>, Misplaced = never> = {
  readonly [K in KnownSelectKeys<Types, M>]?:
    | Misplaced
    | (K extends RelationKeys<Types, M>
        ?
            | true
            | RelationQueryValue<Types, M, K>
            | (IsToMany<Types, M, K> extends true
                ?
                    | RelationRefinement<Types, M, K>
                    // A connection helper's page, on a field's `select` only.
                    | ConnectionPageEntry<RelationTypeModel<Types, M, K>, unknown>
                : never)
        : K extends keyof Row<Types, M>
          ? true
          : never);
};

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
export type SelectObjectSpec<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | KnownSelectSpec<Types, M, ComputedSelectEntry<Types, M>>
  | (KnownSelectSpec<Types, M, ComputedSelectEntry<Types, M>> & {
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
  [K in keyof S & RelationKeys<Types, M> as S[K] extends ConnectionPageEntry<unknown, unknown>
    ? never
    : S[K] extends true | RelationQueryValue<Types, M, K> | ((sub: never) => unknown)
      ? K
      : never]: RelationShape<Types, M, K>;
} & {
  // A connection helper's page: the rows it loaded, which its `resolve` takes.
  [K in keyof S & RelationKeys<Types, M> as S[K] extends ConnectionPageEntry<unknown, unknown>
    ? K
    : never]: S[K] extends ConnectionPageEntry<unknown, infer PageRow> ? readonly PageRow[] : never;
};

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
  ComputedEntryCheck<Types, M, Select>;

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
  [K in keyof Select & KnownSelectKeys<Types, M>]: NonNullable<Select[K]> extends NonNullable<
    KnownSelectSpec<Types, M>[K]
  >
    ? never
    : K;
}[keyof Select & KnownSelectKeys<Types, M>] extends infer Invalid extends string
  ? [Invalid] extends [never]
    ? unknown
    : {
        [K in Invalid as LooksComputed<Types, M, NonNullable<Select[K & keyof Select]>> extends true
          ? `A computed key can't be a column or relation: ${K}`
          : `Invalid value in select: ${K}`]: never;
      }
  : unknown;

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

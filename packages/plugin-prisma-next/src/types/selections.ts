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
  ExtractModel,
  IsUnion,
  ModelKey,
  ObjectBaseShape,
  RelationKeys,
  Row,
  VariantModelKeys,
} from './models.js';
import type {
  DefaultRelationNullable,
  IsToMany,
  RelationFieldShape,
  RelationQueryValue,
  RelationRefinementCollection,
  RelationTypeModel,
} from './relations.js';

/**
 * `true` loads a column or includes a relation. A function `(sub) => ({ key: value })` receives
 * the relation's refinement collection, and each returned key becomes a property on the parent.
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
 * `SelectObjectSpec` for the `select` of a type, where a to-one relation is `true` or nothing. Every
 * reader of a row shares the type's to-one includes, so only a field's `select`, which reloads, can
 * filter one.
 */
export type TypeSelectObjectSpec<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  readonly [K in keyof SelectObjectSpec<Types, M>]?: K extends RelationKeys<Types, M>
    ? IsToMany<Types, M, K> extends true
      ? SelectObjectSpec<Types, M>[K]
      : true
    : SelectObjectSpec<Types, M>[K];
};

/**
 * Rejects anything but `true` on a to-one relation in a type's `select`, naming the problem. The
 * spec `TypeSelectCheck` checks against takes a to-one `{ where }`, so this check reports it.
 */
type TypeSelectToOneCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = [
  Select,
] extends [readonly unknown[]]
  ? unknown
  : {
      [K in keyof Select & RelationKeys<Types, M> as IsToMany<Types, M, K> extends true
        ? never
        : NonNullable<Select[K]> extends true
          ? never
          : `A to-one relation in a type's select takes only true, filter it in a field's select: ${K &
              string}`]: never;
    };

type ToOneFunctionMessage = 'To-one relations take true or { where }, not a function';

/**
 * Rejects the function form on a to-one relation, which has no `combine()`. The parameter is typed
 * as this interface, so the error names it instead of an implicit `any`.
 */
interface NoToOneSelectFunction {
  (relation: NoToOneSelectFunction): never;
  readonly 'To-one relations take true or { where }, not a function': true;
}

export type SelectObjectSpec<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  readonly [K in (keyof Row<Types, M> & string) | RelationKeys<Types, M>]?: K extends RelationKeys<
    Types,
    M
  >
    ?
        | true
        | RelationQueryValue<Types, M, K>
        // Each returned collection or reducer loads into the parent under its key.
        | (IsToMany<Types, M, K> extends true
            ?
                | ((sub: RelationRefinementCollection<Types, M, K>) => {
                    readonly [key: string]: HasRow<unknown>;
                  })
                // A connection helper's page, on a field's `select` only.
                | ConnectionPageEntry<RelationTypeModel<Types, M, K>, unknown>
            : NoToOneSelectFunction)
    : K extends keyof Row<Types, M>
      ? true
      : never;
};

type FunctionFormShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  S,
> = UnionToIntersection<
  {
    [K in keyof S & RelationKeys<Types, M>]: S[K] extends (sub: never) => infer R
      ? R extends Record<string, unknown>
        ? { -readonly [InnerKey in keyof R]: SpecValueResult<R[InnerKey]> }
        : {}
      : {};
  }[keyof S & RelationKeys<Types, M>]
>;

type SimpleRelationShape<Types extends SchemaTypes, M extends ModelKey<Types>, S> = {
  [K in keyof S & RelationKeys<Types, M> as S[K] extends ConnectionPageEntry<unknown, unknown>
    ? never
    : S[K] extends true | RelationQueryValue<Types, M, K>
      ? K
      : never]: RelationShape<Types, M, K, S[K]>;
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
        FunctionFormShape<Types, M, OptionalSelectEntries<S>>
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
    : ArraySelectResult<Result>;

/** Names a select function's array result, since a function returns the object form. */
interface ArraySelectResult<Value> {
  readonly 'A select function returns a select object, such as { title: true }, not': Value;
}

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

type UnknownSelectKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
> = Select extends object
  ?
      | Exclude<keyof Select, keyof SelectObjectSpec<Types, M>>
      | {
          [K in keyof Select & RelationKeys<Types, M> & string]: Select[K] extends
            | true
            | ((...args: never[]) => unknown)
            ? never
            : `${K}.${Exclude<keyof Select[K], keyof RelationQueryValue<Types, M, K>> & (string | number)}`;
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
  ComputedKeyCheck<Types, M, Select>;

/**
 * The keys each relation's function entry computes. A key that isn't a literal, such as one built
 * from the field's args, widens the result's keys to `string`.
 */
type ComputedKeys<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  [K in keyof Select & RelationKeys<Types, M>]: NonNullable<Select[K]> extends (
    sub: never,
  ) => infer Result
    ? Result extends object
      ? string extends keyof Result
        ? string
        : keyof Result & string
      : never
    : never;
};

/**
 * Computed values are written onto the parent row, so each key needs one source, and it can't be a
 * column or relation of the parent's model. Only literal keys can be checked, so an entry with a
 * `string` key is reported as such and left out of the duplicate check, where it would match every
 * other entry's keys. The error is put on the entry's result, so it names the key and the reason.
 */
type ComputedKeyCheck<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Select,
  Computed = ComputedKeys<Types, M, Select>,
  Literal = {
    [K in keyof Computed as string extends Computed[K] ? never : K]: Computed[K];
  },
  Duplicates = {
    [K in keyof Literal]: Literal[K] & Literal[Exclude<keyof Literal, K>];
  }[keyof Literal],
  Shadowing = Computed[keyof Computed] & ((keyof Row<Types, M> & string) | RelationKeys<Types, M>),
> = [Duplicates | Shadowing] extends [never]
  ? unknown
  : {
      readonly [K in keyof Computed as Computed[K] & (Duplicates | Shadowing) extends never
        ? never
        : K]: (sub: never) => string extends Computed[K]
        ? 'Computed keys must be literal: a union-typed or generic key widens to string'
        : {
            readonly [Key in Computed[K] &
              (Duplicates | Shadowing) &
              string]: Key extends Duplicates
              ? 'Computed by two relations in select'
              : 'Computed key names a column or relation';
          };
    };

/**
 * Names a key whose value doesn't fit the spec, such as `email: { limit: 1 }`,
 * `posts: (sub) => sub` or `posts: { limit: 'x' }`. Checking `Select` against the spec misses
 * these. The spec's relation options are all optional, so its intersection with an inferred
 * function accepts any function, and a function's result is checked only for unknown keys.
 */
type InvalidSelectValueCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  // A branch's spread or normalized union can leave a key undefined, which selects nothing.
  [K in keyof Select & keyof SelectObjectSpec<Types, M>]: NonNullable<
    Select[K]
  > extends NonNullable<SelectObjectSpec<Types, M>[K]>
    ? never
    : K;
}[keyof Select & keyof SelectObjectSpec<Types, M>] extends infer Invalid extends string
  ? [Invalid] extends [never]
    ? unknown
    : {
        // The value shows in the untruncated error, so a to-one function names the accepted forms.
        [K in Invalid as `Invalid value in select: ${K}`]: Select[K & keyof Select] extends (
          ...args: never[]
        ) => unknown
          ? [Extract<SelectObjectSpec<Types, M>[K], NoToOneSelectFunction>] extends [never]
            ? never
            : ToOneFunctionMessage
          : never;
      }
  : unknown;

/** `true` if any branch of a relation's entry has a `where`, and `never` if none does. */
type EntryFilters<Entry> = Entry extends unknown
  ? 'where' extends keyof Entry
    ? true
    : never
  : never;

/** A to-one relation is nullable when the contract says so or a `where` can filter it out. */
type RelationShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  R extends RelationKeys<Types, M>,
  Entry = true,
> = RelationFieldShape<
  Types,
  M,
  R,
  [EntryFilters<Entry>] extends [never] ? DefaultRelationNullable<Types, M, R> : true
>;

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
              // A field's relation is loaded separately, so its `where` can make it null.
              Omit<ParentShape, keyof SimpleRelationShape<Types, M, Select>> &
                SimpleColumnShape<Types, M, Select> &
                SimpleRelationShape<Types, M, Select> &
                FunctionFormShape<Types, M, Select>
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
              FunctionFormShape<Types, M, Select>
          : unknown
    >;

/**
 * Checks a type's `select` and offers completions for it. It sits beside a plain `select?: Select`,
 * which stays the only inference site, because inferring through an intersection would narrow a
 * union `Select` to one member.
 */
export type TypeSelectCheck<Types extends SchemaTypes, M extends ModelKey<Types>, Select> = {
  // Picked by the form of `Select` rather than a union of both, which a failing object `select`
  // is reported against as not assignable to `undefined`. The field spec, rather than
  // `TypeSelectObjectSpec`, so the checks below name what a type's `select` can't take. While
  // completing, `Select` is `unknown`, so both forms are offered.
  select?: (unknown extends Select
    ? readonly (keyof Row<Types, M> & string)[] | SelectObjectSpec<Types, M>
    : [Select] extends [readonly unknown[]]
      ? readonly (keyof Row<Types, M> & string)[]
      : SelectObjectSpec<Types, M>) &
    NoInfer<
      SelectCheck<Types, M, Select> &
        NoTypeLevelPage<Select> &
        TypeSelectToOneCheck<Types, M, Select>
    >;
};

/** A connection helper's page loads for one field, so a type's `select` can't take one. */
type NoTypeLevelPage<Select> = {
  [K in keyof Select as Select[K] extends ConnectionPageEntry<unknown, unknown>
    ? `A connection page loads only in a field's select: ${K & string}`
    : never]: never;
};

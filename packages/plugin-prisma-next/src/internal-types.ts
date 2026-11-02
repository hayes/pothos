import type {
  CompatibleTypes,
  ExposeNullability,
  FieldNullability,
  MaybePromise,
  OutputRefShape,
  parentShapeKey,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import type { HasRow } from '@prisma/orm-family-sql/orm-client';
import type { prismaInterfaceKey } from './interface-ref.js';
import type {
  ModelBrand,
  PrismaNextObjectRef,
  prismaContractKey,
  prismaModelKey,
} from './object-ref.js';
import type {
  DefaultRelationNullable,
  IdentityFields,
  IsToMany,
  IsUnion,
  ModelName,
  RelatedModel,
  RelationFieldShape,
  RelationKeys,
  RelationOrderBy,
  RelationRefinementCollection,
  RelationWhere,
  Row,
  VariantModelKeys,
} from './types.js';

/**
 * Matches a model's object ref by the model key it declares. Checking a `type` against
 * `PrismaNextObjectRef<Types, ModelName<Types>>` would build the ref class and its return shape
 * over every model in the contract. The contract key rejects a ref from a builder of another
 * contract.
 */
export interface ModelObjectRefKey<M, C = unknown> extends OutputRefShape<unknown> {
  readonly [prismaModelKey]: M;
  readonly [prismaContractKey]: C;
  readonly modelName: M;
}

/** The interface counterpart of {@link ModelObjectRefKey}. */
export interface ModelInterfaceRefKey<M, C = unknown> extends OutputRefShape<unknown> {
  readonly [prismaInterfaceKey]: M;
  readonly [prismaContractKey]: C;
  readonly modelName: M;
}

export type ParamToModelName<Types extends SchemaTypes, Param> =
  Param extends ModelName<Types>
    ? Param
    : Param extends [infer M extends ModelName<Types>]
      ? M
      : Param extends
            | ModelObjectRefKey<infer M extends ModelName<Types>>
            | ModelInterfaceRefKey<infer M extends ModelName<Types>>
        ? M
        : Param extends
              | [ModelObjectRefKey<infer M extends ModelName<Types>>]
              | [ModelInterfaceRefKey<infer M extends ModelName<Types>>]
          ? M
          : never;

export type ParamToTypeParam<Types extends SchemaTypes, Param, Shape> = Param extends
  | ModelObjectRefKey<string>
  | ModelInterfaceRefKey<string>
  | [ModelObjectRefKey<string>]
  | [ModelInterfaceRefKey<string>]
  ? Param
  : Param extends [unknown]
    ? [PrismaNextObjectRef<Types, ParamToModelName<Types, Param>, Shape>]
    : PrismaNextObjectRef<Types, ParamToModelName<Types, Param>, Shape>;

export type RelationRef<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  RelatedShape,
> =
  IsToMany<Types, M, R> extends true
    ? [PrismaNextObjectRef<Types, RelatedModel<Types, M, R>, RelatedShape>]
    : PrismaNextObjectRef<Types, RelatedModel<Types, M, R>, RelatedShape>;

export type ExtractModel<Types extends SchemaTypes, ParentShape> = ParentShape extends {
  [prismaModelKey]?: infer M;
}
  ? M extends ModelName<Types>
    ? M
    : never
  : never;

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
  M extends ModelName<Types>,
  Interfaces,
> = [Interfaces] extends [readonly unknown[]]
  ? UnionToIntersection<
      Interfaces[number] extends infer I
        ? // Inferring against the ref class would compare its whole structure, so read its keys.
          I extends {
            readonly [prismaInterfaceKey]: infer IM extends string;
            readonly [parentShapeKey]: infer Shape;
          }
          ? M extends IM | VariantModelKeys<Types['PrismaNextContract'], IM>
            ? Shape
            : {}
          : {}
        : never
    >
  : unknown;

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;

type SelectRelationDeclarative<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = {
  readonly where?: RelationWhere<Types, RelatedModel<Types, M, R>>;
  readonly orderBy?: RelationOrderBy<Types, RelatedModel<Types, M, R>>;
  readonly limit?: number;
  readonly offset?: number;
};

type ToOneFunctionMessage =
  'To-one relations take true or { where, orderBy, limit, offset }, not a function';

/**
 * Rejects the function form on a to-one relation, which has no `combine()`. The parameter is typed
 * as this interface, so the error names it instead of an implicit `any`.
 */
interface NoToOneSelectFunction {
  (relation: NoToOneSelectFunction): never;
  readonly 'To-one relations take true or { where, orderBy, limit, offset }, not a function': true;
}

export type SelectObjectSpec<Types extends SchemaTypes, M extends ModelName<Types>> = {
  readonly [K in (keyof Row<Types, M> & string) | RelationKeys<Types, M>]?: K extends RelationKeys<
    Types,
    M
  >
    ?
        | true
        | SelectRelationDeclarative<Types, M, K>
        // Each returned collection or reducer loads into the parent under its key.
        | (IsToMany<Types, M, K> extends true
            ? (sub: RelationRefinementCollection<Types, M, K>) => {
                readonly [key: string]: HasRow<unknown>;
              }
            : NoToOneSelectFunction)
    : K extends keyof Row<Types, M>
      ? true
      : never;
};

type FunctionFormShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
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

type SimpleRelationShape<Types extends SchemaTypes, M extends ModelName<Types>, S> = {
  [K in keyof S & RelationKeys<Types, M> as S[K] extends
    | true
    | SelectRelationDeclarative<Types, M, K>
    ? K
    : never]: RelationShape<Types, M, K, S[K]>;
};

type SimpleColumnShape<Types extends SchemaTypes, M extends ModelName<Types>, S> = {
  [K in keyof S & keyof Row<Types, M> as S[K] extends true ? K : never]: Row<Types, M>[K];
};

/**
 * The model brand and the primary key, which every type's selection loads. Other columns are
 * present only when a `select` declares them. The brand also admits the model's variants. The
 * `M extends string` wrapper makes TypeScript compare two of these shapes by their members, not by
 * `M` alone.
 */
export type ObjectBaseShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Columns = unknown,
> = M extends string
  ? ModelBrand<M | VariantModelKeys<Types['PrismaNextContract'], M>> &
      Normalize<Pick<Row<Types, M>, IdentityFields<Types, M> & keyof Row<Types, M>> & Columns>
  : never;

/**
 * A type's shape as the parent of its fields. A base model's brand admits its variants, so it is
 * narrowed to the model here. Other shapes name only their own model.
 */
export type FieldParentShape<Types extends SchemaTypes, M extends ModelName<Types>, Shape> = [
  VariantModelKeys<Types['PrismaNextContract'], M>,
] extends [never]
  ? Shape
  : Shape & ModelBrand<M>;

export type ValidateFieldSelect<Types extends SchemaTypes, ParentShape, Select> = Select extends (
  ...args: infer Args
) => infer Result
  ? (...args: Args) => MaybePromise<ValidateSelectValue<Types, ParentShape, Awaited<Result>>>
  : ValidateSelectValue<Types, ParentShape, Select>;

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
  M extends ModelName<Types>,
  Column,
> = Column extends keyof Row<Types, M> & string
  ? Column
  : Column extends string
    ? string extends Column
      ? keyof Row<Types, M> & string
      : UnknownSelectColumn<Column>
    : keyof Row<Types, M> & string;

/** Names the requested type when no column fits it, where `never` says only "not assignable". */
interface NoExposableColumn<Type> {
  readonly 'No column of this model can be exposed as': Type;
}

/** The columns `t.expose*` accepts for a GraphQL type. */
export type ExposableColumn<
  Types extends SchemaTypes,
  Shape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
> = [CompatibleTypes<Types, Shape, Type, Nullable>] extends [never]
  ? NoExposableColumn<Type>
  : CompatibleTypes<Types, Shape, Type, Nullable>;

/** The `nullable` option `t.expose*` requires, or none while the column is rejected. */
export type ExposeColumnNullability<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  Shape,
  Name,
  Nullable extends FieldNullability<Type>,
> = Name extends keyof Shape ? ExposeNullability<Types, Type, Shape, Name, Nullable> : {};

type ValidateSelectValue<Types extends SchemaTypes, ParentShape, Select> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? SelectCheck<Types, M, Select>
      : never
    : never;

/** Checks a field's or a type's `select`, which is inferred from the literal, not checked. */
export type SelectCheck<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Select,
> = Select extends readonly string[]
  ? // Only an invalid array is mapped entry by entry, to name the unknown columns.
    Select extends readonly (keyof Row<Types, M>)[]
    ? unknown
    : { readonly [K in keyof Select]: SelectColumnCheck<Types, M, Select[K]> }
  : ExactSelectCheck<Types, M, Select>;

type UnknownSelectKeys<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Select,
> = Select extends readonly unknown[]
  ? never
  : Select extends object
    ?
        | Exclude<keyof Select, keyof SelectObjectSpec<Types, M>>
        | {
            [K in keyof Select & RelationKeys<Types, M> & string]: Select[K] extends
              | true
              | ((...args: never[]) => unknown)
              ? never
              : `${K}.${Exclude<keyof Select[K], keyof SelectRelationDeclarative<Types, M, K>> & string}`;
          }[keyof Select & RelationKeys<Types, M> & string]
    : never;

/** An object `select`'s unknown keys and invalid values. */
type ExactSelectCheck<Types extends SchemaTypes, M extends ModelName<Types>, Select> = ([
  UnknownSelectKeys<Types, M, Select>,
] extends [never]
  ? unknown
  : {
      [K in UnknownSelectKeys<Types, M, Select> & string as `Unknown key in select: ${K}`]: never;
    }) &
  InvalidSelectValueCheck<Types, M, Select>;

/**
 * Names a key whose value doesn't fit the spec, such as `email: { limit: 1 }`,
 * `posts: (sub) => sub` or `posts: { limit: 'x' }`. Checking `Select` against the spec misses
 * these. The spec's relation options are all optional, so its intersection with an inferred
 * function accepts any function, and a function's result is checked only for unknown keys.
 */
type InvalidSelectValueCheck<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Select,
> = Select extends readonly unknown[]
  ? unknown
  : {
        [K in keyof Select & keyof SelectObjectSpec<Types, M>]: Select[K] extends NonNullable<
          SelectObjectSpec<Types, M>[K]
        >
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

type Normalize<T> = { [K in keyof T]: T[K] } & {};

/** A to-one relation is nullable when the contract says so or a `where` can filter it out. */
type RelationShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  Entry = true,
> = RelationFieldShape<
  Types,
  M,
  R,
  'where' extends keyof Entry ? true : DefaultRelationNullable<Types, M, R>
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
        ? // `keyof` a union is the keys every member has.
          Normalize<
            ParentShape & Partial<UnionToIntersection<Branches>> & Pick<Branches, keyof Branches>
          >
        : never
      : // An array that isn't a tuple, such as a variable, may hold any subset of its columns.
        Awaited<Result> extends readonly unknown[]
        ? number extends Awaited<Result>['length']
          ? Normalize<
              ParentShape & Partial<ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>>
            >
          : ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>
        : ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>
    : ShapeFromSelectValue<Types, ParentShape, Select>;

// The unreachable `ParentShape` fallbacks make checks against a deferred shape cheaper.
type ShapeFromSelectValue<Types extends SchemaTypes, ParentShape, Select> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? Select extends readonly (infer K extends keyof Row<Types, M>)[]
        ? Normalize<ParentShape & Pick<Row<Types, M>, K>>
        : Select extends Record<string, unknown>
          ? Normalize<
              // A field's relation is loaded separately, so its `where` can make it null.
              Omit<ParentShape, keyof SimpleRelationShape<Types, M, Select>> &
                SimpleColumnShape<Types, M, Select> &
                SimpleRelationShape<Types, M, Select> &
                FunctionFormShape<Types, M, Select>
            >
          : ParentShape
      : ParentShape
    : ParentShape;

export type ShapeFromObjectSelect<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Select,
> = unknown extends Select
  ? ObjectBaseShape<Types, M>
  : // The brand stays a named interface beside the columns, so exported refs can be emitted.
    ObjectBaseShape<
      Types,
      M,
      Select extends readonly (infer K extends keyof Row<Types, M>)[]
        ? Pick<Row<Types, M>, K>
        : Select extends Record<string, unknown>
          ? SimpleColumnShape<Types, M, Select> &
              SimpleRelationShape<Types, M, Select> &
              FunctionFormShape<Types, M, Select>
          : unknown
    >;

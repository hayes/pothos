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
  RelationKeys,
  RelationOrderBy,
  RelationRefinementCollection,
  RelationWhere,
  Row,
  VariantModelKeys,
} from './types.js';

/**
 * A model ref, read by the model key the plugin's refs declare. Checking a `type` against
 * `PrismaNextObjectRef<Types, ModelName<Types>>` would build the ref class (and its return shape)
 * over the union of every model in the contract. The contract key keeps a ref from a builder of
 * another contract out.
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

// Public on purpose (no internal JSDoc tag, even in a comment): `stripInternal` would drop it from
// the d.ts that the public `prismaField` signatures reference.
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

/** A collection in a combine spec loads `readonly Row[]`; a scalar reducer loads its result. */
export type SpecValueResult<V> =
  V extends HasRow<infer R>
    ? V extends { readonly kind: 'includeScalar' | 'includeCombine' }
      ? R
      : readonly R[]
    : unknown;

/**
 * What the same-model `prismaInterface`s a type implements select: they load for the type too.
 * Another model's interface adds nothing, so implementing it still fails.
 */
export type InterfaceSelectShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  Interfaces,
> = [Interfaces] extends [readonly unknown[]]
  ? UnionToIntersection<
      Interfaces[number] extends infer I
        ? // Read through the ref's keys: inferring against the class compares its whole structure.
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

export type SelectRelationDeclarative<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = {
  readonly where?: RelationWhere<Types, RelatedModel<Types, M, R>>;
  readonly orderBy?: RelationOrderBy<Types, RelatedModel<Types, M, R>>;
  readonly limit?: number;
  readonly offset?: number;
};

export type SelectObjectSpec<Types extends SchemaTypes, M extends ModelName<Types>> = {
  readonly [K in (keyof Row<Types, M> & string) | RelationKeys<Types, M>]?: K extends RelationKeys<
    Types,
    M
  >
    ?
        | true
        | SelectRelationDeclarative<Types, M, K>
        // Each returned value loads into the parent under its key: a collection or a reducer.
        | ((sub: RelationRefinementCollection<Types, M, K>) => {
            readonly [key: string]: HasRow<unknown>;
          })
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
 * present only when a `select` declares them. The brand admits variants, and the conditional stops
 * TypeScript comparing two shapes by `M` alone.
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
 * A type's shape as its fields' parent. A base model's brand admits its variants, so it's narrowed
 * to the model here; other shapes already name only theirs.
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
export interface UnknownSelectColumn<Column> {
  readonly 'Unknown column in select': Column;
}

/**
 * An array `select` entry. An unknown column becomes an object brand rather than `never` or a
 * message string: the error then names it (`'emial' & UnknownSelectColumn<'emial'>`), and a brand
 * is never offered as a string completion. A non-literal entry (the editor's placeholder while
 * completing) stays the column names, so completions list only columns.
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

/** Names the requested type when no column fits it, where `never` would only say "not assignable". */
export interface NoExposableColumn<Type> {
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

/** `nullable` as `t.expose*` requires it; nothing while the column itself is rejected. */
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
      ? Select extends readonly string[]
        ? // Only an invalid array is mapped entry by entry, to name the unknown columns.
          Select extends readonly (keyof Row<Types, M>)[]
          ? unknown
          : { readonly [K in keyof Select]: SelectColumnCheck<Types, M, Select[K]> }
        : ExactSelectCheck<Types, M, Select>
      : Select
    : Select;

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

/** `Select` is inferred from the literal rather than checked, so its keys and values need checking. */
export type ExactSelectCheck<Types extends SchemaTypes, M extends ModelName<Types>, Select> = ([
  UnknownSelectKeys<Types, M, Select>,
] extends [never]
  ? unknown
  : {
      [K in UnknownSelectKeys<Types, M, Select> & string as `Unknown key in select: ${K}`]: never;
    }) &
  InvalidSelectValueCheck<Types, M, Select>;

/**
 * Checking the literal against the spec isn't enough: intersected with the inferred function, the
 * spec's all-optional relation options accept any function, and a function's inferred result is
 * only checked for unknown keys. So a relation's `(sub) => sub` or `{ limit: 'x' }` is named here.
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
      : { [K in Invalid as `Invalid value in select: ${K}`]: never }
    : unknown;

type Normalize<T> = { [K in keyof T]: T[K] } & {};

/** A to-one relation is nullable when the contract says so or a `where` can filter it out. */
type RelationShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
  Entry = true,
> =
  IsToMany<Types, M, R> extends true
    ? readonly Row<Types, RelatedModel<Types, M, R>>[]
    :
        | Row<Types, RelatedModel<Types, M, R>>
        | ('where' extends keyof Entry
            ? null
            : DefaultRelationNullable<Types, M, R> extends false
              ? never
              : null);

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
      : // An array that isn't a tuple (a variable) may hold any subset of its columns.
        Awaited<Result> extends readonly unknown[]
        ? number extends Awaited<Result>['length']
          ? Normalize<
              ParentShape & Partial<ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>>
            >
          : ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>
        : ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>
    : ShapeFromSelectValue<Types, ParentShape, Select>;

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

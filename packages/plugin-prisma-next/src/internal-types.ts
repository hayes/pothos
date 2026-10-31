import type { MaybePromise, SchemaTypes } from '@pothos/core';
import type { HasRow, ModelAccessor } from '@prisma/orm-family-sql/orm-client';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type { ModelBrand, PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
import type {
  BareModelName,
  DefaultRelationNullable,
  IdentityFields,
  IsToMany,
  ModelName,
  NamespaceOf,
  RelatedModel,
  RelationKeys,
  RelationRefinementCollection,
  RelationWhere,
  Row,
  VariantModelKeys,
} from './types.js';

// Public on purpose (no internal JSDoc tag, even in a comment): `stripInternal` would drop it from
// the d.ts that the public `prismaField` signatures reference.
export type ParamToModelName<Types extends SchemaTypes, Param> =
  Param extends ModelName<Types>
    ? Param
    : Param extends [infer M extends ModelName<Types>]
      ? M
      : Param extends
            | PrismaNextObjectRef<Types, infer M extends ModelName<Types>, unknown>
            | PrismaNextInterfaceRef<Types, infer M extends ModelName<Types>, unknown>
        ? M
        : Param extends
              | [PrismaNextObjectRef<Types, infer M extends ModelName<Types>, unknown>]
              | [PrismaNextInterfaceRef<Types, infer M extends ModelName<Types>, unknown>]
          ? M
          : never;

export type ParamToTypeParam<Types extends SchemaTypes, Param, Shape> = Param extends
  | PrismaNextObjectRef<Types, ModelName<Types>, unknown>
  | PrismaNextInterfaceRef<Types, ModelName<Types>, unknown>
  ? Param
  : Param extends
        | [PrismaNextObjectRef<Types, ModelName<Types>, unknown>]
        | [PrismaNextInterfaceRef<Types, ModelName<Types>, unknown>]
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
        ? I extends PrismaNextInterfaceRef<Types, infer IM, infer Shape>
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
  readonly orderBy?: (
    accessor: ModelAccessor<
      Types['PrismaNextContract'],
      BareModelName<RelatedModel<Types, M, R>>,
      NamespaceOf<Types, RelatedModel<Types, M, R>>
    >,
  ) => unknown;
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
        | ((sub: RelationRefinementCollection<Types, M, K>) => Record<string, unknown>)
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
  ? (
      ...args: Args
    ) => MaybePromise<
      ValidateSelectValue<Types, ParentShape, Awaited<Result>> &
        InvalidSelectValueCheck<Types, ExtractModel<Types, ParentShape>, Awaited<Result>>
    >
  : ValidateSelectValue<Types, ParentShape, Select>;

type ValidateSelectValue<Types extends SchemaTypes, ParentShape, Select> =
  ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? Select extends readonly string[]
        ? {
            readonly [K in keyof Select]: Select[K] extends keyof Row<Types, M> & string
              ? Select[K]
              : never;
          }
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

/** `Select` is inferred from the literal rather than checked, so unknown keys need rejecting. */
export type ExactSelectCheck<Types extends SchemaTypes, M extends ModelName<Types>, Select> = [
  UnknownSelectKeys<Types, M, Select>,
] extends [never]
  ? unknown
  : {
      [K in UnknownSelectKeys<Types, M, Select> & string as `Unknown key in select: ${K}`]: never;
    };

/**
 * A function's inferred result is only reliably checked for unknown keys, so a relation's
 * `{ limit: 'x' }` needs naming here.
 */
type InvalidSelectValueCheck<Types extends SchemaTypes, M extends ModelName<Types>, Select> = [
  M,
] extends [never]
  ? unknown
  : Select extends readonly unknown[]
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
 * selections, their columns are optional.
 */
export type ShapeFromSelect<Types extends SchemaTypes, ParentShape, Select> = unknown extends Select
  ? ParentShape
  : Select extends (...args: never[]) => infer Result
    ? IsUnion<Awaited<Result>> extends true
      ? Normalize<
          ParentShape &
            Partial<UnionToIntersection<ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>>>
        >
      : // An array that isn't a tuple (a variable) may hold any subset of its columns.
        Awaited<Result> extends readonly unknown[]
        ? number extends Awaited<Result>['length']
          ? Normalize<
              ParentShape & Partial<ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>>
            >
          : ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>
        : ShapeFromSelectValue<Types, ParentShape, Awaited<Result>>
    : ShapeFromSelectValue<Types, ParentShape, Select>;

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

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
  _ParentShape,
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

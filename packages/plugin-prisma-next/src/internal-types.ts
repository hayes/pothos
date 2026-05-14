import type { SchemaTypes } from '@pothos/core';
import type { Collection, ModelAccessor, ShorthandWhereFilter } from '@prisma-next/sql-orm-client';
import type { PrismaNextObjectRef, prismaModelKey } from './object-ref';
import type {
  AnyContract,
  IsToMany,
  ModelName,
  RelatedModel,
  RelationKeys,
  RelationRefinementCollection,
  Row,
} from './types';

/**
 * prisma-next's `IncludeScalar<R>` is declared internally and not
 * exported. We structurally match `kind: 'includeScalar'` and surface
 * a result type of `number | null` — the widest of the scalar returns
 * (`count` → number; `sum`/`avg`/`min`/`max` → number | null). Precise
 * inference would need `RowType` from the orm-client.
 *
 * TODO: once prisma-next exports `IncludeScalar` (or its `RowType`
 * brand symbol), narrow `SpecValueResult` to the exact result type.
 */
type AnyIncludeScalar = { readonly kind: 'includeScalar' };

/** @internal */
export type ParamToModelName<Types extends SchemaTypes, Param> =
  Param extends ModelName<Types>
    ? Param
    : Param extends [infer M extends ModelName<Types>]
      ? M
      : Param extends PrismaNextObjectRef<Types, infer M extends ModelName<Types>, unknown>
        ? M
        : Param extends [PrismaNextObjectRef<Types, infer M extends ModelName<Types>, unknown>]
          ? M
          : never;

/** @internal */
export type ParamToTypeParam<Types extends SchemaTypes, Param, Shape> =
  Param extends PrismaNextObjectRef<Types, ModelName<Types>, unknown>
    ? Param
    : Param extends [PrismaNextObjectRef<Types, ModelName<Types>, unknown>]
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

/**
 * Recover the model name `M` from a prismaObject field-builder's parent
 * shape. The builder injects `[prismaModelKey]?: M` onto the shape so
 * downstream option-types can introspect it. Resolves to `never` when
 * the shape isn't prisma-next-branded (defensive — would fall back to
 * un-narrowed inference rather than failing compilation).
 */
export type ExtractModel<Types extends SchemaTypes, ParentShape> =
  ParentShape extends { [prismaModelKey]?: infer M }
    ? M extends ModelName<Types>
      ? M
      : never
    : never;

/**
 * Map a prisma-next combine-spec value to its result type:
 *   - `Collection<…, Row, …>` → `readonly Row[]`
 *   - `IncludeScalar<R>` → `number | null` (widest scalar — count is
 *     narrower at number, but TS can't see the result generic
 *     structurally without RowType being exported)
 *
 * Falls back to `unknown` for anything else — the plugin doesn't
 * gatekeep, so future combine-spec value kinds added by prisma-next
 * just type as `unknown` until we add a mapping here.
 */
export type SpecValueResult<V> = V extends AnyIncludeScalar
  ? number | null
  : V extends Collection<infer _C, infer _M, infer Row, infer _S>
    ? readonly Row[]
    : unknown;

/** Standard union-to-intersection for merging function-form inner-key results. */
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;

/**
 * Declarative refine for a relation entry — same shape as the legacy
 * `query` option on `t.relation`. Constrained to filter/order/limit
 * operations only; scalar terminals like `.count()` or `.aggregate()`
 * are forced into the function form (which is combine territory).
 */
export type SelectRelationDeclarative<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = {
  readonly where?:
    | ShorthandWhereFilter<
        Types['PrismaNextContract'] & AnyContract,
        RelatedModel<Types, M, R>
      >
    | ((
        accessor: ModelAccessor<
          Types['PrismaNextContract'] & AnyContract,
          RelatedModel<Types, M, R>
        >,
      ) => unknown);
  readonly orderBy?: (
    accessor: ModelAccessor<
      Types['PrismaNextContract'] & AnyContract,
      RelatedModel<Types, M, R>
    >,
  ) => unknown;
  readonly take?: number;
  readonly skip?: number;
};

/**
 * Object-form select spec: keys constrained to columns + relations of
 * model M.
 *
 *   - Column key `K`: value is `true` (column joins the parent SELECT).
 *   - Relation key `K`:
 *       value `true` → simple include; `parent[K]` typed as the relation rows/row.
 *       value `{ where?, orderBy?, take?, skip? }` → declarative refine.
 *           Stays on the single-consumer fast path (no combine wrap).
 *           `parent[K]` typed as relation rows.
 *       value `(sub) => Record<innerKey, prismaNextValue>` → render-time
 *           function. Each `innerKey` becomes a parent property typed
 *           via `SpecValueResult`. Use this for counts, aggregates, and
 *           multi-variant loads.
 */
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

/** Inner keys contributed to parent by function-form entries in S. */
type FunctionFormShape<Types extends SchemaTypes, M extends ModelName<Types>, S> =
  UnionToIntersection<
    {
      [K in keyof S & RelationKeys<Types, M>]: S[K] extends (sub: never) => infer R
        ? R extends Record<string, unknown>
          ? { -readonly [InnerKey in keyof R]: SpecValueResult<R[InnerKey]> }
          : {}
        : {};
    }[keyof S & RelationKeys<Types, M>]
  >;

/** Top-level relation keys with `true` contribute `parent[rel]` directly. */
type SimpleRelationShape<Types extends SchemaTypes, M extends ModelName<Types>, S> = {
  [K in keyof S & RelationKeys<Types, M> as S[K] extends true ? K : never]: RelationShape<
    Types,
    M,
    K
  >;
};

export type ValidateFieldSelect<ParentShape, Select> = Select extends readonly string[]
  ? {
      readonly [K in keyof Select]: Select[K] extends keyof ParentShape & string
        ? Select[K]
        : never;
    }
  : Select;

type Normalize<T> = { [K in keyof T]: T[K] } & {};

/** Map each relation key in an object-form select to its loaded shape. */
type RelationShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> = IsToMany<Types, M, R> extends true
  ? readonly Row<Types, RelatedModel<Types, M, R>>[]
  : Row<Types, RelatedModel<Types, M, R>> | null;

/**
 * Compute the resolver's `parent` shape from the parent shape + select.
 *
 *   - Legacy array form `select: ['firstName']` narrows the parent to
 *     just the picked columns (existing behavior — preserved).
 *   - Object form `select: { posts: true }` widens the parent with each
 *     declared relation: `parent.posts: readonly Row<Post>[]`.
 *   - Object form with function entries `select: { posts: (sub) => ({ cnt: sub.count() }) }`
 *     widens the parent with each inner key — `parent.cnt: number`.
 *   - Mixed columns + relations work naturally: column keys are
 *     already in ParentShape (no narrowing), relation keys are added.
 */
export type ShapeFromSelect<Types extends SchemaTypes, ParentShape, Select> =
  unknown extends Select
    ? ParentShape
    : Select extends readonly (infer K extends keyof ParentShape)[]
      ? Normalize<Pick<ParentShape, K>>
      : Select extends Record<string, unknown>
        ? ExtractModel<Types, ParentShape> extends infer M
          ? M extends ModelName<Types>
            ? Normalize<
                ParentShape &
                  SimpleRelationShape<Types, M, Select> &
                  FunctionFormShape<Types, M, Select>
              >
            : ParentShape
          : ParentShape
        : ParentShape;

/**
 * Variant of `ShapeFromSelect` that takes `M` explicitly instead of
 * recovering it from a `[prismaModelKey]` brand. Used at object level
 * (`prismaObject({ select })`) where the bare `Row<Types, M>` has no
 * brand to extract.
 */
export type ShapeFromObjectSelect<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  ParentShape,
  Select,
> = unknown extends Select
  ? ParentShape
  : Select extends readonly (infer _K)[]
    ? ParentShape
    : Select extends Record<string, unknown>
      ? Normalize<
          ParentShape & SimpleRelationShape<Types, M, Select> & FunctionFormShape<Types, M, Select>
        >
      : ParentShape;

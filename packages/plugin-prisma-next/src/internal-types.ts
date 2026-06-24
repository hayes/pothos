import type { SchemaTypes } from '@pothos/core';
import type { Collection, ModelAccessor, ShorthandWhereFilter } from '@prisma-next/sql-orm-client';
import type { PrismaNextObjectRef, prismaModelKey } from './object-ref';
import type {
  IsToMany,
  ModelName,
  RelatedModel,
  RelationKeys,
  RelationRefinementCollection,
  Row,
} from './types';

/**
 * prisma-next's `IncludeScalar<R>` is declared internally and not
 * exported. We structurally match `kind: 'includeScalar'` and recover
 * the result generic by reading the value at the type's symbol-keyed
 * brand (`RowSelection<T>` declares `[RowType]: T` where `RowType` is
 * a unique symbol). The brand isn't exported either, but `Extract<keyof V,
 * symbol>` finds it generically so the result type narrows correctly:
 *   - `count()` → `IncludeScalar<number>` → `number`
 *   - `sum/avg/min/max(col)` → `IncludeScalar<number | null>` → `number | null`
 */
type AnyIncludeScalar = { readonly kind: 'includeScalar' };
type SymbolKey<V> = Extract<keyof V, symbol>;
type IncludeScalarResult<V> =
  SymbolKey<V> extends never
    ? number | null
    : V extends { [K in SymbolKey<V>]: infer R }
      ? R
      : number | null;

/**
 * Maps a `t.prismaField`-style `type` parameter (string model name,
 * `[ModelName]`, `PrismaNextObjectRef`, or `[PrismaNextObjectRef]`)
 * back to the underlying contract model name.
 *
 * Must remain a public export. The build runs with `stripInternal:
 * true`; if this carried an internal-strip annotation it would drop
 * out of the dts, and `global-types.d.ts` references it from the
 * publicly-augmented `prismaField` / `prismaFieldWithInput` /
 * `prismaConnection` signatures — stripping it collapses the entire
 * field-builder API to `never` for downstream consumers.
 */
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

/**
 * Resolves a `t.prismaField` `type` parameter to the corresponding
 * type-param the field-builder hands to `this.field({...})`. Same
 * load-bearing constraint as `ParamToModelName` above.
 */
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
export type ExtractModel<Types extends SchemaTypes, ParentShape> = ParentShape extends {
  [prismaModelKey]?: infer M;
}
  ? M extends ModelName<Types>
    ? M
    : never
  : never;

/**
 * Map a prisma-next combine-spec value to its result type:
 *   - `Collection<…, Row, …>` → `readonly Row[]`
 *   - `IncludeScalar<R>` → R (`count` → `number`,
 *     `sum`/`avg`/`min`/`max` → `number | null`)
 *
 * Falls back to `unknown` for anything else — the plugin doesn't
 * gatekeep, so future combine-spec value kinds added by prisma-next
 * just type as `unknown` until we add a mapping here.
 */
export type SpecValueResult<V> = V extends AnyIncludeScalar
  ? IncludeScalarResult<V>
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
    | ShorthandWhereFilter<Types['PrismaNextContract'], RelatedModel<Types, M, R>>
    | ((
        accessor: ModelAccessor<Types['PrismaNextContract'], RelatedModel<Types, M, R>>,
      ) => unknown);
  readonly orderBy?: (
    accessor: ModelAccessor<Types['PrismaNextContract'], RelatedModel<Types, M, R>>,
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

/** Top-level relation keys with `true` contribute `parent[rel]` directly. */
type SimpleRelationShape<Types extends SchemaTypes, M extends ModelName<Types>, S> = {
  [K in keyof S & RelationKeys<Types, M> as S[K] extends true ? K : never]: RelationShape<
    Types,
    M,
    K
  >;
};

/**
 * Column keys in an object-form select (those whose value is `true`).
 * Pulls just those column values out of the model's row so the resolver
 * parent contains exactly what was declared as a dependency — no more,
 * no less.
 */
type SimpleColumnShape<Types extends SchemaTypes, M extends ModelName<Types>, S> = {
  [K in keyof S & keyof Row<Types, M> as S[K] extends true ? K : never]: Row<Types, M>[K];
};

/**
 * Default base shape for any prismaObject's parent. Carries the
 * `[prismaModelKey]?` brand so the field builder can extract the
 * model name from the parent type — and nothing else. Explicit
 * `select` declarations (object-level and field-level) layer
 * columns/relations on top.
 *
 * This matches the runtime: the plugin only loads columns the user
 * has declared a dependency on. Defaulting the parent type to the
 * full `Row<M>` would lie about what's actually present.
 */
export type ObjectBaseShape<Types extends SchemaTypes, M extends ModelName<Types>> = {
  readonly [prismaModelKey]?: M;
};

/**
 * Validates an array-form `select: ['firstName', ...]` so typos surface
 * at the call site (each invalid column becomes `never`, which the
 * caller's `Select` slot then rejects).
 *
 * Source of truth is `Row<Types, M>`, not `ParentShape` — the parent
 * type only carries what's been declared so far, but the select itself
 * is what _adds_ new column dependencies. Resolving against the parent
 * would reject every valid column on a freshly-typed prismaObject.
 */
export type ValidateFieldSelect<
  Types extends SchemaTypes,
  ParentShape,
  Select,
> = Select extends readonly string[]
  ? ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? {
          readonly [K in keyof Select]: Select[K] extends keyof Row<Types, M> & string
            ? Select[K]
            : never;
        }
      : Select
    : Select
  : Select;

type Normalize<T> = { [K in keyof T]: T[K] } & {};

/** Map each relation key in an object-form select to its loaded shape. */
type RelationShape<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  R extends RelationKeys<Types, M>,
> =
  IsToMany<Types, M, R> extends true
    ? readonly Row<Types, RelatedModel<Types, M, R>>[]
    : Row<Types, RelatedModel<Types, M, R>> | null;

/**
 * Compute a field's resolver `parent` shape from the existing parent
 * shape (whatever the type-level select resolved to) plus the field's
 * own `select` declaration.
 *
 * Always additive: the field-level `select` adds to the type-level
 * select, never replaces it. So a resolver sees:
 *   (object-level columns/relations) ∪ (field-level columns/relations)
 *
 * - Array form `select: ['firstName', 'lastName']` adds those columns.
 * - Object form `select: { col: true }` adds the column.
 * - Object form `select: { rel: true }` adds the relation rows.
 * - Object form `select: { rel: (sub) => ({...}) }` adds the function-
 *   form result keys (counts, aggregates, etc.).
 */
export type ShapeFromSelect<Types extends SchemaTypes, ParentShape, Select> = unknown extends Select
  ? ParentShape
  : ExtractModel<Types, ParentShape> extends infer M
    ? M extends ModelName<Types>
      ? Select extends readonly (infer K extends keyof Row<Types, M>)[]
        ? Normalize<ParentShape & Pick<Row<Types, M>, K>>
        : Select extends Record<string, unknown>
          ? Normalize<
              ParentShape &
                SimpleColumnShape<Types, M, Select> &
                SimpleRelationShape<Types, M, Select> &
                FunctionFormShape<Types, M, Select>
            >
          : ParentShape
      : ParentShape
    : ParentShape;

/**
 * Compute the type-level parent shape for a `prismaObject({ select })`.
 *
 * Starts from `ObjectBaseShape` (just the brand sentinel) and adds
 * only what the type-level select explicitly declared. The `_ParentShape`
 * parameter is retained so existing callers keep compiling — the new
 * implementation derives everything from `M` and `Select`.
 *
 *   - undefined select → `ObjectBaseShape` (brand only).
 *   - Array form → brand + picked columns.
 *   - Object form → brand + simple columns + simple relations + function-form keys.
 */
export type ShapeFromObjectSelect<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  _ParentShape,
  Select,
> = unknown extends Select
  ? ObjectBaseShape<Types, M>
  : Select extends readonly (infer K extends keyof Row<Types, M>)[]
    ? Normalize<ObjectBaseShape<Types, M> & Pick<Row<Types, M>, K>>
    : Select extends Record<string, unknown>
      ? Normalize<
          ObjectBaseShape<Types, M> &
            SimpleColumnShape<Types, M, Select> &
            SimpleRelationShape<Types, M, Select> &
            FunctionFormShape<Types, M, Select>
        >
      : ObjectBaseShape<Types, M>;

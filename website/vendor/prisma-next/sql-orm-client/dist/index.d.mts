import { AsyncIterableResult } from "@prisma-next/framework-components/runtime";
import { AndExpr, AnyExpression, BinaryExpr, NullCheckExpr, OrExpr, OrderByItem, WhereArg } from "@prisma-next/sql-relational-core/ast";
import { Contract } from "@prisma-next/contract/types";
import { ExtractCodecTypes, ExtractQueryOperationTypes, SqlStorage, StorageColumn, StorageTable } from "@prisma-next/sql-contract/types";
import { SimplifyDeep } from "@prisma-next/utils/simplify-deep";
import { Expression } from "@prisma-next/sql-relational-core/expression";
import { ExecutionContext } from "@prisma-next/sql-relational-core/query-lane-context";
import { ComputeColumnJsType, RuntimeScope } from "@prisma-next/sql-relational-core/types";

//#region src/types.d.ts
type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max';
interface IncludeScalar<Result> extends RowSelection<Result> {
  readonly kind: 'includeScalar';
  readonly fn: AggregateFn;
  readonly column?: string;
  readonly state: CollectionState;
}
interface IncludeRowsBranch {
  readonly kind: 'rows';
  readonly state: CollectionState;
}
interface IncludeScalarBranch {
  readonly kind: 'scalar';
  readonly selector: IncludeScalar<unknown>;
}
type IncludeCombineBranch = IncludeRowsBranch | IncludeScalarBranch;
interface IncludeCombine<ResultShape extends Record<string, unknown>> extends RowSelection<ResultShape> {
  readonly kind: 'includeCombine';
  readonly branches: Readonly<Record<string, IncludeCombineBranch>>;
}
interface IncludeExpr {
  readonly relationName: string;
  readonly relatedModelName: string;
  readonly relatedTableName: string;
  readonly targetColumn: string;
  readonly localColumn: string;
  readonly cardinality: RelationCardinalityTag | undefined;
  readonly nested: CollectionState;
  readonly scalar: IncludeScalar<unknown> | undefined;
  readonly combine: Readonly<Record<string, IncludeCombineBranch>> | undefined;
}
interface CollectionState {
  readonly filters: readonly AnyExpression[];
  readonly includes: readonly IncludeExpr[];
  readonly orderBy: readonly OrderByItem[] | undefined;
  readonly cursor: Readonly<Record<string, unknown>> | undefined;
  readonly distinct: readonly string[] | undefined;
  readonly distinctOn: readonly string[] | undefined;
  readonly selectedFields: readonly string[] | undefined;
  readonly limit: number | undefined;
  readonly offset: number | undefined;
  readonly variantName: string | undefined;
}
declare function emptyState(): CollectionState;
interface CollectionTypeState {
  readonly hasOrderBy: boolean;
  readonly hasWhere: boolean;
  readonly hasUniqueFilter: boolean;
  readonly variantName: string | undefined;
}
type RelationCardinalityTag = '1:1' | 'N:1' | '1:N' | 'M:N';
type DefaultCollectionTypeState = {
  readonly hasOrderBy: false;
  readonly hasWhere: false;
  readonly hasUniqueFilter: false;
  readonly variantName: undefined;
};
interface RuntimeConnection extends RuntimeScope {
  release?(): Promise<void>;
  transaction?(): Promise<RuntimeTransaction>;
}
interface RuntimeTransaction extends RuntimeScope {
  commit?(): Promise<void>;
  rollback?(): Promise<void>;
}
interface RuntimeQueryable extends RuntimeScope {
  connection?(): Promise<RuntimeConnection>;
  transaction?(): Promise<RuntimeTransaction>;
}
interface CollectionContext<TContract extends Contract<SqlStorage>> {
  readonly runtime: RuntimeQueryable;
  readonly context: ExecutionContext<TContract>;
}
type ComparisonMethodFns<T> = {
  eq(value: T): AnyExpression;
  neq(value: T): AnyExpression;
  gt(value: T): AnyExpression;
  lt(value: T): AnyExpression;
  gte(value: T): AnyExpression;
  lte(value: T): AnyExpression;
  like(pattern: string): AnyExpression;
  in(values: readonly T[]): AnyExpression;
  notIn(values: readonly T[]): AnyExpression;
  isNull(): AnyExpression;
  isNotNull(): AnyExpression;
  asc(): OrderByItem;
  desc(): OrderByItem;
};
/**
 * Trait-gated comparison methods. Only methods whose required traits are
 * all present in `Traits` are included.
 *
 * - `traits: []` → always available (isNull, isNotNull)
 */
type ComparisonMethods<T, Traits> = { [K in keyof ComparisonMethodsMeta as [ComparisonMethodsMeta[K]['traits'][number]] extends [Traits] ? K : never]: ComparisonMethodFns<T>[K] };
type QueryOperationReturnTraits<Returns$1, TCodecTypes extends Record<string, unknown>> = Returns$1 extends {
  readonly codecId: infer Id extends string;
} ? Id extends keyof TCodecTypes ? TCodecTypes[Id] extends {
  readonly traits: infer Traits;
} ? Traits : never : never : never;
type QueryOperationReturnJsType<Returns$1, TCodecTypes extends Record<string, unknown>> = Returns$1 extends {
  readonly codecId: infer Id extends string;
  readonly nullable: infer N;
} ? Id extends keyof TCodecTypes ? TCodecTypes[Id] extends {
  readonly output: infer O;
} ? N extends true ? O | null : O : unknown : unknown : unknown;
type IsBooleanReturn<Returns$1, TCodecTypes extends Record<string, unknown>> = Returns$1 extends {
  readonly codecId: infer Id extends string;
} ? Id extends keyof TCodecTypes ? TCodecTypes[Id] extends {
  readonly traits: infer T;
} ? 'boolean' extends T ? true : false : false : false : false;
/**
 * Extract the `{codecId, nullable}` spec carried inside an `Expression<T>`.
 * Used to recover the op's return spec from its impl signature so the
 * pre-existing `QueryOperationReturn*` helpers can consume it unchanged.
 */
type SpecOf<E> = E extends Expression<infer T> ? T : never;
type ImplReturnSpec<Impl> = Impl extends ((...args: never[]) => infer Ret) ? SpecOf<Ret> : never;
/**
 * Builds the ORM column-method signature for an operation.
 *
 * - User args: drops the impl's first parameter (the column is bound at access
 *   time) and forwards the rest unchanged. Each remaining arg keeps its
 *   authored `CodecExpression` / `TraitExpression` shape — so callers can pass
 *   a raw JS value, another column handle (which itself implements
 *   `Expression`), or `null` when nullable.
 * - Return: predicate ops (boolean-traited return) yield `AnyExpression`;
 *   non-predicate ops yield `ComparisonMethods<JsType, Traits>` of the return
 *   codec.
 */
type QueryOperationMethod<Op, TCodecTypes extends Record<string, unknown>> = Op extends {
  readonly impl: (...args: never[]) => unknown;
} ? Op['impl'] extends ((first: never, ...rest: infer UserArgs extends readonly unknown[]) => unknown) ? ImplReturnSpec<Op['impl']> extends infer Returns ? IsBooleanReturn<Returns, TCodecTypes> extends true ? (...args: UserArgs) => AnyExpression : (...args: UserArgs) => ComparisonMethods<QueryOperationReturnJsType<Returns, TCodecTypes>, QueryOperationReturnTraits<Returns, TCodecTypes>> : never : never : never;
/**
 * Tests whether an operation's `self` dispatch hint reaches a field with the
 * given codec identity. Codec hints match by identity; trait hints match when
 * every required trait is present in the field codec's trait set.
 */
type OpMatchesField<Op, CodecId$1 extends string, CT extends Record<string, unknown>> = Op extends {
  readonly self: infer Self;
} ? Self extends {
  readonly codecId: CodecId$1;
} ? true : Self extends {
  readonly traits: infer RequiredTraits extends readonly string[];
} ? CodecId$1 extends keyof CT ? CT[CodecId$1] extends {
  readonly traits: infer FieldTraits;
} ? [RequiredTraits[number]] extends [FieldTraits] ? true : false : false : false : false : false;
type FieldOperations<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = FieldCodecId<TContract, ModelName, FieldName> extends infer CodecId extends string ? ExtractQueryOperationTypes<TContract> extends infer AllOps ? { [OpName in keyof AllOps & string as OpMatchesField<AllOps[OpName], CodecId, ExtractCodecTypes<TContract>> extends true ? OpName : never]: QueryOperationMethod<AllOps[OpName], ExtractCodecTypes<TContract>> } : unknown : unknown;
/**
 * Declares trait requirements and runtime factory for each comparison method.
 *
 * - `traits: []` means "no trait required" — always available
 * - Multi-trait: `traits: ['equality', 'order']` means BOTH traits are required
 */
declare const COMPARISON_METHODS_META: {
  readonly eq: {
    readonly traits: readonly ["equality"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (value: unknown) => BinaryExpr;
  };
  readonly neq: {
    readonly traits: readonly ["equality"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (value: unknown) => BinaryExpr;
  };
  readonly in: {
    readonly traits: readonly ["equality"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (values: readonly unknown[]) => BinaryExpr;
  };
  readonly notIn: {
    readonly traits: readonly ["equality"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (values: readonly unknown[]) => BinaryExpr;
  };
  readonly gt: {
    readonly traits: readonly ["order"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (value: unknown) => BinaryExpr;
  };
  readonly lt: {
    readonly traits: readonly ["order"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (value: unknown) => BinaryExpr;
  };
  readonly gte: {
    readonly traits: readonly ["order"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (value: unknown) => BinaryExpr;
  };
  readonly lte: {
    readonly traits: readonly ["order"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (value: unknown) => BinaryExpr;
  };
  readonly like: {
    readonly traits: readonly ["textual"];
    readonly create: (left: AnyExpression, codecId: string | undefined) => (value: unknown) => BinaryExpr;
  };
  readonly asc: {
    readonly traits: readonly ["order"];
    readonly create: (left: AnyExpression) => () => OrderByItem;
  };
  readonly desc: {
    readonly traits: readonly ["order"];
    readonly create: (left: AnyExpression) => () => OrderByItem;
  };
  readonly isNull: {
    readonly traits: readonly [];
    readonly create: (left: AnyExpression) => () => NullCheckExpr;
  };
  readonly isNotNull: {
    readonly traits: readonly [];
    readonly create: (left: AnyExpression) => () => NullCheckExpr;
  };
};
type ComparisonMethodsMeta = typeof COMPARISON_METHODS_META;
type RelationPredicate<TContract extends Contract<SqlStorage>, ModelName extends string> = (model: ModelAccessor<TContract, ModelName>) => AnyExpression;
type RelationPredicateInput<TContract extends Contract<SqlStorage>, ModelName extends string> = RelationPredicate<TContract, ModelName> | Record<string, unknown>;
type RelationFilterAccessor<TContract extends Contract<SqlStorage>, RelatedModelName$1 extends string> = {
  some(predicate?: RelationPredicateInput<TContract, RelatedModelName$1>): AnyExpression;
  every(predicate: RelationPredicateInput<TContract, RelatedModelName$1>): AnyExpression;
  none(predicate?: RelationPredicateInput<TContract, RelatedModelName$1>): AnyExpression;
};
type ScalarModelAccessor<TContract extends Contract<SqlStorage>, ModelName extends string> = { [K in keyof FieldsOf<TContract, ModelName> & string]: Expression<{
  codecId: FieldCodecId<TContract, ModelName, K>;
  nullable: FieldNullable<TContract, ModelName, K>;
}> & ComparisonMethods<FieldJsType<TContract, ModelName, K>, FieldTraits<TContract, ModelName, K>> & FieldOperations<TContract, ModelName, K> };
type RelationModelAccessor<TContract extends Contract<SqlStorage>, ModelName extends string> = { [K in RelationNames<TContract, ModelName>]: RelationFilterAccessor<TContract, RelatedModelName<TContract, ModelName, K> & string> };
type ModelAccessor<TContract extends Contract<SqlStorage>, ModelName extends string> = ScalarModelAccessor<TContract, ModelName> & RelationModelAccessor<TContract, ModelName>;
type DefaultModelRow<TContract extends Contract<SqlStorage>, ModelName extends string> = { [K in keyof FieldsOf<TContract, ModelName> & string]: FieldJsType<TContract, ModelName, K> };
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type VariantRow<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelDef<TContract, ModelName> extends {
  readonly discriminator: {
    readonly field: infer DiscField extends string;
  };
  readonly variants: infer V;
} ? V extends Record<string, {
  readonly value: string;
}> ? { [VK in keyof V]: VK extends string & keyof ModelsOf<TContract> ? Simplify<Omit<DefaultModelRow<TContract, ModelName>, DiscField> & DefaultModelRow<TContract, VK> & Record<DiscField, V[VK]['value']>> : never }[keyof V] : DefaultModelRow<TContract, ModelName> : DefaultModelRow<TContract, ModelName>;
type InferRootRow<TContract extends Contract<SqlStorage>, ModelName extends string> = VariantRow<TContract, ModelName>;
type VariantNames<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelDef<TContract, ModelName> extends {
  readonly variants: infer V extends Record<string, unknown>;
} ? keyof V & string : never;
type VariantModelRow<TContract extends Contract<SqlStorage>, ModelName extends string, VariantName extends string> = ModelDef<TContract, ModelName> extends {
  readonly discriminator: {
    readonly field: infer DiscField extends string;
  };
  readonly variants: infer V;
} ? V extends Record<string, {
  readonly value: string;
}> ? VariantName extends keyof V & string & keyof ModelsOf<TContract> ? Simplify<Omit<DefaultModelRow<TContract, ModelName>, DiscField> & DefaultModelRow<TContract, VariantName> & Record<DiscField, V[VariantName]['value']>> : DefaultModelRow<TContract, ModelName> : DefaultModelRow<TContract, ModelName> : DefaultModelRow<TContract, ModelName>;
declare const aggregateResultBrand: unique symbol;
interface AggregateSelector<Result> {
  readonly kind: 'aggregate';
  readonly fn: AggregateFn;
  readonly column?: string;
  readonly [aggregateResultBrand]?: Result;
}
type AggregateSpec = Record<string, AggregateSelector<unknown>>;
type AggregateResult<Spec extends AggregateSpec> = { [K in keyof Spec]: Spec[K] extends AggregateSelector<infer Result> ? Result : never };
interface AggregateBuilder<TContract extends Contract<SqlStorage>, ModelName extends string> {
  count(): AggregateSelector<number>;
  sum<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): AggregateSelector<number | null>;
  avg<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): AggregateSelector<number | null>;
  min<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): AggregateSelector<number | null>;
  max<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): AggregateSelector<number | null>;
}
type HavingComparisonMethods<T> = Pick<ComparisonMethods<T, 'equality' | 'order'>, 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'>;
interface HavingBuilder<TContract extends Contract<SqlStorage>, ModelName extends string> {
  count(): HavingComparisonMethods<number>;
  sum<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): HavingComparisonMethods<number | null>;
  avg<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): HavingComparisonMethods<number | null>;
  min<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): HavingComparisonMethods<number | null>;
  max<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): HavingComparisonMethods<number | null>;
}
type ShorthandWhereFilter<TContract extends Contract<SqlStorage>, ModelName extends string> = Partial<{ [K in keyof DefaultModelRow<TContract, ModelName> & string]: DefaultModelRow<TContract, ModelName>[K] | null | undefined }>;
type ModelsOf<TContract extends Contract<SqlStorage>> = TContract['models'] extends Record<string, unknown> ? TContract['models'] : Record<string, never>;
type ModelDef<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelName extends keyof ModelsOf<TContract> ? ModelsOf<TContract>[ModelName] : never;
type FieldsOf<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelDef<TContract, ModelName> extends {
  readonly fields: infer F;
} ? F extends Record<string, unknown> ? F : Record<string, never> : Record<string, never>;
type ModelStorageFields<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelDef<TContract, ModelName> extends {
  readonly storage: {
    readonly fields: infer Fields;
  };
} ? Fields extends Record<string, {
  readonly column: string;
}> ? Fields : never : never;
type ModelFieldToColumnMap<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelStorageFields<TContract, ModelName> extends infer Fields ? Fields extends Record<string, {
  readonly column: string;
}> ? { readonly [F in keyof Fields]: Fields[F]['column'] } : never : never;
type FieldToColumnMapSafe<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelFieldToColumnMap<TContract, ModelName> extends Record<string, string> ? ModelFieldToColumnMap<TContract, ModelName> : never;
type ModelTableName<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelDef<TContract, ModelName> extends {
  readonly storage: {
    readonly table: infer T extends string;
  };
} ? T : never;
type FieldColumnName<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = (FieldToColumnMapSafe<TContract, ModelName> extends never ? FieldName : FieldName extends keyof FieldToColumnMapSafe<TContract, ModelName> ? FieldToColumnMapSafe<TContract, ModelName>[FieldName] : FieldName) & string;
type ResolvedStorageColumn<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = ModelTableName<TContract, ModelName> extends infer TableName extends string ? FieldColumnName<TContract, ModelName, FieldName> extends infer ColName extends string ? TContract['storage']['tables'] extends Record<string, {
  readonly columns: Record<string, unknown>;
}> ? TableName extends keyof TContract['storage']['tables'] ? ColName extends keyof TContract['storage']['tables'][TableName]['columns'] ? TContract['storage']['tables'][TableName]['columns'][ColName] extends StorageColumn ? TContract['storage']['tables'][TableName]['columns'][ColName] : never : never : never : never : never : never;
type FieldStorageJsType<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = ResolvedStorageColumn<TContract, ModelName, FieldName> extends infer Col extends StorageColumn ? ComputeColumnJsType<TContract, ModelTableName<TContract, ModelName> & string, FieldColumnName<TContract, ModelName, FieldName> & string, Col, ExtractCodecTypes<TContract>> : never;
type FieldJsType<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = [FieldStorageJsType<TContract, ModelName, FieldName>] extends [never] ? unknown : FieldStorageJsType<TContract, ModelName, FieldName>;
type FieldStorageColumn<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = ResolvedStorageColumn<TContract, ModelName, FieldName>;
type FieldCodecId<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = FieldStorageColumn<TContract, ModelName, FieldName> extends {
  readonly codecId: infer Id extends string;
} ? Id : never;
type FieldNullable<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = FieldStorageColumn<TContract, ModelName, FieldName> extends {
  readonly nullable: infer N extends boolean;
} ? N : false;
type FieldTraits<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = FieldCodecId<TContract, ModelName, FieldName> extends infer Id extends string ? Id extends keyof ExtractCodecTypes<TContract> ? ExtractCodecTypes<TContract>[Id] extends {
  readonly traits: infer T;
} ? T : never : never : never;
type NumericFieldNames<TContract extends Contract<SqlStorage>, ModelName extends string> = { [K in keyof DefaultModelRow<TContract, ModelName> & string]: 'numeric' extends FieldTraits<TContract, ModelName, K> ? K : never }[keyof DefaultModelRow<TContract, ModelName> & string];
type ExecutionDefaultEntry<TContract extends Contract<SqlStorage>> = TContract['execution'] extends {
  readonly mutations: {
    readonly defaults: infer Defaults;
  };
} ? Defaults extends ReadonlyArray<unknown> ? Defaults[number] : never : never;
type HasExecutionCreateDefault<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = [Extract<ExecutionDefaultEntry<TContract>, {
  readonly ref: {
    readonly table: ModelTableName<TContract, ModelName>;
    readonly column: FieldColumnName<TContract, ModelName, FieldName>;
  };
  readonly onCreate?: unknown;
}>] extends [never] ? false : true;
type IsOptionalCreateField<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = FieldStorageColumn<TContract, ModelName, FieldName> extends infer Column ? Column extends StorageColumn ? Column['nullable'] extends true ? true : Column extends {
  readonly default: unknown;
} ? true : HasExecutionCreateDefault<TContract, ModelName, FieldName> : HasExecutionCreateDefault<TContract, ModelName, FieldName> : HasExecutionCreateDefault<TContract, ModelName, FieldName>;
type CreateFieldNames<TContract extends Contract<SqlStorage>, ModelName extends string> = keyof DefaultModelRow<TContract, ModelName> & string;
type RequiredCreateFieldNames<TContract extends Contract<SqlStorage>, ModelName extends string> = { [K in CreateFieldNames<TContract, ModelName>]-?: IsOptionalCreateField<TContract, ModelName, K> extends true ? never : K }[CreateFieldNames<TContract, ModelName>];
type OptionalCreateFieldNames<TContract extends Contract<SqlStorage>, ModelName extends string> = { [K in CreateFieldNames<TContract, ModelName>]-?: IsOptionalCreateField<TContract, ModelName, K> extends true ? K : never }[CreateFieldNames<TContract, ModelName>];
type CreateInput<TContract extends Contract<SqlStorage>, ModelName extends string> = Pick<DefaultModelRow<TContract, ModelName>, RequiredCreateFieldNames<TContract, ModelName>> & Partial<Pick<DefaultModelRow<TContract, ModelName>, OptionalCreateFieldNames<TContract, ModelName>>> & RelationMutationFields<TContract, ModelName>;
type IsPolymorphicBase<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelDef<TContract, ModelName> extends {
  readonly discriminator: unknown;
  readonly variants: Record<string, unknown>;
} ? true : false;
type DiscriminatorFieldName<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelDef<TContract, ModelName> extends {
  readonly discriminator: {
    readonly field: infer F extends string;
  };
} ? F : never;
type VariantCreateInput<TContract extends Contract<SqlStorage>, BaseModelName extends string, VariantName extends string> = Omit<CreateInput<TContract, BaseModelName>, DiscriminatorFieldName<TContract, BaseModelName>> & CreateInput<TContract, VariantName>;
type ResolvedCreateInput<TContract extends Contract<SqlStorage>, ModelName extends string, VName extends string | undefined> = IsPolymorphicBase<TContract, ModelName> extends true ? VName extends string ? VariantCreateInput<TContract, ModelName, VName> : never : CreateInput<TContract, ModelName>;
type ModelStorageTableDef<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelTableName<TContract, ModelName> extends infer TableName extends string ? TContract['storage']['tables'] extends Record<string, unknown> ? TableName extends keyof TContract['storage']['tables'] ? TContract['storage']['tables'][TableName] : never : never : never;
type PrimaryKeyConstraintColumns<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelStorageTableDef<TContract, ModelName> extends {
  readonly primaryKey: {
    readonly columns: infer Columns extends readonly string[];
  };
} ? Columns : never;
type UniqueConstraintColumns<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelStorageTableDef<TContract, ModelName> extends {
  readonly uniques: infer Uniques;
} ? Uniques extends ReadonlyArray<infer Unique> ? Unique extends {
  readonly columns: infer Columns extends readonly string[];
} ? Columns : never : never : never;
type FieldNameForColumn<TContract extends Contract<SqlStorage>, ModelName extends string, ColumnName extends string> = { [K in keyof DefaultModelRow<TContract, ModelName> & string]: FieldColumnName<TContract, ModelName, K> extends ColumnName ? K : never }[keyof DefaultModelRow<TContract, ModelName> & string] extends infer Matched ? Matched extends string ? Matched : ColumnName : ColumnName;
type RowValueForField<TContract extends Contract<SqlStorage>, ModelName extends string, FieldName extends string> = FieldName extends keyof DefaultModelRow<TContract, ModelName> ? DefaultModelRow<TContract, ModelName>[FieldName] : unknown;
type CriterionFromConstraintColumns<TContract extends Contract<SqlStorage>, ModelName extends string, Columns$1 extends readonly string[]> = string extends Columns$1[number] ? Record<string, unknown> : { [C in Columns$1[number] as FieldNameForColumn<TContract, ModelName, C>]: RowValueForField<TContract, ModelName, FieldNameForColumn<TContract, ModelName, C>> };
type ConstraintColumnsUnion<TContract extends Contract<SqlStorage>, ModelName extends string> = PrimaryKeyConstraintColumns<TContract, ModelName> | UniqueConstraintColumns<TContract, ModelName>;
type UniqueConstraintCriterion<TContract extends Contract<SqlStorage>, ModelName extends string> = ConstraintColumnsUnion<TContract, ModelName> extends infer Columns ? Columns extends readonly string[] ? CriterionFromConstraintColumns<TContract, ModelName, Columns> : never : never;
type RelationConnectCriterion<TContract extends Contract<SqlStorage>, ModelName extends string> = [UniqueConstraintCriterion<TContract, ModelName>] extends [never] ? Record<string, unknown> : UniqueConstraintCriterion<TContract, ModelName>;
interface RelationMutationCreate<TContract extends Contract<SqlStorage>, ModelName extends string> {
  readonly kind: 'create';
  readonly data: readonly MutationCreateInput<TContract, ModelName>[];
}
interface RelationMutationConnect<TContract extends Contract<SqlStorage>, ModelName extends string> {
  readonly kind: 'connect';
  readonly criteria: readonly RelationConnectCriterion<TContract, ModelName>[];
}
interface RelationMutationDisconnect<TContract extends Contract<SqlStorage>, ModelName extends string> {
  readonly kind: 'disconnect';
  readonly criteria?: readonly RelationConnectCriterion<TContract, ModelName>[];
}
type RelationMutation<TContract extends Contract<SqlStorage>, ModelName extends string> = RelationMutationCreate<TContract, ModelName> | RelationMutationConnect<TContract, ModelName> | RelationMutationDisconnect<TContract, ModelName>;
interface RelationMutator<TContract extends Contract<SqlStorage>, ModelName extends string> {
  create(data: MutationCreateInput<TContract, ModelName>): RelationMutationCreate<TContract, ModelName>;
  create(data: readonly MutationCreateInput<TContract, ModelName>[]): RelationMutationCreate<TContract, ModelName>;
  connect(criterion: RelationConnectCriterion<TContract, ModelName>): RelationMutationConnect<TContract, ModelName>;
  connect(criteria: readonly RelationConnectCriterion<TContract, ModelName>[]): RelationMutationConnect<TContract, ModelName>;
  disconnect(): RelationMutationDisconnect<TContract, ModelName>;
  disconnect(criteria: readonly RelationConnectCriterion<TContract, ModelName>[]): RelationMutationDisconnect<TContract, ModelName>;
}
type RelationMutationCallback<TContract extends Contract<SqlStorage>, ModelName extends string, RelName extends RelationNames<TContract, ModelName>> = (mutator: RelationMutator<TContract, RelatedModelName<TContract, ModelName, RelName> & string>) => RelationMutation<TContract, RelatedModelName<TContract, ModelName, RelName> & string>;
type RelationMutationFields<TContract extends Contract<SqlStorage>, ModelName extends string> = Partial<{ [K in RelationNames<TContract, ModelName>]: RelationMutationCallback<TContract, ModelName, K> }>;
type AllModelRelationEntries<TContract extends Contract<SqlStorage>> = { [M in keyof ModelsOf<TContract>]: ModelsOf<TContract>[M] extends {
  readonly relations: infer R extends Record<string, unknown>;
} ? R[keyof R] : never }[keyof ModelsOf<TContract>];
type RelationDefWithTargetFields = {
  readonly to: string;
  readonly on: {
    readonly targetFields: readonly string[];
  };
};
type ChildForeignKeyFieldNames<TContract extends Contract<SqlStorage>, ModelName extends string> = Extract<AllModelRelationEntries<TContract>, RelationDefWithTargetFields> extends infer Relation ? Relation extends {
  readonly to: ModelName;
  readonly on: {
    readonly targetFields: infer Fields extends readonly string[];
  };
} ? Fields[number] : never : never;
type NestedOptionalCreateFieldNames<TContract extends Contract<SqlStorage>, ModelName extends string> = OptionalCreateFieldNames<TContract, ModelName> | Extract<ChildForeignKeyFieldNames<TContract, ModelName>, CreateFieldNames<TContract, ModelName>>;
type NestedRequiredCreateFieldNames<TContract extends Contract<SqlStorage>, ModelName extends string> = Exclude<CreateFieldNames<TContract, ModelName>, NestedOptionalCreateFieldNames<TContract, ModelName>>;
type NestedCreateInput<TContract extends Contract<SqlStorage>, ModelName extends string> = Pick<DefaultModelRow<TContract, ModelName>, NestedRequiredCreateFieldNames<TContract, ModelName>> & Partial<Pick<DefaultModelRow<TContract, ModelName>, NestedOptionalCreateFieldNames<TContract, ModelName>>>;
type AtLeastOne<T> = keyof T extends never ? never : { [K in keyof T]-?: Pick<T, K> & Partial<Omit<T, K>> }[keyof T];
type MutationCreateInput<TContract extends Contract<SqlStorage>, ModelName extends string> = NestedCreateInput<TContract, ModelName> & RelationMutationFields<TContract, ModelName>;
type MutationCreateInputWithRelations<TContract extends Contract<SqlStorage>, ModelName extends string> = NestedCreateInput<TContract, ModelName> & AtLeastOne<RelationMutationFields<TContract, ModelName>>;
type MutationUpdateInput<TContract extends Contract<SqlStorage>, ModelName extends string> = Partial<DefaultModelRow<TContract, ModelName>> & RelationMutationFields<TContract, ModelName>;
type ModelRelations<TContract extends Contract<SqlStorage>, ModelName extends string> = ModelDef<TContract, ModelName> extends {
  readonly relations: infer R;
} ? R extends Record<string, unknown> ? R : Record<string, never> : Record<string, never>;
type ExactRecord<T> = T extends Record<string, unknown> ? string extends keyof T ? Record<string, never> : T : Record<string, never>;
type RelationsOf<TContract extends Contract<SqlStorage>, ModelName extends string> = ExactRecord<ModelRelations<TContract, ModelName>>;
type RelationNames<TContract extends Contract<SqlStorage>, ModelName extends string> = (string extends keyof RelationsOf<TContract, ModelName> ? never : keyof RelationsOf<TContract, ModelName>) & string;
type RelationModelName<Relation> = Relation extends {
  readonly to: infer To extends string;
} ? To : never;
type RelatedModelName<TContract extends Contract<SqlStorage>, ModelName extends string, RelName extends string> = RelationsOf<TContract, ModelName> extends infer Rels ? Rels extends Record<string, unknown> ? RelName extends keyof Rels ? RelationModelName<Rels[RelName]> : never : never : never;
type RelationCardinalityFromRelation<Relation> = Relation extends {
  readonly cardinality: infer Cardinality extends RelationCardinalityTag;
} ? Cardinality : '1:N';
type RelationCardinality<TContract extends Contract<SqlStorage>, ModelName extends string, RelName extends string> = RelationsOf<TContract, ModelName> extends infer Rels ? Rels extends Record<string, unknown> ? RelName extends keyof Rels ? RelationCardinalityFromRelation<Rels[RelName]> : '1:N' : '1:N' : '1:N';
type RelationLocalFieldColumns<TContract extends Contract<SqlStorage>, ModelName extends string, Relation> = Relation extends {
  readonly on: {
    readonly localFields: infer Fields extends readonly string[];
  };
} ? MapFieldsToColumns<TContract, ModelName, Fields> : readonly [];
type MapFieldsToColumns<TContract extends Contract<SqlStorage>, ModelName extends string, Fields$1 extends readonly string[]> = Fields$1 extends readonly [infer Head extends string, ...infer Tail extends string[]] ? readonly [FieldColumnName<TContract, ModelName, Head>, ...MapFieldsToColumns<TContract, ModelName, Tail>] : readonly [];
type AnyColumnNullable<Columns$1 extends Record<string, StorageColumn>, ColNames extends readonly string[]> = ColNames extends readonly [infer Head extends string, ...infer Tail extends string[]] ? Head extends keyof Columns$1 ? Columns$1[Head]['nullable'] extends true ? true : AnyColumnNullable<Columns$1, Tail> : true : false;
type HasForeignKeyForCols<FKs$1 extends readonly unknown[], Cols$1 extends readonly string[]> = FKs$1 extends readonly [infer Head, ...infer Tail extends unknown[]] ? Head extends {
  readonly columns: Cols$1;
} ? true : HasForeignKeyForCols<Tail, Cols$1> : false;
type IsFkSideOfRelation<Table$1 extends StorageTable, ParentCols extends readonly string[]> = Table$1 extends {
  readonly foreignKeys: infer FKs extends readonly unknown[];
} ? HasForeignKeyForCols<FKs, ParentCols> : false;
type IsToOneRelationNullable<TContract extends Contract<SqlStorage>, ModelName extends string, RelName extends string> = ModelTableName<TContract, ModelName> extends infer TableName extends string ? TableName extends keyof TContract['storage']['tables'] ? TContract['storage']['tables'][TableName] extends infer Table extends StorageTable ? RelationsOf<TContract, ModelName> extends infer Rels extends Record<string, unknown> ? RelName extends keyof Rels ? RelationLocalFieldColumns<TContract, ModelName, Rels[RelName]> extends infer Cols extends readonly string[] ? IsFkSideOfRelation<Table, Cols> extends true ? AnyColumnNullable<Table['columns'], Cols> : true : true : true : true : true : true : true;
type IncludeRelationValue<TContract extends Contract<SqlStorage>, ModelName extends string, RelName extends string, IncludedRow> = RelationCardinality<TContract, ModelName, RelName> extends '1:1' | 'N:1' ? IsToOneRelationNullable<TContract, ModelName, RelName> extends true ? IncludedRow | null : IncludedRow : IncludedRow[];
type CollectionModelName<TContract extends Contract<SqlStorage>> = keyof ModelsOf<TContract> & string;
//#endregion
//#region src/collection-internal-types.d.ts
interface CollectionInit<TContract extends Contract<SqlStorage>> {
  readonly tableName?: string | undefined;
  readonly state?: CollectionState | undefined;
  readonly registry?: ReadonlyMap<string, CollectionConstructor<TContract>> | undefined;
  readonly includeRefinementMode?: boolean | undefined;
}
type CollectionConstructor<TContract extends Contract<SqlStorage>> = new (ctx: CollectionContext<TContract>, modelName: string, options?: CollectionInit<TContract>) => Collection<TContract, string, unknown, CollectionTypeState>;
type WithWhereState<State extends CollectionTypeState> = Omit<State, 'hasWhere'> & {
  readonly hasWhere: true;
};
type WithOrderByState<State extends CollectionTypeState> = Omit<State, 'hasOrderBy'> & {
  readonly hasOrderBy: true;
};
type WithVariantState<State extends CollectionTypeState, V$1 extends string> = Omit<State, 'variantName'> & {
  readonly variantName: V$1;
};
type IncludedRelationsForRow<TContract extends Contract<SqlStorage>, ModelName extends string, Row> = Omit<Row, keyof DefaultModelRow<TContract, ModelName>>;
type IncludeRefinementTerminals = 'all' | 'first' | 'aggregate' | 'groupBy' | 'create' | 'createAll' | 'createCount' | 'update' | 'updateAll' | 'updateCount' | 'delete' | 'deleteAll' | 'deleteCount' | 'upsert';
type IncludeRefinementScalarMethods = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'combine';
type IncludeRefinementCollection<TContract extends Contract<SqlStorage>, ModelName extends string, Row, State extends CollectionTypeState, IsToMany extends boolean> = Omit<Collection<TContract, ModelName, Row, State>, IncludeRefinementTerminals | (IsToMany extends true ? never : IncludeRefinementScalarMethods)>;
type IsToManyRelation<TContract extends Contract<SqlStorage>, ModelName extends string, RelName extends string> = RelationCardinality<TContract, ModelName, RelName> extends '1:N' | 'M:N' ? true : false;
type IncludeRefinementResult<TContract extends Contract<SqlStorage>, RelatedName extends string, IsToMany extends boolean> = IncludeRefinementCollection<TContract, RelatedName, unknown, CollectionTypeState, IsToMany> | (IsToMany extends true ? IncludeScalar<unknown> | IncludeCombine<Record<string, unknown>> : never);
declare const RowType: unique symbol;
interface RowSelection<T> {
  [RowType]: T;
}
type IncludeRefinementValue<TContract extends Contract<SqlStorage>, ParentModelName extends string, RelName extends string, DefaultIncludedRow, RefinedResult> = RefinedResult extends RowSelection<infer V> ? RefinedResult extends {
  readonly kind: 'includeScalar' | 'includeCombine';
} ? V : IncludeRelationValue<TContract, ParentModelName, RelName, V> : IncludeRelationValue<TContract, ParentModelName, RelName, DefaultIncludedRow>;
//#endregion
//#region src/grouped-collection.d.ts
interface GroupedCollectionInit {
  readonly tableName: string;
  readonly baseFilters: readonly AnyExpression[];
  readonly groupByFields: readonly string[];
  readonly groupByColumns: readonly string[];
  readonly havingFilters: readonly AnyExpression[];
}
type GroupByFieldName<TContract extends Contract<SqlStorage>, ModelName extends string> = keyof DefaultModelRow<TContract, ModelName> & string;
declare class GroupedCollection<TContract extends Contract<SqlStorage>, ModelName extends string, GroupFields extends readonly GroupByFieldName<TContract, ModelName>[]> {
  readonly ctx: CollectionContext<TContract>;
  private readonly contract;
  readonly modelName: ModelName;
  readonly tableName: string;
  readonly baseFilters: readonly AnyExpression[];
  readonly groupByFields: readonly string[];
  readonly groupByColumns: readonly string[];
  readonly havingFilters: readonly AnyExpression[];
  constructor(ctx: CollectionContext<TContract>, modelName: ModelName, options: GroupedCollectionInit);
  having(predicate: (having: HavingBuilder<TContract, ModelName>) => AnyExpression): GroupedCollection<TContract, ModelName, GroupFields>;
  aggregate<Spec extends AggregateSpec>(fn: (aggregate: AggregateBuilder<TContract, ModelName>) => Spec): Promise<Array<SimplifyDeep<Pick<DefaultModelRow<TContract, ModelName>, GroupFields[number]> & AggregateResult<Spec>>>>;
}
//#endregion
//#region src/collection.d.ts
type WhereDirectInput = WhereArg;
declare class Collection<TContract extends Contract<SqlStorage>, ModelName extends string, Row = SimplifyDeep<InferRootRow<TContract, ModelName>>, State extends CollectionTypeState = DefaultCollectionTypeState> implements RowSelection<Row> {
  #private;
  readonly [RowType]: Row;
  /** @internal */
  readonly ctx: CollectionContext<TContract>;
  /** @internal */
  private readonly contract;
  /** @internal */
  readonly modelName: ModelName;
  /** @internal */
  readonly tableName: string;
  /** @internal */
  readonly state: CollectionState;
  /** @internal */
  readonly registry: ReadonlyMap<string, CollectionConstructor<TContract>>;
  /** @internal */
  readonly includeRefinementMode: boolean;
  constructor(ctx: CollectionContext<TContract>, modelName: ModelName, options?: CollectionInit<TContract>);
  where(fn: (model: ModelAccessor<TContract, ModelName>) => WhereDirectInput): Collection<TContract, ModelName, Row, WithWhereState<State>>;
  where(input: WhereDirectInput): Collection<TContract, ModelName, Row, WithWhereState<State>>;
  where(fn: (model: ModelAccessor<TContract, ModelName>) => WhereArg): Collection<TContract, ModelName, Row, WithWhereState<State>>;
  where(filters: ShorthandWhereFilter<TContract, ModelName>): Collection<TContract, ModelName, Row, WithWhereState<State>>;
  variant<V$1 extends VariantNames<TContract, ModelName>>(variantName: V$1): Collection<TContract, ModelName, VariantModelRow<TContract, ModelName, V$1>, WithVariantState<WithWhereState<State>, V$1>>;
  include<RelName extends RelationNames<TContract, ModelName>, RelatedName extends RelatedModelName<TContract, ModelName, RelName> & string = RelatedModelName<TContract, ModelName, RelName> & string, IsToMany extends boolean = IsToManyRelation<TContract, ModelName, RelName>, RefinedResult extends IncludeRefinementResult<TContract, RelatedName, IsToMany> = IncludeRefinementCollection<TContract, RelatedName, DefaultModelRow<TContract, RelatedName>, CollectionTypeState, IsToMany>>(relationName: RelName, refineFn?: (collection: IncludeRefinementCollection<TContract, RelatedName, DefaultModelRow<TContract, RelatedName>, DefaultCollectionTypeState, IsToMany>) => RefinedResult): Collection<TContract, ModelName, SimplifyDeep<Row & { [K in RelName]: IncludeRefinementValue<TContract, ModelName, K, DefaultModelRow<TContract, RelatedName>, RefinedResult> }>, State>;
  select<Fields$1 extends readonly [keyof DefaultModelRow<TContract, ModelName> & string, ...(keyof DefaultModelRow<TContract, ModelName> & string)[]]>(...fields: Fields$1): Collection<TContract, ModelName, SimplifyDeep<Pick<DefaultModelRow<TContract, ModelName>, Fields$1[number]> & IncludedRelationsForRow<TContract, ModelName, Row>>, State>;
  orderBy(selection: ((model: ModelAccessor<TContract, ModelName>) => OrderByItem) | ReadonlyArray<(model: ModelAccessor<TContract, ModelName>) => OrderByItem>): Collection<TContract, ModelName, Row, WithOrderByState<State>>;
  groupBy<Fields$1 extends readonly [keyof DefaultModelRow<TContract, ModelName> & string, ...(keyof DefaultModelRow<TContract, ModelName> & string)[]]>(...fields: Fields$1): GroupedCollection<TContract, ModelName, Fields$1>;
  count(): IncludeScalar<number>;
  sum<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): IncludeScalar<number | null>;
  avg<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): IncludeScalar<number | null>;
  min<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): IncludeScalar<number | null>;
  max<FieldName extends NumericFieldNames<TContract, ModelName>>(field: FieldName): IncludeScalar<number | null>;
  combine<Spec extends Record<string, Collection<TContract, ModelName, unknown, CollectionTypeState> | IncludeScalar<unknown>>>(spec: Spec): IncludeCombine<{ [K in keyof Spec]: Spec[K] extends IncludeScalar<infer ScalarResult> ? ScalarResult : Spec[K] extends Collection<TContract, ModelName, infer BranchRow, CollectionTypeState> ? BranchRow[] : never }>;
  cursor(cursorValues: State['hasOrderBy'] extends true ? Partial<Record<keyof DefaultModelRow<TContract, ModelName> & string, unknown>> : never): Collection<TContract, ModelName, Row, State>;
  distinct<Fields$1 extends readonly [keyof DefaultModelRow<TContract, ModelName> & string, ...(keyof DefaultModelRow<TContract, ModelName> & string)[]]>(...fields: Fields$1): Collection<TContract, ModelName, Row, State>;
  distinctOn<Fields$1 extends readonly [keyof DefaultModelRow<TContract, ModelName> & string, ...(keyof DefaultModelRow<TContract, ModelName> & string)[]]>(...fields: State['hasOrderBy'] extends true ? Fields$1 : never): Collection<TContract, ModelName, Row, State>;
  take(n: number): Collection<TContract, ModelName, Row, State>;
  skip(n: number): Collection<TContract, ModelName, Row, State>;
  all(): AsyncIterableResult<Row>;
  first(): Promise<Row | null>;
  first(filter: (model: ModelAccessor<TContract, ModelName>) => WhereArg): Promise<Row | null>;
  first(filter: ShorthandWhereFilter<TContract, ModelName>): Promise<Row | null>;
  aggregate<Spec extends AggregateSpec>(fn: (aggregate: AggregateBuilder<TContract, ModelName>) => Spec): Promise<AggregateResult<Spec>>;
  create(data: ResolvedCreateInput<TContract, ModelName, State['variantName']>): Promise<Row>;
  create(data: MutationCreateInputWithRelations<TContract, ModelName>): Promise<Row>;
  createAll(data: readonly ResolvedCreateInput<TContract, ModelName, State['variantName']>[]): AsyncIterableResult<Row>;
  createCount(data: readonly ResolvedCreateInput<TContract, ModelName, State['variantName']>[]): Promise<number>;
  /**
   * Passing `update: {}` makes this behave like a conditional create.
   * On conflict, `ON CONFLICT DO NOTHING RETURNING ...` may return zero rows,
   * so this method may issue a follow-up reload query to return the existing row.
   */
  upsert(input: {
    create: ResolvedCreateInput<TContract, ModelName, State['variantName']>;
    update: Partial<DefaultModelRow<TContract, ModelName>>;
    conflictOn?: UniqueConstraintCriterion<TContract, ModelName>;
  }): Promise<Row>;
  update(data: State['hasWhere'] extends true ? MutationUpdateInput<TContract, ModelName> : never): Promise<Row | null>;
  updateAll(data: State['hasWhere'] extends true ? Partial<DefaultModelRow<TContract, ModelName>> : never): AsyncIterableResult<Row>;
  updateCount(data: State['hasWhere'] extends true ? Partial<DefaultModelRow<TContract, ModelName>> : never): Promise<number>;
  delete(this: State['hasWhere'] extends true ? Collection<TContract, ModelName, Row, State> : never): Promise<Row | null>;
  deleteAll(this: State['hasWhere'] extends true ? Collection<TContract, ModelName, Row, State> : never): AsyncIterableResult<Row>;
  deleteCount(this: State['hasWhere'] extends true ? Collection<TContract, ModelName, Row, State> : never): Promise<number>;
}
//#endregion
//#region src/filters.d.ts
declare function and(...exprs: AnyExpression[]): AndExpr;
declare function or(...exprs: AnyExpression[]): OrExpr;
declare function not(expr: AnyExpression): AnyExpression;
declare function all(): AnyExpression;
//#endregion
//#region src/orm.d.ts
interface OrmOptions<TContract extends Contract<SqlStorage>, Collections extends Partial<Record<string, AnyCollectionClass>>> {
  readonly runtime: RuntimeQueryable;
  readonly collections?: Collections;
  readonly context: ExecutionContext<TContract>;
}
type ModelNames<TContract extends Contract<SqlStorage>> = CollectionModelName<TContract>;
type AnyCollectionClass = new (...args: never[]) => object;
type CustomCollectionForKey<Collections extends Partial<Record<string, AnyCollectionClass>>, Key extends string> = Key extends keyof Collections ? Collections[Key] extends AnyCollectionClass ? InstanceType<Collections[Key]> : never : never;
type ModelCollection<TContract extends Contract<SqlStorage>, Collections extends Partial<Record<string, AnyCollectionClass>>, ModelName extends ModelNames<TContract>> = [CustomCollectionForKey<Collections, ModelName>] extends [never] ? Collection<TContract, ModelName, InferRootRow<TContract, ModelName>> : CustomCollectionForKey<Collections, ModelName>;
type ModelCollectionMap<TContract extends Contract<SqlStorage>, Collections extends Partial<Record<string, AnyCollectionClass>>> = { [K in ModelNames<TContract>]: ModelCollection<TContract, Collections, K> };
type OrmClient<TContract extends Contract<SqlStorage>, Collections extends Partial<Record<string, AnyCollectionClass>>> = ModelCollectionMap<TContract, Collections>;
declare function orm<TContract extends Contract<SqlStorage>, Collections extends Partial<Record<string, AnyCollectionClass>> = Record<never, never>>(options: OrmOptions<TContract, Collections>): OrmClient<TContract, Collections>;
//#endregion
export { type AggregateBuilder, type AggregateResult, type AggregateSpec, Collection, type CollectionContext, type CollectionModelName, type CollectionState, type CollectionTypeState, type ComparisonMethods, type CreateInput, type DefaultCollectionTypeState, type DefaultModelRow, GroupedCollection, type IncludeExpr, type IncludeRefinementCollection, type IncludeRefinementResult, type IsToManyRelation, type ModelAccessor, type OrmOptions, type RelatedModelName, type RelationFilterAccessor, type RelationMutator, type RelationNames, type RelationPredicate, type RelationPredicateInput, type RelationsOf, type RuntimeQueryable, type ShorthandWhereFilter, type UniqueConstraintCriterion, all, and, emptyState, not, or, orm };
//# sourceMappingURL=index.d.mts.map
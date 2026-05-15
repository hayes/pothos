import { AnyFromSource, SelectAst } from "@prisma-next/sql-relational-core/ast";
import { CodecExpression, Expression as Expression$1, ScopeField } from "@prisma-next/sql-relational-core/expression";
import { ExtractCodecTypes, ExtractFieldInputTypes, ExtractFieldOutputTypes, ExtractQueryOperationTypes, QueryOperationTypesBase, StorageTable, StorageTable as StorageTable$1 } from "@prisma-next/sql-contract/types";
import { SqlQueryPlan } from "@prisma-next/sql-relational-core/plan";

//#region src/scope.d.ts
type CodecTypesBase = Record<string, {
  readonly input: unknown;
  readonly output: unknown;
}>;
type GatedMethod<Capabilities, Required, Method> = Capabilities extends Required ? Method : never;
declare const JoinOuterScope: unique symbol;
declare const SubqueryMarker: unique symbol;
type Expand<T> = { [K in keyof T]: T[K] } & unknown;
type EmptyRow = Record<never, ScopeField>;
type ScopeTable = Record<string, ScopeField>;
type Scope = {
  topLevel: ScopeTable;
  namespaces: Record<string, ScopeTable>;
};
type JoinSource<Row extends ScopeTable, Alias extends string> = {
  readonly [JoinOuterScope]: {
    topLevel: Row;
    namespaces: Record<Alias, Row>;
  };
  getJoinOuterScope(): Scope;
  buildAst(): AnyFromSource;
};
type DefaultScope<Name$1 extends string, Table extends StorageTable$1> = {
  topLevel: StorageTableToScopeTable<Table>;
  namespaces: { [K in Name$1]: StorageTableToScopeTable<Table> };
};
type StorageTableToScopeTable<T extends StorageTable$1> = { [K in keyof T['columns']]: {
  codecId: T['columns'][K]['codecId'];
  nullable: T['columns'][K]['nullable'];
} };
type MergeScopes<A extends Scope, B extends Scope> = {
  topLevel: Expand<Omit<A['topLevel'], keyof B['topLevel']> & Omit<B['topLevel'], keyof A['topLevel']>>;
  namespaces: Expand<A['namespaces'] & B['namespaces']>;
};
type RebindScope<S extends Scope, OldKey extends string, NewKey extends string> = {
  topLevel: S['topLevel'];
  namespaces: Expand<Omit<S['namespaces'], OldKey> & Record<NewKey, S['namespaces'][OldKey]>>;
};
type NullableScopeTable<S extends ScopeTable> = { [K in keyof S]: {
  codecId: S[K]['codecId'];
  nullable: true;
} };
type NullableScope<S extends Scope> = {
  topLevel: NullableScopeTable<S['topLevel']>;
  namespaces: { [TableName in keyof S['namespaces']]: NullableScopeTable<S['namespaces'][TableName]> };
};
type Subquery<RowType extends Record<string, ScopeField>> = {
  [SubqueryMarker]: RowType;
  buildAst(): SelectAst;
  getRowFields(): Record<string, ScopeField>;
};
type QueryContext = {
  readonly codecTypes: CodecTypesBase;
  readonly capabilities: Record<string, Record<string, boolean>>;
  readonly queryOperationTypes: QueryOperationTypesBase;
  readonly resolvedColumnOutputTypes: Record<string, unknown>;
};
//#endregion
//#region src/expression.d.ts
type BooleanCodecType = {
  codecId: 'pg/bool@1';
  nullable: boolean;
};
type WithField<Source, Field extends ScopeField, Alias extends string> = Expand<Source & { [K in Alias]: Field }>;
type WithFields<Source, FromScope extends ScopeTable, Columns extends readonly (keyof FromScope)[]> = Expand<Source & Pick<FromScope, Columns[number]>>;
type ExtractScopeFields<T extends Record<string, Expression$1<ScopeField>>> = { [K in keyof T]: T[K] extends Expression$1<infer F extends ScopeField> ? F : never };
type FieldProxy<AvailableScope extends Scope> = { [K in keyof AvailableScope['topLevel']]: Expression$1<AvailableScope['topLevel'][K]> } & { [TableName in keyof AvailableScope['namespaces']]: { [K in keyof AvailableScope['namespaces'][TableName]]: Expression$1<AvailableScope['namespaces'][TableName][K]> } };
type ExpressionBuilder<AvailableScope extends Scope, QC extends QueryContext> = (fields: FieldProxy<AvailableScope>, fns: Functions<QC>) => Expression$1<BooleanCodecType>;
type OrderByDirection = 'asc' | 'desc';
type OrderByNulls = 'first' | 'last';
type OrderByOptions = {
  direction?: OrderByDirection;
  nulls?: OrderByNulls;
};
type OrderByScope<AvailableScope extends Scope, RowType extends Record<string, ScopeField>> = {
  topLevel: Expand<AvailableScope['topLevel'] & RowType>;
  namespaces: AvailableScope['namespaces'];
};
type DeriveExtFunctions<OT extends QueryOperationTypesBase> = { [K in keyof OT]: OT[K]['impl'] };
type BuiltinFunctions<CT extends Record<string, {
  readonly input: unknown;
}>> = {
  eq: <CodecId extends string>(a: CodecExpression<CodecId, boolean, CT> | null, b: CodecExpression<CodecId, boolean, CT> | null) => Expression$1<BooleanCodecType>;
  ne: <CodecId extends string, N extends boolean>(a: CodecExpression<CodecId, N, CT> | null, b: CodecExpression<CodecId, N, CT> | null) => Expression$1<BooleanCodecType>;
  gt: <CodecId extends string, N extends boolean>(a: CodecExpression<CodecId, N, CT>, b: CodecExpression<CodecId, N, CT>) => Expression$1<BooleanCodecType>;
  gte: <CodecId extends string, N extends boolean>(a: CodecExpression<CodecId, N, CT>, b: CodecExpression<CodecId, N, CT>) => Expression$1<BooleanCodecType>;
  lt: <CodecId extends string, N extends boolean>(a: CodecExpression<CodecId, N, CT>, b: CodecExpression<CodecId, N, CT>) => Expression$1<BooleanCodecType>;
  lte: <CodecId extends string, N extends boolean>(a: CodecExpression<CodecId, N, CT>, b: CodecExpression<CodecId, N, CT>) => Expression$1<BooleanCodecType>;
  and: (...ands: CodecExpression<'pg/bool@1', boolean, CT>[]) => Expression$1<BooleanCodecType>;
  or: (...ors: CodecExpression<'pg/bool@1', boolean, CT>[]) => Expression$1<BooleanCodecType>;
  exists: (subquery: Subquery<Record<string, ScopeField>>) => Expression$1<BooleanCodecType>;
  notExists: (subquery: Subquery<Record<string, ScopeField>>) => Expression$1<BooleanCodecType>;
  in: {
    <CodecId extends string>(expr: Expression$1<{
      codecId: CodecId;
      nullable: boolean;
    }>, subquery: Subquery<Record<string, {
      codecId: CodecId;
      nullable: boolean;
    }>>): Expression$1<BooleanCodecType>;
    <CodecId extends string>(expr: Expression$1<{
      codecId: CodecId;
      nullable: boolean;
    }>, values: Array<CodecExpression<CodecId, boolean, CT>>): Expression$1<BooleanCodecType>;
  };
  notIn: {
    <CodecId extends string>(expr: Expression$1<{
      codecId: CodecId;
      nullable: boolean;
    }>, subquery: Subquery<Record<string, {
      codecId: CodecId;
      nullable: boolean;
    }>>): Expression$1<BooleanCodecType>;
    <CodecId extends string>(expr: Expression$1<{
      codecId: CodecId;
      nullable: boolean;
    }>, values: Array<CodecExpression<CodecId, boolean, CT>>): Expression$1<BooleanCodecType>;
  };
};
type Functions<QC extends QueryContext> = BuiltinFunctions<QC['codecTypes']> & DeriveExtFunctions<QC['queryOperationTypes']>;
type CountField = {
  codecId: 'pg/int8@1';
  nullable: false;
};
type AggregateOnlyFunctions = {
  count: (expr?: Expression$1<ScopeField>) => Expression$1<CountField>;
  sum: <T extends ScopeField>(expr: Expression$1<T>) => Expression$1<{
    codecId: T['codecId'];
    nullable: true;
  }>;
  avg: <T extends ScopeField>(expr: Expression$1<T>) => Expression$1<{
    codecId: T['codecId'];
    nullable: true;
  }>;
  min: <T extends ScopeField>(expr: Expression$1<T>) => Expression$1<{
    codecId: T['codecId'];
    nullable: true;
  }>;
  max: <T extends ScopeField>(expr: Expression$1<T>) => Expression$1<{
    codecId: T['codecId'];
    nullable: true;
  }>;
};
type AggregateFunctions<QC extends QueryContext> = Functions<QC> & AggregateOnlyFunctions;
//#endregion
//#region src/resolve.d.ts
type ResolveField<F$1 extends ScopeField, CodecTypes extends Record<string, {
  readonly output: unknown;
}>> = F$1['codecId'] extends keyof CodecTypes ? F$1['nullable'] extends true ? CodecTypes[F$1['codecId']]['output'] | null : CodecTypes[F$1['codecId']]['output'] : unknown;
type ApplyNullable<T, F$1 extends ScopeField> = F$1['nullable'] extends true ? T | null : T;
type ResolveRow<Row extends Record<string, ScopeField>, CodecTypes extends Record<string, {
  readonly output: unknown;
}>, PreResolved extends Record<string, unknown> = Record<string, never>> = Expand<{ -readonly [K in keyof Row]: string extends keyof PreResolved ? ResolveField<Row[K], CodecTypes> : K extends keyof PreResolved ? ApplyNullable<NonNullable<PreResolved[K & keyof PreResolved]>, Row[K]> : ResolveField<Row[K], CodecTypes> }>;
//#endregion
//#region src/types/mutation-query.d.ts
type ReturningCapability = {
  sql: {
    returning: true;
  };
};
type InsertValues<Table extends StorageTable, CT extends Record<string, {
  readonly input: unknown;
}>> = { [K in keyof Table['columns']]?: Table['columns'][K]['codecId'] extends keyof CT ? CT[Table['columns'][K]['codecId']]['input'] : unknown };
interface InsertQuery<QC extends QueryContext, AvailableScope extends Scope, RowType extends Record<string, ScopeField>> {
  returning: GatedMethod<QC['capabilities'], ReturningCapability, <Columns extends (keyof AvailableScope['topLevel'] & string)[]>(...columns: Columns) => InsertQuery<QC, AvailableScope, WithFields<EmptyRow, AvailableScope['topLevel'], Columns>>>;
  build(): SqlQueryPlan<ResolveRow<RowType, QC['codecTypes'], QC['resolvedColumnOutputTypes']>>;
}
interface UpdateQuery<QC extends QueryContext, AvailableScope extends Scope, RowType extends Record<string, ScopeField>> {
  where(expr: ExpressionBuilder<AvailableScope, QC>): UpdateQuery<QC, AvailableScope, RowType>;
  returning: GatedMethod<QC['capabilities'], ReturningCapability, <Columns extends (keyof AvailableScope['topLevel'] & string)[]>(...columns: Columns) => UpdateQuery<QC, AvailableScope, WithFields<EmptyRow, AvailableScope['topLevel'], Columns>>>;
  build(): SqlQueryPlan<ResolveRow<RowType, QC['codecTypes'], QC['resolvedColumnOutputTypes']>>;
}
interface DeleteQuery<QC extends QueryContext, AvailableScope extends Scope, RowType extends Record<string, ScopeField>> {
  where(expr: ExpressionBuilder<AvailableScope, QC>): DeleteQuery<QC, AvailableScope, RowType>;
  returning: GatedMethod<QC['capabilities'], ReturningCapability, <Columns extends (keyof AvailableScope['topLevel'] & string)[]>(...columns: Columns) => DeleteQuery<QC, AvailableScope, WithFields<EmptyRow, AvailableScope['topLevel'], Columns>>>;
  build(): SqlQueryPlan<ResolveRow<RowType, QC['codecTypes'], QC['resolvedColumnOutputTypes']>>;
}
//#endregion
//#region src/types/joined-tables.d.ts
interface JoinedTables<QC extends QueryContext, AvailableScope extends Scope> extends WithSelect<QC, AvailableScope, EmptyRow>, WithJoin<QC, AvailableScope, QC['capabilities']> {}
//#endregion
//#region src/types/grouped-query.d.ts
interface GroupedQuery<QC extends QueryContext, AvailableScope extends Scope, RowType extends Record<string, ScopeField>> extends Subquery<RowType>, WithPagination, WithDistinct, WithAlias<RowType>, WithBuild<QC, RowType> {
  groupBy(...fields: ((keyof RowType | keyof AvailableScope['topLevel']) & string)[]): GroupedQuery<QC, AvailableScope, RowType>;
  groupBy(expr: (fields: FieldProxy<OrderByScope<AvailableScope, RowType>>, fns: Functions<QC>) => Expression$1<ScopeField>): GroupedQuery<QC, AvailableScope, RowType>;
  having(expr: (fields: FieldProxy<OrderByScope<AvailableScope, RowType>>, fns: AggregateFunctions<QC>) => Expression$1<BooleanCodecType>): GroupedQuery<QC, AvailableScope, RowType>;
  orderBy(field: (keyof RowType | keyof AvailableScope['topLevel']) & string, options?: OrderByOptions): GroupedQuery<QC, AvailableScope, RowType>;
  orderBy(expr: (fields: FieldProxy<OrderByScope<AvailableScope, RowType>>, fns: AggregateFunctions<QC>) => Expression$1<ScopeField>, options?: OrderByOptions): GroupedQuery<QC, AvailableScope, RowType>;
  distinctOn: GatedMethod<QC['capabilities'], {
    postgres: {
      distinctOn: true;
    };
  }, {
    (...fields: ((keyof RowType | keyof AvailableScope['topLevel']) & string)[]): GroupedQuery<QC, AvailableScope, RowType>;
    (expr: (fields: FieldProxy<OrderByScope<AvailableScope, RowType>>, fns: Functions<QC>) => Expression$1<ScopeField>): GroupedQuery<QC, AvailableScope, RowType>;
  }>;
}
//#endregion
//#region src/types/select-query.d.ts
interface SelectQuery<QC extends QueryContext, AvailableScope extends Scope, RowType extends Record<string, ScopeField>> extends Subquery<RowType>, WithSelect<QC, AvailableScope, RowType>, WithPagination, WithDistinct, WithAlias<RowType>, WithBuild<QC, RowType> {
  where(expr: ExpressionBuilder<AvailableScope, QC>): SelectQuery<QC, AvailableScope, RowType>;
  orderBy(field: (keyof RowType | keyof AvailableScope['topLevel']) & string, options?: OrderByOptions): SelectQuery<QC, AvailableScope, RowType>;
  orderBy(expr: (fields: FieldProxy<OrderByScope<AvailableScope, RowType>>, fns: Functions<QC>) => Expression$1<ScopeField>, options?: OrderByOptions): SelectQuery<QC, AvailableScope, RowType>;
  groupBy(...fields: ((keyof RowType | keyof AvailableScope['topLevel']) & string)[]): GroupedQuery<QC, AvailableScope, RowType>;
  groupBy(expr: (fields: FieldProxy<OrderByScope<AvailableScope, RowType>>, fns: Functions<QC>) => Expression$1<ScopeField>): GroupedQuery<QC, AvailableScope, RowType>;
  distinctOn: GatedMethod<QC['capabilities'], {
    postgres: {
      distinctOn: true;
    };
  }, {
    (...fields: ((keyof RowType | keyof AvailableScope['topLevel']) & string)[]): SelectQuery<QC, AvailableScope, RowType>;
    (expr: (fields: FieldProxy<OrderByScope<AvailableScope, RowType>>, fns: Functions<QC>) => Expression$1<ScopeField>): SelectQuery<QC, AvailableScope, RowType>;
  }>;
}
//#endregion
//#region src/types/shared.d.ts
interface LateralBuilder<QC extends QueryContext, ParentScope extends Scope> {
  from<Other extends JoinSource<ScopeTable, string | never>>(other: Other): SelectQuery<QC, MergeScopes<ParentScope, Other[typeof JoinOuterScope]>, EmptyRow>;
}
interface WithSelect<QC extends QueryContext, AvailableScope extends Scope, RowType extends Record<string, ScopeField> = EmptyRow> {
  select<Columns extends (keyof AvailableScope['topLevel'] & string)[]>(...columns: Columns): SelectQuery<QC, AvailableScope, WithFields<RowType, AvailableScope['topLevel'], Columns>>;
  select<Alias extends string, Field extends ScopeField>(alias: Alias, expr: (fields: FieldProxy<AvailableScope>, fns: AggregateFunctions<QC>) => Expression$1<Field>): SelectQuery<QC, AvailableScope, WithField<RowType, Field, Alias>>;
  select<Result extends Record<string, Expression$1<ScopeField>>>(callback: (fields: FieldProxy<AvailableScope>, fns: AggregateFunctions<QC>) => Result): SelectQuery<QC, AvailableScope, Expand<RowType & ExtractScopeFields<Result>>>;
}
interface WithJoin<QC extends QueryContext, AvailableScope extends Scope, Capabilities> {
  innerJoin<Other extends JoinSource<ScopeTable, string | never>>(other: Other, on: ExpressionBuilder<MergeScopes<AvailableScope, Other[typeof JoinOuterScope]>, QC>): JoinedTables<QC, MergeScopes<AvailableScope, Other[typeof JoinOuterScope]>>;
  outerLeftJoin<Other extends JoinSource<ScopeTable, string | never>>(other: Other, on: ExpressionBuilder<MergeScopes<AvailableScope, Other[typeof JoinOuterScope]>, QC>): JoinedTables<QC, MergeScopes<AvailableScope, NullableScope<Other[typeof JoinOuterScope]>>>;
  outerRightJoin<Other extends JoinSource<ScopeTable, string | never>>(other: Other, on: ExpressionBuilder<MergeScopes<AvailableScope, Other[typeof JoinOuterScope]>, QC>): JoinedTables<QC, MergeScopes<NullableScope<AvailableScope>, Other[typeof JoinOuterScope]>>;
  outerFullJoin<Other extends JoinSource<ScopeTable, string | never>>(other: Other, on: ExpressionBuilder<MergeScopes<AvailableScope, Other[typeof JoinOuterScope]>, QC>): JoinedTables<QC, MergeScopes<NullableScope<AvailableScope>, NullableScope<Other[typeof JoinOuterScope]>>>;
  lateralJoin: GatedMethod<Capabilities, {
    sql: {
      lateral: true;
    };
  }, <Alias extends string, LateralRow extends Record<string, ScopeField>>(alias: Alias, builder: (lateral: LateralBuilder<QC, AvailableScope>) => Subquery<LateralRow>) => JoinedTables<QC, MergeScopes<AvailableScope, {
    topLevel: LateralRow;
    namespaces: Record<Alias, LateralRow>;
  }>>>;
  outerLateralJoin: GatedMethod<Capabilities, {
    sql: {
      lateral: true;
    };
  }, <Alias extends string, LateralRow extends Record<string, ScopeField>>(alias: Alias, builder: (lateral: LateralBuilder<QC, AvailableScope>) => Subquery<LateralRow>) => JoinedTables<QC, MergeScopes<AvailableScope, NullableScope<{
    topLevel: LateralRow;
    namespaces: Record<Alias, LateralRow>;
  }>>>>;
}
interface WithPagination {
  limit(count: number): this;
  offset(count: number): this;
}
interface WithDistinct {
  distinct(): this;
}
interface WithAlias<RowType extends Record<string, ScopeField>> {
  as<Alias extends string>(newAlias: Alias): JoinSource<RowType, Alias>;
}
interface WithBuild<QC extends QueryContext, RowType extends Record<string, ScopeField>> {
  build(): SqlQueryPlan<ResolveRow<RowType, QC['codecTypes'], QC['resolvedColumnOutputTypes']>>;
}
//#endregion
//#region src/types/table-proxy.d.ts
type FindModelForTable<C, TableName$1 extends string> = C extends {
  readonly models: infer Models extends Record<string, {
    readonly storage: {
      readonly table: string;
    };
  }>;
} ? { [M in keyof Models & string]: Models[M]['storage']['table'] extends TableName$1 ? M : never }[keyof Models & string] : never;
type FindFieldForColumn<C, ModelName$1 extends string, ColumnName extends string> = C extends {
  readonly models: infer Models extends Record<string, {
    readonly storage: {
      readonly fields: Record<string, {
        readonly column: string;
      }>;
    };
  }>;
} ? ModelName$1 extends keyof Models ? { [F in keyof Models[ModelName$1]['storage']['fields'] & string]: Models[ModelName$1]['storage']['fields'][F]['column'] extends ColumnName ? F : never }[keyof Models[ModelName$1]['storage']['fields'] & string] : never : never;
type ResolvedColumnTypes<C, TableName$1 extends string, FieldTypes extends Record<string, Record<string, unknown>>> = string extends keyof FieldTypes ? Record<string, never> : FindModelForTable<C, TableName$1> extends infer ModelName extends string ? ModelName extends keyof FieldTypes ? C extends {
  readonly storage: {
    readonly tables: infer Tables extends Record<string, StorageTable>;
  };
} ? TableName$1 extends keyof Tables ? { [ColName in keyof Tables[TableName$1]['columns'] & string]: FindFieldForColumn<C, ModelName, ColName> extends infer FieldName extends string ? FieldName extends keyof FieldTypes[ModelName] ? FieldTypes[ModelName][FieldName] : unknown : unknown } : Record<string, never> : Record<string, never> : Record<string, never> : Record<string, never>;
type ResolvedInsertValues<C, Table extends StorageTable, TableName$1 extends string, CT extends Record<string, {
  readonly input: unknown;
}>, FieldInputs extends Record<string, Record<string, unknown>>> = string extends keyof FieldInputs ? InsertValues<Table, CT> : FindModelForTable<C, TableName$1> extends infer ModelName extends string ? ModelName extends keyof FieldInputs ? { [K in keyof Table['columns']]?: FindFieldForColumn<C, ModelName, K & string> extends infer FieldName extends string ? FieldName extends keyof FieldInputs[ModelName] ? Table['columns'][K]['nullable'] extends true ? NonNullable<FieldInputs[ModelName][FieldName]> | null : NonNullable<FieldInputs[ModelName][FieldName]> : Table['columns'][K]['codecId'] extends keyof CT ? CT[Table['columns'][K]['codecId']]['input'] : unknown : Table['columns'][K]['codecId'] extends keyof CT ? CT[Table['columns'][K]['codecId']]['input'] : unknown } : InsertValues<Table, CT> : InsertValues<Table, CT>;
type ResolvedUpdateValues<C, Table extends StorageTable, TableName$1 extends string, CT extends Record<string, {
  readonly input: unknown;
}>, FieldInputs extends Record<string, Record<string, unknown>>> = ResolvedInsertValues<C, Table, TableName$1, CT, FieldInputs>;
type ContractToQC<C extends TableProxyContract, Name$1 extends string = string> = {
  readonly codecTypes: ExtractCodecTypes<C>;
  readonly capabilities: C['capabilities'];
  readonly queryOperationTypes: ExtractQueryOperationTypes<C>;
  readonly resolvedColumnOutputTypes: ResolvedColumnTypes<C, Name$1, ExtractFieldOutputTypes<C>>;
};
interface TableProxy<C extends TableProxyContract, Name$1 extends string & keyof C['storage']['tables'], Alias extends string = Name$1, AvailableScope extends Scope = DefaultScope<Name$1, C['storage']['tables'][Name$1]>, QC extends QueryContext = ContractToQC<C, Name$1>> extends JoinSource<StorageTableToScopeTable<C['storage']['tables'][Name$1]>, Alias>, WithSelect<QC, AvailableScope, EmptyRow>, WithJoin<QC, AvailableScope, C['capabilities']> {
  as<NewAlias extends string>(newAlias: NewAlias): TableProxy<C, Name$1, NewAlias, RebindScope<AvailableScope, Alias, NewAlias>>;
  insert(values: ResolvedInsertValues<C, C['storage']['tables'][Name$1], Name$1, QC['codecTypes'], ExtractFieldInputTypes<C>>): InsertQuery<QC, AvailableScope, EmptyRow>;
  update(set: ResolvedUpdateValues<C, C['storage']['tables'][Name$1], Name$1, QC['codecTypes'], ExtractFieldInputTypes<C>>): UpdateQuery<QC, AvailableScope, EmptyRow>;
  delete(): DeleteQuery<QC, AvailableScope, EmptyRow>;
}
//#endregion
//#region src/types/db.d.ts
type CapabilitiesBase = Record<string, Record<string, boolean>>;
type TableProxyContract = {
  readonly storage: {
    readonly tables: Record<string, StorageTable>;
  };
  readonly capabilities: CapabilitiesBase;
};
type Db<C extends TableProxyContract> = { [Name in string & keyof C['storage']['tables']]: TableProxy<C, Name> };
//#endregion
export { ScopeField as _, GroupedQuery as a, UpdateQuery as c, Expression$1 as d, FieldProxy as f, Scope as g, QueryContext as h, SelectQuery as i, ResolveRow as l, GatedMethod as m, TableProxyContract as n, DeleteQuery as o, Functions as p, TableProxy as r, InsertQuery as s, Db as t, AggregateFunctions as u, Subquery as v };
//# sourceMappingURL=db-T7YxA-v6.d.mts.map
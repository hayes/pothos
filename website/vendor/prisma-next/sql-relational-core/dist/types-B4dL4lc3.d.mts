import { ParamSpec } from "@prisma-next/operations";
import { SqlLoweringSpec } from "@prisma-next/sql-operations";

//#region src/ast/types.d.ts
type Direction = 'asc' | 'desc';
type BinaryOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'in' | 'notIn';
type AggregateCountFn = 'count';
type AggregateOpFn = 'sum' | 'avg' | 'min' | 'max';
type AggregateFn = AggregateCountFn | AggregateOpFn;
interface ExpressionSource {
  toExpr(): AnyExpression;
}
interface ExpressionRewriter {
  columnRef?(expr: ColumnRef): AnyExpression;
  identifierRef?(expr: IdentifierRef): AnyExpression;
  paramRef?(expr: ParamRef): ParamRef | LiteralExpr;
  literal?(expr: LiteralExpr): LiteralExpr;
  list?(expr: ListExpression): ListExpression | LiteralExpr;
  select?(ast: SelectAst): SelectAst;
}
interface AstRewriter extends ExpressionRewriter {
  tableSource?(source: TableSource): TableSource;
  eqColJoinOn?(on: EqColJoinOn): EqColJoinOn | AnyExpression;
}
interface ExprVisitor<R> {
  columnRef(expr: ColumnRef): R;
  identifierRef(expr: IdentifierRef): R;
  subquery(expr: SubqueryExpr): R;
  operation(expr: OperationExpr): R;
  aggregate(expr: AggregateExpr): R;
  jsonObject(expr: JsonObjectExpr): R;
  jsonArrayAgg(expr: JsonArrayAggExpr): R;
  binary(expr: BinaryExpr): R;
  and(expr: AndExpr): R;
  or(expr: OrExpr): R;
  exists(expr: ExistsExpr): R;
  nullCheck(expr: NullCheckExpr): R;
  not(expr: NotExpr): R;
  literal(expr: LiteralExpr): R;
  param(expr: ParamRef): R;
  list(expr: ListExpression): R;
}
interface ExpressionFolder<T> {
  empty: T;
  combine(a: T, b: T): T;
  isAbsorbing?(value: T): boolean;
  columnRef?(expr: ColumnRef): T;
  identifierRef?(expr: IdentifierRef): T;
  paramRef?(expr: ParamRef): T;
  literal?(expr: LiteralExpr): T;
  list?(expr: ListExpression): T;
  select?(ast: SelectAst): T;
}
type ProjectionExpr = AnyExpression;
type InsertValue = ColumnRef | ParamRef | DefaultValueExpr;
type JoinOnExpr = EqColJoinOn | AnyExpression;
type WhereArg = AnyExpression | ToWhereExpr;
type JsonObjectEntry = {
  readonly key: string;
  readonly value: ProjectionExpr;
};
declare abstract class AstNode {
  abstract readonly kind: string;
  protected freeze(): void;
}
declare abstract class QueryAst extends AstNode {
  abstract collectParamRefs(): ParamRef[];
  abstract toQueryAst(): AnyQueryAst;
}
declare abstract class FromSource extends AstNode {
  abstract rewrite(rewriter: AstRewriter): AnyFromSource;
  abstract toFromSource(): AnyFromSource;
}
declare abstract class Expression extends AstNode implements ExpressionSource {
  abstract accept<R>(visitor: ExprVisitor<R>): R;
  abstract rewrite(rewriter: ExpressionRewriter): AnyExpression;
  abstract fold<T>(folder: ExpressionFolder<T>): T;
  collectColumnRefs(): ColumnRef[];
  collectParamRefs(): ParamRef[];
  baseColumnRef(): ColumnRef;
  toExpr(): AnyExpression;
  not(): NotExpr;
}
declare class TableSource extends FromSource {
  readonly kind: "table-source";
  readonly name: string;
  readonly alias: string | undefined;
  constructor(name: string, alias?: string);
  static named(name: string, alias?: string): TableSource;
  rewrite(rewriter: AstRewriter): AnyFromSource;
  toFromSource(): AnyFromSource;
}
interface TableRef {
  readonly name: string;
  readonly alias?: string;
}
declare class DerivedTableSource extends FromSource {
  readonly kind: "derived-table-source";
  readonly alias: string;
  readonly query: SelectAst;
  constructor(alias: string, query: SelectAst);
  static as(alias: string, query: SelectAst): DerivedTableSource;
  rewrite(rewriter: AstRewriter): AnyFromSource;
  toFromSource(): AnyFromSource;
}
declare class ColumnRef extends Expression {
  readonly kind: "column-ref";
  readonly table: string;
  readonly column: string;
  constructor(table: string, column: string);
  static of(table: string, column: string): ColumnRef;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
  baseColumnRef(): ColumnRef;
}
declare class IdentifierRef extends Expression {
  readonly kind: "identifier-ref";
  readonly name: string;
  constructor(name: string);
  static of(name: string): IdentifierRef;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class ParamRef extends Expression {
  readonly kind: "param-ref";
  readonly value: unknown;
  readonly name: string | undefined;
  readonly codecId: string | undefined;
  constructor(value: unknown, options?: {
    name?: string;
    codecId?: string;
  });
  static of(value: unknown, options?: {
    name?: string;
    codecId?: string;
  }): ParamRef;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class DefaultValueExpr extends AstNode {
  readonly kind: "default-value";
  constructor();
}
declare class LiteralExpr extends Expression {
  readonly kind: "literal";
  readonly value: unknown;
  constructor(value: unknown);
  static of(value: unknown): LiteralExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class SubqueryExpr extends Expression {
  readonly kind: "subquery";
  readonly query: SelectAst;
  constructor(query: SelectAst);
  static of(query: SelectAst): SubqueryExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class OperationExpr extends Expression {
  readonly kind: "operation";
  readonly method: string;
  readonly self: AnyExpression;
  readonly args: ReadonlyArray<AnyExpression | ParamRef | LiteralExpr>;
  readonly returns: ParamSpec;
  readonly lowering: SqlLoweringSpec;
  constructor(options: {
    readonly method: string;
    readonly self: AnyExpression;
    readonly args: ReadonlyArray<AnyExpression | ParamRef | LiteralExpr> | undefined;
    readonly returns: ParamSpec;
    readonly lowering: SqlLoweringSpec;
  });
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
  baseColumnRef(): ColumnRef;
}
declare class AggregateExpr extends Expression {
  readonly kind: "aggregate";
  readonly fn: AggregateFn;
  readonly expr: AnyExpression | undefined;
  constructor(fn: AggregateFn, expr?: AnyExpression);
  static count(expr?: AnyExpression): AggregateExpr;
  static sum(expr: AnyExpression): AggregateExpr;
  static avg(expr: AnyExpression): AggregateExpr;
  static min(expr: AnyExpression): AggregateExpr;
  static max(expr: AnyExpression): AggregateExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class JsonObjectExpr extends Expression {
  readonly kind: "json-object";
  readonly entries: ReadonlyArray<JsonObjectEntry>;
  constructor(entries: ReadonlyArray<JsonObjectEntry>);
  static entry(key: string, value: ProjectionExpr): JsonObjectEntry;
  static fromEntries(entries: ReadonlyArray<JsonObjectEntry>): JsonObjectExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class OrderByItem extends AstNode {
  readonly kind: "order-by-item";
  readonly expr: AnyExpression;
  readonly dir: Direction;
  constructor(expr: AnyExpression, dir: Direction);
  static asc(expr: AnyExpression): OrderByItem;
  static desc(expr: AnyExpression): OrderByItem;
  rewrite(rewriter: ExpressionRewriter): OrderByItem;
}
declare class JsonArrayAggExpr extends Expression {
  readonly kind: "json-array-agg";
  readonly expr: AnyExpression;
  readonly onEmpty: 'null' | 'emptyArray';
  readonly orderBy: ReadonlyArray<OrderByItem> | undefined;
  constructor(expr: AnyExpression, onEmpty?: 'null' | 'emptyArray', orderBy?: ReadonlyArray<OrderByItem>);
  static of(expr: AnyExpression, onEmpty?: 'null' | 'emptyArray', orderBy?: ReadonlyArray<OrderByItem>): JsonArrayAggExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class ListExpression extends Expression {
  readonly kind: "list";
  readonly values: ReadonlyArray<AnyExpression>;
  constructor(values: ReadonlyArray<AnyExpression>);
  static of(values: ReadonlyArray<AnyExpression>): ListExpression;
  static fromValues(values: ReadonlyArray<unknown>): ListExpression;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class BinaryExpr extends Expression {
  readonly kind: "binary";
  readonly op: BinaryOp;
  readonly left: AnyExpression;
  readonly right: AnyExpression;
  constructor(op: BinaryOp, left: AnyExpression, right: AnyExpression);
  static eq(left: AnyExpression, right: AnyExpression): BinaryExpr;
  static neq(left: AnyExpression, right: AnyExpression): BinaryExpr;
  static gt(left: AnyExpression, right: AnyExpression): BinaryExpr;
  static lt(left: AnyExpression, right: AnyExpression): BinaryExpr;
  static gte(left: AnyExpression, right: AnyExpression): BinaryExpr;
  static lte(left: AnyExpression, right: AnyExpression): BinaryExpr;
  static like(left: AnyExpression, right: AnyExpression): BinaryExpr;
  static in(left: AnyExpression, right: AnyExpression): BinaryExpr;
  static notIn(left: AnyExpression, right: AnyExpression): BinaryExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class AndExpr extends Expression {
  readonly kind: "and";
  readonly exprs: ReadonlyArray<AnyExpression>;
  constructor(exprs: ReadonlyArray<AnyExpression>);
  static of(exprs: ReadonlyArray<AnyExpression>): AndExpr;
  static true(): AndExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class OrExpr extends Expression {
  readonly kind: "or";
  readonly exprs: ReadonlyArray<AnyExpression>;
  constructor(exprs: ReadonlyArray<AnyExpression>);
  static of(exprs: ReadonlyArray<AnyExpression>): OrExpr;
  static false(): OrExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class ExistsExpr extends Expression {
  readonly kind: "exists";
  readonly notExists: boolean;
  readonly subquery: SelectAst;
  constructor(subquery: SelectAst, notExists?: boolean);
  static exists(subquery: SelectAst): ExistsExpr;
  static notExists(subquery: SelectAst): ExistsExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class NullCheckExpr extends Expression {
  readonly kind: "null-check";
  readonly expr: AnyExpression;
  readonly isNull: boolean;
  constructor(expr: AnyExpression, isNull: boolean);
  static isNull(expr: AnyExpression): NullCheckExpr;
  static isNotNull(expr: AnyExpression): NullCheckExpr;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class NotExpr extends Expression {
  readonly kind: "not";
  readonly expr: AnyExpression;
  constructor(expr: AnyExpression);
  toWhereExpr(): AnyExpression;
  accept<R>(visitor: ExprVisitor<R>): R;
  rewrite(rewriter: ExpressionRewriter): AnyExpression;
  fold<T>(folder: ExpressionFolder<T>): T;
}
declare class EqColJoinOn extends AstNode {
  readonly kind: "eq-col-join-on";
  readonly left: ColumnRef;
  readonly right: ColumnRef;
  constructor(left: ColumnRef, right: ColumnRef);
  static of(left: ColumnRef, right: ColumnRef): EqColJoinOn;
  rewrite(rewriter: AstRewriter): EqColJoinOn | AnyExpression;
}
declare class JoinAst extends AstNode {
  readonly kind: "join";
  readonly joinType: 'inner' | 'left' | 'right' | 'full';
  readonly source: AnyFromSource;
  readonly lateral: boolean;
  readonly on: JoinOnExpr;
  constructor(joinType: 'inner' | 'left' | 'right' | 'full', source: AnyFromSource, on: JoinOnExpr, lateral?: boolean);
  static inner(source: AnyFromSource, on: JoinOnExpr, lateral?: boolean): JoinAst;
  static left(source: AnyFromSource, on: JoinOnExpr, lateral?: boolean): JoinAst;
  static right(source: AnyFromSource, on: JoinOnExpr, lateral?: boolean): JoinAst;
  static full(source: AnyFromSource, on: JoinOnExpr, lateral?: boolean): JoinAst;
  rewrite(rewriter: AstRewriter): JoinAst;
}
declare class ProjectionItem extends AstNode {
  readonly kind: "projection-item";
  readonly alias: string;
  readonly expr: ProjectionExpr;
  readonly codecId: string | undefined;
  constructor(alias: string, expr: ProjectionExpr, codecId?: string);
  static of(alias: string, expr: ProjectionExpr, codecId?: string): ProjectionItem;
  withCodecId(codecId: string | undefined): ProjectionItem;
}
interface SelectAstOptions {
  readonly from: AnyFromSource;
  readonly joins: ReadonlyArray<JoinAst> | undefined;
  readonly projection: ReadonlyArray<ProjectionItem>;
  readonly where: AnyExpression | undefined;
  readonly orderBy: ReadonlyArray<OrderByItem> | undefined;
  readonly distinct: true | undefined;
  readonly distinctOn: ReadonlyArray<AnyExpression> | undefined;
  readonly groupBy: ReadonlyArray<AnyExpression> | undefined;
  readonly having: AnyExpression | undefined;
  readonly limit: number | undefined;
  readonly offset: number | undefined;
  readonly selectAllIntent: {
    readonly table?: string;
  } | undefined;
}
declare class SelectAst extends QueryAst {
  readonly kind: "select";
  readonly from: AnyFromSource;
  readonly joins: ReadonlyArray<JoinAst> | undefined;
  readonly projection: ReadonlyArray<ProjectionItem>;
  readonly where: AnyExpression | undefined;
  readonly orderBy: ReadonlyArray<OrderByItem> | undefined;
  readonly distinct: true | undefined;
  readonly distinctOn: ReadonlyArray<AnyExpression> | undefined;
  readonly groupBy: ReadonlyArray<AnyExpression> | undefined;
  readonly having: AnyExpression | undefined;
  readonly limit: number | undefined;
  readonly offset: number | undefined;
  readonly selectAllIntent: {
    readonly table?: string;
  } | undefined;
  constructor(options: SelectAstOptions);
  static from(from: AnyFromSource): SelectAst;
  withFrom(from: AnyFromSource): SelectAst;
  withJoins(joins: ReadonlyArray<JoinAst>): SelectAst;
  withProjection(projection: ReadonlyArray<ProjectionItem>): SelectAst;
  addProjection(alias: string, expr: ProjectionExpr): SelectAst;
  withWhere(where: AnyExpression | undefined): SelectAst;
  withOrderBy(orderBy: ReadonlyArray<OrderByItem>): SelectAst;
  withDistinct(enabled?: boolean): SelectAst;
  withDistinctOn(distinctOn: ReadonlyArray<AnyExpression>): SelectAst;
  withGroupBy(groupBy: ReadonlyArray<AnyExpression>): SelectAst;
  withHaving(having: AnyExpression | undefined): SelectAst;
  withLimit(limit: number | undefined): SelectAst;
  withOffset(offset: number | undefined): SelectAst;
  withSelectAllIntent(selectAllIntent: {
    readonly table?: string;
  } | undefined): SelectAst;
  rewrite(rewriter: AstRewriter): SelectAst;
  collectColumnRefs(): ColumnRef[];
  collectParamRefs(): ParamRef[];
  toQueryAst(): AnyQueryAst;
}
declare abstract class InsertOnConflictAction extends AstNode {
  abstract toInsertOnConflictAction(): AnyInsertOnConflictAction;
}
declare class DoNothingConflictAction extends InsertOnConflictAction {
  readonly kind: "do-nothing";
  constructor();
  toInsertOnConflictAction(): AnyInsertOnConflictAction;
}
declare class DoUpdateSetConflictAction extends InsertOnConflictAction {
  readonly kind: "do-update-set";
  readonly set: Readonly<Record<string, ColumnRef | ParamRef>>;
  constructor(set: Readonly<Record<string, ColumnRef | ParamRef>>);
  toInsertOnConflictAction(): AnyInsertOnConflictAction;
}
declare class InsertOnConflict extends AstNode {
  readonly kind: "insert-on-conflict";
  readonly columns: ReadonlyArray<ColumnRef>;
  readonly action: AnyInsertOnConflictAction;
  constructor(columns: ReadonlyArray<ColumnRef>, action: AnyInsertOnConflictAction);
  static on(columns: ReadonlyArray<ColumnRef>): InsertOnConflict;
  doNothing(): InsertOnConflict;
  doUpdateSet(set: Readonly<Record<string, ColumnRef | ParamRef>>): InsertOnConflict;
}
declare class InsertAst extends QueryAst {
  readonly kind: "insert";
  readonly table: TableSource;
  readonly rows: ReadonlyArray<Readonly<Record<string, InsertValue>>>;
  readonly onConflict: InsertOnConflict | undefined;
  readonly returning: ReadonlyArray<ProjectionItem> | undefined;
  constructor(table: TableSource, rows?: ReadonlyArray<Record<string, InsertValue>>, onConflict?: InsertOnConflict, returning?: ReadonlyArray<ProjectionItem>);
  static into(table: TableSource): InsertAst;
  withValues(values: Record<string, InsertValue>): InsertAst;
  withRows(rows: ReadonlyArray<Record<string, InsertValue>>): InsertAst;
  withReturning(returning: ReadonlyArray<ProjectionItem> | undefined): InsertAst;
  withOnConflict(onConflict: InsertOnConflict | undefined): InsertAst;
  rewrite(rewriter: AstRewriter): InsertAst;
  collectParamRefs(): ParamRef[];
  toQueryAst(): AnyQueryAst;
}
declare class UpdateAst extends QueryAst {
  readonly kind: "update";
  readonly table: TableSource;
  readonly set: Readonly<Record<string, ColumnRef | ParamRef>>;
  readonly where: AnyExpression | undefined;
  readonly returning: ReadonlyArray<ProjectionItem> | undefined;
  constructor(table: TableSource, set?: Readonly<Record<string, ColumnRef | ParamRef>>, where?: AnyExpression, returning?: ReadonlyArray<ProjectionItem>);
  static table(table: TableSource): UpdateAst;
  withSet(set: Readonly<Record<string, ColumnRef | ParamRef>>): UpdateAst;
  withWhere(where: AnyExpression | undefined): UpdateAst;
  withReturning(returning: ReadonlyArray<ProjectionItem> | undefined): UpdateAst;
  rewrite(rewriter: AstRewriter): UpdateAst;
  collectParamRefs(): ParamRef[];
  toQueryAst(): AnyQueryAst;
}
declare class DeleteAst extends QueryAst {
  readonly kind: "delete";
  readonly table: TableSource;
  readonly where: AnyExpression | undefined;
  readonly returning: ReadonlyArray<ProjectionItem> | undefined;
  constructor(table: TableSource, where?: AnyExpression, returning?: ReadonlyArray<ProjectionItem>);
  static from(table: TableSource): DeleteAst;
  withWhere(where: AnyExpression | undefined): DeleteAst;
  withReturning(returning: ReadonlyArray<ProjectionItem> | undefined): DeleteAst;
  rewrite(rewriter: AstRewriter): DeleteAst;
  collectParamRefs(): ParamRef[];
  toQueryAst(): AnyQueryAst;
}
type AnyQueryAst = SelectAst | InsertAst | UpdateAst | DeleteAst;
type AnyFromSource = TableSource | DerivedTableSource;
type AnyExpression = ColumnRef | IdentifierRef | ParamRef | LiteralExpr | SubqueryExpr | OperationExpr | AggregateExpr | JsonObjectExpr | JsonArrayAggExpr | ListExpression | BinaryExpr | AndExpr | OrExpr | ExistsExpr | NullCheckExpr | NotExpr;
type AnyInsertOnConflictAction = DoNothingConflictAction | DoUpdateSetConflictAction;
type AnyInsertValue = ColumnRef | ParamRef | DefaultValueExpr;
type AnyOperationArg = AnyExpression | ParamRef | LiteralExpr;
declare const queryAstKinds: ReadonlySet<string>;
declare const whereExprKinds: ReadonlySet<string>;
declare function isQueryAst(value: unknown): value is AnyQueryAst;
declare function isWhereExpr(value: unknown): value is AnyExpression;
interface ToWhereExpr {
  toWhereExpr(): AnyExpression;
}
interface LoweredStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly annotations?: Record<string, unknown>;
}
//#endregion
export { ToWhereExpr as $, InsertOnConflict as A, NotExpr as B, ExistsExpr as C, ExpressionSource as D, ExpressionRewriter as E, JsonObjectEntry as F, ParamRef as G, OperationExpr as H, JsonObjectExpr as I, SelectAst as J, ProjectionExpr as K, ListExpression as L, JoinAst as M, JoinOnExpr as N, IdentifierRef as O, JsonArrayAggExpr as P, TableSource as Q, LiteralExpr as R, EqColJoinOn as S, ExpressionFolder as T, OrExpr as U, NullCheckExpr as V, OrderByItem as W, SubqueryExpr as X, SelectAstOptions as Y, TableRef as Z, DeleteAst as _, AndExpr as a, whereExprKinds as at, DoNothingConflictAction as b, AnyInsertOnConflictAction as c, AnyQueryAst as d, UpdateAst as et, AstRewriter as f, DefaultValueExpr as g, ColumnRef as h, AggregateOpFn as i, queryAstKinds as it, InsertValue as j, InsertAst as k, AnyInsertValue as l, BinaryOp as m, AggregateExpr as n, isQueryAst as nt, AnyExpression as o, BinaryExpr as p, ProjectionItem as q, AggregateFn as r, isWhereExpr as rt, AnyFromSource as s, AggregateCountFn as t, WhereArg as tt, AnyOperationArg as u, DerivedTableSource as v, ExprVisitor as w, DoUpdateSetConflictAction as x, Direction as y, LoweredStatement as z };
//# sourceMappingURL=types-B4dL4lc3.d.mts.map
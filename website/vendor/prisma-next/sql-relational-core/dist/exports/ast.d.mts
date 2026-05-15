import { _ as codec, a as CodecInput, c as CodecRegistry, d as ContractCodecRegistry, f as ExtractCodecTypes, g as SqlColumnRef, h as SqlCodecInstanceContext, i as CodecId, l as CodecTrait, m as SqlCodecCallContext, n as CodecCallContext, o as CodecMeta, p as ExtractDataTypes, r as CodecDefBuilder, s as CodecParamsDescriptor, t as Codec, u as CodecTraits, v as createCodecRegistry, y as defineCodecs } from "../codec-types-DJEaWT36.mjs";
import { $ as ToWhereExpr, A as InsertOnConflict, B as NotExpr, C as ExistsExpr, D as ExpressionSource, E as ExpressionRewriter, F as JsonObjectEntry, G as ParamRef, H as OperationExpr, I as JsonObjectExpr, J as SelectAst, K as ProjectionExpr, L as ListExpression, M as JoinAst, N as JoinOnExpr, O as IdentifierRef, P as JsonArrayAggExpr, Q as TableSource, R as LiteralExpr, S as EqColJoinOn, T as ExpressionFolder, U as OrExpr, V as NullCheckExpr, W as OrderByItem, X as SubqueryExpr, Y as SelectAstOptions, Z as TableRef, _ as DeleteAst, a as AndExpr, at as whereExprKinds, b as DoNothingConflictAction, c as AnyInsertOnConflictAction, d as AnyQueryAst, et as UpdateAst, f as AstRewriter, g as DefaultValueExpr, h as ColumnRef, i as AggregateOpFn, it as queryAstKinds, j as InsertValue, k as InsertAst, l as AnyInsertValue, m as BinaryOp, n as AggregateExpr, nt as isQueryAst, o as AnyExpression, p as BinaryExpr, q as ProjectionItem, r as AggregateFn, rt as isWhereExpr, s as AnyFromSource, t as AggregateCountFn, tt as WhereArg, u as AnyOperationArg, v as DerivedTableSource, w as ExprVisitor, x as DoUpdateSetConflictAction, y as Direction, z as LoweredStatement } from "../types-B4dL4lc3.mjs";
import { ContractMarkerRecord } from "@prisma-next/contract/types";

//#region src/ast/adapter-types.d.ts
type AdapterTarget = string;
interface MarkerStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}
interface AdapterProfile<TTarget extends AdapterTarget = AdapterTarget> {
  readonly id: string;
  readonly target: TTarget;
  readonly capabilities: Record<string, unknown>;
  /**
   * Returns the adapter's default codec registry.
   * The registry contains codecs provided by the adapter for converting
   * between wire types and JavaScript types.
   */
  codecs(): CodecRegistry;
  /**
   * Returns the SQL statement to read the contract marker from the database.
   * Each adapter provides target-specific SQL (e.g. schema-qualified table names,
   * parameter placeholder style).
   */
  readMarkerStatement(): MarkerStatement;
  /**
   * Parses a row returned by the adapter's `readMarkerStatement()` into a
   * `ContractMarkerRecord`. Each adapter is responsible for any
   * target-specific decoding before delegating to the shared row schema.
   * Throws on shape violation.
   */
  parseMarkerRow(row: unknown): ContractMarkerRecord;
}
interface LowererContext<TContract = unknown> {
  readonly contract: TContract;
  readonly params?: readonly unknown[];
}
type Lowerer<Ast = unknown, TContract = unknown, TBody = LoweredStatement> = (ast: Ast, context: LowererContext<TContract>) => TBody;
/**
 * Lowers a query AST into a target-specific executable body (typically
 * `LoweredStatement` for SQL adapters). The `lower` method returns the body
 * directly; per-statement metadata, when needed, lives on the body itself
 * (e.g. `LoweredStatement.annotations`). Adapter-level metadata such as the
 * profile id is reachable via `profile.id` for callers that genuinely need it.
 */
interface Adapter<Ast = unknown, TContract = unknown, TBody = LoweredStatement> {
  readonly profile: AdapterProfile;
  lower(ast: Ast, context: LowererContext<TContract>): TBody;
}
//#endregion
//#region src/ast/driver-types.d.ts
interface SqlExecuteRequest {
  readonly sql: string;
  readonly params?: readonly unknown[];
}
interface SqlQueryResult<Row = Record<string, unknown>> {
  readonly rows: ReadonlyArray<Row>;
  readonly rowCount?: number | null;
  readonly [key: string]: unknown;
}
interface SqlExplainResult<Row = Record<string, unknown>> {
  readonly rows: ReadonlyArray<Row>;
}
type SqlDriverState = 'unbound' | 'connected' | 'closed';
interface SqlDriver<TBinding = void> extends SqlQueryable {
  readonly state?: SqlDriverState;
  connect(binding: TBinding): Promise<void>;
  acquireConnection(): Promise<SqlConnection>;
  close(): Promise<void>;
}
interface SqlConnection extends SqlQueryable {
  beginTransaction(): Promise<SqlTransaction>;
  /**
   * Returns the connection to the pool for reuse. Must only be called when the
   * connection is known to be in a clean, reusable state. If a transaction
   * operation (commit/rollback) failed or the connection is otherwise suspect,
   * call `destroy(reason)` instead.
   */
  release(): Promise<void>;
  /**
   * Evicts the connection so it is never reused. Call this when the
   * connection may be in an indeterminate state (e.g. a failed rollback
   * leaving an open transaction, or a broken socket).
   *
   * Implementations MUST:
   * - Leave the connection retryable if teardown fails, so a follow-up
   *   call can actually dispose of the handle. Calling destroy() or
   *   release() more than once after a successful teardown is caller
   *   error and behaves as the underlying primitive dictates (typically
   *   a thrown error).
   * - Treat `reason` as advisory context only. It may be surfaced to
   *   driver-level observability hooks (e.g. pg-pool's `'release'` event)
   *   but MUST NOT influence eviction behavior and MUST NOT be rethrown.
   * - Dispose of any driver-wide state that depends on this single
   *   connection (e.g. a direct-client driver should close itself, since a
   *   destroyed connection means its one underlying socket is unusable).
   * - Propagate errors raised while tearing down the underlying connection.
   *   The caller has context the driver does not (whether it is already
   *   about to throw a more informative error, whether it is shutting
   *   down, etc.) and is better positioned to decide whether to swallow
   *   or surface the failure.
   */
  destroy(reason?: unknown): Promise<void>;
}
interface SqlTransaction extends SqlQueryable {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
interface SqlQueryable {
  execute<Row = Record<string, unknown>>(request: SqlExecuteRequest): AsyncIterable<Row>;
  explain?(request: SqlExecuteRequest): Promise<SqlExplainResult>;
  query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<SqlQueryResult<Row>>;
}
//#endregion
//#region src/ast/sql-codecs.d.ts
declare const SQL_CHAR_CODEC_ID: "sql/char@1";
declare const SQL_VARCHAR_CODEC_ID: "sql/varchar@1";
declare const SQL_INT_CODEC_ID: "sql/int@1";
declare const SQL_FLOAT_CODEC_ID: "sql/float@1";
declare const SQL_TEXT_CODEC_ID: "sql/text@1";
declare const SQL_TIMESTAMP_CODEC_ID: "sql/timestamp@1";
declare const codecs: CodecDefBuilder<{
  char: Codec<"sql/char@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
  varchar: Codec<"sql/varchar@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
  int: Codec<"sql/int@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
  float: Codec<"sql/float@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
  text: Codec<"sql/text@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
} & Record<"timestamp", Codec<"sql/timestamp@1", readonly ["equality", "order"], Date, Date, Record<string, unknown>, unknown>>>;
declare const sqlCodecDefinitions: {
  readonly char: {
    readonly typeId: "sql/char@1";
    readonly scalar: "char";
    readonly codec: Codec<"sql/char@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
    readonly input: string;
    readonly output: string;
    readonly jsType: string;
  };
  readonly varchar: {
    readonly typeId: "sql/varchar@1";
    readonly scalar: "varchar";
    readonly codec: Codec<"sql/varchar@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
    readonly input: string;
    readonly output: string;
    readonly jsType: string;
  };
  readonly int: {
    readonly typeId: "sql/int@1";
    readonly scalar: "int";
    readonly codec: Codec<"sql/int@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
    readonly input: number;
    readonly output: number;
    readonly jsType: number;
  };
  readonly float: {
    readonly typeId: "sql/float@1";
    readonly scalar: "float";
    readonly codec: Codec<"sql/float@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
    readonly input: number;
    readonly output: number;
    readonly jsType: number;
  };
  readonly text: {
    readonly typeId: "sql/text@1";
    readonly scalar: "text";
    readonly codec: Codec<"sql/text@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
    readonly input: string;
    readonly output: string;
    readonly jsType: string;
  };
  readonly timestamp: {
    readonly typeId: "sql/timestamp@1";
    readonly scalar: "timestamp";
    readonly codec: Codec<"sql/timestamp@1", readonly ["equality", "order"], Date, Date, Record<string, unknown>, unknown>;
    readonly input: Date;
    readonly output: Date;
    readonly jsType: Date;
  };
};
declare const sqlDataTypes: {
  readonly char: "sql/char@1";
  readonly varchar: "sql/varchar@1";
  readonly int: "sql/int@1";
  readonly float: "sql/float@1";
  readonly text: "sql/text@1";
  readonly timestamp: "sql/timestamp@1";
};
type SqlCodecTypes = typeof codecs.CodecTypes;
//#endregion
//#region src/ast/util.d.ts
declare function compact<T extends Record<string, unknown>>(o: T): T;
/**
 * Walks an AST's parameter references in first-encounter order and dedupes
 * by ParamRef identity. The single canonical helper used by every consumer
 * that aligns `plan.params` with metadata-by-index — the SQL builder lane,
 * the SQL ORM client, the SQL runtime encoder, and the Postgres renderer's
 * `$N` index map — so the four walks cannot drift in dedupe semantics.
 *
 * SQLite's `?`-placeholder renderer intentionally does NOT use this helper
 * because it needs one params entry per occurrence in the SQL.
 */
declare function collectOrderedParamRefs(ast: AnyQueryAst): ReadonlyArray<ParamRef>;
//#endregion
export { Adapter, AdapterProfile, AdapterTarget, AggregateCountFn, AggregateExpr, AggregateFn, AggregateOpFn, AndExpr, AnyExpression, AnyFromSource, AnyInsertOnConflictAction, AnyInsertValue, AnyOperationArg, AnyQueryAst, AstRewriter, BinaryExpr, BinaryOp, Codec, CodecCallContext, CodecDefBuilder, CodecId, CodecInput, CodecMeta, CodecParamsDescriptor, CodecRegistry, CodecTrait, CodecTraits, ColumnRef, ContractCodecRegistry, DefaultValueExpr, DeleteAst, DerivedTableSource, Direction, DoNothingConflictAction, DoUpdateSetConflictAction, EqColJoinOn, ExistsExpr, ExprVisitor, ExpressionFolder, ExpressionRewriter, ExpressionSource, ExtractCodecTypes, ExtractDataTypes, IdentifierRef, InsertAst, InsertOnConflict, InsertValue, JoinAst, JoinOnExpr, JsonArrayAggExpr, JsonObjectEntry, JsonObjectExpr, ListExpression, LiteralExpr, LoweredStatement, Lowerer, LowererContext, MarkerStatement, NotExpr, NullCheckExpr, OperationExpr, OrExpr, OrderByItem, ParamRef, ProjectionExpr, ProjectionItem, SQL_CHAR_CODEC_ID, SQL_FLOAT_CODEC_ID, SQL_INT_CODEC_ID, SQL_TEXT_CODEC_ID, SQL_TIMESTAMP_CODEC_ID, SQL_VARCHAR_CODEC_ID, SelectAst, SelectAstOptions, SqlCodecCallContext, SqlCodecInstanceContext, SqlCodecTypes, SqlColumnRef, SqlConnection, SqlDriver, SqlDriverState, SqlExecuteRequest, SqlExplainResult, SqlQueryResult, SqlQueryable, SqlTransaction, SubqueryExpr, TableRef, TableSource, ToWhereExpr, UpdateAst, WhereArg, codec, collectOrderedParamRefs, compact, createCodecRegistry, defineCodecs, isQueryAst, isWhereExpr, queryAstKinds, sqlCodecDefinitions, sqlDataTypes, whereExprKinds };
//# sourceMappingURL=ast.d.mts.map
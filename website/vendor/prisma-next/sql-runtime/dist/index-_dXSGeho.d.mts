import { AfterExecuteResult, AfterExecuteResult as AfterExecuteResult$1, ExecutionPlan, RuntimeLog, RuntimeLog as Log, RuntimeMiddleware, RuntimeMiddlewareContext } from "@prisma-next/framework-components/runtime";
import { Adapter, AnyQueryAst, CodecRegistry, LoweredStatement, MarkerStatement, MarkerStatement as MarkerStatement$1, SqlDriver } from "@prisma-next/sql-relational-core/ast";
import { CodecDescriptor } from "@prisma-next/framework-components/codec";
import { ExecutionStack, ExecutionStackInstance, RuntimeAdapterDescriptor, RuntimeAdapterInstance, RuntimeDriverDescriptor, RuntimeDriverInstance, RuntimeExtensionDescriptor, RuntimeExtensionInstance, RuntimeTargetDescriptor, RuntimeTargetInstance } from "@prisma-next/framework-components/execution";
import { SqlOperationDescriptor } from "@prisma-next/sql-operations";
import { Contract, ContractMarkerRecord, PlanMeta } from "@prisma-next/contract/types";
import { SqlStorage } from "@prisma-next/sql-contract/types";
import { CodecDescriptorRegistry, ExecutionContext, TypeHelperRegistry } from "@prisma-next/sql-relational-core/query-lane-context";
import { SqlExecutionPlan, SqlQueryPlan } from "@prisma-next/sql-relational-core/plan";
import { RuntimeScope } from "@prisma-next/sql-relational-core/types";

//#region src/codecs/validation.d.ts
declare function extractCodecIds(contract: Contract<SqlStorage>): Set<string>;
declare function validateContractCodecMappings(registry: CodecRegistry | CodecDescriptorRegistry, contract: Contract<SqlStorage>): void;
declare function validateCodecRegistryCompleteness(registry: CodecRegistry | CodecDescriptorRegistry, contract: Contract<SqlStorage>): void;
//#endregion
//#region src/lower-sql-plan.d.ts
/**
 * Lowers a SQL query plan to an executable Plan by calling the adapter's lower method.
 *
 * @param adapter - Adapter to lower AST to SQL
 * @param contract - Contract for lowering context
 * @param queryPlan - SQL query plan from a lane (contains AST, params, meta, but no SQL)
 * @returns Fully executable Plan with SQL string
 */
declare function lowerSqlPlan<Row>(adapter: Adapter<AnyQueryAst, Contract<SqlStorage>, LoweredStatement>, contract: Contract<SqlStorage>, queryPlan: SqlQueryPlan<Row>): SqlExecutionPlan<Row>;
//#endregion
//#region src/marker.d.ts
declare function parseContractMarkerRow(row: unknown): ContractMarkerRecord;
//#endregion
//#region src/middleware/sql-middleware.d.ts
interface SqlMiddlewareContext extends RuntimeMiddlewareContext {
  readonly contract: Contract<SqlStorage>;
}
/**
 * Pre-lowering query view passed to `beforeCompile`. Carries the typed SQL
 * AST and plan metadata; `sql`/`params` are produced later by the adapter.
 */
interface DraftPlan {
  readonly ast: AnyQueryAst;
  readonly meta: PlanMeta;
}
interface SqlMiddleware extends RuntimeMiddleware<SqlExecutionPlan> {
  readonly familyId?: 'sql';
  /**
   * Rewrite the query AST before it is lowered to SQL. Middlewares run in
   * registration order; each sees the predecessor's output, so rewrites
   * compose (e.g. soft-delete + tenant isolation).
   *
   * Return `undefined` (or a draft whose `ast` reference equals the input's)
   * to pass through. Return a draft with a new `ast` reference to replace it;
   * the runtime emits a `middleware.rewrite` debug log event and continues
   * with the new draft. `adapter.lower()` runs once after the chain.
   *
   * Use `AstRewriter` / `SelectAst.withWhere` / `AndExpr.of` etc. to build
   * the rewritten AST. Predicates and literals go through parameterized
   * constructors by default — no SQL-injection surface is added. **Warning:**
   * constructing `LiteralExpr.of(userInput)` from untrusted input bypasses
   * that guarantee; use `ParamRef.of(userInput, ...)` instead.
   *
   * See `docs/architecture docs/subsystems/4. Runtime & Middleware Framework.md`.
   */
  beforeCompile?(draft: DraftPlan, ctx: SqlMiddlewareContext): Promise<DraftPlan | undefined>;
  beforeExecute?(plan: SqlExecutionPlan, ctx: SqlMiddlewareContext): Promise<void>;
  onRow?(row: Record<string, unknown>, plan: SqlExecutionPlan, ctx: SqlMiddlewareContext): Promise<void>;
  afterExecute?(plan: SqlExecutionPlan, result: AfterExecuteResult, ctx: SqlMiddlewareContext): Promise<void>;
}
//#endregion
//#region src/middleware/budgets.d.ts
interface BudgetsOptions {
  readonly maxRows?: number;
  readonly defaultTableRows?: number;
  readonly tableRows?: Record<string, number>;
  readonly maxLatencyMs?: number;
  readonly severities?: {
    readonly rowCount?: 'warn' | 'error';
    readonly latency?: 'warn' | 'error';
  };
}
declare function budgets(options?: BudgetsOptions): SqlMiddleware;
//#endregion
//#region src/middleware/lints.d.ts
interface LintsOptions {
  readonly severities?: {
    readonly selectStar?: 'warn' | 'error';
    readonly noLimit?: 'warn' | 'error';
    readonly deleteWithoutWhere?: 'warn' | 'error';
    readonly updateWithoutWhere?: 'warn' | 'error';
    readonly readOnlyMutation?: 'warn' | 'error';
    readonly unindexedPredicate?: 'warn' | 'error';
  };
  readonly fallbackWhenAstMissing?: 'raw' | 'skip';
}
/**
 * AST-first lint middleware for SQL plans. When `plan.ast` is a SQL QueryAst, inspects
 * the AST structurally. When `plan.ast` is missing, falls back to raw heuristic
 * guardrails or skips linting depending on `fallbackWhenAstMissing`.
 *
 * Rules (AST-based):
 * - DELETE without WHERE: blocks execution (configurable severity, default error)
 * - UPDATE without WHERE: blocks execution (configurable severity, default error)
 * - Unbounded SELECT: warn/error (severity from noLimit)
 * - SELECT * intent: warn/error (severity from selectStar)
 *
 * Fallback: When ast is missing, `fallbackWhenAstMissing: 'raw'` uses heuristic
 * SQL parsing; `'skip'` skips all lints. Default is `'raw'`.
 */
declare function lints(options?: LintsOptions): SqlMiddleware;
//#endregion
//#region src/runtime-spi.d.ts
/**
 * Reader of the SQL contract marker. SQL runtimes verify the database's
 * `prisma_contract.marker` row against the runtime's contract by issuing
 * this statement before executing user queries (when `verify` is enabled).
 * Each adapter is responsible for any target-specific row decoding before
 * delegating to the shared row schema.
 */
interface MarkerReader {
  readMarkerStatement(): MarkerStatement;
  parseMarkerRow(row: unknown): ContractMarkerRecord;
}
/**
 * SQL family adapter SPI consumed by `SqlRuntime`. Encapsulates the
 * runtime contract, marker reader, and plan validation logic so the
 * runtime can be unit-tested without a concrete SQL adapter profile.
 *
 * Implemented by `SqlFamilyAdapter` for production and by mock classes
 * in tests.
 */
interface RuntimeFamilyAdapter<TContract = unknown> {
  readonly contract: TContract;
  readonly markerReader: MarkerReader;
  validatePlan(plan: ExecutionPlan, contract: TContract): void;
}
interface RuntimeVerifyOptions {
  readonly mode: 'onFirstUse' | 'startup' | 'always';
  readonly requireMarker: boolean;
}
type TelemetryOutcome = 'success' | 'runtime-error';
interface RuntimeTelemetryEvent {
  readonly lane: string;
  readonly target: string;
  readonly fingerprint: string;
  readonly outcome: TelemetryOutcome;
  readonly durationMs?: number;
}
//#endregion
//#region src/sql-context.d.ts
/**
 * Runtime parameterized codec descriptor.
 *
 * The unified `CodecDescriptor<P>` shape applied to parameterized codecs
 * — `paramsSchema: StandardSchemaV1<P>` for JSON-boundary validation,
 * `factory: (P) => (CodecInstanceContext) => Codec` for the curried higher-order codec.
 * The factory is called once per `storage.types` instance (or once per
 * inline-`typeParams` column); per-instance state lives in the closure.
 *
 * Codec-registry-unification spec § Decision.
 */
type RuntimeParameterizedCodecDescriptor<P = Record<string, unknown>> = CodecDescriptor<P>;
interface SqlStaticContributions {
  readonly codecs: () => CodecRegistry;
  readonly parameterizedCodecs: () => ReadonlyArray<RuntimeParameterizedCodecDescriptor<any>>;
  readonly queryOperations?: () => ReadonlyArray<SqlOperationDescriptor>;
  readonly mutationDefaultGenerators?: () => ReadonlyArray<RuntimeMutationDefaultGenerator>;
}
interface RuntimeMutationDefaultGenerator {
  readonly id: string;
  readonly generate: (params?: Record<string, unknown>) => unknown;
}
interface SqlRuntimeTargetDescriptor<TTargetId extends string = string, TTargetInstance extends RuntimeTargetInstance<'sql', TTargetId> = RuntimeTargetInstance<'sql', TTargetId>> extends RuntimeTargetDescriptor<'sql', TTargetId, TTargetInstance>, SqlStaticContributions {}
interface SqlRuntimeAdapterDescriptor<TTargetId extends string = string, TAdapterInstance extends RuntimeAdapterInstance<'sql', TTargetId> = SqlRuntimeAdapterInstance<TTargetId>> extends RuntimeAdapterDescriptor<'sql', TTargetId, TAdapterInstance>, SqlStaticContributions {}
interface SqlRuntimeExtensionDescriptor<TTargetId extends string = string> extends RuntimeExtensionDescriptor<'sql', TTargetId, SqlRuntimeExtensionInstance<TTargetId>>, SqlStaticContributions {
  create(): SqlRuntimeExtensionInstance<TTargetId>;
}
interface SqlExecutionStack<TTargetId extends string = string> {
  readonly target: SqlRuntimeTargetDescriptor<TTargetId>;
  readonly adapter: SqlRuntimeAdapterDescriptor<TTargetId>;
  readonly extensionPacks: readonly SqlRuntimeExtensionDescriptor<TTargetId>[];
}
type SqlExecutionStackWithDriver<TTargetId extends string = string> = Omit<ExecutionStack<'sql', TTargetId, SqlRuntimeAdapterInstance<TTargetId>, SqlRuntimeDriverInstance<TTargetId>, SqlRuntimeExtensionInstance<TTargetId>>, 'target' | 'adapter' | 'driver' | 'extensionPacks'> & {
  readonly target: SqlRuntimeTargetDescriptor<TTargetId>;
  readonly adapter: SqlRuntimeAdapterDescriptor<TTargetId, SqlRuntimeAdapterInstance<TTargetId>>;
  readonly driver: RuntimeDriverDescriptor<'sql', TTargetId, unknown, SqlRuntimeDriverInstance<TTargetId>> | undefined;
  readonly extensionPacks: readonly SqlRuntimeExtensionDescriptor<TTargetId>[];
};
interface SqlRuntimeExtensionInstance<TTargetId extends string> extends RuntimeExtensionInstance<'sql', TTargetId> {}
type SqlRuntimeAdapterInstance<TTargetId extends string = string> = RuntimeAdapterInstance<'sql', TTargetId> & Adapter<AnyQueryAst, Contract<SqlStorage>, LoweredStatement>;
/**
 * NOTE: Binding type is intentionally erased to unknown at this shared runtime layer.
 * Target clients (for example `postgres()`) validate and construct the concrete binding
 * before calling `driver.connect(binding)`, which keeps runtime behavior safe today.
 * A future follow-up can preserve TBinding through stack/context generics end-to-end.
 */
type SqlRuntimeDriverInstance<TTargetId extends string = string> = RuntimeDriverInstance<'sql', TTargetId> & SqlDriver<unknown>;
declare function createSqlExecutionStack<TTargetId extends string>(options: {
  readonly target: SqlRuntimeTargetDescriptor<TTargetId>;
  readonly adapter: SqlRuntimeAdapterDescriptor<TTargetId>;
  readonly driver?: RuntimeDriverDescriptor<'sql', TTargetId, unknown, SqlRuntimeDriverInstance<TTargetId>> | undefined;
  readonly extensionPacks?: readonly SqlRuntimeExtensionDescriptor<TTargetId>[] | undefined;
}): SqlExecutionStackWithDriver<TTargetId>;
declare function createExecutionContext<TContract extends Contract<SqlStorage> = Contract<SqlStorage>, TTargetId extends string = string>(options: {
  readonly contract: TContract;
  readonly stack: SqlExecutionStack<TTargetId>;
}): ExecutionContext<TContract>;
//#endregion
//#region src/sql-marker.d.ts
interface SqlStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}
interface WriteMarkerInput {
  readonly storageHash: string;
  readonly profileHash: string;
  readonly contractJson?: unknown;
  readonly canonicalVersion?: number;
  readonly appTag?: string;
  readonly meta?: Record<string, unknown>;
  /**
   * Applied-invariants set on the marker.
   *
   * - `undefined` → existing column left untouched. Sign and
   *   verify-database paths use this; they don't accumulate invariants.
   * - explicit value (including `[]`) → column overwritten with
   *   exactly that value.
   */
  readonly invariants?: readonly string[];
}
declare const ensureSchemaStatement: SqlStatement;
declare const ensureTableStatement: SqlStatement;
declare function readContractMarker(): MarkerStatement;
interface WriteContractMarkerStatements {
  readonly insert: SqlStatement;
  readonly update: SqlStatement;
}
declare function writeContractMarker(input: WriteMarkerInput): WriteContractMarkerStatements;
//#endregion
//#region src/sql-runtime.d.ts
type Log$1 = RuntimeLog;
interface CreateRuntimeOptions<TContract extends Contract<SqlStorage> = Contract<SqlStorage>, TTargetId extends string = string> {
  readonly stackInstance: ExecutionStackInstance<'sql', TTargetId, SqlRuntimeAdapterInstance<TTargetId>, RuntimeDriverInstance<'sql', TTargetId>, SqlRuntimeExtensionInstance<TTargetId>>;
  readonly context: ExecutionContext<TContract>;
  readonly driver: SqlDriver<unknown>;
  readonly verify: RuntimeVerifyOptions;
  readonly middleware?: readonly SqlMiddleware[];
  readonly mode?: 'strict' | 'permissive';
  readonly log?: Log$1;
}
interface Runtime extends RuntimeQueryable {
  connection(): Promise<RuntimeConnection>;
  telemetry(): RuntimeTelemetryEvent | null;
  close(): Promise<void>;
}
interface RuntimeConnection extends RuntimeQueryable {
  transaction(): Promise<RuntimeTransaction>;
  /**
   * Returns the connection to the pool for reuse. Only call this when the
   * connection is known to be in a clean state. If a transaction
   * commit/rollback failed or the connection is otherwise suspect, call
   * `destroy(reason)` instead.
   */
  release(): Promise<void>;
  /**
   * Evicts the connection so it is never reused. Call this when the
   * connection may be in an indeterminate state (e.g. a failed rollback
   * leaving an open transaction, or a broken socket).
   *
   * If teardown fails the error is propagated and the connection remains
   * retryable, so the caller can decide whether to swallow the failure or
   * retry cleanup. Calling destroy() or release() more than once after a
   * successful teardown is caller error.
   *
   * `reason` is advisory context only. It may be surfaced to driver-level
   * observability hooks (e.g. pg-pool's `'release'` event) but does not
   * influence eviction behavior and is not rethrown.
   */
  destroy(reason?: unknown): Promise<void>;
}
interface RuntimeTransaction extends RuntimeQueryable {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
interface RuntimeQueryable extends RuntimeScope {}
interface TransactionContext extends RuntimeQueryable {
  readonly invalidated: boolean;
}
declare function withTransaction<R>(runtime: Runtime, fn: (tx: TransactionContext) => PromiseLike<R>): Promise<R>;
declare function createRuntime<TContract extends Contract<SqlStorage>, TTargetId extends string>(options: CreateRuntimeOptions<TContract, TTargetId>): Runtime;
//#endregion
export { createExecutionContext as A, budgets as B, SqlRuntimeAdapterInstance as C, SqlRuntimeTargetDescriptor as D, SqlRuntimeExtensionInstance as E, RuntimeVerifyOptions as F, extractCodecIds as G, SqlMiddlewareContext as H, TelemetryOutcome as I, validateCodecRegistryCompleteness as K, LintsOptions as L, MarkerReader as M, RuntimeFamilyAdapter as N, SqlStaticContributions as O, RuntimeTelemetryEvent as P, lints as R, SqlRuntimeAdapterDescriptor as S, SqlRuntimeExtensionDescriptor as T, parseContractMarkerRow as U, SqlMiddleware as V, lowerSqlPlan as W, ExecutionContext as _, Runtime as a, SqlExecutionStack as b, RuntimeTransaction as c, withTransaction as d, SqlStatement as f, writeContractMarker as g, readContractMarker as h, CreateRuntimeOptions as i, createSqlExecutionStack as j, TypeHelperRegistry as k, TransactionContext as l, ensureTableStatement as m, Log as n, RuntimeConnection as o, ensureSchemaStatement as p, validateContractCodecMappings as q, MarkerStatement$1 as r, RuntimeQueryable as s, AfterExecuteResult$1 as t, createRuntime as u, RuntimeMutationDefaultGenerator as v, SqlRuntimeDriverInstance as w, SqlExecutionStackWithDriver as x, RuntimeParameterizedCodecDescriptor as y, BudgetsOptions as z };
//# sourceMappingURL=index-_dXSGeho.d.mts.map
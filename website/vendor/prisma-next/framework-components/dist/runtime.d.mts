import { n as CodecCallContext } from "./codec-types-CB0jWeHU.mjs";
import { PlanMeta } from "@prisma-next/contract/types";

//#region src/execution/async-iterable-result.d.ts
declare class AsyncIterableResult<Row> implements AsyncIterable<Row>, PromiseLike<Row[]> {
  private readonly generator;
  private consumed;
  private consumedBy;
  private bufferedArrayPromise;
  constructor(generator: AsyncGenerator<Row, void, unknown>);
  [Symbol.asyncIterator](): AsyncIterator<Row>;
  toArray(): Promise<Row[]>;
  first(): Promise<Row | null>;
  firstOrThrow(): Promise<Row>;
  then<TResult1 = Row[], TResult2 = never>(onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null): PromiseLike<TResult1 | TResult2>;
}
//#endregion
//#region src/execution/query-plan.d.ts
/**
 * Family-agnostic plan marker.
 *
 * Carries only `meta` (the family-agnostic plan metadata) and the optional
 * phantom `_row` parameter that lets type-level utilities recover the row
 * type from a plan value. SQL and Mongo extend this marker with their own
 * concrete shapes (`SqlQueryPlan`, `MongoQueryPlan`).
 *
 * `QueryPlan` is the *pre-lowering* marker — i.e. the surface a builder
 * produces before family-specific lowering turns it into an executable
 * plan (`ExecutionPlan`).
 */
interface QueryPlan<Row = unknown> {
  readonly meta: PlanMeta;
  /**
   * Phantom property to carry the Row generic for type-level utilities.
   * Not set at runtime; used only for `ResultType` extraction.
   */
  readonly _row?: Row;
}
/**
 * Family-agnostic execution-plan marker.
 *
 * Extends `QueryPlan` with no additional structural fields — the marker
 * exists to nominally distinguish executable plans from pre-lowering plans
 * in the type system. Family-specific execution plans (`SqlExecutionPlan`,
 * `MongoExecutionPlan`) extend this marker with their concrete shapes
 * (e.g. `sql + params` for SQL, `wireCommand` for Mongo).
 */
interface ExecutionPlan<Row = unknown> extends QueryPlan<Row> {}
/**
 * Extracts the `Row` type from a plan via the phantom `_row` property.
 *
 * Works with any plan that extends `QueryPlan<Row>` — including
 * `ExecutionPlan<Row>`, `SqlQueryPlan<Row>`, `SqlExecutionPlan<Row>`,
 * `MongoQueryPlan<Row>`, and `MongoExecutionPlan<Row>`.
 *
 * The `_row` property must be present in the plan's static type for the
 * conditional to bind `R`; objects whose type lacks `_row` resolve to
 * `never`. Without the `keyof` guard, `extends { _row?: infer R }` would
 * silently match any object and infer `unknown`.
 *
 * Example: `type Row = ResultType<typeof plan>`.
 */
type ResultType<P> = '_row' extends keyof P ? P extends {
  readonly _row?: infer R;
} ? R : never : never;
//#endregion
//#region src/execution/runtime-error.d.ts
interface RuntimeErrorEnvelope extends Error {
  readonly code: string;
  readonly category: 'PLAN' | 'CONTRACT' | 'LINT' | 'BUDGET' | 'RUNTIME';
  readonly severity: 'error';
  readonly details?: Record<string, unknown>;
}
/**
 * Stable code emitted by the runtime when an in-flight `execute()`
 * is cancelled via the per-query `AbortSignal`. The envelope's
 * `details.phase` distinguishes where the abort was observed:
 *
 * - `'encode'` — abort fired during `encodeParams` (SQL) or
 *   `resolveValue` (Mongo).
 * - `'decode'` — abort fired during `decodeRow` / `decodeField`.
 * - `'stream'` — abort fired between rows or before any codec call
 *   (already-aborted at entry).
 */
declare const RUNTIME_ABORTED: "RUNTIME.ABORTED";
/** Discriminator placed in `details.phase` of a `RUNTIME.ABORTED` envelope. */
type RuntimeAbortedPhase = 'encode' | 'decode' | 'stream';
/**
 * Type guard for the runtime-error envelope produced by `runtimeError`.
 *
 * Prefer this over duck-typing on `error.code` directly so consumers stay
 * insulated from the envelope's internal shape.
 */
declare function isRuntimeError(error: unknown): error is RuntimeErrorEnvelope;
declare function runtimeError(code: string, message: string, details?: Record<string, unknown>): RuntimeErrorEnvelope;
/**
 * Construct a `RUNTIME.ABORTED` envelope. Phase distinguishes where the
 * abort was observed (encode / decode / stream); cause carries `signal.reason`
 * verbatim from the platform — native abort produces a `DOMException`,
 * explicit `controller.abort(reason)` produces whatever the caller passed.
 * No synthesis happens here.
 */
declare function runtimeAborted(phase: RuntimeAbortedPhase, cause?: unknown): RuntimeErrorEnvelope;
//#endregion
//#region src/execution/race-against-abort.d.ts
/**
 * Throw a phase-tagged `RUNTIME.ABORTED` envelope if the supplied
 * codec-call context is already aborted at the precheck site. Centralises
 * the `if (ctx.signal?.aborted) throw runtimeAborted(...)` pattern that
 * every codec dispatch site repeats.
 */
declare function checkAborted(ctx: CodecCallContext, phase: RuntimeAbortedPhase): void;
/**
 * Race a per-cell `Promise.all` (or any other in-flight work promise) against
 * the supplied abort signal so the runtime returns `RUNTIME.ABORTED` promptly
 * even when codec bodies ignore the signal. In-flight bodies that ignore the
 * signal are abandoned and run to completion in the background — the
 * cooperative-cancellation contract documented in ADR 204.
 *
 * Call sites still SHOULD pre-check `signal.aborted` and short-circuit with
 * a phase-tagged `RUNTIME.ABORTED` envelope before invoking this helper —
 * that path is the canonical "aborted at entry" surface and avoids
 * scheduling the work promise. As a defensive belt-and-braces, this helper
 * also handles the already-aborted case internally: `AbortSignal` does not
 * replay past abort events to listeners registered after the abort, so we
 * inspect `signal.aborted` synchronously and reject with the sentinel
 * before installing the listener. The rejection is still attributed to the
 * abort path via the sentinel-identity check.
 *
 * Distinguishing the rejection source is load-bearing for AC-ERR4
 * (`RUNTIME.ENCODE_FAILED` / `RUNTIME.DECODE_FAILED` pass through unchanged).
 * The semantically equivalent `abortable(signal)` helper in
 * `@prisma-next/utils` rejects with `signal.reason ?? new DOMException(...)`,
 * which is not stably distinguishable from a codec-thrown error by identity
 * alone (a fresh fallback DOMException is allocated per call). We instead
 * track abort attribution with a unique sentinel: only the `onAbort` listener
 * installed here ever rejects with the sentinel, so an `error === sentinel`
 * identity check after the race is unambiguous.
 *
 * Lives in `framework-components` (rather than the SQL family, where it
 * originated in m2) so every family runtime that needs cooperative
 * cancellation around a codec-dispatch `Promise.all` (SQL encode + decode
 * today, Mongo encode in m3) shares the same attribution logic.
 */
declare function raceAgainstAbort<T>(work: Promise<T>, signal: AbortSignal | undefined, phase: RuntimeAbortedPhase): Promise<T>;
//#endregion
//#region src/execution/runtime-middleware.d.ts
interface RuntimeLog {
  info(event: unknown): void;
  warn(event: unknown): void;
  error(event: unknown): void;
  debug?(event: unknown): void;
}
interface RuntimeMiddlewareContext {
  readonly contract: unknown;
  readonly mode: 'strict' | 'permissive';
  readonly now: () => number;
  readonly log: RuntimeLog;
}
interface AfterExecuteResult {
  readonly rowCount: number;
  readonly latencyMs: number;
  readonly completed: boolean;
}
/**
 * Family-agnostic middleware SPI parameterized over the plan marker.
 *
 * `TPlan` defaults to the framework `QueryPlan` marker so a generic
 * middleware (e.g. cross-family telemetry) can be authored without
 * naming a family. Family-specific middleware (`SqlMiddleware`,
 * `MongoMiddleware`) narrow `TPlan` to their concrete plan type.
 */
interface RuntimeMiddleware<TPlan extends QueryPlan = QueryPlan> {
  readonly name: string;
  readonly familyId?: string;
  readonly targetId?: string;
  beforeExecute?(plan: TPlan, ctx: RuntimeMiddlewareContext): Promise<void>;
  onRow?(row: Record<string, unknown>, plan: TPlan, ctx: RuntimeMiddlewareContext): Promise<void>;
  afterExecute?(plan: TPlan, result: AfterExecuteResult, ctx: RuntimeMiddlewareContext): Promise<void>;
}
/**
 * Optional per-`execute` options accepted by every family runtime.
 *
 * `signal` is the per-query cancellation signal. The runtime threads the
 * signal through to every codec call for the query and uses it to short-
 * circuit the row stream with `RUNTIME.ABORTED` when the caller aborts.
 * Omitting the option (or passing `undefined`) preserves today's behavior
 * bit-for-bit.
 */
interface RuntimeExecuteOptions {
  readonly signal?: AbortSignal;
}
/**
 * Cross-family SPI for any runtime that can execute plans and be shut down.
 * Each family runtime (SQL, Mongo) satisfies this interface — SQL nominally,
 * Mongo structurally (due to its phantom Row parameter using a unique symbol).
 *
 * The `_row` intersection on `execute` connects the `Row` type parameter to the
 * plan, mirroring how `QueryPlan<Row>` carries a phantom `_row?: Row`.
 */
interface RuntimeExecutor<TPlan extends QueryPlan> {
  execute<Row>(plan: TPlan & {
    readonly _row?: Row;
  }, options?: RuntimeExecuteOptions): AsyncIterableResult<Row>;
  close(): Promise<void>;
}
declare function checkMiddlewareCompatibility(middleware: RuntimeMiddleware, runtimeFamilyId: string, runtimeTargetId: string): void;
//#endregion
//#region src/execution/run-with-middleware.d.ts
/**
 * Drives a single execution of `runDriver()` through the middleware lifecycle.
 *
 * Lifecycle, in order:
 *  1. For each middleware in registration order: `beforeExecute(exec, ctx)`.
 *  2. For each row yielded by `runDriver()`: for each middleware in registration
 *     order: `onRow(row, exec, ctx)`; then yield the row to the consumer.
 *  3. On successful completion: for each middleware in registration order:
 *     `afterExecute(exec, { rowCount, latencyMs, completed: true }, ctx)`.
 *  4. On any error thrown by the driver loop: for each middleware in
 *     registration order: `afterExecute(exec, { rowCount, latencyMs,
 *     completed: false }, ctx)`. Errors thrown by `afterExecute` during the
 *     error path are swallowed so they do not mask the original driver error.
 *     The original error is then rethrown.
 *
 * This helper is the single canonical implementation of the middleware
 * orchestration loop; family runtimes should not reimplement it.
 */
declare function runWithMiddleware<TExec extends ExecutionPlan, Row>(exec: TExec, middleware: ReadonlyArray<RuntimeMiddleware<TExec>>, ctx: RuntimeMiddlewareContext, runDriver: () => AsyncIterable<Row>): AsyncIterableResult<Row>;
//#endregion
//#region src/execution/runtime-core.d.ts
/**
 * Constructor options shared by every concrete `RuntimeCore` subclass.
 *
 * Family runtimes typically build the middleware list and the
 * `RuntimeMiddlewareContext` themselves (running compatibility checks,
 * narrowing the context's `contract` field, etc.) before calling `super`.
 */
interface RuntimeCoreOptions<TMiddleware extends RuntimeMiddleware<ExecutionPlan>> {
  readonly middleware: ReadonlyArray<TMiddleware>;
  readonly ctx: RuntimeMiddlewareContext;
}
/**
 * Family-agnostic abstract runtime base.
 *
 * Defines the entire `execute(plan)` template in one place:
 *
 * 1. `runBeforeCompile(plan)` — concrete; defaults to identity. SQL overrides
 *    this to run its `beforeCompile` middleware-hook chain.
 * 2. `lower(plan)` — abstract. Each family produces its `*ExecutionPlan`
 *    (SQL via `lowerSqlPlan`, Mongo via `adapter.lower`).
 * 3. `runWithMiddleware(exec, this.middleware, this.ctx,
 *    () => runDriver(exec))` — concrete; lifts the middleware lifecycle
 *    out of the family runtimes into the canonical helper.
 *
 * Concrete subclasses must implement `lower`, `runDriver`, and `close`.
 *
 * The class is generic over:
 * - `TPlan` — the family's pre-lowering plan type.
 * - `TExec` — the family's post-lowering (executable) plan type.
 * - `TMiddleware` — the family's middleware type. Constrained to
 *   `RuntimeMiddleware<TExec>` because `runWithMiddleware` invokes the
 *   `beforeExecute` / `onRow` / `afterExecute` hooks with the lowered
 *   `TExec`. (The spec/plan wording "RuntimeMiddleware<TPlan>" is
 *   tightened to `<TExec>` here so the helper call typechecks; the
 *   intent is unchanged — middleware sees the post-lowering plan.)
 */
declare abstract class RuntimeCore<TPlan extends QueryPlan, TExec extends ExecutionPlan, TMiddleware extends RuntimeMiddleware<TExec>> implements RuntimeExecutor<TPlan> {
  protected readonly middleware: ReadonlyArray<TMiddleware>;
  protected readonly ctx: RuntimeMiddlewareContext;
  constructor(options: RuntimeCoreOptions<TMiddleware>);
  /**
   * Pre-lowering hook for plan rewriting. Defaults to identity. Subclasses
   * may override to run a `beforeCompile` middleware chain (SQL does this
   * to support typed AST rewrites — see `before-compile-chain.ts`).
   */
  protected runBeforeCompile(plan: TPlan): TPlan | Promise<TPlan>;
  /**
   * Lower a pre-lowering `TPlan` into the family's executable `TExec`.
   * Family-specific: SQL produces `{ sql, params, ast?, ... }`; Mongo
   * produces `{ command, ... }`.
   *
   * `ctx` carries per-query cancellation (and any future fields on
   * `CodecCallContext`); concrete subclasses forward it to the
   * encode-side codec dispatch site (e.g. SQL's `encodeParams` in m2,
   * Mongo's `resolveValue` in m3). The runtime allocates one ctx per
   * `execute()` call and threads the same reference everywhere; the
   * `signal` field inside may be `undefined`, but the ctx object itself
   * is always present.
   */
  protected abstract lower(plan: TPlan, ctx: CodecCallContext): TExec | Promise<TExec>;
  /**
   * Drive the underlying transport for a lowered `TExec`. Yields raw rows
   * directly from the driver as `Record<string, unknown>`; codec decoding
   * (if any) is the subclass's responsibility, applied by wrapping
   * `execute()` rather than living inside this hook.
   *
   * The `Row` type parameter on `execute()` is satisfied by the caller via
   * the plan's phantom `_row`; the runtime treats rows as opaque records
   * here and trusts the caller's row typing.
   */
  protected abstract runDriver(exec: TExec): AsyncIterable<Record<string, unknown>>;
  abstract close(): Promise<void>;
  execute<Row>(plan: TPlan & {
    readonly _row?: Row;
  }, options?: RuntimeExecuteOptions): AsyncIterableResult<Row>;
}
//#endregion
export { type AfterExecuteResult, AsyncIterableResult, type ExecutionPlan, type QueryPlan, RUNTIME_ABORTED, type ResultType, type RuntimeAbortedPhase, RuntimeCore, type RuntimeCoreOptions, type RuntimeErrorEnvelope, type RuntimeExecuteOptions, type RuntimeExecutor, type RuntimeLog, type RuntimeMiddleware, type RuntimeMiddlewareContext, checkAborted, checkMiddlewareCompatibility, isRuntimeError, raceAgainstAbort, runWithMiddleware, runtimeAborted, runtimeError };
//# sourceMappingURL=runtime.d.mts.map
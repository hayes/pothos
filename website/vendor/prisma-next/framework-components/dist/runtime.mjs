//#region src/execution/runtime-error.ts
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
const RUNTIME_ABORTED = "RUNTIME.ABORTED";
/**
* Type guard for the runtime-error envelope produced by `runtimeError`.
*
* Prefer this over duck-typing on `error.code` directly so consumers stay
* insulated from the envelope's internal shape.
*/
function isRuntimeError(error) {
	return error instanceof Error && "code" in error && typeof error.code === "string" && "category" in error && "severity" in error;
}
function runtimeError(code, message, details) {
	const error = new Error(message);
	Object.defineProperty(error, "name", {
		value: "RuntimeError",
		configurable: true
	});
	return Object.assign(error, {
		code,
		category: resolveCategory(code),
		severity: "error",
		message,
		details
	});
}
function resolveCategory(code) {
	const prefix = code.split(".")[0] ?? "RUNTIME";
	switch (prefix) {
		case "PLAN":
		case "CONTRACT":
		case "LINT":
		case "BUDGET": return prefix;
		default: return "RUNTIME";
	}
}
/**
* Construct a `RUNTIME.ABORTED` envelope. Phase distinguishes where the
* abort was observed (encode / decode / stream); cause carries `signal.reason`
* verbatim from the platform — native abort produces a `DOMException`,
* explicit `controller.abort(reason)` produces whatever the caller passed.
* No synthesis happens here.
*/
function runtimeAborted(phase, cause) {
	const envelope = runtimeError(RUNTIME_ABORTED, `Operation aborted during ${phase}`, { phase });
	return Object.assign(envelope, { cause });
}

//#endregion
//#region src/execution/async-iterable-result.ts
var AsyncIterableResult = class {
	generator;
	consumed = false;
	consumedBy;
	bufferedArrayPromise;
	constructor(generator) {
		this.generator = generator;
	}
	[Symbol.asyncIterator]() {
		if (this.consumed) throw runtimeError("RUNTIME.ITERATOR_CONSUMED", `AsyncIterableResult iterator has already been consumed via ${this.consumedBy === "bufferedArray" ? "toArray()/then()" : "for-await loop"}. Each AsyncIterableResult can only be iterated once.`, {
			consumedBy: this.consumedBy,
			suggestion: this.consumedBy === "bufferedArray" ? "If you need to iterate multiple times, store the results from toArray() in a variable and reuse that." : "If you need to iterate multiple times, use toArray() to collect all results first."
		});
		this.consumed = true;
		this.consumedBy = "iterator";
		return this.generator;
	}
	toArray() {
		if (this.consumedBy === "iterator") return Promise.reject(runtimeError("RUNTIME.ITERATOR_CONSUMED", "AsyncIterableResult iterator has already been consumed via for-await loop. Each AsyncIterableResult can only be iterated once.", {
			consumedBy: this.consumedBy,
			suggestion: "The iterator was already consumed by a for-await loop. Use toArray() or await the result before iterating."
		}));
		if (this.bufferedArrayPromise) return this.bufferedArrayPromise;
		this.consumed = true;
		this.consumedBy = "bufferedArray";
		this.bufferedArrayPromise = (async () => {
			const out = [];
			for await (const item of this.generator) out.push(item);
			return out;
		})();
		return this.bufferedArrayPromise;
	}
	async first() {
		return (await this.toArray())[0] ?? null;
	}
	async firstOrThrow() {
		const row = await this.first();
		if (row === null) throw runtimeError("RUNTIME.NO_ROWS", "Expected at least one row, but none were returned", {});
		return row;
	}
	then(onfulfilled, onrejected) {
		return this.toArray().then(onfulfilled, onrejected);
	}
};

//#endregion
//#region src/execution/race-against-abort.ts
/**
* Throw a phase-tagged `RUNTIME.ABORTED` envelope if the supplied
* codec-call context is already aborted at the precheck site. Centralises
* the `if (ctx.signal?.aborted) throw runtimeAborted(...)` pattern that
* every codec dispatch site repeats.
*/
function checkAborted(ctx, phase) {
	if (ctx.signal?.aborted) throw runtimeAborted(phase, ctx.signal.reason);
}
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
async function raceAgainstAbort(work, signal, phase) {
	if (signal === void 0) return await work;
	const sentinel = { reason: void 0 };
	let onAbort;
	const abortPromise = new Promise((_, reject) => {
		if (signal.aborted) {
			sentinel.reason = signal.reason;
			reject(sentinel);
			return;
		}
		onAbort = () => {
			sentinel.reason = signal.reason;
			reject(sentinel);
		};
		signal.addEventListener("abort", onAbort, { once: true });
	});
	try {
		return await Promise.race([work, abortPromise]);
	} catch (error) {
		if (error === sentinel) throw runtimeAborted(phase, sentinel.reason);
		throw error;
	} finally {
		if (onAbort) signal.removeEventListener("abort", onAbort);
	}
}

//#endregion
//#region src/execution/run-with-middleware.ts
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
function runWithMiddleware(exec, middleware, ctx, runDriver) {
	const iterator = async function* () {
		const startedAt = Date.now();
		let rowCount = 0;
		let completed = false;
		try {
			for (const mw of middleware) if (mw.beforeExecute) await mw.beforeExecute(exec, ctx);
			for await (const row of runDriver()) {
				for (const mw of middleware) if (mw.onRow) await mw.onRow(row, exec, ctx);
				rowCount++;
				yield row;
			}
			completed = true;
		} catch (error) {
			const latencyMs$1 = Date.now() - startedAt;
			for (const mw of middleware) if (mw.afterExecute) try {
				await mw.afterExecute(exec, {
					rowCount,
					latencyMs: latencyMs$1,
					completed
				}, ctx);
			} catch {}
			throw error;
		}
		const latencyMs = Date.now() - startedAt;
		for (const mw of middleware) if (mw.afterExecute) await mw.afterExecute(exec, {
			rowCount,
			latencyMs,
			completed
		}, ctx);
	};
	return new AsyncIterableResult(iterator());
}

//#endregion
//#region src/execution/runtime-core.ts
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
var RuntimeCore = class {
	middleware;
	ctx;
	constructor(options) {
		this.middleware = options.middleware;
		this.ctx = options.ctx;
	}
	/**
	* Pre-lowering hook for plan rewriting. Defaults to identity. Subclasses
	* may override to run a `beforeCompile` middleware chain (SQL does this
	* to support typed AST rewrites — see `before-compile-chain.ts`).
	*/
	runBeforeCompile(plan) {
		return plan;
	}
	execute(plan, options) {
		const self = this;
		const signal = options?.signal;
		const codecCtx = signal === void 0 ? {} : { signal };
		async function* generator() {
			checkAborted(codecCtx, "stream");
			const compiled = await self.runBeforeCompile(plan);
			const exec = await self.lower(compiled, codecCtx);
			yield* runWithMiddleware(exec, self.middleware, self.ctx, () => self.runDriver(exec));
		}
		return new AsyncIterableResult(generator());
	}
};

//#endregion
//#region src/execution/runtime-middleware.ts
function checkMiddlewareCompatibility(middleware, runtimeFamilyId, runtimeTargetId) {
	if (middleware.targetId !== void 0 && middleware.familyId === void 0) throw runtimeError("RUNTIME.MIDDLEWARE_INCOMPATIBLE", `Middleware '${middleware.name}' specifies targetId '${middleware.targetId}' without familyId`, {
		middleware: middleware.name,
		targetId: middleware.targetId
	});
	if (middleware.familyId !== void 0 && middleware.familyId !== runtimeFamilyId) throw runtimeError("RUNTIME.MIDDLEWARE_FAMILY_MISMATCH", `Middleware '${middleware.name}' requires family '${middleware.familyId}' but the runtime is configured for family '${runtimeFamilyId}'`, {
		middleware: middleware.name,
		middlewareFamilyId: middleware.familyId,
		runtimeFamilyId
	});
	if (middleware.targetId !== void 0 && middleware.targetId !== runtimeTargetId) throw runtimeError("RUNTIME.MIDDLEWARE_TARGET_MISMATCH", `Middleware '${middleware.name}' requires target '${middleware.targetId}' but the runtime is configured for target '${runtimeTargetId}'`, {
		middleware: middleware.name,
		middlewareTargetId: middleware.targetId,
		runtimeTargetId
	});
}

//#endregion
export { AsyncIterableResult, RUNTIME_ABORTED, RuntimeCore, checkAborted, checkMiddlewareCompatibility, isRuntimeError, raceAgainstAbort, runWithMiddleware, runtimeAborted, runtimeError };
//# sourceMappingURL=runtime.mjs.map
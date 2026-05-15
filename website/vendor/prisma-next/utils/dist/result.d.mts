//#region src/result.d.ts
/**
 * Generic Result type for representing success or failure outcomes.
 *
 * This is the standard way to return "expected failures" as values rather than
 * throwing exceptions. See docs/Error Handling.md for the full taxonomy.
 *
 * Naming rationale:
 * - `Ok<T>` / `NotOk<F>` mirror the `ok: true/false` discriminator
 * - `NotOk` avoids collision with domain types like "Failure" or "Error"
 * - `failure` property distinguishes from JS Error semantics
 */
/**
 * Represents a successful result containing a value.
 */
interface Ok<T> {
  readonly ok: true;
  readonly value: T;
  assertOk(): T;
  assertNotOk(): never;
}
/**
 * Represents an unsuccessful result containing failure details.
 */
interface NotOk<F> {
  readonly ok: false;
  readonly failure: F;
  assertOk(): never;
  assertNotOk(): F;
}
/**
 * A discriminated union representing either success (Ok) or failure (NotOk).
 *
 * @typeParam T - The success value type
 * @typeParam F - The failure details type
 */
type Result<T, F> = Ok<T> | NotOk<F>;
/**
 * Creates a successful result.
 */
declare function ok<T>(value: T): Ok<T>;
/**
 * Creates an unsuccessful result.
 */
declare function notOk<F>(failure: F): NotOk<F>;
/**
 * Returns a successful void result.
 * Use this for validation checks that don't produce a value.
 */
declare function okVoid(): Ok<void>;
//#endregion
export { type NotOk, type Ok, type Result, notOk, ok, okVoid };
//# sourceMappingURL=result.d.mts.map
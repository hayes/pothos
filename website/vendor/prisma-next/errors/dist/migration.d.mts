import { r as CliStructuredError } from "./control-ekdDo8G9.mjs";

//#region src/migration.d.ts

/**
 * A scaffolded migration contains a placeholder slot that was never filled in.
 *
 * Thrown at emit time (when `check.source()` or `run()` is invoked) via the
 * `placeholder(...)` utility. The `slot` identifies the exact location the
 * author still needs to edit, e.g. `"backfill-product-status:check.source"`.
 */
declare function errorUnfilledPlaceholder(slot: string): CliStructuredError;
/**
 * Scaffolded `migration.ts` files call this wherever the scaffolder couldn't
 * emit a real query and the author is expected to fill one in. Always throws
 * a structured migration error (`PN-MIG-2001`).
 *
 * The return type `never` makes it assignable to any expected return type, so
 * a scaffolded `() => placeholder('...')` satisfies signatures like
 * `() => MongoQueryPlan` without polluting them with a sentinel union arm.
 */
declare function placeholder(slot: string): never;
/**
 * A `dataTransform(endContract, …)` factory was handed a `SqlQueryPlan` whose
 * `meta.storageHash` does not match the `endContract.storage.storageHash` it
 * was configured with. This almost always means the user's query-builder
 * (`sql({ context: createExecutionContext({ contract: endContract, … }) })`)
 * was instantiated from a different contract reference than the one passed
 * to `dataTransform(endContract, …)`.
 *
 * Distinct from `runtimeError('PLAN.HASH_MISMATCH', …)` (`PN-RUN-*`) which
 * rejects a plan at runtime execution; this is an authoring-time rejection
 * so it lives in the `MIG` namespace.
 */
declare function errorDataTransformContractMismatch(options: {
  readonly dataTransformName: string;
  readonly expected: string;
  readonly actual: string;
}): CliStructuredError;
/**
 * `migration.ts` was expected at the given package directory but could not be
 * located. Thrown when consumers attempt to read a migration package that is
 * missing its source file.
 */
declare function errorMigrationFileMissing(dir: string): CliStructuredError;
/**
 * The `migration.ts` at the given package directory does not default-export a
 * valid migration shape. Two shapes are accepted: a `Migration` subclass, or a
 * factory function returning a `MigrationPlan`-shaped object (with at least
 * an `operations` array, plus `targetId` and `destination`). Thrown when the
 * default export is missing, is not a constructor/function, does not extend
 * `Migration`, or (for factory functions) returns a value that is not
 * `MigrationPlan`-shaped.
 */
declare function errorMigrationInvalidDefaultExport(dir: string, actualExportDescription?: string): CliStructuredError;
/**
 * The migration class declares one `targetId` but the loaded
 * `prisma-next.config.ts` declares another. Thrown by `MigrationCLI.run`
 * when a migration script is invoked against a config whose target
 * descriptor disagrees with the migration's own `targetId`. Distinct from generic
 * config-validation errors because the mismatch is between two valid
 * artifacts (the script and the config), not a malformed input.
 */
declare function errorMigrationTargetMismatch(options: {
  readonly migrationTargetId: string;
  readonly configTargetId: string;
}): CliStructuredError;
/**
 * A `Migration.operations` getter returned a value that is not an array. Used
 * by emit capabilities after instantiating the authored migration.
 */
declare function errorMigrationPlanNotArray(dir: string, actualValueDescription?: string): CliStructuredError;
//#endregion
export { errorDataTransformContractMismatch, errorMigrationFileMissing, errorMigrationInvalidDefaultExport, errorMigrationPlanNotArray, errorMigrationTargetMismatch, errorUnfilledPlaceholder, placeholder };
//# sourceMappingURL=migration.d.mts.map
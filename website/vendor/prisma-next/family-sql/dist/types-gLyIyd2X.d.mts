import { ControlAdapterDescriptor, ControlDriverInstance, ControlExtensionDescriptor, ControlFamilyInstance, ControlStack, DataTransformOperation, MigratableTargetDescriptor, MigrationOperationPolicy, MigrationPlan, MigrationPlanOperation, MigrationPlannerConflict, MigrationPlannerFailureResult, MigrationPlannerSuccessResult, MigrationRunnerExecutionChecks, MigrationRunnerFailure, MigrationRunnerSuccessValue, OperationContext, OperationPreview, OperationPreviewCapable, PslContractInferCapable, SchemaIssue, SchemaViewCapable, SignDatabaseResult, VerifyDatabaseResult, VerifyDatabaseSchemaResult } from "@prisma-next/framework-components/control";
import { Result } from "@prisma-next/utils/result";
import { Contract } from "@prisma-next/contract/types";
import { SqlSchemaIR } from "@prisma-next/sql-schema-ir/types";
import { TargetBoundComponentDescriptor } from "@prisma-next/framework-components/components";
import { SqlStorage, StorageTypeInstance } from "@prisma-next/sql-contract/types";
import { TypesImportSpec } from "@prisma-next/framework-components/emission";
import { PslDocumentAst } from "@prisma-next/framework-components/psl-ast";
import { SqlOperationDescriptor } from "@prisma-next/sql-operations";

//#region src/core/control-instance.d.ts
interface SqlTypeMetadata {
  readonly typeId: string;
  readonly familyId: 'sql';
  readonly targetId: string;
  readonly nativeType?: string;
}
type SqlTypeMetadataRegistry = Map<string, SqlTypeMetadata>;
interface SqlFamilyInstanceState {
  readonly codecTypeImports: ReadonlyArray<TypesImportSpec>;
  readonly operationTypeImports: ReadonlyArray<TypesImportSpec>;
  readonly extensionIds: ReadonlyArray<string>;
  readonly typeMetadataRegistry: SqlTypeMetadataRegistry;
}
interface SchemaVerifyOptions {
  readonly driver: ControlDriverInstance<'sql', string>;
  readonly contract: unknown;
  readonly strict: boolean;
  readonly context?: OperationContext;
  /**
   * Active framework components participating in this composition.
   * All components must have matching familyId ('sql') and targetId.
   */
  readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>>;
}
interface SqlControlFamilyInstance extends ControlFamilyInstance<'sql', SqlSchemaIR>, SchemaViewCapable<SqlSchemaIR>, PslContractInferCapable<SqlSchemaIR>, OperationPreviewCapable, SqlFamilyInstanceState {
  validateContract(contractJson: unknown): Contract;
  verify(options: {
    readonly driver: ControlDriverInstance<'sql', string>;
    readonly contract: unknown;
    readonly expectedTargetId: string;
    readonly contractPath: string;
    readonly configPath?: string;
  }): Promise<VerifyDatabaseResult>;
  schemaVerify(options: SchemaVerifyOptions): Promise<VerifyDatabaseSchemaResult>;
  sign(options: {
    readonly driver: ControlDriverInstance<'sql', string>;
    readonly contract: unknown;
    readonly contractPath: string;
    readonly configPath?: string;
  }): Promise<SignDatabaseResult>;
  introspect(options: {
    readonly driver: ControlDriverInstance<'sql', string>;
    readonly contract?: unknown;
  }): Promise<SqlSchemaIR>;
  inferPslContract(schemaIR: SqlSchemaIR): PslDocumentAst;
  toOperationPreview(operations: readonly MigrationPlanOperation[]): OperationPreview;
}
//#endregion
//#region src/core/migrations/types.d.ts
type AnyRecord = Readonly<Record<string, unknown>>;
interface ComponentDatabaseDependency<TTargetDetails> {
  readonly id: string;
  readonly label: string;
  readonly install: readonly SqlMigrationPlanOperation<TTargetDetails>[];
}
interface ComponentDatabaseDependencies<TTargetDetails> {
  readonly init?: readonly ComponentDatabaseDependency<TTargetDetails>[];
}
interface DatabaseDependencyProvider {
  readonly databaseDependencies?: ComponentDatabaseDependencies<unknown>;
}
declare function isDatabaseDependencyProvider(value: unknown): value is DatabaseDependencyProvider;
declare function collectInitDependencies(components: ReadonlyArray<unknown>): readonly ComponentDatabaseDependency<unknown>[];
interface StorageTypePlanResult<TTargetDetails> {
  readonly operations: readonly SqlMigrationPlanOperation<TTargetDetails>[];
}
/**
 * Input for expanding parameterized native types.
 */
interface ExpandNativeTypeInput {
  readonly nativeType: string;
  readonly codecId?: string;
  readonly typeParams?: Record<string, unknown>;
}
/**
 * Input for resolving an identity-value SQL literal used to backfill existing rows when
 * adding a NOT NULL column without an explicit default.
 *
 * "Identity value" in the algebraic (monoid) sense: the neutral element for the type
 * (0 for numbers, '' for strings, false for booleans, etc.).
 */
interface ResolveIdentityValueInput {
  readonly nativeType: string;
  readonly codecId?: string;
  readonly typeParams?: Record<string, unknown>;
}
interface CodecControlHooks<TTargetDetails = unknown> {
  planTypeOperations?: (options: {
    readonly typeName: string;
    readonly typeInstance: StorageTypeInstance;
    readonly contract: Contract<SqlStorage>;
    readonly schema: SqlSchemaIR;
    readonly schemaName?: string;
    readonly policy: MigrationOperationPolicy;
  }) => StorageTypePlanResult<TTargetDetails>;
  verifyType?: (options: {
    readonly typeName: string;
    readonly typeInstance: StorageTypeInstance;
    readonly schema: SqlSchemaIR;
    readonly schemaName?: string;
  }) => readonly SchemaIssue[];
  introspectTypes?: (options: {
    readonly driver: ControlDriverInstance<'sql', string>;
    readonly schemaName?: string;
  }) => Promise<Record<string, StorageTypeInstance>>;
  /**
   * Expands a parameterized native type to its full SQL representation.
   * Used by schema verification to compare contract types against database types.
   *
   * For example, expands:
   * - { nativeType: 'character varying', typeParams: { length: 255 } } -> 'character varying(255)'
   * - { nativeType: 'numeric', typeParams: { precision: 10, scale: 2 } } -> 'numeric(10,2)'
   *
   * Returns the expanded type string, or the original nativeType if no expansion is needed.
   */
  expandNativeType?: (input: ExpandNativeTypeInput) => string;
  /**
   * Resolves the identity value (monoid neutral element) as a SQL literal for safely adding
   * a NOT NULL column without an explicit default to a non-empty table.
   *
   * Return semantics:
   * - string: use this literal
   * - null: explicitly no safe identity value is known; fall back to another strategy
   * - undefined: no opinion; planner may use built-in fallbacks
   */
  resolveIdentityValue?: (input: ResolveIdentityValueInput) => string | null | undefined;
}
interface SqlControlExtensionDescriptor<TTargetId extends string> extends ControlExtensionDescriptor<'sql', TTargetId> {
  readonly databaseDependencies?: ComponentDatabaseDependencies<unknown>;
  readonly queryOperations?: () => ReadonlyArray<SqlOperationDescriptor>;
}
interface SqlControlAdapterDescriptor<TTargetId extends string> extends ControlAdapterDescriptor<'sql', TTargetId> {
  readonly queryOperations?: () => ReadonlyArray<SqlOperationDescriptor>;
}
interface SqlMigrationPlanOperationStep {
  readonly description: string;
  readonly sql: string;
  readonly meta?: AnyRecord;
}
/**
 * Minimal shape every SQL-family target must conform to for its per-operation
 * `target.details` payload. Each SQL operation addresses a named database
 * object in some schema; targets (Postgres, MySQL, SQLite, …) extend this
 * shape with their own fields (e.g. Postgres adds `objectType` and optional
 * `table`).
 */
interface SqlPlanTargetDetails {
  readonly schema: string;
  readonly name: string;
}
interface SqlMigrationPlanOperationTarget<TTargetDetails> {
  readonly id: string;
  readonly details?: TTargetDetails;
}
interface SqlMigrationPlanOperation<TTargetDetails> extends MigrationPlanOperation {
  readonly summary?: string;
  readonly target: SqlMigrationPlanOperationTarget<TTargetDetails>;
  readonly precheck: readonly SqlMigrationPlanOperationStep[];
  readonly execute: readonly SqlMigrationPlanOperationStep[];
  readonly postcheck: readonly SqlMigrationPlanOperationStep[];
  readonly meta?: AnyRecord;
}
/**
 * Union of all operation shapes a SQL-family migration may emit: schema-facing
 * `SqlMigrationPlanOperation`s and family-agnostic `DataTransformOperation`s.
 *
 * Mirrors `AnyMongoMigrationOperation` in shape — the runner already handles
 * both branches via `isDataTransformOperation`, and authored `migration.ts`
 * files must be able to intermix `dataTransform(endContract, …)` calls with
 * DDL factory calls (e.g. `setNotNull(…)`) in a single `operations` array.
 */
type AnySqlMigrationOperation<TTargetDetails> = SqlMigrationPlanOperation<TTargetDetails> | DataTransformOperation;
interface SqlMigrationPlanContractInfo {
  readonly storageHash: string;
  readonly profileHash?: string;
}
interface SqlMigrationPlan<TTargetDetails> extends MigrationPlan {
  /**
   * Origin contract identity that the plan expects the database to currently be at.
   * If omitted or null, the runner skips origin validation entirely.
   */
  readonly origin?: SqlMigrationPlanContractInfo | null;
  /**
   * Destination contract identity that the plan intends to reach.
   */
  readonly destination: SqlMigrationPlanContractInfo;
  readonly operations: readonly SqlMigrationPlanOperation<TTargetDetails>[];
  /**
   * Sorted, deduplicated invariant ids declared by this plan's data-transform
   * ops. Required at the SQL-family layer (the SQL runners consume this as
   * the source of truth for marker writes and self-edge no-op checks); the
   * framework-level {@link MigrationPlan.providedInvariants} stays optional
   * because `db init` / `db update` plans don't have a corresponding
   * migration manifest.
   */
  readonly providedInvariants: readonly string[];
  readonly meta?: AnyRecord;
}
type SqlPlannerConflictKind = 'typeMismatch' | 'nullabilityConflict' | 'indexIncompatible' | 'foreignKeyConflict' | 'missingButNonAdditive' | 'unsupportedOperation';
interface SqlPlannerConflictLocation {
  readonly table?: string;
  readonly column?: string;
  readonly index?: string;
  readonly constraint?: string;
  readonly type?: string;
}
interface SqlPlannerConflict extends MigrationPlannerConflict {
  readonly kind: SqlPlannerConflictKind;
  readonly location?: SqlPlannerConflictLocation;
  readonly meta?: AnyRecord;
}
interface SqlPlannerSuccessResult<TTargetDetails> extends Omit<MigrationPlannerSuccessResult, 'plan'> {
  readonly kind: 'success';
  readonly plan: SqlMigrationPlan<TTargetDetails>;
}
interface SqlPlannerFailureResult extends Omit<MigrationPlannerFailureResult, 'conflicts'> {
  readonly kind: 'failure';
  readonly conflicts: readonly SqlPlannerConflict[];
}
type SqlPlannerResult<TTargetDetails> = SqlPlannerSuccessResult<TTargetDetails> | SqlPlannerFailureResult;
interface SqlMigrationPlannerPlanOptions {
  readonly contract: Contract<SqlStorage>;
  readonly schema: SqlSchemaIR;
  readonly policy: MigrationOperationPolicy;
  readonly schemaName?: string;
  /**
   * The "from" contract (state the planner assumes the database starts at),
   * or `null` for reconciliation flows that have no prior contract.
   *
   * Required at every call site so the structural fact "I have a prior
   * contract / I don't" is visible in the type. `migration plan` supplies
   * the previous bundle's `metadata.toContract`; `db update` / `db init`
   * reconcile against the live schema and pass `null`. Strategies that
   * need from/to column-shape comparisons (unsafe type change, nullability
   * tightening) use this to decide whether to emit `dataTransform`
   * placeholders; they short-circuit when it is `null`.
   *
   * Planners also derive the "from" identity they stamp onto the produced
   * plan's `describe()` as `fromContract?.storage.storageHash ?? null`.
   */
  readonly fromContract: Contract<SqlStorage> | null;
  /**
   * Active framework components participating in this composition.
   * SQL targets can interpret this list to derive database dependencies.
   * All components must have matching familyId ('sql') and targetId.
   */
  readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>>;
}
interface SqlMigrationPlanner<TTargetDetails> {
  plan(options: SqlMigrationPlannerPlanOptions): SqlPlannerResult<TTargetDetails>;
}
interface SqlMigrationRunnerExecuteCallbacks<TTargetDetails> {
  onOperationStart?(operation: SqlMigrationPlanOperation<TTargetDetails>): void;
  onOperationComplete?(operation: SqlMigrationPlanOperation<TTargetDetails>): void;
}
interface SqlMigrationRunnerExecuteOptions<TTargetDetails> {
  readonly plan: SqlMigrationPlan<TTargetDetails>;
  readonly driver: ControlDriverInstance<'sql', string>;
  /**
   * Destination contract IR.
   * Must correspond to `plan.destination` and is used for schema verification and marker/ledger writes.
   */
  readonly destinationContract: Contract<SqlStorage>;
  /**
   * Execution-time policy that defines which operation classes are allowed.
   * The runner validates each operation against this policy before execution.
   */
  readonly policy: MigrationOperationPolicy;
  readonly schemaName?: string;
  readonly strictVerification?: boolean;
  readonly callbacks?: SqlMigrationRunnerExecuteCallbacks<TTargetDetails>;
  readonly context?: OperationContext;
  /**
   * Execution-time checks configuration.
   * All checks default to `true` (enabled) when omitted.
   */
  readonly executionChecks?: MigrationRunnerExecutionChecks;
  /**
   * Active framework components participating in this composition.
   * SQL targets can interpret this list to derive database dependencies.
   * All components must have matching familyId ('sql') and targetId.
   */
  readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>>;
}
type SqlMigrationRunnerErrorCode = 'DESTINATION_CONTRACT_MISMATCH' | 'MARKER_ORIGIN_MISMATCH' | 'POLICY_VIOLATION' | 'PRECHECK_FAILED' | 'POSTCHECK_FAILED' | 'SCHEMA_VERIFY_FAILED' | 'FOREIGN_KEY_VIOLATION' | 'EXECUTION_FAILED';
interface SqlMigrationRunnerFailure extends MigrationRunnerFailure {
  readonly code: SqlMigrationRunnerErrorCode;
  readonly meta?: AnyRecord;
}
interface SqlMigrationRunnerSuccessValue extends MigrationRunnerSuccessValue {}
type SqlMigrationRunnerResult = Result<SqlMigrationRunnerSuccessValue, SqlMigrationRunnerFailure>;
interface SqlMigrationRunner<TTargetDetails> {
  execute(options: SqlMigrationRunnerExecuteOptions<TTargetDetails>): Promise<SqlMigrationRunnerResult>;
}
interface SqlControlTargetDescriptor<TTargetId extends string, TTargetDetails> extends MigratableTargetDescriptor<'sql', TTargetId, SqlControlFamilyInstance> {
  readonly queryOperations?: () => ReadonlyArray<SqlOperationDescriptor>;
  createPlanner(family: SqlControlFamilyInstance): SqlMigrationPlanner<TTargetDetails>;
  createRunner(family: SqlControlFamilyInstance): SqlMigrationRunner<TTargetDetails>;
}
interface CreateSqlMigrationPlanOptions<TTargetDetails> {
  readonly targetId: string;
  readonly origin?: SqlMigrationPlanContractInfo | null;
  readonly destination: SqlMigrationPlanContractInfo;
  readonly operations: readonly SqlMigrationPlanOperation<TTargetDetails>[];
  /**
   * Sorted, deduplicated invariant ids for this plan; mirrors the required
   * field on {@link SqlMigrationPlan}. Callers without a migration manifest
   * (`db init`, `db update`, planner-built plans) pass `[]`.
   */
  readonly providedInvariants: readonly string[];
  readonly meta?: AnyRecord;
}
//#endregion
export { SqlPlannerFailureResult as A, SqlMigrationRunnerFailure as C, SqlPlannerConflict as D, SqlPlanTargetDetails as E, isDatabaseDependencyProvider as F, SchemaVerifyOptions as I, SqlControlFamilyInstance as L, SqlPlannerSuccessResult as M, StorageTypePlanResult as N, SqlPlannerConflictKind as O, collectInitDependencies as P, SqlMigrationRunnerExecuteOptions as S, SqlMigrationRunnerSuccessValue as T, SqlMigrationPlanner as _, ComponentDatabaseDependency as a, SqlMigrationRunnerErrorCode as b, ResolveIdentityValueInput as c, SqlControlTargetDescriptor as d, SqlMigrationPlan as f, SqlMigrationPlanOperationTarget as g, SqlMigrationPlanOperationStep as h, ComponentDatabaseDependencies as i, SqlPlannerResult as j, SqlPlannerConflictLocation as k, SqlControlAdapterDescriptor as l, SqlMigrationPlanOperation as m, AnySqlMigrationOperation as n, CreateSqlMigrationPlanOptions as o, SqlMigrationPlanContractInfo as p, CodecControlHooks as r, ExpandNativeTypeInput as s, AnyRecord as t, SqlControlExtensionDescriptor as u, SqlMigrationPlannerPlanOptions as v, SqlMigrationRunnerResult as w, SqlMigrationRunnerExecuteCallbacks as x, SqlMigrationRunner as y };
//# sourceMappingURL=types-gLyIyd2X.d.mts.map
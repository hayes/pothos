import { a as AuthoringFieldNamespace, d as AuthoringTypeNamespace, i as AuthoringContributions } from "./framework-authoring-BdrFDx4x.mjs";
import { a as CodecLookup } from "./codec-types-CB0jWeHU.mjs";
import { A as LoweredDefaultResult, C as ControlMutationDefaultEntry, D as DefaultFunctionLoweringHandler, E as DefaultFunctionLoweringContext, F as SourceSpan, M as MutationDefaultGeneratorDescriptor, N as ParsedDefaultFunctionCall, O as DefaultFunctionRegistry, P as SourceDiagnostic, T as ControlMutationDefaults, a as ComponentMetadata, b as TargetInstance, c as DriverDescriptor, d as ExtensionDescriptor, f as ExtensionInstance, h as FamilyInstance, j as LoweredDefaultValue, k as DefaultFunctionRegistryEntry, l as DriverInstance, m as FamilyDescriptor, n as AdapterInstance, t as AdapterDescriptor, v as TargetBoundComponentDescriptor, w as ControlMutationDefaultRegistry, y as TargetDescriptor } from "./framework-components-AHI6V96G.mjs";
import { t as TypesImportSpec } from "./types-import-spec-D-O6GotH.mjs";
import { t as EmissionSpi } from "./emission-types-D6t3_a0x.mjs";
import { m as PslDocumentAst } from "./psl-ast-9X5rwo98.mjs";
import { Contract, ContractMarkerRecord } from "@prisma-next/contract/types";
import { Result } from "@prisma-next/utils/result";

//#region src/control/control-result-types.d.ts
declare const VERIFY_CODE_MARKER_MISSING = "PN-RUN-3001";
declare const VERIFY_CODE_HASH_MISMATCH = "PN-RUN-3002";
declare const VERIFY_CODE_TARGET_MISMATCH = "PN-RUN-3003";
declare const VERIFY_CODE_SCHEMA_FAILURE = "PN-RUN-3010";
interface OperationContext {
  readonly contractPath?: string;
  readonly configPath?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}
interface VerifyDatabaseResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly summary: string;
  readonly contract: {
    readonly storageHash: string;
    readonly profileHash?: string;
  };
  readonly marker?: {
    readonly storageHash?: string;
    readonly profileHash?: string;
  };
  readonly target: {
    readonly expected: string;
    readonly actual?: string;
  };
  readonly missingCodecs?: readonly string[];
  readonly codecCoverageSkipped?: boolean;
  readonly meta?: {
    readonly configPath?: string;
    readonly contractPath: string;
  };
  readonly timings: {
    readonly total: number;
  };
}
interface BaseSchemaIssue {
  readonly kind: 'missing_table' | 'missing_column' | 'extra_table' | 'extra_column' | 'extra_primary_key' | 'extra_foreign_key' | 'extra_unique_constraint' | 'extra_index' | 'extra_validator' | 'type_mismatch' | 'type_missing' | 'type_values_mismatch' | 'nullability_mismatch' | 'primary_key_mismatch' | 'foreign_key_mismatch' | 'unique_constraint_mismatch' | 'index_mismatch' | 'dependency_missing' | 'default_missing' | 'default_mismatch' | 'extra_default';
  readonly table?: string;
  readonly column?: string;
  readonly indexOrConstraint?: string;
  readonly typeName?: string;
  readonly dependencyId?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly message: string;
}
interface EnumValuesChangedIssue {
  readonly kind: 'enum_values_changed';
  readonly typeName: string;
  readonly addedValues: readonly string[];
  readonly removedValues: readonly string[];
  readonly message: string;
}
type SchemaIssue = BaseSchemaIssue | EnumValuesChangedIssue;
interface SchemaVerificationNode {
  readonly status: 'pass' | 'warn' | 'fail';
  readonly kind: string;
  readonly name: string;
  readonly contractPath: string;
  readonly code: string;
  readonly message: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly children: readonly SchemaVerificationNode[];
}
interface VerifyDatabaseSchemaResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly summary: string;
  readonly contract: {
    readonly storageHash: string;
    readonly profileHash?: string;
  };
  readonly target: {
    readonly expected: string;
    readonly actual?: string;
  };
  readonly schema: {
    readonly issues: readonly SchemaIssue[];
    readonly root: SchemaVerificationNode;
    readonly counts: {
      readonly pass: number;
      readonly warn: number;
      readonly fail: number;
      readonly totalNodes: number;
    };
  };
  readonly meta?: {
    readonly configPath?: string;
    readonly contractPath?: string;
    readonly strict: boolean;
  };
  readonly timings: {
    readonly total: number;
  };
}
interface EmitContractResult {
  readonly contractJson: string;
  readonly contractDts: string;
  readonly storageHash: string;
  readonly executionHash?: string;
  readonly profileHash: string;
}
interface IntrospectSchemaResult<TSchemaIR> {
  readonly ok: true;
  readonly summary: string;
  readonly target: {
    readonly familyId: string;
    readonly id: string;
  };
  readonly schema: TSchemaIR;
  readonly meta?: {
    readonly configPath?: string;
    readonly dbUrl?: string;
  };
  readonly timings: {
    readonly total: number;
  };
}
interface SignDatabaseResult {
  readonly ok: boolean;
  readonly summary: string;
  readonly contract: {
    readonly storageHash: string;
    readonly profileHash?: string;
  };
  readonly target: {
    readonly expected: string;
    readonly actual?: string;
  };
  readonly marker: {
    readonly created: boolean;
    readonly updated: boolean;
    readonly previous?: {
      readonly storageHash?: string;
      readonly profileHash?: string;
    };
  };
  readonly meta?: {
    readonly configPath?: string;
    readonly contractPath: string;
  };
  readonly timings: {
    readonly total: number;
  };
}
//#endregion
//#region src/control/control-instances.d.ts
interface ControlFamilyInstance<TFamilyId extends string, TSchemaIR> extends FamilyInstance<TFamilyId> {
  validateContract(contractJson: unknown): Contract;
  verify(options: {
    readonly driver: ControlDriverInstance<TFamilyId, string>;
    readonly contract: unknown;
    readonly expectedTargetId: string;
    readonly contractPath: string;
    readonly configPath?: string;
  }): Promise<VerifyDatabaseResult>;
  schemaVerify(options: {
    readonly driver: ControlDriverInstance<TFamilyId, string>;
    readonly contract: unknown;
    readonly strict: boolean;
    readonly contractPath: string;
    readonly configPath?: string;
    readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<TFamilyId, string>>;
  }): Promise<VerifyDatabaseSchemaResult>;
  sign(options: {
    readonly driver: ControlDriverInstance<TFamilyId, string>;
    readonly contract: unknown;
    readonly contractPath: string;
    readonly configPath?: string;
  }): Promise<SignDatabaseResult>;
  readMarker(options: {
    readonly driver: ControlDriverInstance<TFamilyId, string>;
  }): Promise<ContractMarkerRecord | null>;
  introspect(options: {
    readonly driver: ControlDriverInstance<TFamilyId, string>;
    readonly contract?: unknown;
  }): Promise<TSchemaIR>;
}
interface ControlTargetInstance<TFamilyId extends string, TTargetId extends string> extends TargetInstance<TFamilyId, TTargetId> {}
interface ControlAdapterInstance<TFamilyId extends string, TTargetId extends string> extends AdapterInstance<TFamilyId, TTargetId> {}
interface ControlDriverInstance<TFamilyId extends string, TTargetId extends string> extends DriverInstance<TFamilyId, TTargetId> {
  query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<{
    readonly rows: Row[];
  }>;
  close(): Promise<void>;
}
interface ControlExtensionInstance<TFamilyId extends string, TTargetId extends string> extends ExtensionInstance<TFamilyId, TTargetId> {}
//#endregion
//#region src/control/control-stack.d.ts
interface AssembledAuthoringContributions {
  readonly field: AuthoringFieldNamespace;
  readonly type: AuthoringTypeNamespace;
}
interface ControlStack<TFamilyId extends string = string, TTargetId extends string = string> {
  readonly family: ControlFamilyDescriptor<TFamilyId>;
  readonly target: ControlTargetDescriptor<TFamilyId, TTargetId>;
  readonly adapter?: ControlAdapterDescriptor<TFamilyId, TTargetId> | undefined;
  readonly driver?: ControlDriverDescriptor<TFamilyId, TTargetId> | undefined;
  readonly extensionPacks: readonly ControlExtensionDescriptor<TFamilyId, TTargetId>[];
  readonly codecTypeImports: ReadonlyArray<TypesImportSpec>;
  readonly operationTypeImports: ReadonlyArray<TypesImportSpec>;
  readonly queryOperationTypeImports: ReadonlyArray<TypesImportSpec>;
  readonly extensionIds: ReadonlyArray<string>;
  readonly codecLookup: CodecLookup;
  readonly authoringContributions: AssembledAuthoringContributions;
  readonly scalarTypeDescriptors: ReadonlyMap<string, string>;
  readonly controlMutationDefaults: ControlMutationDefaults;
}
interface CreateControlStackInput<TFamilyId extends string = string, TTargetId extends string = string> {
  readonly family: ControlFamilyDescriptor<TFamilyId>;
  readonly target: ControlTargetDescriptor<TFamilyId, TTargetId>;
  readonly adapter?: ControlAdapterDescriptor<TFamilyId, TTargetId> | undefined;
  readonly driver?: ControlDriverDescriptor<TFamilyId, TTargetId> | undefined;
  readonly extensionPacks?: ReadonlyArray<ControlExtensionDescriptor<TFamilyId, TTargetId>> | undefined;
}
declare function assertUniqueCodecOwner(options: {
  readonly codecId: string;
  readonly owners: Map<string, string>;
  readonly descriptorId: string;
  readonly entityLabel: string;
  readonly entityOwnershipLabel: string;
}): void;
declare function extractCodecTypeImports(descriptors: ReadonlyArray<Pick<ComponentMetadata, 'types'>>): ReadonlyArray<TypesImportSpec>;
declare function extractOperationTypeImports(descriptors: ReadonlyArray<Pick<ComponentMetadata, 'types'>>): ReadonlyArray<TypesImportSpec>;
declare function extractQueryOperationTypeImports(descriptors: ReadonlyArray<Pick<ComponentMetadata, 'types'>>): ReadonlyArray<TypesImportSpec>;
declare function extractComponentIds(family: {
  readonly id: string;
}, target: {
  readonly id: string;
}, adapter: {
  readonly id: string;
} | undefined, extensions: ReadonlyArray<{
  readonly id: string;
}>): ReadonlyArray<string>;
declare function assembleAuthoringContributions(descriptors: ReadonlyArray<{
  readonly authoring?: AuthoringContributions;
}>): AssembledAuthoringContributions;
declare function assembleScalarTypeDescriptors(descriptors: ReadonlyArray<Pick<ComponentMetadata, 'scalarTypeDescriptors'> & {
  readonly id?: string;
}>): ReadonlyMap<string, string>;
declare function assembleControlMutationDefaults(descriptors: ReadonlyArray<Pick<ComponentMetadata, 'controlMutationDefaults'> & {
  readonly id?: string;
}>): ControlMutationDefaults;
declare function extractCodecLookup(descriptors: ReadonlyArray<Pick<ComponentMetadata & {
  id?: string;
}, 'types' | 'id'>>): CodecLookup;
declare function createControlStack<TFamilyId extends string, TTargetId extends string>(input: CreateControlStackInput<TFamilyId, TTargetId>): ControlStack<TFamilyId, TTargetId>;
//#endregion
//#region src/control/control-descriptors.d.ts
interface ControlFamilyDescriptor<TFamilyId extends string, TFamilyInstance extends ControlFamilyInstance<TFamilyId, unknown> = ControlFamilyInstance<TFamilyId, unknown>> extends FamilyDescriptor<TFamilyId> {
  readonly emission: EmissionSpi;
  create<TTargetId extends string>(stack: ControlStack<TFamilyId, TTargetId>): TFamilyInstance;
}
interface ControlTargetDescriptor<TFamilyId extends string, TTargetId extends string, TTargetInstance extends ControlTargetInstance<TFamilyId, TTargetId> = ControlTargetInstance<TFamilyId, TTargetId>> extends TargetDescriptor<TFamilyId, TTargetId> {
  create(): TTargetInstance;
}
interface ControlAdapterDescriptor<TFamilyId extends string, TTargetId extends string, TAdapterInstance extends ControlAdapterInstance<TFamilyId, TTargetId> = ControlAdapterInstance<TFamilyId, TTargetId>> extends AdapterDescriptor<TFamilyId, TTargetId> {
  /**
   * Construct a control adapter instance for this stack.
   *
   * The `stack` argument mirrors `ControlFamilyDescriptor.create(stack)`:
   * adapter implementations may inspect `stack.codecLookup`, extension packs,
   * or other assembled metadata when constructing the instance.
   */
  create(stack: ControlStack<TFamilyId, TTargetId>): TAdapterInstance;
}
interface ControlDriverDescriptor<TFamilyId extends string, TTargetId extends string, TDriverInstance extends ControlDriverInstance<TFamilyId, TTargetId> = ControlDriverInstance<TFamilyId, TTargetId>, TConnection = string> extends DriverDescriptor<TFamilyId, TTargetId> {
  create(connection: TConnection): Promise<TDriverInstance>;
}
interface ControlExtensionDescriptor<TFamilyId extends string, TTargetId extends string, TExtensionInstance extends ControlExtensionInstance<TFamilyId, TTargetId> = ControlExtensionInstance<TFamilyId, TTargetId>> extends ExtensionDescriptor<TFamilyId, TTargetId> {
  create(): TExtensionInstance;
}
//#endregion
//#region src/control/control-migration-types.d.ts
/**
 * Migration operation classes define the safety level of an operation.
 * - 'additive': Adds new structures without modifying existing ones (safe)
 * - 'widening': Relaxes constraints or expands types (generally safe)
 * - 'destructive': Removes or alters existing structures (potentially unsafe)
 * - 'data': Data transformation operation (e.g., backfill, type conversion)
 */
type MigrationOperationClass = 'additive' | 'widening' | 'destructive' | 'data';
/**
 * A lowered query statement as stored in ops.json.
 * Contains the SQL string and parameter values — ready for execution.
 * Lowering from query builder AST to SQL happens at verify time.
 */
interface SerializedQueryPlan {
  readonly sql: string;
  readonly params: readonly unknown[];
}
/**
 * A data transform operation within a migration edge.
 *
 * Data transforms are authored in TypeScript using the query builder,
 * serialized to JSON ASTs at verification time, and rendered to SQL
 * by the target adapter at apply time.
 *
 * In draft state (before verification), `check` and `run` are null.
 * After verification, they contain the serialized query ASTs.
 */
interface DataTransformOperation extends MigrationPlanOperation {
  readonly operationClass: 'data';
  /**
   * Human-readable label for this data transform.
   */
  readonly name: string;
  /**
   * Optional opt-in routing identity. Presence opts the transform into
   * invariant-aware routing; absence means it is path-dependent and
   * not referenceable from refs.
   */
  readonly invariantId?: string;
  /**
   * Path to the TypeScript source file that produced this operation.
   * Not part of edgeId computation — for traceability only.
   */
  readonly source: string;
  /**
   * Serialized check query plan, or a boolean literal.
   * - SerializedQueryPlan: describes violations; empty result = already applied.
   * - false: always run (no check).
   * - true: always skip.
   * - null: not yet serialized (draft state).
   */
  readonly check: SerializedQueryPlan | boolean | null;
  /**
   * Serialized run query plans.
   * - Array of serialized query plans to execute sequentially.
   * - null: not yet serialized (draft state).
   */
  readonly run: readonly SerializedQueryPlan[] | null;
}
/**
 * Policy defining which operation classes are allowed during a migration.
 */
interface MigrationOperationPolicy {
  readonly allowedOperationClasses: readonly MigrationOperationClass[];
}
/**
 * A single migration operation for display purposes.
 * Contains only the fields needed for CLI output (tree view, JSON envelope).
 */
interface MigrationPlanOperation {
  /** Unique identifier for this operation (e.g., "table.users.create"). */
  readonly id: string;
  /** Human-readable label for display in UI/CLI (e.g., "Create table users"). */
  readonly label: string;
  /** The class of operation (additive, widening, destructive). */
  readonly operationClass: MigrationOperationClass;
}
/**
 * Framework-level contract for a single factory call in a target's planner IR.
 *
 * @see ADR 195
 */
interface OpFactoryCall {
  /** The name of the factory that would produce this call's runtime op. */
  readonly factoryName: string;
  /** The operation's safety class (additive, widening, destructive, data). */
  readonly operationClass: MigrationOperationClass;
  /** Human-readable label for CLI output and diagnostics. */
  readonly label: string;
}
/**
 * A migration plan for display purposes.
 * Contains only the fields needed for CLI output (summary, JSON envelope).
 */
interface MigrationPlan {
  /** The target ID this plan is for (e.g., 'postgres'). */
  readonly targetId: string;
  /**
   * Origin contract identity that the plan expects the database to currently be at.
   * If omitted or null, the runner skips origin validation entirely.
   */
  readonly origin?: {
    readonly storageHash: string;
    readonly profileHash?: string;
  } | null;
  /** Destination contract identity that the plan intends to reach. */
  readonly destination: {
    readonly storageHash: string;
    readonly profileHash?: string;
  };
  /** Ordered list of operations to execute. */
  readonly operations: readonly MigrationPlanOperation[];
  /**
   * Sorted, deduplicated invariant ids declared by this plan's data-transform
   * ops. Authored migrations carry the canonical value from
   * `migration.json.providedInvariants`; planner-built plans (`db init`,
   * `db update`) omit it (the runner treats it as `[]`). Runners read this
   * field for marker writes and self-edge no-op detection rather than
   * re-deriving from `operations`, since the manifest is the canonical
   * source for the invariant set across all runners (postgres, sqlite,
   * mongo).
   */
  readonly providedInvariants?: readonly string[];
}
/**
 * A migration plan that can also render itself back to user-editable
 * TypeScript source (a `migration.ts` file).
 *
 * Planners produce this richer shape so that CLI commands can both:
 *  - hand the plan to the runner for execution (via `MigrationPlan`), and
 *  - materialize the plan as an editable source file via `renderTypeScript()`.
 *
 * User-authored migrations (`Migration` subclasses) satisfy `MigrationPlan`
 * but not this interface: they are already the source.
 */
interface MigrationPlanWithAuthoringSurface extends MigrationPlan {
  /**
   * Render this plan back to TypeScript source suitable for writing to
   * `migration.ts`. Output may start with a shebang; when it does, the caller
   * should make the resulting file executable.
   */
  renderTypeScript(): string;
}
/**
 * A conflict detected during migration planning.
 */
interface MigrationPlannerConflict {
  /** Kind of conflict (e.g., 'typeMismatch', 'nullabilityConflict'). */
  readonly kind: string;
  /** Human-readable summary of the conflict. */
  readonly summary: string;
  /** Optional explanation of why this conflict occurred. */
  readonly why?: string;
}
/**
 * Successful planner result with the migration plan.
 *
 * The plan is typed as `MigrationPlanWithAuthoringSurface` so the CLI can
 * uniformly ask any plan to render itself to TypeScript.
 */
interface MigrationPlannerSuccessResult {
  readonly kind: 'success';
  readonly plan: MigrationPlanWithAuthoringSurface;
}
/**
 * Failed planner result with the list of conflicts.
 */
interface MigrationPlannerFailureResult {
  readonly kind: 'failure';
  readonly conflicts: readonly MigrationPlannerConflict[];
}
/**
 * Union type for planner results.
 */
type MigrationPlannerResult = MigrationPlannerSuccessResult | MigrationPlannerFailureResult;
/**
 * Success value for migration runner execution.
 */
interface MigrationRunnerSuccessValue {
  readonly operationsPlanned: number;
  readonly operationsExecuted: number;
}
/**
 * Failure details for migration runner execution.
 */
interface MigrationRunnerFailure {
  /** Error code for the failure. */
  readonly code: string;
  /** Human-readable summary of the failure. */
  readonly summary: string;
  /** Optional explanation of why the failure occurred. */
  readonly why?: string;
  /** Optional metadata for debugging and UX (e.g., schema issues, SQL state). */
  readonly meta?: Record<string, unknown>;
}
/**
 * Result type for migration runner execution.
 */
type MigrationRunnerResult = Result<MigrationRunnerSuccessValue, MigrationRunnerFailure>;
/**
 * Execution-time checks configuration for migration runners.
 * All checks default to `true` (enabled) when omitted.
 */
interface MigrationRunnerExecutionChecks {
  /**
   * Whether to run prechecks before executing operations.
   * Defaults to `true` (prechecks are run).
   */
  readonly prechecks?: boolean;
  /**
   * Whether to run postchecks after executing operations.
   * Defaults to `true` (postchecks are run).
   */
  readonly postchecks?: boolean;
  /**
   * Whether to run idempotency probe (check if postcheck is already satisfied before execution).
   * Defaults to `true` (idempotency probe is run).
   */
  readonly idempotencyChecks?: boolean;
}
/**
 * Migration planner interface for planning schema changes.
 * This is the minimal interface that CLI commands use.
 *
 * @template TFamilyId - The family ID (e.g., 'sql', 'document')
 * @template TTargetId - The target ID (e.g., 'postgres', 'mysql')
 */
interface MigrationPlanner<TFamilyId extends string = string, TTargetId extends string = string> {
  plan(options: {
    readonly contract: unknown;
    readonly schema: unknown;
    readonly policy: MigrationOperationPolicy;
    /**
     * The "from" contract (the state the planner assumes the database starts
     * at), or `null` for a baseline plan with no prior state.
     *
     * Planners derive any "from" identity they need to stamp onto the
     * produced plan's `describe()` from `fromContract?.storage.storageHash
     * ?? null`. They also pass this to data-safety strategies so they can
     * compare `from` and `to` column shapes (e.g. to detect unsafe type
     * changes).
     *
     * Required at every call site to make the structural fact "I have a
     * prior contract / I don't" visible in the type. Reconciliation
     * commands (`db init`, `db update`) introspect a live schema and pass
     * `null`; authoring commands (`migration plan`) pass the previous
     * bundle's `metadata.toContract`.
     */
    readonly fromContract: Contract | null;
    /**
     * Active framework components participating in this composition.
     * Families/targets can interpret this list to derive family-specific metadata.
     * All components must have matching familyId and targetId.
     */
    readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<TFamilyId, TTargetId>>;
  }): MigrationPlannerResult;
  /**
   * Produce an empty migration with the target's authoring conventions.
   *
   * Used by `migration new` to scaffold a fresh `migration.ts`. The
   * returned plan has no operations; its `renderTypeScript()` yields a
   * stub the user can edit.
   */
  emptyMigration(context: MigrationScaffoldContext): MigrationPlanWithAuthoringSurface;
}
/**
 * Migration runner interface for executing migration plans.
 * This is the minimal interface that CLI commands use.
 *
 * @template TFamilyId - The family ID (e.g., 'sql', 'document')
 * @template TTargetId - The target ID (e.g., 'postgres', 'mysql')
 */
interface MigrationRunner<TFamilyId extends string = string, TTargetId extends string = string> {
  /**
   * Execute a migration plan against the configured driver.
   *
   * The `plan` parameter is trusted input. Callers are responsible for
   * upstream verification of the originating migration package — typically
   * by obtaining the package via `readMigrationPackage` from
   * `@prisma-next/migration-tools/io`, which performs hash-integrity checks
   * at the load boundary. Runners do not re-verify the plan and assume the
   * `(metadata, ops)` pair on disk has not been tampered with since emit.
   */
  execute(options: {
    readonly plan: MigrationPlan;
    readonly driver: ControlDriverInstance<TFamilyId, TTargetId>;
    readonly destinationContract: unknown;
    readonly policy: MigrationOperationPolicy;
    readonly callbacks?: {
      onOperationStart?(op: MigrationPlanOperation): void;
      onOperationComplete?(op: MigrationPlanOperation): void;
    };
    /**
     * Execution-time checks configuration.
     * All checks default to `true` (enabled) when omitted.
     */
    readonly executionChecks?: MigrationRunnerExecutionChecks;
    /**
     * Active framework components participating in this composition.
     * Families/targets can interpret this list to derive family-specific metadata.
     * All components must have matching familyId and targetId.
     */
    readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<TFamilyId, TTargetId>>;
  }): Promise<MigrationRunnerResult>;
}
/**
 * Optional capability interface for targets that support migrations.
 * Targets that implement migrations expose this via their descriptor.
 *
 * @template TFamilyId - The family ID (e.g., 'sql', 'document')
 * @template TTargetId - The target ID (e.g., 'postgres', 'mysql')
 * @template TFamilyInstance - The family instance type (e.g., SqlControlFamilyInstance)
 */
interface TargetMigrationsCapability<TFamilyId extends string = string, TTargetId extends string = string, TFamilyInstance extends ControlFamilyInstance<TFamilyId, unknown> = ControlFamilyInstance<TFamilyId, unknown>> {
  createPlanner(family: TFamilyInstance): MigrationPlanner<TFamilyId, TTargetId>;
  createRunner(family: TFamilyInstance): MigrationRunner<TFamilyId, TTargetId>;
  /**
   * Synthesizes a family-specific schema IR from a contract for offline planning.
   * The returned schema can be passed to `planner.plan({ schema })` as the "from" state.
   *
   * @param contract - The contract to convert, or null for a new project (empty schema).
   * @param frameworkComponents - Active framework components, used to derive database
   *   dependencies (e.g. extensions) that should be reflected in the schema IR.
   * @returns Family-specific schema IR (e.g., `SqlSchemaIR` for SQL targets).
   */
  contractToSchema(contract: Contract | null, frameworkComponents?: ReadonlyArray<TargetBoundComponentDescriptor<TFamilyId, TTargetId>>): unknown;
}
/**
 * Context for rendering migration source files.
 *
 * Kept minimal: only the paths a target might need to compute relative imports
 * (e.g. the contract `.d.ts` import for typed-contract builders). Passed to
 * `MigrationPlanner.emptyMigration(context)`.
 */
interface MigrationScaffoldContext {
  /** Absolute path to the migration package directory. Used by targets to compute relative imports. */
  readonly packageDir: string;
  /** Absolute path to the contract.json file, if one exists. Used by targets that emit typed-contract imports. */
  readonly contractJsonPath?: string;
  /**
   * Storage hash of the "from" contract, or `null` for a baseline scaffold
   * with no prior state. Targets use this to populate `describe()` on the
   * rendered empty migration so that identity metadata is correctly
   * populated.
   */
  readonly fromHash: string | null;
  /**
   * Storage hash of the "to" contract. Same purpose as `fromHash` — threaded
   * through so the rendered class's `describe()` declares the correct
   * destination identity.
   */
  readonly toHash: string;
}
//#endregion
//#region src/control/control-operation-preview.d.ts
/**
 * Family-agnostic textual preview of a migration plan, used by the CLI to
 * render a "DDL preview" section for `db init` / `db update` / `migration plan`
 * / `migration show`. Each statement carries a free-form `language` tag so
 * formatters can suffix `;` for SQL but render Mongo shell lines verbatim.
 *
 * Producers are family-specific: SQL emits `language: 'sql'` (existing DDL
 * extraction); Mongo emits `language: 'mongodb-shell'` via the
 * `MongoDdlCommandFormatter` visitor.
 *
 * The capability `OperationPreviewCapable` (declared in
 * `./control-capabilities`) is how a family announces it can produce these.
 */
interface OperationPreviewStatement {
  readonly text: string;
  /** Dialect identifier, e.g. `'sql'`, `'mongodb-shell'`. Free-form by design (OQ-3). */
  readonly language: string;
}
interface OperationPreview {
  readonly statements: readonly OperationPreviewStatement[];
}
//#endregion
//#region src/control/control-schema-view.d.ts
/**
 * Core schema view types for family-agnostic schema visualization.
 *
 * These types provide a minimal, generic, tree-shaped representation of schemas
 * across families, designed for CLI visualization and lightweight tooling.
 *
 * Families can optionally project their family-specific Schema IR into this
 * core view via the `toSchemaView` method on `FamilyInstance`.
 */
type SchemaNodeKind = 'root' | 'namespace' | 'collection' | 'entity' | 'field' | 'index' | 'dependency';
interface SchemaTreeVisitor<R> {
  visit(node: SchemaTreeNode): R;
}
interface SchemaTreeNodeOptions {
  readonly kind: SchemaNodeKind;
  readonly id: string;
  readonly label: string;
  readonly meta?: Record<string, unknown>;
  readonly children?: readonly SchemaTreeNode[];
}
declare class SchemaTreeNode {
  readonly kind: SchemaNodeKind;
  readonly id: string;
  readonly label: string;
  readonly meta?: Record<string, unknown>;
  readonly children?: readonly SchemaTreeNode[];
  constructor(options: SchemaTreeNodeOptions);
  accept<R>(visitor: SchemaTreeVisitor<R>): R;
}
/**
 * Core schema view providing a family-agnostic tree representation of a schema.
 * Used by CLI and cross-family tooling for visualization.
 */
interface CoreSchemaView {
  readonly root: SchemaTreeNode;
}
//#endregion
//#region src/control/control-capabilities.d.ts
interface MigratableTargetDescriptor<TFamilyId extends string, TTargetId extends string, TFamilyInstance extends ControlFamilyInstance<TFamilyId, unknown> = ControlFamilyInstance<TFamilyId, unknown>> extends ControlTargetDescriptor<TFamilyId, TTargetId> {
  readonly migrations: TargetMigrationsCapability<TFamilyId, TTargetId, TFamilyInstance>;
}
declare function hasMigrations<TFamilyId extends string, TTargetId extends string>(target: ControlTargetDescriptor<TFamilyId, TTargetId>): target is MigratableTargetDescriptor<TFamilyId, TTargetId>;
interface SchemaViewCapable<TSchemaIR = unknown> {
  toSchemaView(schema: TSchemaIR): CoreSchemaView;
}
declare function hasSchemaView<TFamilyId extends string, TSchemaIR>(instance: ControlFamilyInstance<TFamilyId, TSchemaIR>): instance is ControlFamilyInstance<TFamilyId, TSchemaIR> & SchemaViewCapable<TSchemaIR>;
/**
 * Capability declaring that a family can infer a PSL contract AST from its
 * opaque introspected schema IR. Consumed by `prisma-next contract infer`.
 */
interface PslContractInferCapable<TSchemaIR = unknown> {
  inferPslContract(schemaIR: TSchemaIR): PslDocumentAst;
}
declare function hasPslContractInfer<TFamilyId extends string, TSchemaIR>(instance: ControlFamilyInstance<TFamilyId, TSchemaIR>): instance is ControlFamilyInstance<TFamilyId, TSchemaIR> & PslContractInferCapable<TSchemaIR>;
/**
 * Capability declaring that a family can render a textual preview of migration
 * operations for the CLI's "DDL preview" output. SQL families emit
 * `language: 'sql'` statements; Mongo families emit `language: 'mongodb-shell'`.
 */
interface OperationPreviewCapable {
  toOperationPreview(operations: readonly MigrationPlanOperation[]): OperationPreview;
}
declare function hasOperationPreview<TFamilyId extends string, TSchemaIR>(instance: ControlFamilyInstance<TFamilyId, TSchemaIR>): instance is ControlFamilyInstance<TFamilyId, TSchemaIR> & OperationPreviewCapable;
//#endregion
export { type AssembledAuthoringContributions, type BaseSchemaIssue, type ControlAdapterDescriptor, type ControlAdapterInstance, type ControlDriverDescriptor, type ControlDriverInstance, type ControlExtensionDescriptor, type ControlExtensionInstance, type ControlFamilyDescriptor, type ControlFamilyInstance, type ControlMutationDefaultEntry, type ControlMutationDefaultRegistry, type ControlMutationDefaults, type ControlStack, type ControlTargetDescriptor, type ControlTargetInstance, type CoreSchemaView, type CreateControlStackInput, type DataTransformOperation, type DefaultFunctionLoweringContext, type DefaultFunctionLoweringHandler, type DefaultFunctionRegistry, type DefaultFunctionRegistryEntry, type EmitContractResult, type EnumValuesChangedIssue, type IntrospectSchemaResult, type LoweredDefaultResult, type LoweredDefaultValue, type MigratableTargetDescriptor, type MigrationOperationClass, type MigrationOperationPolicy, type MigrationPlan, type MigrationPlanOperation, type MigrationPlanWithAuthoringSurface, type MigrationPlanner, type MigrationPlannerConflict, type MigrationPlannerFailureResult, type MigrationPlannerResult, type MigrationPlannerSuccessResult, type MigrationRunner, type MigrationRunnerExecutionChecks, type MigrationRunnerFailure, type MigrationRunnerResult, type MigrationRunnerSuccessValue, type MigrationScaffoldContext, type MutationDefaultGeneratorDescriptor, type OpFactoryCall, type OperationContext, type OperationPreview, type OperationPreviewCapable, type OperationPreviewStatement, type ParsedDefaultFunctionCall, type PslContractInferCapable, type SchemaIssue, type SchemaNodeKind, SchemaTreeNode, type SchemaTreeNodeOptions, type SchemaTreeVisitor, type SchemaVerificationNode, type SchemaViewCapable, type SerializedQueryPlan, type SignDatabaseResult, type SourceDiagnostic, type SourceSpan, type TargetMigrationsCapability, VERIFY_CODE_HASH_MISMATCH, VERIFY_CODE_MARKER_MISSING, VERIFY_CODE_SCHEMA_FAILURE, VERIFY_CODE_TARGET_MISMATCH, type VerifyDatabaseResult, type VerifyDatabaseSchemaResult, assembleAuthoringContributions, assembleControlMutationDefaults, assembleScalarTypeDescriptors, assertUniqueCodecOwner, createControlStack, extractCodecLookup, extractCodecTypeImports, extractComponentIds, extractOperationTypeImports, extractQueryOperationTypeImports, hasMigrations, hasOperationPreview, hasPslContractInfer, hasSchemaView };
//# sourceMappingURL=control.d.mts.map
import { A as SqlPlannerFailureResult, C as SqlMigrationRunnerFailure, D as SqlPlannerConflict, E as SqlPlanTargetDetails, F as isDatabaseDependencyProvider, I as SchemaVerifyOptions, L as SqlControlFamilyInstance, M as SqlPlannerSuccessResult, N as StorageTypePlanResult, O as SqlPlannerConflictKind, P as collectInitDependencies, S as SqlMigrationRunnerExecuteOptions, T as SqlMigrationRunnerSuccessValue, _ as SqlMigrationPlanner, a as ComponentDatabaseDependency, b as SqlMigrationRunnerErrorCode, c as ResolveIdentityValueInput, d as SqlControlTargetDescriptor, f as SqlMigrationPlan, g as SqlMigrationPlanOperationTarget, h as SqlMigrationPlanOperationStep, i as ComponentDatabaseDependencies, j as SqlPlannerResult, k as SqlPlannerConflictLocation, l as SqlControlAdapterDescriptor, m as SqlMigrationPlanOperation, n as AnySqlMigrationOperation, o as CreateSqlMigrationPlanOptions, p as SqlMigrationPlanContractInfo, r as CodecControlHooks, s as ExpandNativeTypeInput, t as AnyRecord, u as SqlControlExtensionDescriptor, v as SqlMigrationPlannerPlanOptions, w as SqlMigrationRunnerResult, x as SqlMigrationRunnerExecuteCallbacks, y as SqlMigrationRunner } from "./types-gLyIyd2X.mjs";
import { ControlFamilyDescriptor, ControlStack, MigrationOperationClass, MigrationOperationPolicy, MigrationOperationPolicy as MigrationOperationPolicy$1, MigrationPlan, MigrationPlanOperation, MigrationPlanner, MigrationPlannerConflict, MigrationPlannerConflict as MigrationPlannerConflict$1, MigrationPlannerResult, TargetMigrationsCapability, assembleAuthoringContributions } from "@prisma-next/framework-components/control";
import { NotOk, Ok } from "@prisma-next/utils/result";
import * as _prisma_next_contract_types0 from "@prisma-next/contract/types";
import { ColumnDefault, Contract } from "@prisma-next/contract/types";
import { SqlSchemaIR } from "@prisma-next/sql-schema-ir/types";
import { TargetBoundComponentDescriptor } from "@prisma-next/framework-components/components";
import { SqlStorage, StorageColumn } from "@prisma-next/sql-contract/types";
import * as _prisma_next_framework_components_emission0 from "@prisma-next/framework-components/emission";

//#region src/core/control-descriptor.d.ts
declare class SqlFamilyDescriptor implements ControlFamilyDescriptor<'sql', SqlControlFamilyInstance> {
  readonly kind: "family";
  readonly id = "sql";
  readonly familyId: "sql";
  readonly version = "0.0.1";
  readonly emission: {
    readonly id: "sql";
    readonly validateTypes: (contract: _prisma_next_contract_types0.Contract, _ctx: _prisma_next_framework_components_emission0.ValidationContext) => void;
    readonly validateStructure: (contract: _prisma_next_contract_types0.Contract) => void;
    readonly generateStorageType: (contract: _prisma_next_contract_types0.Contract, storageHashTypeName: string) => string;
    readonly generateModelStorageType: (_modelName: string, model: _prisma_next_contract_types0.ContractModel) => string;
    readonly resolveFieldTypeParams: (_modelName: string, fieldName: string, model: _prisma_next_contract_types0.ContractModel, contract: _prisma_next_contract_types0.Contract) => Record<string, unknown> | undefined;
    readonly getFamilyImports: () => string[];
    readonly getFamilyTypeAliases: (options?: _prisma_next_framework_components_emission0.GenerateContractTypesOptions) => string;
    readonly getTypeMapsExpression: () => string;
    readonly getContractWrapper: (contractBaseName: string, typeMapsName: string) => string;
  };
  readonly authoring: {
    readonly field: {
      readonly uuid: {
        readonly kind: "fieldPreset";
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: 36;
          };
        };
      };
      readonly ulid: {
        readonly kind: "fieldPreset";
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: 26;
          };
        };
      };
      readonly nanoid: {
        readonly kind: "fieldPreset";
        readonly args: readonly [{
          readonly kind: "object";
          readonly optional: true;
          readonly properties: {
            readonly size: {
              readonly kind: "number";
              readonly optional: true;
              readonly integer: true;
              readonly minimum: 2;
              readonly maximum: 255;
            };
          };
        }];
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: {
              readonly kind: "arg";
              readonly index: 0;
              readonly path: readonly ["size"];
              readonly default: 21;
            };
          };
        };
      };
      readonly cuid2: {
        readonly kind: "fieldPreset";
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: 24;
          };
        };
      };
      readonly ksuid: {
        readonly kind: "fieldPreset";
        readonly output: {
          readonly codecId: "sql/char@1";
          readonly nativeType: "character";
          readonly typeParams: {
            readonly length: 27;
          };
        };
      };
      readonly id: {
        readonly uuidv4: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 36;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "uuidv4";
            };
            readonly id: true;
          };
        };
        readonly uuidv7: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 36;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "uuidv7";
            };
            readonly id: true;
          };
        };
        readonly ulid: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 26;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "ulid";
            };
            readonly id: true;
          };
        };
        readonly nanoid: {
          readonly kind: "fieldPreset";
          readonly args: readonly [{
            readonly kind: "object";
            readonly optional: true;
            readonly properties: {
              readonly size: {
                readonly kind: "number";
                readonly optional: true;
                readonly integer: true;
                readonly minimum: 2;
                readonly maximum: 255;
              };
            };
          }];
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: {
                readonly kind: "arg";
                readonly index: 0;
                readonly path: readonly ["size"];
                readonly default: 21;
              };
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "nanoid";
              readonly params: {
                readonly size: {
                  readonly kind: "arg";
                  readonly index: 0;
                  readonly path: readonly ["size"];
                };
              };
            };
            readonly id: true;
          };
        };
        readonly cuid2: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 24;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "cuid2";
            };
            readonly id: true;
          };
        };
        readonly ksuid: {
          readonly kind: "fieldPreset";
          readonly output: {
            readonly codecId: "sql/char@1";
            readonly nativeType: "character";
            readonly typeParams: {
              readonly length: 27;
            };
            readonly executionDefault: {
              readonly kind: "generator";
              readonly id: "ksuid";
            };
            readonly id: true;
          };
        };
      };
    };
    readonly type: {
      readonly sql: {
        readonly String: {
          readonly kind: "typeConstructor";
          readonly args: readonly [{
            readonly kind: "number";
            readonly name: "length";
            readonly integer: true;
            readonly minimum: 1;
            readonly maximum: 10485760;
          }];
          readonly output: {
            readonly codecId: "sql/varchar@1";
            readonly nativeType: "character varying";
            readonly typeParams: {
              readonly length: {
                readonly kind: "arg";
                readonly index: 0;
              };
            };
          };
        };
      };
    };
  };
  create<TTargetId extends string>(stack: ControlStack<'sql', TTargetId>): SqlControlFamilyInstance;
}
//#endregion
//#region src/core/assembly.d.ts
declare function extractCodecControlHooks(descriptors: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>>): Map<string, CodecControlHooks>;
//#endregion
//#region src/core/migrations/contract-to-schema-ir.d.ts
/**
 * Target-specific callback that expands a column's base `nativeType` and optional
 * `typeParams` into the fully-qualified type string used by the database
 * (e.g. `character` + `{ length: 36 }` → `character(36)`).
 *
 * This lives in the family layer as a callback rather than importing a concrete
 * implementation because each target (Postgres, MySQL, SQLite, …) has its own
 * parameterization syntax. The target wires its expander when calling
 * `contractToSchemaIR`, keeping the family layer target-agnostic.
 */
type NativeTypeExpander = (input: {
  readonly nativeType: string;
  readonly codecId?: string;
  readonly typeParams?: Record<string, unknown>;
}) => string;
/**
 * Target-specific callback that renders a `ColumnDefault` into the raw SQL literal
 * string stored in `SqlColumnIR.default`.
 *
 * Default value serialization is target-specific (quoting, casting, type syntax vary
 * between Postgres, MySQL, SQLite, …). This callback follows the same IoC pattern as
 * `NativeTypeExpander`: the target provides its renderer when calling
 * `contractToSchemaIR`, keeping the family layer target-agnostic.
 */
type DefaultRenderer = (def: ColumnDefault, column: StorageColumn) => string;
/**
 * Detects destructive changes between two contract storages.
 *
 * The additive-only planner silently ignores removals (tables, columns).
 * This function detects those removals so callers can report them as conflicts
 * rather than silently producing an empty plan.
 *
 * Returns an empty array if no destructive changes are found.
 */
declare function detectDestructiveChanges(from: SqlStorage | null, to: SqlStorage): readonly MigrationPlannerConflict$1[];
interface ContractToSchemaIROptions {
  readonly annotationNamespace: string;
  readonly expandNativeType?: NativeTypeExpander;
  readonly renderDefault?: DefaultRenderer;
  readonly frameworkComponents?: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>>;
}
/**
 * Converts a `Contract` to `SqlSchemaIR`.
 *
 * Reads `contract.storage` for tables, `contract.storage.types` for type
 * annotations, and derives database dependencies from `frameworkComponents`
 * (each component's `databaseDependencies.init[].id`).
 * Storage-type annotations are written under `options.annotationNamespace`.
 *
 * Drops codec metadata (`codecId`, `typeRef`) since the schema IR only represents
 * structural information. When `expandNativeType` is provided, parameterized types
 * are expanded (e.g. `character` + `{ length: 36 }` → `character(36)`) so the
 * resulting IR compares correctly against the "to" contract during planning.
 *
 * Returns an empty schema IR when `contract` is `null` (new project).
 */
declare function contractToSchemaIR(contract: Contract<SqlStorage> | null, options: ContractToSchemaIROptions): SqlSchemaIR;
//#endregion
//#region src/core/migrations/plan-helpers.d.ts
declare function createMigrationPlan<TTargetDetails>(options: CreateSqlMigrationPlanOptions<TTargetDetails>): SqlMigrationPlan<TTargetDetails>;
declare function plannerSuccess<TTargetDetails>(plan: SqlMigrationPlan<TTargetDetails>): SqlPlannerSuccessResult<TTargetDetails>;
declare function plannerFailure(conflicts: readonly SqlPlannerConflict[]): SqlPlannerFailureResult;
/**
 * Creates a successful migration runner result.
 */
declare function runnerSuccess(value: {
  operationsPlanned: number;
  operationsExecuted: number;
}): Ok<SqlMigrationRunnerSuccessValue>;
/**
 * Creates a failed migration runner result.
 */
declare function runnerFailure(code: SqlMigrationRunnerErrorCode, summary: string, options?: {
  why?: string;
  meta?: AnyRecord;
}): NotOk<SqlMigrationRunnerFailure>;
//#endregion
//#region src/core/migrations/policies.d.ts
/**
 * Policy used by `db init`: additive-only operations, no widening/destructive steps.
 */
declare const INIT_ADDITIVE_POLICY: MigrationOperationPolicy$1;
//#endregion
//#region src/exports/control.d.ts
declare const _default: SqlFamilyDescriptor;
//#endregion
export { type AnySqlMigrationOperation, type CodecControlHooks, type ComponentDatabaseDependencies, type ComponentDatabaseDependency, type ContractToSchemaIROptions, type CreateSqlMigrationPlanOptions, type DefaultRenderer, type ExpandNativeTypeInput, INIT_ADDITIVE_POLICY, type MigrationOperationClass, type MigrationOperationPolicy, type MigrationPlan, type MigrationPlanOperation, type MigrationPlanner, type MigrationPlannerConflict, type MigrationPlannerResult, type NativeTypeExpander, type ResolveIdentityValueInput, type SchemaVerifyOptions, type SqlControlAdapterDescriptor, type SqlControlExtensionDescriptor, type SqlControlFamilyInstance, type SqlControlTargetDescriptor, type SqlMigrationPlan, type SqlMigrationPlanContractInfo, type SqlMigrationPlanOperation, type SqlMigrationPlanOperationStep, type SqlMigrationPlanOperationTarget, type SqlMigrationPlanner, type SqlMigrationPlannerPlanOptions, type SqlMigrationRunner, type SqlMigrationRunnerErrorCode, type SqlMigrationRunnerExecuteCallbacks, type SqlMigrationRunnerExecuteOptions, type SqlMigrationRunnerFailure, type SqlMigrationRunnerResult, type SqlMigrationRunnerSuccessValue, type SqlPlanTargetDetails, type SqlPlannerConflict, type SqlPlannerConflictKind, type SqlPlannerConflictLocation, type SqlPlannerFailureResult, type SqlPlannerResult, type SqlPlannerSuccessResult, type StorageTypePlanResult, type TargetMigrationsCapability, assembleAuthoringContributions, collectInitDependencies, contractToSchemaIR, createMigrationPlan, _default as default, detectDestructiveChanges, extractCodecControlHooks, isDatabaseDependencyProvider, plannerFailure, plannerSuccess, runnerFailure, runnerSuccess };
//# sourceMappingURL=control.d.mts.map
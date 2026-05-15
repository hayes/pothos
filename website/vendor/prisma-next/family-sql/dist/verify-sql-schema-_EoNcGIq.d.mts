import { OperationContext, VerifyDatabaseSchemaResult } from "@prisma-next/framework-components/control";
import { ColumnDefault, Contract } from "@prisma-next/contract/types";
import { SqlSchemaIR } from "@prisma-next/sql-schema-ir/types";
import { TargetBoundComponentDescriptor } from "@prisma-next/framework-components/components";
import { SqlStorage } from "@prisma-next/sql-contract/types";

//#region src/core/schema-verify/verify-sql-schema.d.ts

/**
 * Function type for normalizing raw database default expressions into ColumnDefault.
 * Target-specific implementations handle database dialect differences.
 */
type DefaultNormalizer = (rawDefault: string, nativeType: string) => ColumnDefault | undefined;
/**
 * Function type for normalizing schema native types to canonical form for comparison.
 * Target-specific implementations handle dialect-specific type name variations
 * (e.g., Postgres 'varchar' → 'character varying', 'timestamptz' normalization).
 */
type NativeTypeNormalizer = (nativeType: string) => string;
/**
 * Options for the pure schema verification function.
 */
interface VerifySqlSchemaOptions {
  /** The validated SQL contract to verify against */
  readonly contract: Contract<SqlStorage>;
  /** The schema IR from introspection (or another source) */
  readonly schema: SqlSchemaIR;
  /** Whether to run in strict mode (detects extra tables/columns) */
  readonly strict: boolean;
  /** Optional operation context for metadata */
  readonly context?: OperationContext;
  /** Type metadata registry for codec consistency warnings */
  readonly typeMetadataRegistry: ReadonlyMap<string, {
    nativeType?: string;
  }>;
  /**
   * Active framework components participating in this composition.
   * All components must have matching familyId ('sql') and targetId.
   */
  readonly frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>>;
  /**
   * Optional target-specific normalizer for raw database default expressions.
   * When provided, schema defaults (raw strings) are normalized before comparison
   * with contract defaults (ColumnDefault objects).
   */
  readonly normalizeDefault?: DefaultNormalizer;
  /**
   * Optional target-specific normalizer for schema native type names.
   * When provided, schema native types are normalized before comparison
   * with contract native types (e.g., Postgres 'varchar' → 'character varying').
   */
  readonly normalizeNativeType?: NativeTypeNormalizer;
}
/**
 * Verifies that a SqlSchemaIR matches a Contract.
 *
 * This is a pure function that does NOT perform any database I/O.
 * It takes an already-introspected schema IR and compares it against
 * the contract requirements.
 *
 * @param options - Verification options
 * @returns VerifyDatabaseSchemaResult with verification tree and issues
 */
declare function verifySqlSchema(options: VerifySqlSchemaOptions): VerifyDatabaseSchemaResult;
//#endregion
export { verifySqlSchema as i, NativeTypeNormalizer as n, VerifySqlSchemaOptions as r, DefaultNormalizer as t };
//# sourceMappingURL=verify-sql-schema-_EoNcGIq.d.mts.map
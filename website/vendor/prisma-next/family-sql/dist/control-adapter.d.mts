import { n as NativeTypeNormalizer, t as DefaultNormalizer } from "./verify-sql-schema-_EoNcGIq.mjs";
import { ControlAdapterInstance, ControlDriverInstance, ControlStack } from "@prisma-next/framework-components/control";
import { ContractMarkerRecord } from "@prisma-next/contract/types";
import { AnyQueryAst, LoweredStatement, LowererContext } from "@prisma-next/sql-relational-core/ast";
import { SqlSchemaIR } from "@prisma-next/sql-schema-ir/types";

//#region src/core/control-adapter.d.ts

/**
 * SQL control adapter interface for control-plane operations.
 * Implemented by target-specific adapters (e.g., Postgres, MySQL).
 *
 * @template TTarget - The target ID (e.g., 'postgres', 'mysql')
 */
interface SqlControlAdapter<TTarget extends string = string> extends ControlAdapterInstance<'sql', TTarget> {
  /**
   * Reads the contract marker from the database, returning `null` if the marker
   * table or its row is missing. Implementations are responsible for the
   * dialect-specific existence probe (e.g. Postgres `information_schema.tables`
   * vs SQLite `sqlite_master`) and parameter placeholders.
   *
   * @param driver - ControlDriverInstance for executing queries (target-specific)
   * @returns Resolved marker record, or `null` if not yet stamped.
   */
  readMarker(driver: ControlDriverInstance<'sql', TTarget>): Promise<ContractMarkerRecord | null>;
  /**
   * Introspects a database schema and returns a raw SqlSchemaIR.
   *
   * This is a pure schema discovery operation that queries the database catalog
   * and returns the schema structure without type mapping or contract enrichment.
   * Type mapping and enrichment are handled separately by enrichment helpers.
   *
   * @param driver - ControlDriverInstance instance for executing queries (target-specific)
   * @param contract - Optional contract for contract-guided introspection (filtering, optimization)
   * @param schema - Schema name to introspect (defaults to 'public')
   * @returns Promise resolving to SqlSchemaIR representing the live database schema
   */
  introspect(driver: ControlDriverInstance<'sql', TTarget>, contract?: unknown, schema?: string): Promise<SqlSchemaIR>;
  /**
   * Optional target-specific normalizer for raw database default expressions.
   * When provided, schema defaults (raw strings) are normalized before comparison
   * with contract defaults (ColumnDefault objects) during schema verification.
   */
  readonly normalizeDefault?: DefaultNormalizer;
  /**
   * Optional target-specific normalizer for schema native type names.
   * When provided, schema native types (from introspection) are normalized
   * before comparison with contract native types during schema verification.
   */
  readonly normalizeNativeType?: NativeTypeNormalizer;
  /**
   * Lower a SQL query AST into a target-flavored `{ sql, params }` payload.
   *
   * Migration tooling (e.g. the `dataTransform` operation) needs to materialize
   * SQL at emit/plan time without instantiating the runtime adapter. The control
   * adapter's `lower` is byte-equivalent to the runtime adapter's `lower` for the
   * same AST and contract, ensuring planned SQL matches what the runtime would
   * emit.
   */
  lower(ast: AnyQueryAst, context: LowererContext<unknown>): LoweredStatement;
}
/**
 * SQL control adapter descriptor interface.
 * Provides a factory method to create control adapter instances.
 *
 * @template TTarget - The target ID (e.g., 'postgres', 'mysql')
 */
interface SqlControlAdapterDescriptor<TTarget extends string = string> {
  /**
   * Creates a SQL control adapter instance for control-plane operations.
   *
   * Receives the assembled `ControlStack` so adapters can read aggregated
   * metadata (codec lookup, extension contributions) when materializing.
   */
  create(stack: ControlStack<'sql', TTarget>): SqlControlAdapter<TTarget>;
}
//#endregion
export { type SqlControlAdapter, type SqlControlAdapterDescriptor };
//# sourceMappingURL=control-adapter.d.mts.map
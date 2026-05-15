//#region src/types.d.ts
/**
 * SQL Schema IR types for target-agnostic schema representation.
 *
 * These types represent the canonical in-memory representation of SQL schemas
 * for the SQL family, used for verification and future migration planning.
 */
/**
 * Primary key definition matching Contract format.
 * Defined here to avoid circular dependency with sql-contract.
 */
type PrimaryKey = {
  readonly columns: readonly string[];
  readonly name?: string;
};
/**
 * Namespaced annotations for extensibility.
 * Each namespace (e.g., 'pg', 'pgvector') owns its annotations.
 */
type SqlAnnotations = {
  readonly [namespace: string]: unknown;
};
/**
 * SQL column IR representing a column in a table.
 */
type SqlColumnIR = {
  readonly name: string;
  readonly nativeType: string;
  readonly nullable: boolean;
  readonly default?: string;
  readonly annotations?: SqlAnnotations;
};
/**
 * Referential action for foreign keys in the schema IR.
 * Defined here independently from the contract package to avoid coupling.
 */
type SqlReferentialAction = 'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault';
/**
 * SQL foreign key IR.
 */
type SqlForeignKeyIR = {
  readonly columns: readonly string[];
  readonly referencedTable: string;
  readonly referencedColumns: readonly string[];
  readonly name?: string;
  readonly onDelete?: SqlReferentialAction;
  readonly onUpdate?: SqlReferentialAction;
  readonly annotations?: SqlAnnotations;
};
/**
 * SQL unique constraint IR.
 */
type SqlUniqueIR = {
  readonly columns: readonly string[];
  readonly name?: string;
  readonly annotations?: SqlAnnotations;
};
/**
 * SQL index IR.
 */
type SqlIndexIR = {
  readonly columns: readonly string[];
  readonly name?: string;
  readonly unique: boolean;
  readonly annotations?: SqlAnnotations;
};
/**
 * SQL table IR representing a table in the schema.
 * Primary key format matches Contract for consistency.
 */
type SqlTableIR = {
  readonly name: string;
  readonly columns: Record<string, SqlColumnIR>;
  readonly primaryKey?: PrimaryKey;
  readonly foreignKeys: readonly SqlForeignKeyIR[];
  readonly uniques: readonly SqlUniqueIR[];
  readonly indexes: readonly SqlIndexIR[];
  readonly annotations?: SqlAnnotations;
};
type DependencyIR = {
  readonly id: string;
};
/**
 * SQL Schema IR representing the complete database schema.
 * This is the target-agnostic representation used for verification and migration planning.
 */
type SqlSchemaIR = {
  readonly tables: Record<string, SqlTableIR>;
  readonly annotations?: SqlAnnotations;
  readonly dependencies: readonly DependencyIR[];
};
/**
 * SQL type metadata for control-plane and execution-plane type availability and mapping.
 * This abstraction provides a read-only view of type information without encode/decode behavior.
 */
interface SqlTypeMetadata {
  /**
   * Namespaced type identifier in format 'namespace/name@version'
   * Examples: 'pg/int4@1', 'pg/text@1', 'pg/timestamptz@1'
   */
  readonly typeId: string;
  /**
   * Contract scalar type IDs that this type can handle.
   * Examples: ['text'], ['int4', 'float8'], ['timestamp', 'timestamptz']
   */
  readonly targetTypes: readonly string[];
  /**
   * Native database type name (target-specific).
   * Examples: 'integer', 'text', 'character varying', 'timestamp with time zone'
   * This is optional because not all types have a native database representation.
   */
  readonly nativeType?: string;
}
/**
 * Registry interface for SQL type metadata.
 * Provides read-only iteration over type metadata entries.
 */
interface SqlTypeMetadataRegistry {
  /**
   * Returns an iterator over all type metadata entries.
   */
  values(): IterableIterator<SqlTypeMetadata>;
}
//#endregion
export { SqlForeignKeyIR as a, SqlSchemaIR as c, SqlTypeMetadataRegistry as d, SqlUniqueIR as f, SqlColumnIR as i, SqlTableIR as l, PrimaryKey as n, SqlIndexIR as o, SqlAnnotations as r, SqlReferentialAction as s, DependencyIR as t, SqlTypeMetadata as u };
//# sourceMappingURL=types-BmyESSa6.d.mts.map
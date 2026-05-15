import { C as ReferentialAction, f as ForeignKey, k as SqlStorage, m as ForeignKeyReferences } from "./types-D1QODyT3.mjs";
import { Contract } from "@prisma-next/contract/types";
import * as arktype_internal_variants_object_ts0 from "arktype/internal/variants/object.ts";
import * as arktype_internal_variants_string_ts0 from "arktype/internal/variants/string.ts";

//#region src/validators.d.ts
type ColumnDefaultLiteral = {
  readonly kind: 'literal';
  readonly value: string | number | boolean | Record<string, unknown> | unknown[] | null;
};
type ColumnDefaultFunction = {
  readonly kind: 'function';
  readonly expression: string;
};
declare const ColumnDefaultLiteralSchema: arktype_internal_variants_object_ts0.ObjectType<ColumnDefaultLiteral, {}>;
declare const ColumnDefaultFunctionSchema: arktype_internal_variants_object_ts0.ObjectType<ColumnDefaultFunction, {}>;
declare const ColumnDefaultSchema: arktype_internal_variants_object_ts0.ObjectType<ColumnDefaultLiteral | ColumnDefaultFunction, {}>;
declare const IndexSchema: arktype_internal_variants_object_ts0.ObjectType<{
  columns: readonly string[];
  name?: string;
  using?: string;
  config?: Record<string, unknown>;
}, {}>;
declare const ForeignKeyReferencesSchema: arktype_internal_variants_object_ts0.ObjectType<ForeignKeyReferences, {}>;
declare const ReferentialActionSchema: arktype_internal_variants_string_ts0.StringType<ReferentialAction, {}>;
declare const ForeignKeySchema: arktype_internal_variants_object_ts0.ObjectType<ForeignKey, {}>;
/**
 * Validates the structural shape of SqlStorage using Arktype.
 *
 * @param value - The storage value to validate
 * @returns The validated storage if structure is valid
 * @throws Error if the storage structure is invalid
 */
declare function validateStorage(value: unknown): SqlStorage;
declare function validateModel(value: unknown): unknown;
/**
 * Validates the structural shape of an SQL contract using Arktype.
 *
 * Ensures all required fields are present and have the correct types,
 * including SQL-specific storage structure (tables, columns, constraints).
 *
 * @param value - The contract value to validate (typically from a JSON import)
 * @returns The validated contract if structure is valid
 * @throws ContractValidationError if the contract structure is invalid
 */
declare function validateSqlContract<T extends Contract<SqlStorage>>(value: unknown): T;
/**
 * Validates semantic constraints on SqlStorage that cannot be expressed in Arktype schemas.
 *
 * Returns an array of human-readable error strings. Empty array = valid.
 *
 * Currently checks:
 * - duplicate named primary key / unique / index / foreign key objects within a table
 * - duplicate unique, index, or foreign key declarations within a table
 * - `setNull` referential action on a non-nullable FK column (would fail at runtime)
 * - `setDefault` referential action on a non-nullable FK column without a DEFAULT (would fail at runtime)
 */
declare function validateStorageSemantics(storage: SqlStorage): string[];
//#endregion
export { ColumnDefaultFunctionSchema, ColumnDefaultLiteralSchema, ColumnDefaultSchema, ForeignKeyReferencesSchema, ForeignKeySchema, IndexSchema, ReferentialActionSchema, validateModel, validateSqlContract, validateStorage, validateStorageSemantics };
//# sourceMappingURL=validators.d.mts.map
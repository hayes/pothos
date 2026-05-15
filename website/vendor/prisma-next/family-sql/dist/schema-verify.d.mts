import { i as verifySqlSchema, n as NativeTypeNormalizer, r as VerifySqlSchemaOptions } from "./verify-sql-schema-_EoNcGIq.mjs";
import { a as ComponentDatabaseDependency } from "./types-gLyIyd2X.mjs";
import { SchemaIssue, SchemaVerificationNode } from "@prisma-next/framework-components/control";
import { SqlIndexIR, SqlSchemaIR, SqlUniqueIR } from "@prisma-next/sql-schema-ir/types";

//#region src/core/schema-verify/verify-helpers.d.ts

/**
 * Compares two arrays of strings for equality (order-sensitive).
 */
declare function arraysEqual(a: readonly string[], b: readonly string[]): boolean;
/**
 * Checks if a unique constraint requirement is satisfied by the given columns.
 *
 * Semantic satisfaction: a unique constraint requirement can be satisfied by:
 * - A unique constraint with the same columns, OR
 * - A unique index with the same columns
 *
 * @param uniques - The unique constraints in the schema table
 * @param indexes - The indexes in the schema table
 * @param columns - The columns required by the unique constraint
 * @returns true if the requirement is satisfied
 */
declare function isUniqueConstraintSatisfied(uniques: readonly SqlUniqueIR[], indexes: readonly SqlIndexIR[], columns: readonly string[]): boolean;
/**
 * Checks if an index requirement is satisfied by the given columns.
 *
 * Semantic satisfaction: a non-unique index requirement can be satisfied by:
 * - Any index (unique or non-unique) with the same columns, OR
 * - A unique constraint with the same columns (stronger satisfies weaker)
 *
 * @param indexes - The indexes in the schema table
 * @param uniques - The unique constraints in the schema table
 * @param columns - The columns required by the index
 * @returns true if the requirement is satisfied
 */
declare function isIndexSatisfied(indexes: readonly SqlIndexIR[], uniques: readonly SqlUniqueIR[], columns: readonly string[]): boolean;
/**
 * Verifies database dependencies are installed using component-owned verification hooks.
 * Checks whether each dependency is satisfied by verifying its id is present in
 * schema.dependencies (populated from introspection).
 *
 * Returns verification nodes for the tree.
 */
declare function verifyDatabaseDependencies(dependencies: ReadonlyArray<ComponentDatabaseDependency<unknown>>, schema: SqlSchemaIR, issues: SchemaIssue[]): SchemaVerificationNode[];
//#endregion
export { type NativeTypeNormalizer, type VerifySqlSchemaOptions, arraysEqual, isIndexSatisfied, isUniqueConstraintSatisfied, verifyDatabaseDependencies, verifySqlSchema };
//# sourceMappingURL=schema-verify.d.mts.map
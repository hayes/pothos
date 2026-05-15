import { G as ParamRef, h as ColumnRef } from "./types-B4dL4lc3.mjs";
import { r as ExecutionContext } from "./query-lane-context-BF-wuc0r.mjs";
import { t as SqlExecutionPlan } from "./sql-execution-plan-Dgx7BGin.mjs";
import { Contract } from "@prisma-next/contract/types";
import { ParamSpec } from "@prisma-next/operations";
import { SqlLoweringSpec } from "@prisma-next/sql-operations";
import { ExtractFieldOutputTypes, SqlStorage, StorageColumn } from "@prisma-next/sql-contract/types";

//#region src/types.d.ts
type Expr = ColumnRef | ParamRef;
/**
 * Extracts the model name for a given table by iterating models to find the one
 * whose `storage.table` matches.
 */
type ExtractTableToModel<TContract extends Contract<SqlStorage>, TableName extends string> = TContract['models'] extends infer Models extends Record<string, unknown> ? { [M in keyof Models & string]: Models[M] extends {
  readonly storage: {
    readonly table: TableName;
  };
} ? M : never }[keyof Models & string] : never;
/**
 * Extracts the field name for a given column by finding the field in
 * `model.storage.fields` whose `column` matches.
 */
type ExtractColumnToField<TContract extends Contract<SqlStorage>, TableName extends string, ColumnName extends string> = ExtractTableToModel<TContract, TableName> extends infer ModelName extends string ? TContract['models'] extends infer Models extends Record<string, unknown> ? ModelName & keyof Models extends infer MKey extends string ? Models[MKey] extends {
  readonly storage: {
    readonly fields: infer Fields extends Record<string, unknown>;
  };
} ? { [F in keyof Fields & string]: Fields[F] extends {
  readonly column: ColumnName;
} ? F : never }[keyof Fields & string] : never : never : never : never;
type FallbackCodecLookup<ColumnMeta extends StorageColumn, CodecTypes$1 extends Record<string, {
  readonly output: unknown;
}>> = ColumnMeta extends {
  codecId: infer CodecId extends string;
} ? CodecId extends keyof CodecTypes$1 ? CodecTypes$1[CodecId] extends {
  readonly output: infer O;
} ? ColumnMeta extends {
  nullable: true;
} ? O | null : O : unknown : unknown : unknown;
/**
 * Type-level operation signature.
 * Represents an operation at the type level for use in contract type maps.
 */
type OperationTypeSignature = {
  readonly args: ReadonlyArray<ParamSpec>;
  readonly returns: ParamSpec;
  readonly lowering: SqlLoweringSpec;
  readonly capabilities?: ReadonlyArray<string>;
};
/**
 * Type-level operation registry.
 * Maps typeId → operations, where operations is a record of method name → operation signature.
 *
 * Example:
 * ```typescript
 * type MyOperations: OperationTypes = {
 *   'pg/vector@1': {
 *     cosineDistance: {
 *       args: [{ codecId: 'pg/vector@1'; nullable: false }];
 *       returns: { codecId: 'core/float8'; nullable: false };
 *       lowering: { targetFamily: 'sql'; strategy: 'function'; template: '...' };
 *     };
 *   };
 * };
 * ```
 */
type OperationTypes = Record<string, Record<string, OperationTypeSignature>>;
/**
 * CodecTypes represents a map of typeId to codec definitions.
 * Each codec definition must have an `output` property indicating the JavaScript type.
 *
 * Example:
 * ```typescript
 * type MyCodecTypes: CodecTypes = {
 *   'pg/int4@1': { output: number };
 *   'pg/text@1': { output: string };
 * };
 * ```
 */
type CodecTypes = Record<string, {
  readonly output: unknown;
}>;
/**
 * Extracts operations for a given typeId from the operation registry.
 * Returns an empty record if the typeId is not found.
 *
 * @example
 * ```typescript
 * type Ops = OperationsForTypeId<'pg/vector@1', MyOperations>;
 * // Ops = { cosineDistance: { ... }, l2Distance: { ... } }
 * ```
 */
type OperationsForTypeId<TypeId extends string, Operations extends OperationTypes> = Operations extends Record<string, never> ? Record<string, never> : TypeId extends keyof Operations ? Operations[TypeId] : Record<string, never>;
type ComputeColumnJsType<TContract extends Contract<SqlStorage>, TableName extends string, ColumnName extends string, ColumnMeta extends StorageColumn, CodecTypes$1 extends Record<string, {
  readonly output: unknown;
}>> = ExtractTableToModel<TContract, TableName> extends infer ModelName ? [ModelName] extends [never] ? FallbackCodecLookup<ColumnMeta, CodecTypes$1> : ModelName extends string ? ExtractColumnToField<TContract, TableName, ColumnName> extends infer FieldName ? [FieldName] extends [never] ? FallbackCodecLookup<ColumnMeta, CodecTypes$1> : FieldName extends string ? ModelName extends keyof ExtractFieldOutputTypes<TContract> ? FieldName extends keyof ExtractFieldOutputTypes<TContract>[ModelName] ? ExtractFieldOutputTypes<TContract>[ModelName][FieldName] : never : never : never : never : never : never;
/**
 * Utility type to check if a contract has the required capabilities for includeMany.
 * Requires both `lateral` and `jsonAgg` to be `true` in the contract's capabilities for the target.
 * Capabilities are nested by target: `{ [target]: { lateral: true, jsonAgg: true } }`
 */
type HasIncludeManyCapabilities<TContract extends Contract<SqlStorage>> = TContract extends {
  capabilities: infer C;
  target: infer T;
} ? T extends string ? C extends Record<string, Record<string, boolean>> ? C extends { [K in T]: infer TargetCaps } ? TargetCaps extends {
  lateral: true;
  jsonAgg: true;
} ? true : false : false : false : false : false;
/**
 * Alias for the SQL-domain executable plan, exposed under the legacy
 * `SqlPlan` name for compatibility with SQL builder/utility call sites.
 * The canonical name is `SqlExecutionPlan` (`./sql-execution-plan`).
 */
type SqlPlan<Row = unknown> = SqlExecutionPlan<Row>;
/**
 * Helper types for extracting contract structure.
 */
type TablesOf<TContract> = TContract extends {
  storage: {
    tables: infer U;
  };
} ? U : never;
type TableKey<TContract> = Extract<keyof TablesOf<TContract>, string>;
/**
 * Unique symbol for metadata property to avoid collisions with user-defined properties
 */
declare const META: unique symbol;
/**
 * Extracts metadata from a type that has a META property
 */
type Meta<T$1 extends {
  [META]: unknown;
}> = T$1[typeof META];
/**
 * Metadata interface for table definitions
 */
interface TableMetadata<Name extends string> {
  name: Name;
}
/**
 * Metadata interface for model definitions
 */
interface ModelMetadata<Name extends string> {
  name: Name;
}
/**
 * Base interface for table definitions with metadata
 * Used in contract.d.ts to define storage-level table types
 */
interface TableDef<Name extends string> {
  readonly [META]: TableMetadata<Name>;
}
/**
 * Base interface for model definitions with metadata
 * Used in contract.d.ts to define application-level model types
 */
interface ModelDef<Name extends string> {
  readonly [META]: ModelMetadata<Name>;
}
type ColumnsOf<TContract, K extends TableKey<TContract>> = K extends keyof TablesOf<TContract> ? TablesOf<TContract>[K] extends {
  columns: infer C;
} ? C : never : never;
interface RawTemplateOptions {
  readonly annotations?: Record<string, unknown>;
}
interface RawFunctionOptions extends RawTemplateOptions {
  readonly params: ReadonlyArray<unknown>;
}
type RawTemplateFactory = (strings: TemplateStringsArray, ...values: readonly unknown[]) => SqlExecutionPlan;
interface RawFactory extends RawTemplateFactory {
  (text: string, options: RawFunctionOptions): SqlExecutionPlan;
  with(options: RawTemplateOptions): RawTemplateFactory;
}
interface RuntimeError extends Error {
  readonly code: string;
  readonly category: 'PLAN';
  readonly severity: 'error';
  readonly details?: Record<string, unknown>;
  readonly hints?: readonly string[];
  readonly docs?: readonly string[];
}
interface BuildParamsMap {
  readonly [name: string]: unknown;
}
interface BuildOptions {
  readonly params?: BuildParamsMap;
}
interface SqlBuilderOptions<TContract extends Contract<SqlStorage> = Contract<SqlStorage>> {
  readonly context: ExecutionContext<TContract>;
}
//#endregion
export { TableKey as C, TableDef as S, TablesOf as T, RawTemplateFactory as _, ComputeColumnJsType as a, SqlBuilderOptions as b, META as c, ModelMetadata as d, OperationTypeSignature as f, RawFunctionOptions as g, RawFactory as h, ColumnsOf as i, Meta as l, OperationsForTypeId as m, BuildParamsMap as n, Expr as o, OperationTypes as p, CodecTypes as r, HasIncludeManyCapabilities as s, BuildOptions as t, ModelDef as u, RawTemplateOptions as v, TableMetadata as w, SqlPlan as x, RuntimeError as y };
//# sourceMappingURL=types-BWOCTYd8.d.mts.map
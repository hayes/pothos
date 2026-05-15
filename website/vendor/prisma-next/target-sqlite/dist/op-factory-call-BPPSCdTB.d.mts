import { t as SqlitePlanTargetDetails } from "./planner-target-details-DTIFFx4L.mjs";
import { i as SqliteTableSpec, n as SqliteColumnSpec, r as SqliteIndexSpec } from "./shared-BNtoZqdo.mjs";
import { MigrationOperationClass, SqlMigrationPlanOperation } from "@prisma-next/family-sql/control";
import { ImportRequirement, TsExpression } from "@prisma-next/ts-render";
import { OpFactoryCall } from "@prisma-next/framework-components/control";

//#region src/core/migrations/op-factory-call.d.ts

type Op = SqlMigrationPlanOperation<SqlitePlanTargetDetails>;
declare abstract class SqliteOpFactoryCallNode extends TsExpression implements OpFactoryCall {
  abstract readonly factoryName: string;
  abstract readonly operationClass: MigrationOperationClass;
  abstract readonly label: string;
  abstract toOp(): Op;
  importRequirements(): readonly ImportRequirement[];
  protected freeze(): void;
}
declare class CreateTableCall extends SqliteOpFactoryCallNode {
  readonly factoryName: "createTable";
  readonly operationClass: "additive";
  readonly tableName: string;
  readonly spec: SqliteTableSpec;
  readonly label: string;
  constructor(tableName: string, spec: SqliteTableSpec);
  toOp(): Op;
  renderTypeScript(): string;
}
declare class DropTableCall extends SqliteOpFactoryCallNode {
  readonly factoryName: "dropTable";
  readonly operationClass: "destructive";
  readonly tableName: string;
  readonly label: string;
  constructor(tableName: string);
  toOp(): Op;
  renderTypeScript(): string;
}
declare class RecreateTableCall extends SqliteOpFactoryCallNode {
  readonly factoryName: "recreateTable";
  readonly operationClass: MigrationOperationClass;
  readonly tableName: string;
  readonly contractTable: SqliteTableSpec;
  readonly schemaColumnNames: readonly string[];
  readonly indexes: readonly SqliteIndexSpec[];
  readonly summary: string;
  readonly postchecks: readonly {
    readonly description: string;
    readonly sql: string;
  }[];
  readonly label: string;
  constructor(args: {
    tableName: string;
    contractTable: SqliteTableSpec;
    schemaColumnNames: readonly string[];
    indexes: readonly SqliteIndexSpec[];
    summary: string;
    postchecks: readonly {
      readonly description: string;
      readonly sql: string;
    }[];
    operationClass: MigrationOperationClass;
  });
  toOp(): Op;
  renderTypeScript(): string;
}
declare class AddColumnCall extends SqliteOpFactoryCallNode {
  readonly factoryName: "addColumn";
  readonly operationClass: "additive";
  readonly tableName: string;
  readonly columnName: string;
  readonly column: SqliteColumnSpec;
  readonly label: string;
  constructor(tableName: string, column: SqliteColumnSpec);
  toOp(): Op;
  renderTypeScript(): string;
}
declare class DropColumnCall extends SqliteOpFactoryCallNode {
  readonly factoryName: "dropColumn";
  readonly operationClass: "destructive";
  readonly tableName: string;
  readonly columnName: string;
  readonly label: string;
  constructor(tableName: string, columnName: string);
  toOp(): Op;
  renderTypeScript(): string;
}
declare class CreateIndexCall extends SqliteOpFactoryCallNode {
  readonly factoryName: "createIndex";
  readonly operationClass: "additive";
  readonly tableName: string;
  readonly indexName: string;
  readonly columns: readonly string[];
  readonly label: string;
  constructor(tableName: string, indexName: string, columns: readonly string[]);
  toOp(): Op;
  renderTypeScript(): string;
}
declare class DropIndexCall extends SqliteOpFactoryCallNode {
  readonly factoryName: "dropIndex";
  readonly operationClass: "destructive";
  readonly tableName: string;
  readonly indexName: string;
  readonly label: string;
  constructor(tableName: string, indexName: string);
  toOp(): Op;
  renderTypeScript(): string;
}
/**
 * A planner-generated data-transform stub. The current default strategy
 * (`nullabilityTighteningBackfillStrategy`) emits one of these with a
 * backfill-flavored `id`/`label` when the policy allows `'data'` and the
 * contract tightens a column's nullability, but the op itself is generic —
 * any future strategy that needs a placeholder data step can construct one
 * with its own id/label.
 *
 * `toOp()` always throws `PN-MIG-2001`: the planner cannot lower a stubbed
 * transform to a runtime op — the user must edit the rendered
 * `migration.ts` and re-emit.
 */
declare class DataTransformCall extends SqliteOpFactoryCallNode {
  readonly factoryName: "dataTransform";
  readonly operationClass: "data";
  readonly id: string;
  readonly label: string;
  readonly tableName: string;
  readonly columnName: string;
  constructor(id: string, label: string, tableName: string, columnName: string);
  toOp(): Op;
  renderTypeScript(): string;
  importRequirements(): readonly ImportRequirement[];
}
type SqliteOpFactoryCall = CreateTableCall | DropTableCall | RecreateTableCall | AddColumnCall | DropColumnCall | CreateIndexCall | DropIndexCall | DataTransformCall;
//#endregion
export { DropColumnCall as a, RecreateTableCall as c, DataTransformCall as i, SqliteOpFactoryCall as l, CreateIndexCall as n, DropIndexCall as o, CreateTableCall as r, DropTableCall as s, AddColumnCall as t };
//# sourceMappingURL=op-factory-call-BPPSCdTB.d.mts.map
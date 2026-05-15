import "@prisma-next/driver-sqlite/runtime";
import { orm } from "@prisma-next/sql-orm-client";
import { ExecutionContext, Runtime, RuntimeVerifyOptions, SqlExecutionStackWithDriver, SqlMiddleware, SqlRuntimeExtensionDescriptor } from "@prisma-next/sql-runtime";
import { Contract } from "@prisma-next/contract/types";
import { Db } from "@prisma-next/sql-builder/types";
import { SqlStorage } from "@prisma-next/sql-contract/types";

//#region src/runtime/binding.d.ts
type SqliteBindingInput = {
  readonly path: string;
};
//#endregion
//#region src/runtime/sqlite.d.ts
type SqliteTargetId = 'sqlite';
type OrmClient<TContract extends Contract<SqlStorage>> = ReturnType<typeof orm<TContract>>;
interface SqliteClient<TContract extends Contract<SqlStorage>> {
  readonly sql: Db<TContract>;
  readonly orm: OrmClient<TContract>;
  readonly context: ExecutionContext<TContract>;
  readonly stack: SqlExecutionStackWithDriver<SqliteTargetId>;
  connect(bindingInput?: {
    readonly path: string;
  }): Promise<Runtime>;
  runtime(): Runtime;
}
interface SqliteOptionsBase {
  readonly extensions?: readonly SqlRuntimeExtensionDescriptor<SqliteTargetId>[];
  readonly middleware?: readonly SqlMiddleware[];
  readonly verify?: RuntimeVerifyOptions;
}
type SqliteOptionsWithContract<TContract extends Contract<SqlStorage>> = {
  readonly path?: string;
} & SqliteOptionsBase & {
  readonly contract: TContract;
  readonly contractJson?: never;
};
type SqliteOptionsWithContractJson<TContract extends Contract<SqlStorage>> = {
  readonly path?: string;
  readonly _contract?: TContract;
} & SqliteOptionsBase & {
  readonly contractJson: unknown;
  readonly contract?: never;
};
type SqliteOptions<TContract extends Contract<SqlStorage>> = SqliteOptionsWithContract<TContract> | SqliteOptionsWithContractJson<TContract>;
declare function sqlite<TContract extends Contract<SqlStorage>>(options: SqliteOptionsWithContract<TContract>): SqliteClient<TContract>;
declare function sqlite<TContract extends Contract<SqlStorage>>(options: SqliteOptionsWithContractJson<TContract>): SqliteClient<TContract>;
//#endregion
export { type SqliteBindingInput, type SqliteClient, type SqliteOptions, type SqliteOptionsBase, type SqliteOptionsWithContract, type SqliteOptionsWithContractJson, type SqliteTargetId, sqlite as default };
//# sourceMappingURL=runtime.d.mts.map
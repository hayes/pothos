/**
 * Static bundle of @prisma-next/* runtime modules exposed to playground
 * user code. The packages come from the published npm `@prisma-next/*`
 * install. The one exception is `@prisma-next/driver-sqlite`, whose
 * upstream build targets Node's `node:sqlite` (unavailable in the
 * browser): `next.config.mjs` aliases `@prisma-next/driver-sqlite` to the
 * hand-written sql.js-backed shim at `lib/playground/prisma-next/
 * driver-sqlite/`, which also adds the `/seed` registry the demos use.
 *
 * User code imports these by their npm names. The modules are registered
 * with the playground's example-stub registry (`example-stubs.ts`), so
 * the execution engine hands them to user code instead of fetching them
 * from esm.sh — that keeps a single `@prisma-next/*` instance shared with
 * the statically bundled `@pothos/plugin-prisma-next`.
 */

'use client';

import * as AdapterSqliteRuntime from '@prisma-next/adapter-sqlite/runtime';
import * as AdapterSqliteTypes from '@prisma-next/adapter-sqlite/types';
import * as ContractTypes from '@prisma-next/contract/types';
import * as DriverSqliteRuntime from '@prisma-next/driver-sqlite/runtime';
import * as DriverSqliteSeed from '@prisma-next/driver-sqlite/seed';
import * as SqlContractTypes from '@prisma-next/sql-contract/types';
import * as SqlContractValidate from '@prisma-next/sql-contract/validators';
import * as SqlOrmClient from '@prisma-next/sql-orm-client';
import * as SqliteRuntime from '@prisma-next/sqlite/runtime';
import { registerExampleStubs } from './example-stubs';
import * as PlaygroundCapture from './prisma-next';

// Subpath-keyed: user code imports by exact subpath (e.g.
// `@prisma-next/sqlite/runtime`), so the keys mirror what the import
// specifier scan captures.
//
// `@pothos/playground-capture` is a synthetic specifier — there is no
// such npm package. The stub registry resolves it to our in-tree
// capture middleware so demo `db.ts` can `import { capturePlaygroundSql }`
// without learning about the website's internal file layout.
export const prismaNextModules: Record<string, unknown> = {
  '@prisma-next/sqlite/runtime': SqliteRuntime,
  '@prisma-next/sql-orm-client': SqlOrmClient,
  '@prisma-next/contract/types': ContractTypes,
  '@prisma-next/sql-contract/types': SqlContractTypes,
  '@prisma-next/sql-contract/validators': SqlContractValidate,
  '@prisma-next/adapter-sqlite/runtime': AdapterSqliteRuntime,
  '@prisma-next/adapter-sqlite/types': AdapterSqliteTypes,
  '@prisma-next/driver-sqlite/runtime': DriverSqliteRuntime,
  '@prisma-next/driver-sqlite/seed': DriverSqliteSeed,
  '@pothos/playground-capture': PlaygroundCapture,
};

registerExampleStubs(prismaNextModules);

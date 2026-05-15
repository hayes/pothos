/**
 * Static bundle of @prisma-next/* runtime modules exposed to playground
 * user code. The packages are vendored under `website/vendor/prisma-next/`
 * (see `scripts/vendor-prisma-next.ts`); the sql.js-backed driver lives
 * at `website/vendor/prisma-next/driver-sqlite/` and replaces the
 * upstream Node-only one.
 *
 * User code imports these by their npm names; getPrismaNextModules()
 * scans for those import specifiers and returns the resolved modules so
 * the playground's __require shim can hand them to `new Function()`.
 */

'use client';

import * as AdapterSqliteRuntime from '@prisma-next/adapter-sqlite/runtime';
import * as AdapterSqliteTypes from '@prisma-next/adapter-sqlite/types';
import * as ContractTypes from '@prisma-next/contract/types';
import * as DriverSqliteRuntime from '@prisma-next/driver-sqlite/runtime';
import * as DriverSqliteSeed from '@prisma-next/driver-sqlite/seed';
import * as SqlContractTypes from '@prisma-next/sql-contract/types';
import * as SqlContractValidate from '@prisma-next/sql-contract/validate';
import * as SqlOrmClient from '@prisma-next/sql-orm-client';
import * as SqliteRuntime from '@prisma-next/sqlite/runtime';
import * as PlaygroundCapture from './prisma-next';

// Subpath-keyed: user code imports by exact subpath (e.g.
// `@prisma-next/sqlite/runtime`), so the keys mirror what the import
// regex captures. Falsy entries are stripped before exposure.
//
// `@pothos/playground-capture` is a synthetic specifier — there is no
// such npm package. The playground bundler resolves it to our in-tree
// capture utilities so demo `db.ts` can `import { capturePlaygroundSql }`
// without learning about the website's internal file layout.
export const prismaNextModules: Record<string, unknown> = {
  '@prisma-next/sqlite/runtime': SqliteRuntime,
  '@prisma-next/sql-orm-client': SqlOrmClient,
  '@prisma-next/contract/types': ContractTypes,
  '@prisma-next/sql-contract/types': SqlContractTypes,
  '@prisma-next/sql-contract/validate': SqlContractValidate,
  '@prisma-next/adapter-sqlite/runtime': AdapterSqliteRuntime,
  '@prisma-next/adapter-sqlite/types': AdapterSqliteTypes,
  '@prisma-next/driver-sqlite/runtime': DriverSqliteRuntime,
  '@prisma-next/driver-sqlite/seed': DriverSqliteSeed,
  '@pothos/playground-capture': PlaygroundCapture,
};

// Match `@prisma-next/...` AND the synthetic `@pothos/playground-capture`
// specifier. Per-specifier presence in `prismaNextModules` is the final
// filter — unrelated `@pothos/*` plugin imports fall through to the
// pothos plugin bundler.
const SCANNED_IMPORT_RE =
  /import\s+[\s\S]*?\s+from\s+['"](@prisma-next\/[^'"]+|@pothos\/playground-capture)['"]/g;

export function getPrismaNextModules(code: string): Record<string, unknown> {
  const modules: Record<string, unknown> = {};

  SCANNED_IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null = SCANNED_IMPORT_RE.exec(code);
  while (match !== null) {
    const specifier = match[1];
    if (specifier in prismaNextModules) {
      modules[specifier] = prismaNextModules[specifier];
    }
    match = SCANNED_IMPORT_RE.exec(code);
  }
  return modules;
}

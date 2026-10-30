'use client';

import * as PrismaNextModule from '@pothos/plugin-prisma-next';
import * as OrmClient from '@prisma/orm-family-sql/orm-client';
import * as SqliteStatic from '@prisma/orm-sqlite/static';
import { sqliteRuntime } from './capture';
import * as NodeSqlite from './node-sqlite';

let prepared: Promise<Record<string, unknown>> | undefined;

/** The module map for examples using the ORM, available once SQLite's WebAssembly has loaded. */
export function prepare() {
  prepared ??= NodeSqlite.initNodeSqlite().then(() => ({
    '@pothos/plugin-prisma-next': PrismaNextModule,
    '@prisma/orm-family-sql/orm-client': OrmClient,
    '@prisma/orm-sqlite/runtime': sqliteRuntime,
    '@prisma/orm-sqlite/static': SqliteStatic,
    'node:sqlite': NodeSqlite,
  }));
  return prepared;
}

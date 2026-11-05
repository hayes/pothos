import type { BindParams, Database, SqlJsStatic, SqlValue } from 'sql.js';

// A browser implementation of the part of `node:sqlite` the ORM's SQLite driver uses, backed by
// sql.js. A path names one shared in-memory database, as it names one file in Node, so the driver's
// connections and an example's seeding connection see the same data.
let SQL: SqlJsStatic | undefined;
const databases = new Map<string, Database>();

/** The driver opens connections synchronously, so WebAssembly must be ready before it runs. */
export async function initNodeSqlite() {
  if (!SQL) {
    const { default: initSqlJs } = await import('sql.js');
    SQL = await initSqlJs({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
    });
  }
}

function sqliteError(error: unknown) {
  return Object.assign(error instanceof Error ? error : new Error(String(error)), {
    code: 'ERR_SQLITE_ERROR',
    errcode: 1,
  });
}

function bindParams(params: unknown[]): BindParams {
  return params.map((param) =>
    typeof param === 'bigint' || typeof param === 'boolean' ? Number(param) : param,
  ) as SqlValue[];
}

class StatementSync {
  constructor(
    private readonly db: Database,
    private readonly sql: string,
  ) {}

  private withStatement<T>(run: (statement: ReturnType<Database['prepare']>) => T): T {
    try {
      const statement = this.db.prepare(this.sql);
      try {
        return run(statement);
      } finally {
        statement.free();
      }
    } catch (error) {
      throw sqliteError(error);
    }
  }

  columns() {
    return this.withStatement((statement) => statement.getColumnNames().map((name) => ({ name })));
  }

  all(...params: unknown[]) {
    return this.withStatement((statement) => {
      statement.bind(bindParams(params));
      const rows: Record<string, unknown>[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
      return rows;
    });
  }

  iterate(...params: unknown[]) {
    return this.all(...params)[Symbol.iterator]();
  }

  run(...params: unknown[]) {
    return this.withStatement((statement) => {
      statement.run(bindParams(params));
      return {
        changes: this.db.getRowsModified(),
        lastInsertRowid: Number(this.db.exec('SELECT last_insert_rowid()')[0].values[0][0]),
      };
    });
  }
}

export class DatabaseSync {
  private readonly db: Database;

  constructor(path: string) {
    if (!SQL) {
      throw new Error('node:sqlite was opened before its WebAssembly module loaded.');
    }
    const existing = path === ':memory:' ? undefined : databases.get(path);
    this.db = existing ?? new SQL.Database();
    if (!existing && path !== ':memory:') {
      databases.set(path, this.db);
    }
  }

  exec(sql: string) {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw sqliteError(error);
    }
  }

  prepare(sql: string) {
    return new StatementSync(this.db, sql);
  }

  // The path keeps the database alive, like a file, for the next connection to it.
  close() {}
}

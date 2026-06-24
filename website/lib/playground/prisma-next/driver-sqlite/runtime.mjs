// Universal sql.js-backed sqlite driver for prisma-next. Mirrors
// the surface of the upstream `@prisma-next/driver-sqlite` (which uses
// `node:sqlite` — not available on Vercel's Node version, and never
// available in the browser).
//
// Browser: loads the WASM from a CDN.
// Node:    loads the WASM from the local `sql.js` install.
//
// This dual mode lets the same shim drive the website's playground
// (browser) and the plugin's vitest suite (node) without conditional
// exports or a node-builtin dependency.
//
// Binding contract: the `@prisma-next/sqlite` factory always normalises
// to `{ kind: 'path', path: string }`. We carry the seed through that
// channel by accepting either:
//   - `:memory:` → empty in-memory DB
//   - `seed:<key>` → look up SQL from ./seed.mjs registry, exec, then
//     run queries
import { takeSeed } from './seed.mjs';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

let sqlJsInitPromise;

async function loadSqlJs() {
  if (!sqlJsInitPromise) {
    sqlJsInitPromise = (async () => {
      // sql.js ships a UMD bundle. Importing it at runtime keeps the
      // ~1.5MB WASM out of the playground's main bundle until the
      // prisma-next demo actually runs.
      const mod = await import('sql.js');
      const initSqlJs = mod.default ?? mod;
      if (isBrowser) {
        // The WASM blob is content-addressed against the JS shim, so
        // the version here must match the one resolved from
        // node_modules. Keep in sync with package.json's `sql.js` pin.
        return initSqlJs({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
        });
      }
      // Node: read the WASM directly off disk so we don't depend on a
      // network fetch (vitest, CI, server-side Next prerender). The
      // bundled WASM lives next to sql.js's UMD entry; resolving the
      // module itself gives us a stable anchor that survives pnpm's
      // content-addressed install layout (where the package.json
      // sometimes isn't in `exports`).
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const sqlJsEntryUrl = await import.meta.resolve('sql.js');
      const distDir = new URL('./', sqlJsEntryUrl);
      return initSqlJs({
        locateFile: (file) => fileURLToPath(new URL(file, distDir)),
        // sql.js sometimes ignores `locateFile` and looks for
        // `sql-wasm.wasm` next to the bundle directly; feed the bytes
        // through `wasmBinary` as a belt-and-suspenders fallback.
        wasmBinary: readFileSync(fileURLToPath(new URL('sql-wasm.wasm', distDir))),
      });
    })();
  }
  return sqlJsInitPromise;
}

function driverError(code, message) {
  const error = new Error(message);
  Object.defineProperty(error, 'name', { value: 'RuntimeError', configurable: true });
  return Object.assign(error, { code, category: 'RUNTIME', severity: 'error', details: undefined });
}

const NOT_CONNECTED = 'SQLite driver not connected. Call connect(binding) before execute.';
const ALREADY_CONNECTED =
  'SQLite driver already connected. Call close() before reconnecting with a new binding.';

async function applyBinding(SQL, binding) {
  if (binding.path === ':memory:' || binding.path === '') {
    const db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    return db;
  }
  if (binding.path.startsWith('seed:')) {
    const db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    const seed = takeSeed(binding.path.slice('seed:'.length));
    if (seed) db.exec(seed);
    return db;
  }
  if (!isBrowser) {
    // Node: load the file off disk into sql.js. The driver tracks the
    // origin path so `.close()` can persist any writes back. Plugin
    // tests use temp DBs created by `node:sqlite` and then drive
    // prisma-next through this shim — this branch is what makes that
    // round-trip work.
    const { existsSync, readFileSync } = await import('node:fs');
    const bytes = existsSync(binding.path) ? readFileSync(binding.path) : null;
    const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    db.run('PRAGMA foreign_keys = ON');
    db.__filePath = binding.path;
    return db;
  }
  throw driverError(
    'DRIVER.UNSUPPORTED_BINDING',
    `Browser sqlite driver only supports ':memory:' or 'seed:<key>' paths, got ${binding.path}`,
  );
}

async function persistIfFileBacked(db) {
  if (isBrowser) return;
  const path = db.__filePath;
  if (!path) return;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(path, Buffer.from(db.export()));
}

function rowsFromExec(db, sql, params) {
  // db.exec returns one result per statement; for parametrised
  // single-statement queries we use db.prepare + bind/step.
  const stmt = db.prepare(sql);
  try {
    if (params && params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

class SqlJsConnection {
  #db;
  constructor(db) {
    this.#db = db;
  }
  async *execute(request) {
    for (const row of rowsFromExec(this.#db, request.sql, request.params)) yield row;
  }
  // prisma-next 0.14.0's sql-runtime drives prepared statements through
  // `executePrepared`. The upstream node:sqlite driver simply forwards
  // `{ sql, params }` to `execute`; sql.js has no separate prepared-plan
  // channel, so we do the same — the request already carries the lowered
  // SQL + params.
  executePrepared(request) {
    return this.execute({ sql: request.sql, params: request.params });
  }
  async explain(request) {
    return { rows: rowsFromExec(this.#db, `EXPLAIN QUERY PLAN ${request.sql}`, request.params) };
  }
  async query(sql, params) {
    return { rows: rowsFromExec(this.#db, sql, params) };
  }
  async beginTransaction() {
    this.#db.run('BEGIN');
    return new SqlJsTransaction(this.#db);
  }
  async release() {}
  async destroy() {}
}

class SqlJsTransaction {
  #db;
  constructor(db) {
    this.#db = db;
  }
  async *execute(request) {
    for (const row of rowsFromExec(this.#db, request.sql, request.params)) yield row;
  }
  executePrepared(request) {
    return this.execute({ sql: request.sql, params: request.params });
  }
  async explain(request) {
    return { rows: rowsFromExec(this.#db, `EXPLAIN QUERY PLAN ${request.sql}`, request.params) };
  }
  async query(sql, params) {
    return { rows: rowsFromExec(this.#db, sql, params) };
  }
  async commit() {
    this.#db.run('COMMIT');
  }
  async rollback() {
    this.#db.run('ROLLBACK');
  }
}

class SqlJsDriver {
  familyId = 'sql';
  targetId = 'sqlite';
  #state = { kind: 'unbound' };
  // `@prisma-next/sqlite`'s factory kicks off connect() in the
  // background and immediately returns a runtime that may execute
  // queries before the WASM has loaded. Upstream `node:sqlite` doesn't
  // hit this because its `new DatabaseSync(path)` is synchronous —
  // ours isn't. Hold onto the in-flight connect so subsequent
  // execute/query/explain calls await it instead of failing fast.
  #connectPromise = null;

  get state() {
    return this.#state.kind;
  }

  async connect(binding) {
    if (this.#state.kind === 'connected') {
      throw driverError('DRIVER.ALREADY_CONNECTED', ALREADY_CONNECTED);
    }
    if (this.#connectPromise) return this.#connectPromise;
    this.#connectPromise = (async () => {
      const SQL = await loadSqlJs();
      const db = await applyBinding(SQL, binding);
      this.#state = { kind: 'connected', db, conn: new SqlJsConnection(db) };
    })();
    try {
      await this.#connectPromise;
    } catch (err) {
      this.#connectPromise = null;
      throw err;
    }
  }

  async #ensureConnected() {
    if (this.#state.kind === 'connected') return this.#state;
    if (this.#connectPromise) {
      await this.#connectPromise;
      if (this.#state.kind === 'connected') return this.#state;
    }
    throw driverError('DRIVER.NOT_CONNECTED', NOT_CONNECTED);
  }

  async acquireConnection() {
    const state = await this.#ensureConnected();
    // sql.js is single-connection; reuse the shared one.
    return state.conn;
  }

  async close() {
    if (this.#state.kind !== 'connected') return;
    await persistIfFileBacked(this.#state.db);
    this.#state.db.close();
    this.#state = { kind: 'closed' };
  }

  execute(request) {
    const ensure = this.#ensureConnected.bind(this);
    return {
      [Symbol.asyncIterator]() {
        let inner = null;
        return {
          async next() {
            if (!inner) {
              const state = await ensure();
              inner = state.conn.execute(request)[Symbol.asyncIterator]();
            }
            return inner.next();
          },
        };
      },
    };
  }

  async explain(request) {
    const state = await this.#ensureConnected();
    return state.conn.explain(request);
  }

  async query(sql, params) {
    const state = await this.#ensureConnected();
    return state.conn.query(sql, params);
  }
}

const sqlJsDriverDescriptor = {
  kind: 'driver',
  familyId: 'sql',
  targetId: 'sqlite',
  id: 'sqlite-sqljs',
  version: '0.0.1',
  capabilities: {},
  create() {
    return new SqlJsDriver();
  },
};

export default sqlJsDriverDescriptor;

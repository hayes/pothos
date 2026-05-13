// Spins up an on-disk sqlite database in a temp directory, seeds it
// via raw CREATE/INSERT (avoids prisma-next's migration CLI stack for
// a fixture), and connects a sqlite client. Returns orm + runtime so
// tests can inspect emitted SQL via the capture middleware.
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import sqlite from '@prisma-next/sqlite/runtime';
import type { AfterExecuteResult } from '@prisma-next/framework-components/runtime';
import type { SqlExecutionPlan } from '@prisma-next/sql-relational-core/plan';
import type { Runtime, SqlMiddleware } from '@prisma-next/sql-runtime';
import type { Contract as SampleContractType } from './sample-contract';

const sampleContractJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./sample-contract.json', import.meta.url)), 'utf8'),
) as SampleContractType;

export type SampleContract = SampleContractType;

export interface CapturedExecution {
  sql: string;
  params: readonly unknown[];
  rowCount?: number;
  latencyMs?: number;
}

const captureStore = new AsyncLocalStorage<CapturedExecution[]>();

export function withCapture<T>(
  captures: CapturedExecution[],
  fn: () => Promise<T>,
): Promise<T> {
  return captureStore.run(captures, fn);
}

const captureMiddleware: SqlMiddleware = {
  name: 'pothos-test-capture',
  familyId: 'sql',
  async beforeExecute(plan: SqlExecutionPlan) {
    const captures = captureStore.getStore();
    if (!captures) return;
    captures.push({ sql: plan.sql, params: plan.params });
  },
  async afterExecute(_plan: SqlExecutionPlan, result: AfterExecuteResult) {
    const captures = captureStore.getStore();
    if (!captures || captures.length === 0) return;
    const last = captures[captures.length - 1];
    if (!last) return;
    last.rowCount = result.rowCount;
    last.latencyMs = result.latencyMs;
  },
};

export interface TestRuntimeContext {
  runtime: Runtime;
  ormClient: ReturnType<typeof sqlite<SampleContract>>['orm'];
  contract: SampleContract;
  cleanup: () => Promise<void>;
}

export async function createTestRuntime(): Promise<TestRuntimeContext> {
  const testDir = mkdtempSync(join(tmpdir(), 'pothos-prisma-next-'));
  const dbPath = join(testDir, 'test.db');

  const rawDb = new DatabaseSync(dbPath);
  rawDb.exec('PRAGMA foreign_keys = ON');
  createSchema(rawDb, sampleContractJson);
  seedData(rawDb);
  rawDb.close();

  const client = sqlite<SampleContract>({
    contractJson: sampleContractJson,
    middleware: [captureMiddleware],
  });
  const runtime = await client.connect({ path: dbPath });

  return {
    runtime,
    ormClient: client.orm,
    contract: sampleContractJson,
    cleanup: async () => {
      await runtime.close();
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Issue the marker table + the contract's user/post/comment tables.
 * The marker rows are required by `verify: { requireMarker: false }`'s
 * fallback path, which still consults the table when present.
 */
function createSchema(db: DatabaseSync, contract: SampleContract): void {
  db.exec(`
    CREATE TABLE _prisma_marker (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      core_hash TEXT NOT NULL,
      profile_hash TEXT NOT NULL,
      contract_json TEXT,
      canonical_version INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      app_tag TEXT,
      meta TEXT NOT NULL DEFAULT '{}',
      invariants TEXT NOT NULL DEFAULT '[]'
    )
  `);
  const storageHash = (contract as { storage?: { storageHash?: string } }).storage?.storageHash ?? '';
  const profileHash = (contract as { profileHash?: string }).profileHash ?? storageHash;
  db.prepare('INSERT INTO _prisma_marker (id, core_hash, profile_hash) VALUES (?, ?, ?)').run(
    1,
    storageHash,
    profileHash,
  );

  db.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY NOT NULL,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    )
  `);
  db.exec(`
    CREATE TABLE post (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      authorId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (authorId) REFERENCES user(id)
    )
  `);
  db.exec(`
    CREATE TABLE comment (
      id TEXT PRIMARY KEY NOT NULL,
      body TEXT NOT NULL,
      authorId TEXT NOT NULL,
      postId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (authorId) REFERENCES user(id),
      FOREIGN KEY (postId) REFERENCES post(id)
    )
  `);
}

/**
 * Two users, four posts (mix of published/draft), two comments on the
 * one published post by Alice. Mirrors the example seed but with stable
 * IDs so test assertions can hardcode them.
 */
function seedData(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO user (id, firstName, lastName, email) VALUES
      ('u-alice', 'Alice', 'Andrews', 'alice@example.com'),
      ('u-bob', 'Bob', 'Brown', 'bob@example.com')
  `);
  db.exec(`
    INSERT INTO post (id, title, content, published, authorId, createdAt) VALUES
      ('p-hello', 'Hello, Pothos', 'Welcome.', 1, 'u-alice', '2026-04-01T10:00:00.000Z'),
      ('p-draft1', 'Draft #1', 'WIP', 0, 'u-alice', '2026-04-02T10:00:00.000Z'),
      ('p-bob1', 'Bob writes', 'My experience.', 1, 'u-bob', '2026-04-03T10:00:00.000Z'),
      ('p-bob-draft', 'Bob draft', 'Polishing.', 0, 'u-bob', '2026-04-04T10:00:00.000Z')
  `);
  db.exec(`
    INSERT INTO comment (id, body, authorId, postId, createdAt) VALUES
      ('c-1', 'Looks great!', 'u-bob', 'p-hello', '2026-04-01T11:00:00.000Z'),
      ('c-2', 'Glad to see this working.', 'u-alice', 'p-hello', '2026-04-01T12:00:00.000Z')
  `);
}

// A seeded on-disk sqlite database, built with raw SQL rather than prisma-next's migrations.
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import type { Runtime, SqlMiddleware } from '@prisma/orm-family-sql/runtime';
import type { Contract as SampleContractType } from './sample-contract';

const sampleContractJson = contractFromJson<SampleContractType>(
  JSON.parse(readFileSync(fileURLToPath(new URL('./sample-contract.json', import.meta.url)), 'utf8')),
);

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

const captureSlot = Symbol('pothos-test-capture');

const captureMiddleware: SqlMiddleware = {
  name: 'pothos-test-capture',
  familyId: 'sql',
  async beforeEncode(plan, ctx) {
    const captures = captureStore.getStore();
    if (!captures) return;
    const capture: CapturedExecution = { sql: plan.sql, params: plan.params };
    captures.push(capture);
    ctx.state(captureSlot)['capture'] = capture;
  },
  async activityEnded(_activity, result, ctx) {
    if (result.kind !== 'statement') return;
    const capture = ctx.state(captureSlot)['capture'] as CapturedExecution | undefined;
    if (!capture) return;
    if (result.returns === 'rows') capture.rowCount = result.rowCount;
    capture.latencyMs = result.latencyMs;
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

  const client = sqlite({
    contract: sampleContractJson,
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

function createSchema(db: DatabaseSync, contract: SampleContract): void {
  // The runtime reads the marker `WHERE space = 'app'`; without that row it fails to initialize.
  db.exec(`
    CREATE TABLE _prisma_marker (
      space TEXT PRIMARY KEY NOT NULL,
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
  const APP_SPACE_ID = 'app';
  const storageHash = (contract as { storage?: { storageHash?: string } }).storage?.storageHash ?? '';
  const profileHash = (contract as { profileHash?: string }).profileHash ?? storageHash;
  db.prepare(
    'INSERT INTO _prisma_marker (space, core_hash, profile_hash) VALUES (?, ?, ?)',
  ).run(APP_SPACE_ID, storageHash, profileHash);

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
      score REAL,
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

function seedData(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO user (id, firstName, lastName, email) VALUES
      ('u-alice', 'Alice', 'Andrews', 'alice@example.com'),
      ('u-bob', 'Bob', 'Brown', 'bob@example.com')
  `);
  db.exec(`
    INSERT INTO post (id, title, content, published, score, authorId, createdAt) VALUES
      ('p-hello', 'Hello, Pothos', 'Welcome.', 1, 1.5, 'u-alice', '2026-04-01T10:00:00.000Z'),
      ('p-draft1', 'Draft #1', 'WIP', 0, 2.25, 'u-alice', '2026-04-02T10:00:00.000Z'),
      ('p-bob1', 'Bob writes', 'My experience.', 1, 3.5, 'u-bob', '2026-04-03T10:00:00.000Z'),
      ('p-bob-draft', 'Bob draft', 'Polishing.', 0, 4.75, 'u-bob', '2026-04-04T10:00:00.000Z')
  `);
  db.exec(`
    INSERT INTO comment (id, body, authorId, postId, createdAt) VALUES
      ('c-1', 'Looks great!', 'u-bob', 'p-hello', '2026-04-01T11:00:00.000Z'),
      ('c-2', 'Glad to see this working.', 'u-alice', 'p-hello', '2026-04-01T12:00:00.000Z')
  `);
}

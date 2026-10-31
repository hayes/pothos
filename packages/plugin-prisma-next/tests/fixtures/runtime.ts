// Seeded on-disk sqlite databases, built with raw SQL rather than prisma-next's migrations.
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SqlMiddleware } from '@prisma/orm-family-sql/runtime';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import type { Contract as SampleContractType } from './sample-contract';

export type SampleContract = SampleContractType;

export function loadContract<C>(url: URL): C {
  return contractFromJson(JSON.parse(readFileSync(url, 'utf8'))) as unknown as C;
}

export const sampleContract = loadContract<SampleContract>(
  new URL('./sample-contract.json', import.meta.url),
);

export interface CapturedExecution {
  sql: string;
  params: readonly unknown[];
}

const captureStore = new AsyncLocalStorage<CapturedExecution[]>();

export function withCapture<T>(captures: CapturedExecution[], fn: () => Promise<T>): Promise<T> {
  return captureStore.run(captures, fn);
}

export const captureMiddleware: SqlMiddleware = {
  name: 'pothos-test-capture',
  familyId: 'sql',
  beforeEncode(plan) {
    captureStore.getStore()?.push({ sql: plan.sql, params: plan.params });
    return Promise.resolve();
  },
};

type SqliteContract = Parameters<typeof sqlite>[0]['contract'];

export interface SqliteRuntime<C extends SqliteContract> {
  client: ReturnType<typeof sqlite<C>>;
  orm: ReturnType<typeof sqlite<C>>['orm'];
  contract: C;
  cleanup: () => Promise<void>;
}

/** The database opens on the first query. */
export function createSqliteRuntime<C extends SqliteContract>(
  contract: C,
  ddl: string,
): SqliteRuntime<C> {
  const dir = mkdtempSync(join(tmpdir(), 'pothos-prisma-next-'));
  const path = join(dir, 'test.db');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  // The runtime reads the marker `WHERE space = 'app'`; without that row it fails to initialize.
  db.exec(`CREATE TABLE _prisma_marker (
    space TEXT PRIMARY KEY NOT NULL, core_hash TEXT NOT NULL, profile_hash TEXT NOT NULL,
    contract_json TEXT, canonical_version INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), app_tag TEXT,
    meta TEXT NOT NULL DEFAULT '{}', invariants TEXT NOT NULL DEFAULT '[]')`);
  const hashes = contract as { storage?: { storageHash?: string }; profileHash?: string };
  const storageHash = hashes.storage?.storageHash ?? '';
  db.prepare('INSERT INTO _prisma_marker (space, core_hash, profile_hash) VALUES (?, ?, ?)').run(
    'app',
    storageHash,
    hashes.profileHash ?? storageHash,
  );
  db.exec(ddl);
  db.close();

  const client = sqlite<C>({ contract, path, middleware: [captureMiddleware] });
  return {
    client,
    orm: client.orm,
    contract,
    cleanup: async () => {
      await client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export const sampleDdl = `
  CREATE TABLE user (
    id TEXT PRIMARY KEY NOT NULL, firstName TEXT NOT NULL, lastName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  );
  CREATE TABLE post (
    id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0, score REAL, authorId TEXT NOT NULL,
    createdAt TEXT NOT NULL, FOREIGN KEY (authorId) REFERENCES user(id)
  );
  CREATE TABLE comment (
    id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL, authorId TEXT NOT NULL,
    postId TEXT NOT NULL, createdAt TEXT NOT NULL,
    FOREIGN KEY (authorId) REFERENCES user(id), FOREIGN KEY (postId) REFERENCES post(id)
  );
  CREATE TABLE post_view (
    postId TEXT NOT NULL, viewer TEXT NOT NULL, viewedAt TEXT NOT NULL,
    FOREIGN KEY (postId) REFERENCES post(id)
  );
  INSERT INTO user (id, firstName, lastName, email) VALUES
    ('u-alice', 'Alice', 'Andrews', 'alice@example.com'),
    ('u-bob', 'Bob', 'Brown', 'bob@example.com');
  INSERT INTO post (id, title, content, published, score, authorId, createdAt) VALUES
    ('p-hello', 'Hello, Pothos', 'Welcome.', 1, 1.5, 'u-alice', '2026-04-01T10:00:00.000Z'),
    ('p-draft1', 'Draft #1', 'WIP', 0, 2.25, 'u-alice', '2026-04-02T10:00:00.000Z'),
    ('p-bob1', 'Bob writes', 'My experience.', 1, 3.5, 'u-bob', '2026-04-03T10:00:00.000Z'),
    ('p-bob-draft', 'Bob draft', 'Polishing.', 0, 4.75, 'u-bob', '2026-04-04T10:00:00.000Z');
  INSERT INTO comment (id, body, authorId, postId, createdAt) VALUES
    ('c-1', 'Looks great!', 'u-bob', 'p-hello', '2026-04-01T11:00:00.000Z'),
    ('c-2', 'Glad to see this working.', 'u-alice', 'p-hello', '2026-04-01T12:00:00.000Z');
  INSERT INTO post_view (postId, viewer, viewedAt) VALUES
    ('p-hello', 'Bob', '2026-04-01T13:00:00.000Z'),
    ('p-hello', 'Carol', '2026-04-01T14:00:00.000Z'),
    ('p-bob1', 'Alice', '2026-04-03T11:00:00.000Z');
`;

export type TestRuntimeContext = SqliteRuntime<SampleContract>;

export function createTestRuntime(): TestRuntimeContext {
  return createSqliteRuntime(sampleContract, sampleDdl);
}

-- Marker table shape mirrors prisma-next 0.14.0's sqlite control adapter
-- (`_prisma_marker` defined in @prisma-next/adapter-sqlite). The adapter
-- reads `WHERE space = 'app'` selecting core_hash/profile_hash/
-- contract_json/canonical_version/updated_at/app_tag/meta/invariants, so
-- the `space` column (and a row with space='app') is required.
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
);

-- Marker hashes must match the contract; tests/fixtures/runtime.ts has
-- the wiring: core_hash = contract.storage.storageHash, profile_hash =
-- contract.profileHash. `space` is APP_SPACE_ID ("app") from
-- @prisma-next/framework-components. Regenerate if contract.json changes.
INSERT INTO _prisma_marker (space, core_hash, profile_hash)
VALUES (
  'app',
  'sha256:71c9bd0dd2593146612df8cebf0a9f6073d31d411b6ba29726e6f3a50ce58dc9',
  'sha256:3cc333ecad9f3f4c7229370a9d2c37e908cdce0f8d2e9fb132d50605b024eff2'
);

CREATE TABLE user (
  id TEXT PRIMARY KEY NOT NULL,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE post (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  authorId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (authorId) REFERENCES user(id)
);

CREATE TABLE comment (
  id TEXT PRIMARY KEY NOT NULL,
  body TEXT NOT NULL,
  authorId TEXT NOT NULL,
  postId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (authorId) REFERENCES user(id),
  FOREIGN KEY (postId) REFERENCES post(id)
);

INSERT INTO user (id, firstName, lastName, email) VALUES
  ('u-alice', 'Alice', 'Andrews', 'alice@example.com'),
  ('u-bob', 'Bob', 'Brown', 'bob@example.com'),
  ('u-carol', 'Carol', 'Chen', 'carol@example.com');

INSERT INTO post (id, title, content, published, authorId, createdAt) VALUES
  ('p-hello', 'Hello, Pothos', 'Welcome to the prisma-next demo.', 1, 'u-alice', '2026-04-01T10:00:00.000Z'),
  ('p-types', 'Type-safe GraphQL from a contract', 'Models and relations are inferred from the contract JSON.', 1, 'u-alice', '2026-04-02T10:00:00.000Z'),
  ('p-draft', 'Draft post', 'Polishing this one.', 0, 'u-alice', '2026-04-03T10:00:00.000Z'),
  ('p-bob1', 'On collection clients', 'A different mental model than the old client.', 1, 'u-bob', '2026-04-04T10:00:00.000Z'),
  ('p-bob2', 'Relations and includes', 'Plugin reads the GraphQL selection set.', 1, 'u-bob', '2026-04-05T10:00:00.000Z'),
  ('p-carol', 'Cursor pagination', 'Relay connections, end to end.', 1, 'u-carol', '2026-04-06T10:00:00.000Z');

INSERT INTO comment (id, body, authorId, postId, createdAt) VALUES
  ('c-1', 'Looks great!', 'u-bob', 'p-hello', '2026-04-01T11:00:00.000Z'),
  ('c-2', 'Loving the type inference.', 'u-carol', 'p-hello', '2026-04-01T12:00:00.000Z'),
  ('c-3', 'Big improvement.', 'u-alice', 'p-bob1', '2026-04-04T11:00:00.000Z'),
  ('c-4', 'Selection-set-driven includes are clever.', 'u-carol', 'p-bob2', '2026-04-05T11:00:00.000Z');

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
);

-- Marker hashes must match the contract; tests/fixtures/runtime.ts has
-- the wiring: core_hash = contract.storage.storageHash, profile_hash =
-- contract.profileHash. Regenerate if contract.json changes.
INSERT INTO _prisma_marker (id, core_hash, profile_hash)
VALUES (
  1,
  'sha256:26621165d69ac72f42a5e328fd9b567c2913617adcd0fa89c1336dffa27fc5f4',
  'sha256:213031a5ce861b455f22bc065769080ea0357fabcb999de0190524ecd32531f7'
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

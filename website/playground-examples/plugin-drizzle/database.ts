import { drizzle } from 'drizzle-orm/sqlite-proxy';
import initSqlJs from 'sql.js';
import { relations } from './tables';

// sql.js executes real SQLite in WebAssembly. Keep the serialized database
// with this schema, so rebuilding/resetting the schema also resets its data.
// Closing each connection releases WASM memory even when an example is replaced.
const sqlite = initSqlJs({
  locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/sql.js@1.14.1/dist/${file}`,
});
let saved: Uint8Array | undefined;
const seed = `
PRAGMA foreign_keys = ON;
CREATE TABLE users (id INTEGER PRIMARY KEY, firstName TEXT NOT NULL, lastName TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL);
CREATE TABLE profiles (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL UNIQUE REFERENCES users(id), bio TEXT);
CREATE TABLE posts (id INTEGER PRIMARY KEY, authorId INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, content TEXT NOT NULL, published INTEGER NOT NULL, createdAt TEXT NOT NULL);
CREATE TABLE media (id INTEGER PRIMARY KEY, url TEXT NOT NULL, uploadedById INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE postMedia (id INTEGER PRIMARY KEY, postId INTEGER NOT NULL REFERENCES posts(id), mediaId INTEGER NOT NULL REFERENCES media(id), UNIQUE(postId, mediaId));
INSERT INTO users VALUES (1, 'Maya', 'Chen', 'maya@example.com', 'editor'), (2, 'Leo', 'Silva', 'leo@example.com', 'author'), (3, 'Nora', 'Ellis', 'nora@example.com', 'author');
INSERT INTO profiles VALUES (1, 1, 'Writes about community gardens.');
INSERT INTO posts VALUES
(1, 1, 'Starting a seed library', 'Share seeds with your neighbors.', 1, '2026-01-15T09:00:00.000Z'),
(2, 1, 'A guide to composting', 'Turn kitchen scraps into healthy soil.', 1, '2026-01-15T09:00:00.000Z'),
(3, 2, 'Watering through summer', 'Water early and mulch deeply.', 1, '2026-01-15T09:00:00.000Z'),
(5, 2, 'Saving rainwater', 'Leo’s unpublished draft.', 0, '2026-01-15T09:00:00.000Z'),
(4, 1, 'Planning the spring exchange', 'An unpublished editorial draft.', 0, '2026-01-15T09:00:00.000Z');
INSERT INTO media VALUES (1, 'https://images.example.com/seed-library.jpg', 2);
INSERT INTO postMedia VALUES (1, 1, 1), (2, 2, 1);
`;

export const db = drizzle(
  async (sql, params, method) => {
    const SQL = await sqlite;
    const connection = new SQL.Database(saved);
    try {
      if (!saved) {
        connection.run(seed);
      }
      connection.run('PRAGMA foreign_keys = ON');
      console.log('SQL', sql, params);
      const result = connection.exec(sql, params);
      saved = connection.export();
      const rows = result[0]?.values ?? [];
      return { rows: method === 'get' ? rows[0] : rows };
    } finally {
      connection.close();
    }
  },
  { relations },
);

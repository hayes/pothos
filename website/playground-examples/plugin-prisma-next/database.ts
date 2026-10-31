import { DatabaseSync } from 'node:sqlite';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import type { Contract } from './contract';
import contractJson from './contract.json';

// The playground runs SQLite in WebAssembly, loaded from a CDN; the client below is the same one
// you would use with a file on Node.
const path = 'publishing.db';
const seed = new DatabaseSync(path);
seed.exec(`
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS users;
CREATE TABLE users (id INTEGER PRIMARY KEY, firstName TEXT NOT NULL, lastName TEXT NOT NULL, email TEXT NOT NULL UNIQUE);
CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL, published INTEGER NOT NULL, authorId INTEGER NOT NULL REFERENCES users(id));
INSERT INTO users VALUES (1, 'Maya', 'Chen', 'maya@example.com'), (2, 'Leo', 'Silva', 'leo@example.com');
INSERT INTO posts VALUES
(1, 'Starting a seed library', 1, 1),
(2, 'A guide to composting', 1, 1),
(3, 'Planning the spring exchange', 0, 1),
(4, 'Watering through summer', 1, 2);
`);
seed.close();

export const contract = contractFromJson<Contract>(contractJson);
export const db = sqlite({ contract, path });

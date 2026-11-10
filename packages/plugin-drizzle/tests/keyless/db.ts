import { createClient } from '@libsql/client';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});
// No primary key and no unique column.
export const logs = sqliteTable('logs', {
  at: text('at').notNull(),
  userId: integer('user_id').notNull(),
  message: text('message').notNull(),
});
export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey(),
  logAt: text('log_at').notNull(),
  body: text('body').notNull(),
});

export const schema = { users, logs, notes };
export const relations = defineRelations(schema, (r) => ({
  users: {
    logs: r.many.logs({ from: r.users.id, to: r.logs.userId }),
  },
  logs: {
    user: r.one.users({ from: r.logs.userId, to: r.users.id, optional: false }),
    notes: r.many.notes({ from: r.logs.at, to: r.notes.logAt }),
  },
  notes: {},
}));

export const client = createClient({ url: ':memory:' });
export const db = drizzle({ client, relations });
export type DrizzleRelations = typeof relations;

export async function seed() {
  await client.executeMultiple(`
    create table users (id integer primary key, name text not null);
    create table logs (at text not null, user_id integer not null, message text not null);
    create table notes (id integer primary key, log_at text not null, body text not null);
  `);
  await db.insert(users).values([
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bob' },
  ]);
  await db.insert(logs).values([
    { at: '2026-01-01', userId: 1, message: 'first' },
    { at: '2026-01-02', userId: 2, message: 'second' },
    { at: '2026-01-03', userId: 1, message: 'third' },
  ]);
  await db.insert(notes).values([
    { id: 1, logAt: '2026-01-01', body: 'a' },
    { id: 2, logAt: '2026-01-01', body: 'b' },
    { id: 3, logAt: '2026-01-03', body: 'c' },
  ]);
}

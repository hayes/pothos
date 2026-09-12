import { defineRelations, eq, sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { beforeEach, expect, it, vi } from 'vitest';
import { captureDrizzleQueries, snapshotQuery } from '../drizzle/capture';
import { drizzleSqliteProxy } from '../drizzle/sqlite-proxy';
import { getExtensionPanels, resetExtensionPanels } from '../extension-panels-slot';

const users = sqliteTable('users', { id: integer().primaryKey(), name: text().notNull() });
const relations = defineRelations({ users });
beforeEach(resetExtensionPanels);

it('captures relational options without changing SQL or returned rows', async () => {
  const driver = vi.fn(async (..._args: unknown[]) => ({
    rows: [[JSON.stringify({ id: 1, name: 'Maya' })]],
  }));
  const normal = drizzle(driver, { relations });
  const inspected = drizzleSqliteProxy.drizzle(driver, { relations });
  const options = { columns: { id: true, name: true }, where: { id: 1 }, limit: 2 } as const;
  const expected = await normal.query.users.findMany(options);
  const actual = await inspected.query.users.findMany(options);
  expect(actual).toEqual(expected);
  expect(actual).toEqual([{ id: 1, name: 'Maya' }]);
  expect(driver.mock.calls[1]).toEqual(driver.mock.calls[0]);
  const panel = getExtensionPanels()[0];
  expect(panel.name).toBe('Queries');
  expect(panel.tabs).toHaveLength(1);
  expect(panel.tabs![0].name).toBe('1. db.query.users.findMany');
  expect(JSON.parse(panel.tabs![0].content)).toEqual({
    method: 'db.query.users.findMany',
    arguments: [options],
  });
});

it('snapshots arguments, preserves the query object, and starts fresh after reset', () => {
  // biome-ignore lint/suspicious/noThenProperty: verify capture never consumes a lazy query
  const result = { then: vi.fn() };
  const table = {
    findFirst: vi.fn(function (this: unknown, ..._args: unknown[]) {
      expect(this).toBe(table);
      return result;
    }),
  };
  const db = captureDrizzleQueries({ query: { users: table } });
  const options = { where: { id: 1 }, with: { posts: { limit: 2 } } };
  expect(db.query.users.findFirst(options)).toBe(result);
  options.where.id = 9;
  const previous = getExtensionPanels()[0];
  expect(JSON.parse(previous.tabs![0].content).arguments[0].where.id).toBe(1);
  db.query.users.findFirst();
  expect(previous.tabs).toHaveLength(2);
  expect(result.then).not.toHaveBeenCalled();
  resetExtensionPanels();
  expect(getExtensionPanels()).toEqual([]);
  db.query.users.findFirst({ where: { id: 3 } });
  expect(getExtensionPanels()[0]).not.toBe(previous);
  expect(getExtensionPanels()[0].tabs).toHaveLength(1);
  expect(previous.tabs).toHaveLength(2);
});

it('records count arguments and preserves synchronous API failures', () => {
  const db = drizzleSqliteProxy.drizzle(async () => ({ rows: [] }), { relations });
  db.$count(users, eq(users.id, 1));
  const entry = JSON.parse(getExtensionPanels()[0].tabs![0].content);
  expect(entry.method).toBe('db.$count');
  expect(entry.arguments[0]).toEqual({ $type: 'Table', name: 'users' });
  expect(entry.arguments[1].$type).toBe('SQL');
  const error = new Error('invalid query');
  const broken = captureDrizzleQueries({
    query: {
      users: {
        findMany: () => {
          throw error;
        },
      },
    },
  });
  expect(() => broken.query.users.findMany()).toThrow(error);
  expect(getExtensionPanels()[0].tabs).toHaveLength(2);
});

it('labels callbacks, SQL, cycles and special values without evaluating callbacks or getters', () => {
  const callback = vi.fn(() => {
    throw new Error('must not run');
  });
  const getter = vi.fn(() => {
    throw new Error('must not run');
  });
  const options: Record<string, unknown> = {
    where: callback,
    extras: { count: sql`length(${users.name})` },
    date: new Date('2026-01-01T00:00:00.123Z'),
    id: 9n,
    missing: undefined,
  };
  Object.defineProperty(options, 'getter', { enumerable: true, get: getter });
  options.self = options;
  const snapshot = snapshotQuery(options) as Record<string, unknown>;
  expect(snapshot.where).toMatchObject({ $type: 'Function' });
  expect(snapshot.extras).toMatchObject({ count: { $type: 'SQL' } });
  expect(snapshot.id).toEqual({ $type: 'bigint', value: '9' });
  expect(snapshot.missing).toEqual({ $type: 'undefined' });
  expect(snapshot.date).toEqual({ $type: 'Date', value: '2026-01-01T00:00:00.123Z' });
  expect(snapshot.self).toEqual({ $type: 'Circular', path: '$' });
  expect(snapshot.getter).toMatchObject({ $type: 'Accessor' });
  expect(callback).not.toHaveBeenCalled();
  expect(getter).not.toHaveBeenCalled();
  expect(() => JSON.stringify(snapshot)).not.toThrow();
});

import { existsSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { type GraphQLSchema, graphql } from 'graphql';
import { beforeAll, expect, it, vi } from 'vitest';
import expected from '../../../playground-examples/plugin-drizzle/expected.json';

// Use the installed WASM file in Node; the example uses a CDN URL in the browser.
vi.mock('sql.js', async (importOriginal) => {
  const { default: initSqlJs } = await importOriginal<typeof import('sql.js')>();
  return { default: () => initSqlJs() };
});

const directory = new URL('../../../playground-examples/plugin-drizzle/', import.meta.url);
const contextValue = JSON.parse(readFileSync(new URL('context.json', directory), 'utf8'));
let db: SqliteRemoteDatabase;
let schema: GraphQLSchema;

beforeAll(async () => {
  // Examples have isolated TypeScript checks so their plugin declarations do not merge into
  // the website's program. Load this example by URL to preserve that boundary here too.
  db = (await import(new URL('database.ts', directory).href)).db;
  schema = (await import(new URL('schema.ts', directory).href)).schema;
});

it.each(
  Object.entries(expected),
)('executes the Drizzle playground query %s', async (file, result) => {
  const variables = new URL(file.replace('.graphql', '.variables.json'), directory);
  expect(
    await graphql({
      schema,
      source: readFileSync(new URL(file, directory), 'utf8'),
      contextValue,
      variableValues: existsSync(variables)
        ? JSON.parse(readFileSync(variables, 'utf8'))
        : undefined,
    }),
  ).toEqual(result);
});

it('persists writes and returns the requested raw query row shape', async () => {
  await db.run(sql`create table proxy_test (value text)`);
  await db.run(sql`insert into proxy_test values (${'saved'})`);
  expect(await db.get(sql`select value from proxy_test`)).toEqual({ value: 'saved' });
  expect(await db.all(sql`select value from proxy_test`)).toEqual([{ value: 'saved' }]);
  expect(await db.values(sql`select value from proxy_test`)).toEqual([['saved']]);
  expect(
    await db.get(sql`select value from proxy_test where value = ${'missing'}`),
  ).toBeUndefined();
});

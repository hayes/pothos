import { createClient } from '@libsql/client';
import SchemaBuilder, { PothosSchemaError } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { getTableConfig, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ExecutionResult } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';

// A node ID column whose type has no ID format. One no ID was ever written for is refused when
// the schema is built; one whose values may still serialize fails at request time, with the
// detail kept out of the response.

const client = createClient({ url: ':memory:' });
const things = sqliteTable('things', {
  id: integer().primaryKey(),
  flag: integer({ mode: 'boolean' }).notNull().unique(),
  meta: text({ mode: 'json' }).notNull().unique(),
});
const relations = defineRelations({ things });
const db = drizzle({ client, relations });

function createBuilder() {
  return new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
    plugins: [RelayPlugin, DrizzlePlugin],
    drizzle: { client: db, relations, getTableConfig },
    scopeAuth: { authScopes: () => ({}) },
  });
}

beforeAll(async () => {
  await client.execute(
    'create table things (id integer primary key, flag integer not null unique, meta text not null unique)',
  );
  await db.insert(things).values([
    { id: 1, flag: true, meta: 'one' },
    { id: 2, flag: false, meta: { two: 2 } },
  ]);
});

afterAll(() => {
  client.close();
});

it('refuses a node ID column whose values IDs never held', () => {
  const builder = createBuilder();

  expect(() =>
    builder.drizzleNode('things', {
      name: 'Thing',
      id: { column: things.flag },
      fields: (t) => ({ key: t.exposeInt('id') }),
    }),
  ).toThrow(
    new PothosSchemaError(
      "Column flag (boolean) can't be a node ID: no value it holds can be written as one",
    ),
  );
});

describe('a node ID column whose values may serialize', () => {
  const builder = createBuilder();

  builder.drizzleNode('things', {
    name: 'Thing',
    id: { column: things.meta },
    fields: (t) => ({ key: t.exposeInt('id') }),
  });
  builder.queryType({
    fields: (t) => ({
      things: t.drizzleField({
        type: ['things'],
        nullable: { list: false, items: true },
        resolve: (query) => db.query.things.findMany(query({ orderBy: { id: 'asc' } })),
      }),
    }),
  });

  const schema = builder.toSchema();

  async function run(source: string, variableValues: Record<string, unknown> = {}) {
    return (await execute({
      schema,
      document: gql(source),
      variableValues,
      contextValue: {},
    })) as ExecutionResult;
  }

  it('writes the IDs it can, and hides why it cannot write the rest', async () => {
    const result = await run('{ things { id } }');

    expect(result.data).toEqual({
      things: [{ id: Buffer.from('Thing:one').toString('base64') }, null],
    });
    expect(result.errors?.map((error) => error.message)).toEqual(['Unexpected error.']);
    expect((result.errors?.[0].originalError?.cause as Error).message).toBe(
      "A node ID column holds a value of type object, which IDs can't encode",
    );
  });

  it('hides why it cannot read one back', async () => {
    const result = await run('query ($id: ID!) { node(id: $id) { id } }', {
      id: Buffer.from('Thing:one').toString('base64'),
    });

    expect(result.errors?.map((error) => error.message)).toEqual(['Unexpected error.']);
    expect((result.errors?.[0].originalError?.cause as Error).message).toBe(
      "Node IDs for column meta (object json) can't be parsed",
    );
  });
});

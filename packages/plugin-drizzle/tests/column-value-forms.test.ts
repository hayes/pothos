import { createClient } from '@libsql/client';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import {
  bigint,
  doublePrecision,
  pgEnum,
  integer as pgInteger,
  pgTable,
} from 'drizzle-orm/pg-core';
import { getTableConfig, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { ExecutionResult } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { getCursorParser } from '../src/utils/cursors';

// Values the plugin can write into a cursor or ID are read back, whatever JS type a driver option
// made the row value: the checks reject only what no row of the column holds.

function cursor(payload: string) {
  return Buffer.from(payload).toString('base64');
}

function globalID(type: string, id: string) {
  return Buffer.from(`${type}:${id}`).toString('base64');
}

describe('cursor values a driver option can produce', () => {
  const mood = pgEnum('mood', ['happy', 'sad']);
  const readings = pgTable('readings', {
    id: pgInteger().primaryKey(),
    big: bigint({ mode: 'bigint' }).notNull(),
    value: doublePrecision().notNull(),
    mood: mood().notNull(),
  });

  it('accepts an enum label the schema no longer lists', () => {
    expect(getCursorParser(['mood'], [readings.mood])(cursor('DC:S:angry'))).toEqual({
      mood: 'angry',
    });
  });

  it('accepts a number or digits for a bigint column', () => {
    const parse = getCursorParser(['big'], [readings.big]);

    expect(parse(cursor('DC:N:5'))).toEqual({ big: 5 });
    expect(parse(cursor('DC:S:9007199254740993'))).toEqual({ big: BigInt('9007199254740993') });
    expect(() => parse(cursor('DC:N:1.5'))).toThrow('Invalid cursor.');
    expect(() => parse(cursor('DC:O:{"a":1}'))).toThrow('Invalid cursor.');
  });

  it('accepts a bigint for an integer column', () => {
    expect(getCursorParser(['id'], [readings.id])(cursor('DC:I:3'))).toEqual({
      id: BigInt(3),
    });
  });

  it('accepts NaN as Postgres writes it in JSON, in a tagged and a legacy cursor', () => {
    const parse = getCursorParser(['value', 'id'], [readings.value, readings.id]);

    expect(parse(cursor('DC:T:["S:NaN","N:1"]'))).toEqual({ value: 'NaN', id: 1 });
    expect(parse(cursor('DC:J:["NaN",1]'))).toEqual({ value: 'NaN', id: 1 });
    expect(parse(cursor('DC:J:["-Infinity",1]'))).toEqual({ value: '-Infinity', id: 1 });
    expect(() => getCursorParser(['id'], [readings.id])(cursor('DC:S:NaN'))).toThrow(
      'Invalid cursor.',
    );
  });
});

describe('connections and nodes', () => {
  const client = createClient({ url: ':memory:' });
  const items = sqliteTable(
    'items',
    {
      id: integer().primaryKey(),
      name: text().notNull(),
      seq: integer().notNull(),
      area: text(),
      code: text().notNull(),
    },
    (t) => [uniqueIndex('items_area_code').on(t.area, t.code)],
  );
  const relations = defineRelations({ items });
  const statements: string[] = [];
  const db = drizzle({
    client,
    relations,
    logger: { logQuery: (query) => statements.push(query) },
  });
  const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
    plugins: [RelayPlugin, DrizzlePlugin],
    drizzle: { client: db, relations, getTableConfig },
    scopeAuth: { authScopes: () => ({}) },
  });

  builder.drizzleNode('items', {
    name: 'Item',
    id: { column: (item) => [item.area, item.code] },
    fields: (t) => ({ key: t.exposeInt('id') }),
  });
  builder.queryType({
    fields: (t) => ({
      byName: t.drizzleConnection({
        type: 'items',
        resolve: (query) => db.query.items.findMany(query({ orderBy: { name: 'asc' } })),
      }),
      bySeq: t.drizzleConnection({
        type: 'items',
        resolve: (query) => db.query.items.findMany(query({ orderBy: { seq: 'asc' } })),
      }),
    }),
  });

  let schema: ReturnType<typeof builder.toSchema>;

  beforeAll(async () => {
    await client.execute(
      `create table items (id integer primary key, name text not null, seq integer not null,
        area text, code text not null)`,
    );
    await client.execute('create unique index items_area_code on items (area, code)');
    await db.insert(items).values([
      { id: 1, name: '1', seq: 1, area: 'north', code: 'a' },
      { id: 2, name: '2', seq: 2, area: null, code: 'b' },
      { id: 3, name: '3', seq: 3, area: 'south', code: 'c' },
      { id: 4, name: '4', seq: 4, area: 'south', code: 'd' },
    ]);
    schema = builder.toSchema();
  });

  afterAll(() => {
    client.close();
  });

  async function run(source: string, variableValues: Record<string, unknown> = {}) {
    statements.length = 0;

    const result = (await execute({
      schema,
      document: gql(source),
      variableValues,
      contextValue: {},
    })) as ExecutionResult;

    return { ...result, statements: [...statements] };
  }

  const page = (field: string) =>
    `query ($after: String) { ${field}(first: 2, after: $after) { edges { node { key } } } }`;

  it.each([
    // a text column read as a number
    ['byName', 'DC:N:2'],
    // an integer column read as a bigint
    ['bySeq', 'DC:I:2'],
  ])('pages %s from a cursor holding %s', async (field, payload) => {
    const result = await run(page(field), { after: cursor(payload) });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      [field]: { edges: [{ node: { key: 3 } }, { node: { key: 4 } }] },
    });
  });

  it('still rejects an object for a text column', async () => {
    const result = await run(page('byName'), { after: cursor('DC:O:{"a":1}') });

    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid cursor.']);
    expect(result.statements).toEqual([]);
  });

  it('resolves a compound ID with a null part as a missing node', async () => {
    const listed = await run('{ bySeq { edges { node { id key } } } }');
    const ids = (
      listed.data as { bySeq: { edges: { node: { id: string; key: number } }[] } }
    ).bySeq.edges.map((edge) => edge.node);

    expect(ids[1]).toEqual({ id: globalID('Item', '[null,"b"]'), key: 2 });

    const result = await run('query ($id: ID!) { node(id: $id) { id } }', { id: ids[1].id });

    expect(result).toEqual({ data: { node: null }, statements: expect.any(Array) });
  });
});

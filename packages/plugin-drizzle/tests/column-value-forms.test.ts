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
  numeric as pgNumeric,
  pgTable,
  text as pgText,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  getTableConfig,
  integer,
  numeric,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type { ExecutionResult } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { getCursorParser } from '../src/utils/cursors';

// Values the plugin can write into a cursor or ID are read back, whatever JS type a driver option
// made the row value: the checks reject only what no row of the column holds, and never pass a
// value of the wrong type to SQL, where the database's error would carry the query.

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
    bigNumeric: pgNumeric({ mode: 'bigint' }).notNull(),
    value: doublePrecision().notNull(),
    mood: mood().notNull(),
    label: pgText().notNull(),
    uid: uuid().notNull(),
    amount: pgNumeric().notNull(),
    bigText: bigint({ mode: 'string' }).notNull(),
    tags: pgText().array().notNull(),
  });

  it('accepts a number or bigint only for a column holding a number as text', () => {
    for (const column of [readings.amount, readings.bigText]) {
      const parse = getCursorParser(['value', 'id'], [column, readings.id]);

      expect(parse(cursor('DC:T:["N:2","N:1"]'))).toEqual({ value: 2, id: 1 });
      expect(parse(cursor('DC:T:["I:2","N:1"]'))).toEqual({ value: BigInt(2), id: 1 });
      expect(parse(cursor('DC:J:[2,1]'))).toEqual({ value: 2, id: 1 });
    }

    for (const column of [readings.label, readings.uid, readings.mood]) {
      const parse = getCursorParser(['value', 'id'], [column, readings.id]);

      expect(() => parse(cursor('DC:T:["N:2","N:1"]'))).toThrow('Invalid cursor.');
      expect(() => parse(cursor('DC:T:["I:2","N:1"]'))).toThrow('Invalid cursor.');
      expect(() => parse(cursor('DC:J:[2,1]'))).toThrow('Invalid cursor.');
    }
  });

  it('accepts an enum label the schema no longer lists', () => {
    expect(getCursorParser(['mood'], [readings.mood])(cursor('DC:S:angry'))).toEqual({
      mood: 'angry',
    });
  });

  it('accepts only a bigint in 64 bits for a bigint column', () => {
    const parse = getCursorParser(['big'], [readings.big]);

    expect(parse(cursor('DC:I:9223372036854775807'))).toEqual({
      big: BigInt('9223372036854775807'),
    });
    expect(() => parse(cursor('DC:I:9223372036854775808'))).toThrow('Invalid cursor.');
    expect(() => parse(cursor('DC:N:5'))).toThrow('Invalid cursor.');
    expect(() => parse(cursor('DC:S:5'))).toThrow('Invalid cursor.');
    expect(() => parse(cursor('DC:N:1.5'))).toThrow('Invalid cursor.');
    expect(() => parse(cursor('DC:O:{"a":1}'))).toThrow('Invalid cursor.');
  });

  it('accepts a bigint beyond 64 bits for a numeric bigint column', () => {
    const parse = getCursorParser(['bigNumeric'], [readings.bigNumeric]);

    expect(parse(cursor('DC:I:99999999999999999999'))).toEqual({
      bigNumeric: BigInt('99999999999999999999'),
    });
    expect(() => parse(cursor('DC:N:5'))).toThrow('Invalid cursor.');
  });

  it("accepts a bigint in the column's range for an integer column", () => {
    const parse = getCursorParser(['id'], [readings.id]);

    expect(parse(cursor('DC:I:3'))).toEqual({ id: BigInt(3) });
    expect(() => parse(cursor('DC:I:2147483648'))).toThrow('Invalid cursor.');
  });

  it('accepts only an array for an array column', () => {
    const parse = getCursorParser(['tags', 'id'], [readings.tags, readings.id]);

    expect(parse(cursor('DC:T:["O:[\\"a\\"]","N:1"]'))).toEqual({ tags: ['a'], id: 1 });
    expect(parse(cursor('DC:J:[["a"],1]'))).toEqual({ tags: ['a'], id: 1 });
    expect(() => parse(cursor('DC:T:["S:a","N:1"]'))).toThrow('Invalid cursor.');
    expect(() => parse(cursor('DC:J:["a",1]'))).toThrow('Invalid cursor.');
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
      amount: numeric().notNull(),
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
      byAmount: t.drizzleConnection({
        type: 'items',
        resolve: (query) => db.query.items.findMany(query({ orderBy: { amount: 'asc' } })),
      }),
    }),
  });

  let schema: ReturnType<typeof builder.toSchema>;

  beforeAll(async () => {
    await client.execute(
      `create table items (id integer primary key, name text not null, seq integer not null,
        area text, code text not null, amount numeric not null)`,
    );
    await client.execute('create unique index items_area_code on items (area, code)');
    await db.insert(items).values([
      { id: 1, name: '1', seq: 1, area: 'north', code: 'a', amount: '1.5' },
      { id: 2, name: '2', seq: 2, area: null, code: 'b', amount: '2' },
      { id: 3, name: '3', seq: 3, area: 'south', code: 'c', amount: '3.25' },
      { id: 4, name: '4', seq: 4, area: 'south', code: 'd', amount: '4' },
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
    // a numeric column read as a number
    ['byAmount', 'DC:N:2'],
    // an integer column read as a bigint
    ['bySeq', 'DC:I:2'],
  ])('pages %s from a cursor holding %s', async (field, payload) => {
    const result = await run(page(field), { after: cursor(payload) });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      [field]: { edges: [{ node: { key: 3 } }, { node: { key: 4 } }] },
    });
  });

  it.each([
    ['a number', 'DC:N:2'],
    ['a bigint', 'DC:I:2'],
    ['an object', 'DC:O:{"a":1}'],
    ['an array, read as a one-part prefix', 'DC:O:[1]'],
  ])('rejects %s for a plain text column', async (_name, payload) => {
    const result = await run(page('byName'), { after: cursor(payload) });

    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid cursor.']);
    expect(result.statements).toEqual([]);
  });

  it('rejects a number for a plain text column in a compound ID', async () => {
    const result = await run('query ($id: ID!) { node(id: $id) { id } }', {
      id: globalID('Item', '[1,"a"]'),
    });

    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid ID.']);
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

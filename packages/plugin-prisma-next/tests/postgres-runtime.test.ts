import { readFileSync } from 'node:fs';
import { Temporal } from '@js-temporal/polyfill';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import postgres from '@prisma/orm-postgres/runtime';
import { graphql } from 'graphql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { mutationCases } from './fixtures/mutation-cases';
import type { Contract } from './postgres/contract';

// This fixture intentionally uses another dialect through the same plugin.
// The application, not Pothos, owns the driver and temporal codec.
Object.assign(globalThis, { Temporal });
const url =
  process.env.POTHOS_PRISMA_NEXT_DATABASE_URL ??
  'postgresql://prisma:prisma@localhost:5456/prisma_next';
const contract = JSON.parse(
  readFileSync(new URL('./postgres/contract.json', import.meta.url), 'utf8'),
) as Contract;
// RC9's programmatic emitter omits defaults required by its JSON deserializer.
for (const namespace of Object.values(contract.storage.namespaces)) {
  for (const table of Object.values(namespace.entries.table)) {
    const serialized = table as unknown as {
      uniques?: unknown[];
      foreignKeys?: unknown[];
      indexes?: { unique?: boolean }[];
    };
    serialized.uniques ??= [];
    serialized.foreignKeys ??= [];
    serialized.indexes ??= [];
    for (const index of serialized.indexes) {
      index.unique ??= false;
    }
  }
}
const client = postgres<Contract>({ contractJson: contract, url, verifyMarker: false });
const raw = new Client({ connectionString: url });

function createSchema(orm = client.orm) {
  const builder = new SchemaBuilder<{
    PrismaNextContract: Contract;
  }>({ plugins: [RelayPlugin, prismaNextPlugin], relay: {}, prismaNext: { contract } });
  builder.prismaNode('Account', {
    id: { field: 'id' },
    collection: () => orm.public.Account,
    fields: (t) => ({
      name: t.exposeString('name'),
      entries: t.relation('entries', { query: { orderBy: (entry) => entry.id.asc() } }),
      count: t.relationCount('entries'),
      losslessCount: t.string({
        select: { entries: (entries) => ({ count: entries.countBigInt() }) },
        resolve: (row) => String(row.count),
      }),
      average: t.string({
        nullable: true,
        select: { entries: (entries) => ({ average: entries.avgDecimal('wide') }) },
        resolve: (row) => (row.average === null ? null : String(row.average)),
      }),
      amount: t.relationAggregate('entries', { op: 'sum', field: 'amount' }),
    }),
  });
  builder.prismaObject('Entry', {
    fields: (t) => ({
      id: t.exposeID('id'),
      account: t.relation('account'),
      wide: t.string({ select: ['wide'], resolve: (row) => String(row.wide) }),
      exact: t.string({ select: ['exact'], resolve: (row) => String(row.exact) }),
      payload: t.string({
        select: ['payload'],
        resolve: (row) => Buffer.from(row.payload).toString('hex'),
      }),
      createdAt: t.string({
        select: ['createdAt'],
        resolve: (row) => row.createdAt.toString(),
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      accounts: t.prismaField({
        type: ['Account'],
        resolve: () => orm.public.Account.orderBy((account) => account.id.asc()),
      }),
      timeline: t.prismaConnection({
        type: 'Entry',
        cursor: [
          {
            field: 'createdAt',
            direction: 'desc',
            codec: {
              encode: (value) => String(value),
              decode: (value) => globalThis.Temporal.Instant.from(String(value)),
            },
          },
          'id',
        ],
        resolve: () => orm.public.Entry,
      }),
      entries: t.prismaConnection({
        type: 'Entry',
        cursor: 'id',
        totalCount: true,
        resolve: () => orm.public.Entry,
      }),
    }),
  });
  return builder.toSchema();
}

function nullableConnectionSchema(nulls: 'first' | 'last', direction: 'asc' | 'desc') {
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract },
  });
  const cursor = [{ field: 'sortLabel', direction, nulls }, 'id'] as const;
  builder.prismaObject('Entry', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.prismaObject('Account', {
    fields: (t) => ({
      id: t.exposeID('id'),
      entries: t.relatedConnection('entries', { cursor, totalCount: true }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      entries: t.prismaConnection({
        type: 'Entry',
        cursor,
        totalCount: true,
        resolve: () => client.orm.public.Entry,
      }),
      accounts: t.prismaField({
        type: ['Account'],
        resolve: () => client.orm.public.Account.orderBy((account) => account.id.asc()),
      }),
    }),
  });
  return builder.toSchema();
}

describe('PostgreSQL through the shared SQL-family plugin', () => {
  mutationCases(client, raw, contract);

  beforeAll(async () => {
    await raw.connect();
    await raw.query(`
      CREATE TABLE pothos_next_account (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE pothos_next_entry (
        id text PRIMARY KEY, "accountId" text NOT NULL REFERENCES pothos_next_account(id),
        amount double precision NOT NULL, wide bigint NOT NULL, exact numeric NOT NULL,
        payload bytea NOT NULL, "createdAt" timestamptz NOT NULL, "sortLabel" text
      );
      INSERT INTO pothos_next_account VALUES ('a', 'Alice'), ('b', 'Bob');
      INSERT INTO pothos_next_entry (id, "accountId", amount, wide, exact, payload, "createdAt") VALUES
        ('e1', 'a', 1.25, 9007199254740993, 12345678901234567890.125,
         decode('00ff10', 'hex'), '2026-09-10T12:34:56.123456Z'),
        ('e2', 'a', 2.5, 9007199254740995, 1.5,
         decode('ab', 'hex'), '2026-09-11T12:34:56.123456Z');
    `);
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await raw.query('DROP TABLE IF EXISTS pothos_next_entry, pothos_next_account');
    await raw.end();
  });

  it('preserves included wide numbers, decimal, bytes and temporal precision', async () => {
    const result = await graphql({
      schema: createSchema(),
      source:
        '{ accounts { name count losslessCount average amount entries { id wide exact payload createdAt account { name } } } }',
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchObject({
      accounts: [
        {
          name: 'Alice',
          count: 2,
          losslessCount: '2',
          average: '9007199254740994.0000',
          amount: 3.75,
          entries: [
            {
              id: 'e1',
              wide: '9007199254740993',
              exact: '12345678901234567890.125',
              payload: '00ff10',
              createdAt: '2026-09-10T12:34:56.123456Z',
              account: { name: 'Alice' },
            },
            { id: 'e2', wide: '9007199254740995' },
          ],
        },
        { name: 'Bob', count: 0, amount: null, entries: [] },
      ],
    });
  });

  it('continues a connection with the same count and no repeated rows', async () => {
    const schema = createSchema();
    const first = await graphql({
      schema,
      source: '{ entries(first: 1) { totalCount edges { node { id } } pageInfo { endCursor } } }',
      contextValue: {},
    });
    expect(first.errors).toBeUndefined();
    const page = first.data?.entries as { totalCount: number; pageInfo: { endCursor: string } };
    expect(page.totalCount).toBe(2);
    const second = await graphql({
      schema,
      source:
        'query ($after: String!) { entries(first: 1, after: $after) { totalCount edges { node { id } } } }',
      variableValues: { after: page.pageInfo.endCursor },
      contextValue: {},
    });
    expect(second.errors).toBeUndefined();
    expect(second.data).toMatchObject({
      entries: { totalCount: 2, edges: [{ node: { id: 'e2' } }] },
    });
  });

  it('round trips Temporal cursor values through an application-provided codec', async () => {
    const schema = createSchema();
    const first = await graphql({
      schema,
      source: '{ timeline(first: 1) { edges { node { id } } pageInfo { endCursor } } }',
      contextValue: {},
    });
    expect(first.errors).toBeUndefined();
    expect(first.data).toMatchObject({ timeline: { edges: [{ node: { id: 'e2' } }] } });
    const page = first.data?.timeline as { pageInfo: { endCursor: string } };
    const second = await graphql({
      schema,
      source:
        'query ($after: String!) { timeline(first: 1, after: $after) { edges { node { id } } } }',
      variableValues: { after: page.pageInfo.endCursor },
      contextValue: {},
    });
    expect(second.errors).toBeUndefined();
    expect(second.data).toMatchObject({ timeline: { edges: [{ node: { id: 'e1' } }] } });
  });

  it('executes the complete selection inside the caller transaction', async () => {
    const rollback = new Error('rollback fixture');
    await expect(
      client.transaction(async (tx) => {
        await tx.orm.public.Account.where({ id: 'a' }).update({ name: 'In transaction' });
        const result = await graphql({
          schema: createSchema(tx.orm),
          source: '{ accounts { name count entries { account { name } } } }',
          contextValue: {},
        });
        expect(result.errors).toBeUndefined();
        expect(result.data?.accounts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'In transaction',
              count: 2,
              entries: [
                { account: { name: 'In transaction' } },
                { account: { name: 'In transaction' } },
              ],
            }),
          ]),
        );
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    const result = await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a']);
    expect(result.rows[0].name).toBe('Alice');
  });

  it('batch-loads conflicting to-one selections through the context transaction', async () => {
    let providerCalls = 0;
    const builder = new SchemaBuilder<{
      PrismaNextContract: Contract;
      Context: { orm: typeof client.orm };
    }>({
      plugins: [prismaNextPlugin],
      prismaNext: {
        contract,
        collections: (context) => {
          providerCalls += 1;
          return { Account: context.orm.public.Account, Entry: context.orm.public.Entry };
        },
      },
    });
    builder.prismaObject('Account', {
      fields: (t) => ({ name: t.exposeString('name') }),
    });
    builder.prismaObject('Entry', {
      fields: (t) => ({
        original: t.relation('account', {
          nullable: true,
          query: { where: { name: 'Alice' } },
        }),
        current: t.relation('account', {
          nullable: true,
          query: { where: { name: 'In transaction' } },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        entries: t.prismaField({
          type: ['Entry'],
          resolve: (_parent, _args, context) => context.orm.public.Entry,
        }),
      }),
    });
    const schema = builder.toSchema();
    const rollback = new Error('rollback fallback fixture');
    await expect(
      client.transaction(async (tx) => {
        await tx.orm.public.Account.where({ id: 'a' }).update({ name: 'In transaction' });
        const result = await graphql({
          schema,
          source: '{ entries { original { name } current { name } } }',
          contextValue: { orm: tx.orm },
        });
        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual({
          entries: [
            { original: null, current: { name: 'In transaction' } },
            { original: null, current: { name: 'In transaction' } },
          ],
        });
        expect(providerCalls).toBeGreaterThan(0);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    const result = await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a']);
    expect(result.rows[0].name).toBe('Alice');
  });

  it.each([
    ['first', 'asc', ['e1', 'e5', 'e3', 'e6', 'e2', 'e4']],
    ['last', 'asc', ['e3', 'e6', 'e2', 'e4', 'e1', 'e5']],
    ['first', 'desc', ['e1', 'e5', 'e2', 'e4', 'e3', 'e6']],
    ['last', 'desc', ['e2', 'e4', 'e3', 'e6', 'e1', 'e5']],
  ] as const)('paginates nullable %s/%s cursors forward, backward, and per related parent', async (nulls, direction, expected) => {
    await raw.query(`
        UPDATE pothos_next_entry SET "sortLabel" = 'B' WHERE id = 'e2';
        INSERT INTO pothos_next_entry
          (id, "accountId", amount, wide, exact, payload, "createdAt", "sortLabel")
        SELECT extra.id, extra.account, amount, wide, exact, payload, "createdAt", extra.label
        FROM pothos_next_entry
        CROSS JOIN (VALUES
          ('e3', 'a', 'A'), ('e4', 'b', 'B'), ('e5', 'b', NULL), ('e6', 'b', 'A')
        ) AS extra(id, account, label)
        WHERE pothos_next_entry.id = 'e1';
      `);
    try {
      const schema = nullableConnectionSchema(nulls, direction);
      type Page = {
        totalCount: number;
        edges: { cursor: string; node: { id: string } }[];
        pageInfo: {
          startCursor: string;
          endCursor: string;
          hasNextPage: boolean;
          hasPreviousPage: boolean;
        };
      };
      const page = async (variables: Record<string, unknown>): Promise<Page> => {
        const result = await graphql({
          schema,
          source: `query($first: Int, $last: Int, $after: String, $before: String) {
              entries(first: $first, last: $last, after: $after, before: $before) {
                totalCount edges { cursor node { id } }
                pageInfo { startCursor endCursor hasNextPage hasPreviousPage }
              }
            }`,
          variableValues: variables,
          contextValue: {},
        });
        expect(result.errors).toBeUndefined();
        return result.data?.entries as Page;
      };
      const cursors = new Map<string, string>();
      const forward: string[] = [];
      let after: string | undefined;
      for (let index = 0; index < 3; index += 1) {
        const result = await page({ first: 2, after });
        expect(result.totalCount).toBe(6);
        expect(result.edges).toHaveLength(2);
        for (const edge of result.edges) {
          forward.push(edge.node.id);
          cursors.set(edge.node.id, edge.cursor);
        }
        expect(result.pageInfo.hasNextPage).toBe(index < 2);
        after = result.pageInfo.endCursor;
      }
      expect(forward).toEqual(expected);
      const backward: string[] = [];
      let before: string | undefined;
      for (let index = 0; index < 3; index += 1) {
        const result = await page({ last: 2, before });
        expect(result.edges).toHaveLength(2);
        backward.unshift(...result.edges.map((edge) => edge.node.id));
        expect(result.pageInfo.hasPreviousPage).toBe(index < 2);
        before = result.pageInfo.startCursor;
      }
      expect(backward).toEqual(expected);
      const bounded = await page({
        first: 10,
        after: cursors.get(expected[1]),
        before: cursors.get(expected[4]),
      });
      expect(bounded.edges.map((edge) => edge.node.id)).toEqual(expected.slice(2, 4));

      const related = await graphql({
        schema,
        source: '{ accounts { id entries(first: 2) { totalCount edges { node { id } } } } }',
        contextValue: {},
      });
      expect(related.errors).toBeUndefined();
      expect(related.data).toEqual({
        accounts: ['a', 'b'].map((id) => ({
          id,
          entries: {
            totalCount: 3,
            edges: expected
              .filter((entry) =>
                (id === 'a' ? ['e1', 'e2', 'e3'] : ['e4', 'e5', 'e6']).includes(entry),
              )
              .slice(0, 2)
              .map((entry) => ({ node: { id: entry } })),
          },
        })),
      });
    } finally {
      await raw.query(`
          DELETE FROM pothos_next_entry WHERE id IN ('e3', 'e4', 'e5', 'e6');
          UPDATE pothos_next_entry SET "sortLabel" = NULL;
        `);
    }
  });
});

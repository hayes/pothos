import { Temporal } from '@js-temporal/polyfill';
import SchemaBuilder, { PothosValidationError } from '@pothos/core';
import RelayPlugin, { encodeGlobalID } from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import { SqlQueryError } from '@prisma/orm-family-sql/errors';
import postgres from '@prisma/orm-postgres/runtime';
import postgresServerless from '@prisma/orm-postgres/serverless';
import { graphql } from 'graphql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import PrismaNextPlugin from '../src';
import { isRefusedValue } from '../src/utils/errors';
import { loadPostgresContract, postgresUrl as url } from './fixtures/helpers';
import type { Contract } from './postgres/contract';

// The application, not Pothos, provides Temporal for the temporal codec.
Object.assign(globalThis, { Temporal });
const contract = loadPostgresContract<Contract>(
  new URL('./postgres/contract.json', import.meta.url),
);
let statements = 0;
const client = postgres({
  contract,
  url,
  verifyMarker: false,
  middleware: [
    {
      name: 'pothos-test-statement-count',
      familyId: 'sql',
      beforeEncode() {
        statements += 1;
        return Promise.resolve();
      },
    },
  ],
});
const raw = new Client({ connectionString: url });

/** `db` may be a connection or transaction, which the plugin also loads through. */
function createSchema(db: { orm: typeof client.orm } = client) {
  const { orm } = db;
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, PrismaNextPlugin],
    relay: {},
    prismaNext: { client: () => db, context: client.context },
  });
  builder.prismaNode('Account', {
    id: { field: 'id' },
    collection: () => orm.public.Account,
    fields: (t) => ({
      name: t.exposeString('name'),
      entries: t.relation('entries', { query: { orderBy: { id: 'asc' } } }),
      count: t.relationCount('entries'),
      losslessCount: t.string({
        select: { count: { entries: (entries) => entries.countBigInt() } },
        resolve: (row) => String(row.count),
      }),
      average: t.string({
        nullable: true,
        select: { average: { entries: (entries) => entries.avgDecimal('wide') } },
        resolve: (row) => (row.average === null ? null : String(row.average)),
      }),
      amount: t.float({
        nullable: true,
        select: { amount: { entries: (entries) => entries.sum('amount') } },
        resolve: (row) => row.amount,
      }),
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
        collection: () => orm.public.Account.orderBy((account) => account.id.asc()),
      }),
      timeline: t.prismaConnection({
        type: 'Entry',
        query: { orderBy: { createdAt: 'desc', id: 'asc' } },
        collection: () => orm.public.Entry,
      }),
      entries: t.prismaConnection({
        type: 'Entry',
        totalCount: true,
        collection: () => orm.public.Entry,
      }),
      byWide: t.prismaConnection({
        type: 'Entry',
        query: { orderBy: { wide: 'desc', id: 'asc' } },
        collection: () => orm.public.Entry,
      }),
      byExact: t.prismaConnection({
        type: 'Entry',
        query: { orderBy: { exact: 'asc' } },
        collection: () => orm.public.Entry,
      }),
    }),
  });
  return builder.toSchema();
}

function nullableConnectionSchema(nulls: 'first' | 'last', direction: 'asc' | 'desc') {
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, PrismaNextPlugin],
    relay: {},
    prismaNext: { client },
  });
  const orderBy = { sortLabel: { direction, nulls }, id: 'asc' } as const;
  builder.prismaObject('Entry', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.prismaObject('Account', {
    fields: (t) => ({
      id: t.exposeID('id'),
      entries: t.relatedConnection('entries', { query: { orderBy }, totalCount: true }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      entries: t.prismaConnection({
        type: 'Entry',
        query: { orderBy },
        totalCount: true,
        collection: () => client.orm.public.Entry,
      }),
      accounts: t.prismaField({
        type: ['Account'],
        collection: () => client.orm.public.Account.orderBy((account) => account.id.asc()),
      }),
    }),
  });
  return builder.toSchema();
}

function createMutationSchema() {
  const events: string[] = [];
  let providerCalls = 0;
  const builder = new SchemaBuilder<{
    PrismaNextContract: Contract;
    Context: { orm: typeof client.orm };
  }>({
    plugins: [PrismaNextPlugin, WithInputPlugin],
    prismaNext: {
      // The request context carries the transaction's `orm`.
      client: (ctx) => {
        providerCalls += 1;
        return ctx;
      },
      context: client.context,
    },
  });
  const Account = builder.prismaObject('Account', {
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      entries: t.relation('entries', { query: { orderBy: { id: 'asc' } } }),
      completedName: t.string({
        select: ['name'],
        resolve: async (account) => {
          await Promise.resolve();
          events.push(`completed:${account.name}`);
          return account.name;
        },
      }),
      fail: t.string({
        nullable: false,
        resolve: () => {
          throw new Error('mutation result failed');
        },
      }),
    }),
  });
  builder.prismaObject('Entry', {
    fields: (t) => ({
      id: t.exposeID('id'),
      // A row the plugin didn't load, so its fields reload.
      reloaded: t.field({
        type: Account,
        select: ['accountId'],
        // @ts-expect-error a row built by hand isn't planned; it reloads
        resolve: (entry) => ({ id: entry.accountId }),
      }),
      current: t.relation('account'),
    }),
  });
  builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
  builder.mutationType({
    fields: (t) => ({
      createAccount: t.prismaField({
        type: 'Account',
        nullable: false,
        args: { id: t.arg.string({ required: true }), name: t.arg.string({ required: true }) },
        collection: async (_root, args, context) => {
          await context.orm.public.Account.create(args);
          return context.orm.public.Account.where({ id: args.id });
        },
      }),
      rename: t.prismaFieldWithInput({
        type: 'Account',
        nullable: false,
        input: { name: t.input.string({ required: true }) },
        collection: async (_root, args, context) => {
          events.push(`write:${args.input.name}`);
          await context.orm.public.Account.where({ id: 'a' }).update({ name: args.input.name });
          return context.orm.public.Account.where({ id: 'a' });
        },
      }),
      closedTransaction: t.prismaField({
        type: 'Account',
        nullable: true,
        collection: () =>
          client.transaction(async (tx) => tx.orm.public.Account.where({ id: 'a' })),
      }),
      missing: t.prismaField({
        type: 'Account',
        nullable: true,
        collection: (_root, _args, context) => context.orm.public.Account.where({ id: 'absent' }),
      }),
    }),
  });
  return { schema: builder.toSchema(), events, providerCalls: () => providerCalls };
}

describe('PostgreSQL through the shared SQL-family plugin', () => {
  describe('GraphQL mutation results', () => {
    it('creates through prismaField in a caller transaction and returns the selected result', async () => {
      const { schema } = createMutationSchema();
      try {
        const result = await client.transaction((tx) =>
          graphql({
            schema,
            source:
              'mutation { createAccount(id: "mutation-created", name: "Created") { id name entries { id } } missing { id } }',
            contextValue: { orm: tx.orm },
          }),
        );
        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual({
          createAccount: { id: 'mutation-created', name: 'Created', entries: [] },
          missing: null,
        });
        expect(
          (
            await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', [
              'mutation-created',
            ])
          ).rows,
        ).toEqual([{ name: 'Created' }]);
      } finally {
        await raw.query('DELETE FROM pothos_next_account WHERE id = $1', ['mutation-created']);
      }
    });

    it('completes serial input mutations and nested reloads before the next write', async () => {
      const fixture = createMutationSchema();
      const rollback = new Error('rollback serial mutation fixture');
      await expect(
        client.transaction(async (tx) => {
          const result = await graphql({
            schema: fixture.schema,
            source: `mutation {
            first: rename(input: { name: "First" }) { completedName entries { reloaded { name } current { name } } }
            second: rename(input: { name: "Second" }) { completedName entries { reloaded { name } current { name } } }
          }`,
            contextValue: { orm: tx.orm },
          });
          expect(result.errors).toBeUndefined();
          expect(result.data).toEqual({
            first: {
              completedName: 'First',
              entries: [
                { reloaded: { name: 'First' }, current: { name: 'First' } },
                { reloaded: { name: 'First' }, current: { name: 'First' } },
              ],
            },
            second: {
              completedName: 'Second',
              entries: [
                { reloaded: { name: 'Second' }, current: { name: 'Second' } },
                { reloaded: { name: 'Second' }, current: { name: 'Second' } },
              ],
            },
          });
          expect(fixture.events).toEqual([
            'write:First',
            'completed:First',
            'write:Second',
            'completed:Second',
          ]);
          // The client is read once per request.
          expect(fixture.providerCalls()).toBe(1);
          // An independent connection cannot see either uncommitted mutation.
          expect(
            (await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a'])).rows,
          ).toEqual([{ name: 'Alice' }]);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
      expect(
        (await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a'])).rows,
      ).toEqual([{ name: 'Alice' }]);
    });

    it('rejects a Collection whose resolver already ended its transaction', async () => {
      const { schema } = createMutationSchema();
      const result = await graphql({
        schema,
        source: 'mutation { closedTransaction { name entries { current { name } } } }',
        contextValue: { orm: client.orm },
      });
      expect(result.data).toEqual({ closedTransaction: null });
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].path).toEqual(['closedTransaction']);
      expect(result.errors?.[0].message).toMatch(/transaction|committed|closed/i);
    });

    it('lets the application roll back writes when GraphQL reports a result-field error', async () => {
      const { schema, events } = createMutationSchema();
      await expect(
        client.transaction(async (tx) => {
          const result = await graphql({
            schema,
            source:
              'mutation { rename(input: { name: "Rollback" }) { name fail } later: rename(input: { name: "Must not run" }) { name } }',
            contextValue: { orm: tx.orm },
          });
          expect(result.data).toBeNull();
          expect(result.errors).toHaveLength(1);
          expect(result.errors?.[0].path).toEqual(['rename', 'fail']);
          // graphql() resolves with errors; throwing is the caller's rollback policy.
          throw result.errors?.[0];
        }),
      ).rejects.toThrow('mutation result failed');
      expect(events).toEqual(['write:Rollback']);
      expect(
        (await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a'])).rows,
      ).toEqual([{ name: 'Alice' }]);
    });
  });

  beforeAll(async () => {
    await raw.connect();
    await raw.query(`
      DROP TABLE IF EXISTS pothos_next_token, pothos_next_event, pothos_next_entry, pothos_next_account;
      CREATE TABLE pothos_next_account (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE pothos_next_entry (
        id text PRIMARY KEY, "accountId" text NOT NULL REFERENCES pothos_next_account(id),
        amount double precision NOT NULL, wide bigint NOT NULL, exact numeric NOT NULL,
        payload bytea NOT NULL, "createdAt" timestamptz NOT NULL, "sortLabel" text
      );
      CREATE TABLE pothos_next_event (at timestamptz PRIMARY KEY, label text NOT NULL);
      CREATE TABLE pothos_next_token (
        id numeric(10, 2) PRIMARY KEY, wide bigint NOT NULL UNIQUE, bin bytea NOT NULL UNIQUE,
        label text NOT NULL
      );
      INSERT INTO pothos_next_token VALUES
        (0.5, 9007199254740993, decode('ff', 'hex'), 'half'),
        (1.5, 9007199254740995, decode('fe', 'hex'), 'one and a half');
      INSERT INTO pothos_next_event VALUES
        ('2026-09-10T12:00:00.000001Z', 'one'),
        ('2026-09-10T12:00:00.000002Z', 'two'),
        ('2026-09-10T12:00:00.000003Z', 'three');
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
    await raw.query(
      'DROP TABLE IF EXISTS pothos_next_token, pothos_next_event, pothos_next_entry, pothos_next_account',
    );
    await raw.end();
  });

  it('plans nested includes and counts into one statement', async () => {
    statements = 0;
    const result = await graphql({
      schema: createSchema(),
      source: `{
        accounts { name count entries { id account { name entries { id } count } } }
      }`,
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(statements).toBe(1);
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

  it('runs planned selections on a per-request serverless connection', async () => {
    await using connection = await postgresServerless({ contract }).connect({ url });
    const result = await graphql({
      schema: createSchema(connection),
      source: '{ accounts { name count entries { id account { name } } } }',
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data?.accounts).toEqual([
      {
        name: 'Alice',
        count: 2,
        entries: [
          { id: 'e1', account: { name: 'Alice' } },
          { id: 'e2', account: { name: 'Alice' } },
        ],
      },
      { name: 'Bob', count: 0, entries: [] },
    ]);
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

  it('round trips Temporal cursor values through the column codec', async () => {
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

  it.each([
    ['byWide', ['e2', 'e1']],
    ['byExact', ['e2', 'e1']],
  ])('pages over lossless numeric cursor values (%s)', async (field, expected) => {
    const schema = createSchema();
    const seen: string[] = [];
    let after: string | null = null;
    for (let i = 0; i <= expected.length; i += 1) {
      const result = await graphql({
        schema,
        source: `query ($after: String) { ${field}(first: 1, after: $after) { edges { node { id } } pageInfo { endCursor } } }`,
        variableValues: { after },
        contextValue: {},
      });
      expect(result.errors).toBeUndefined();
      const page = result.data?.[field] as {
        edges: { node: { id: string } }[];
        pageInfo: { endCursor: string };
      };
      seen.push(...page.edges.map((edge) => edge.node.id));
      after = page.pageInfo.endCursor;
    }
    expect(seen).toEqual(expected);
  });

  describe('column codecs from the client context', () => {
    function eventSchema() {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [RelayPlugin, PrismaNextPlugin],
        relay: {},
        prismaNext: { client },
      });
      const Event = builder.prismaObject('Event', {
        fields: (t) => ({
          label: t.string({ select: ['label'], resolve: (event) => event.label }),
          exposed: t.exposeString('label'),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          events: t.prismaConnection({
            type: 'Event',
            collection: () => client.orm.public.Event,
          }),
          keyed: t.field({
            type: [Event],
            resolve: () =>
              ['2026-09-10T12:00:00.000003Z', '2026-09-10T12:00:00.000001Z'].map((at) => ({
                at: Temporal.Instant.from(at),
              })) as never,
          }),
        }),
      });
      return builder.toSchema();
    }

    it('pages over a Temporal column without an application codec', async () => {
      const schema = eventSchema();
      const first = await graphql({
        schema,
        source: '{ events(first: 1) { edges { node { label } } pageInfo { endCursor } } }',
        contextValue: {},
      });
      expect(first.errors).toBeUndefined();
      expect(first.data).toMatchObject({ events: { edges: [{ node: { label: 'one' } }] } });
      const page = first.data?.events as { pageInfo: { endCursor: string } };
      const second = await graphql({
        schema,
        source:
          'query ($after: String!) { events(first: 1, after: $after) { edges { node { label } } } }',
        variableValues: { after: page.pageInfo.endCursor },
        contextValue: {},
      });
      expect(second.errors).toBeUndefined();
      // The microsecond between rows survives the cursor.
      expect(second.data).toMatchObject({ events: { edges: [{ node: { label: 'two' } }] } });
    });

    it('batches reloads keyed by Temporal identities', async () => {
      const result = await graphql({
        schema: eventSchema(),
        source: '{ keyed { label } }',
        contextValue: {},
      });
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ keyed: [{ label: 'three' }, { label: 'one' }] });
    });
  });

  describe('identities and IDs through column codecs', () => {
    function tokenSchema() {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [RelayPlugin, PrismaNextPlugin],
        relay: {},
        prismaNext: { client },
      });
      const Token = builder.prismaNode('Token', {
        id: { field: 'id' },
        fields: (t) => ({ label: t.exposeString('label') }),
      });
      const ByWide = builder.prismaNode('Token', {
        variant: 'TokenByWide',
        id: { field: 'wide' },
        fields: (t) => ({ label: t.exposeString('label') }),
      });
      const ByBin = builder.prismaNode('Token', {
        variant: 'TokenByBin',
        id: { field: 'bin' },
        fields: (t) => ({ label: t.exposeString('label') }),
      });
      const tokens = () => client.orm.public.Token.orderBy((token) => token.label.asc());
      builder.queryType({
        fields: (t) => ({
          tokens: t.prismaField({ type: [Token], collection: tokens }),
          byWide: t.prismaField({ type: [ByWide], collection: tokens }),
          byBin: t.prismaField({ type: [ByBin], collection: tokens }),
          // The database reads these back as 0.50 and 1.50.
          written: t.field({
            type: [Token],
            // @ts-expect-error a row built by hand isn't planned; it reloads
            resolve: () => [{ id: '0.5' }, { id: '1.5' }],
          }),
        }),
      });
      return builder.toSchema();
    }

    it('matches reloaded decimal identities written in another form', async () => {
      const result = await graphql({
        schema: tokenSchema(),
        source: '{ written { label } }',
        contextValue: {},
      });
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ written: [{ label: 'half' }, { label: 'one and a half' }] });
    });

    it.each([
      ['tokens', 'Token'],
      ['byWide', 'TokenByWide'],
      ['byBin', 'TokenByBin'],
    ])('round trips decimal, wide integer and bytes node IDs (%s)', async (field, type) => {
      const schema = tokenSchema();
      const listed = await graphql({ schema, source: `{ ${field} { id } }`, contextValue: {} });
      expect(listed.errors).toBeUndefined();
      const ids = (listed.data?.[field] as { id: string }[]).map((token) => token.id);
      expect(new Set(ids).size).toBe(2);
      const loaded = await graphql({
        schema,
        source: `query ($ids: [ID!]!) { nodes(ids: $ids) { __typename ... on ${type} { label } } }`,
        variableValues: { ids },
        contextValue: {},
      });
      expect(loaded.errors).toBeUndefined();
      expect(loaded.data).toEqual({
        nodes: [
          { __typename: type, label: 'half' },
          { __typename: type, label: 'one and a half' },
        ],
      });
    });

    it('serializes a compound ID with a wide integer for a custom id.parse', async () => {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [RelayPlugin, PrismaNextPlugin],
        relay: {},
        prismaNext: { client },
      });
      const Token = builder.prismaNode('Token', {
        id: {
          field: ['wide', 'label'],
          parse: (id) => {
            const [wide, label] = JSON.parse(id) as [string, string];
            return [BigInt(wide), label];
          },
        },
        fields: (t) => ({ label: t.exposeString('label') }),
      });
      builder.queryType({
        fields: (t) => ({
          tokens: t.prismaField({
            type: [Token],
            collection: () => client.orm.public.Token.orderBy((token) => token.label.asc()),
          }),
        }),
      });
      const schema = builder.toSchema();
      const listed = await graphql({ schema, source: '{ tokens { id } }', contextValue: {} });
      expect(listed.errors).toBeUndefined();
      const [{ id }] = listed.data?.tokens as { id: string }[];
      const loaded = await graphql({
        schema,
        source: 'query ($id: ID!) { node(id: $id) { ... on Token { label } } }',
        variableValues: { id },
        contextValue: {},
      });
      expect(loaded.errors).toBeUndefined();
      expect(loaded.data).toEqual({ node: { label: 'half' } });
    });

    it('fails only the node whose ID its column codec rejects', async () => {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [RelayPlugin, PrismaNextPlugin],
        relay: {},
        prismaNext: { client },
      });
      builder.prismaNode('Token', {
        variant: 'TokenByWide',
        id: { field: 'wide', parse: (id) => BigInt(id) },
        fields: (t) => ({ label: t.exposeString('label') }),
      });
      builder.queryType({});
      const result = await graphql({
        schema: builder.toSchema(),
        source: `query ($a: ID!, $b: ID!) {
          a: node(id: $a) { ... on TokenByWide { label } }
          b: node(id: $b) { ... on TokenByWide { label } }
        }`,
        variableValues: {
          a: encodeGlobalID('TokenByWide', '9007199254740993'),
          // Out of range for bigint, so the column codec rejects it.
          b: encodeGlobalID('TokenByWide', '99999999999999999999999'),
        },
        contextValue: {},
      });
      expect(result.data).toEqual({ a: { label: 'half' }, b: null });
      expect(result.errors?.map(({ message, path }) => ({ message, path }))).toEqual([
        { message: 'Invalid ID.', path: ['b'] },
      ]);
      expect(result.errors?.[0]?.originalError).toBeInstanceOf(PothosValidationError);
    });
  });

  describe('values the column codec accepts and the database refuses', () => {
    function textSchema() {
      const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
        plugins: [RelayPlugin, PrismaNextPlugin],
        relay: {},
        prismaNext: { client },
      });
      builder.prismaObject('Entry', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.prismaNode('Account', {
        id: { field: 'id' },
        fields: (t) => ({
          name: t.exposeString('name'),
          entries: t.relatedConnection('entries', { query: { orderBy: { id: 'asc' } } }),
        }),
      });
      builder.queryType({
        fields: (t) => ({
          accounts: t.prismaConnection({
            type: 'Account',
            collection: () => client.orm.public.Account,
          }),
          list: t.prismaField({
            type: ['Account'],
            collection: () => client.orm.public.Account.orderBy((account) => account.id.asc()),
          }),
        }),
      });
      return builder.toSchema();
    }

    // Postgres text can't hold a NUL, which the text codec accepts.
    const refused = 'x\u0000y';

    /** `cursor` with its value replaced by `refused`. */
    function refusedCursor(cursor: string) {
      const payload = Buffer.from(cursor, 'base64').toString();
      const prefix = payload.slice(0, payload.indexOf(':', 'PNC:'.length) + 1);
      return Buffer.from(`${prefix}S:${refused}`).toString('base64');
    }

    it('fails only the node whose ID the database refuses', async () => {
      const result = await graphql({
        schema: textSchema(),
        source: `query ($a: ID!, $b: ID!) {
          a: node(id: $a) { ... on Account { name } }
          b: node(id: $b) { ... on Account { name } }
        }`,
        variableValues: {
          a: encodeGlobalID('Account', 'a'),
          b: encodeGlobalID('Account', refused),
        },
        contextValue: {},
      });
      expect(result.data).toEqual({ a: { name: 'Alice' }, b: null });
      expect(result.errors?.map(({ message, path }) => ({ message, path }))).toEqual([
        { message: 'Invalid ID.', path: ['b'] },
      ]);
      expect(result.errors?.[0]?.originalError).toBeInstanceOf(PothosValidationError);
      expect((result.errors?.[0]?.originalError as Error).cause).toBeInstanceOf(SqlQueryError);
    });

    it('treats only values the database cannot represent as refused', () => {
      const state = (sqlState: string) => new SqlQueryError('', { sqlState });
      expect(['22021', '22P02', '22P05', '22007', '22008'].map(state).every(isRefusedValue)).toBe(
        true,
      );
      // Division by zero, numeric overflow and a bad regular expression aren't the value's.
      expect(['22012', '22003', '2201B', '23505'].map(state).some(isRefusedValue)).toBe(false);
    });

    it('refuses a root connection cursor the database refuses', async () => {
      const schema = textSchema();
      const first = await graphql({
        schema,
        source: '{ accounts(first: 1) { pageInfo { endCursor } } }',
        contextValue: {},
      });
      const { endCursor } = (first.data?.accounts as { pageInfo: { endCursor: string } }).pageInfo;
      const result = await graphql({
        schema,
        source:
          'query ($after: String) { accounts(first: 1, after: $after) { edges { node { name } } } }',
        variableValues: { after: refusedCursor(endCursor) },
        contextValue: {},
      });
      expect(result.data).toEqual({ accounts: null });
      expect(result.errors?.map(({ message, path }) => ({ message, path }))).toEqual([
        { message: 'Invalid cursor.', path: ['accounts'] },
      ]);
    });

    it.each([
      ['a prismaField', '{ list { entries(first: 1, after: $after) { edges { node { id } } } } }'],
      [
        'a node',
        `{ node(id: "${encodeGlobalID('Account', 'a')}") {
          ... on Account { entries(first: 1, after: $after) { edges { node { id } } } }
        } }`,
      ],
    ])('refuses a nested connection cursor the database refuses beneath %s', async (_, selection) => {
      const schema = textSchema();
      const first = await graphql({
        schema,
        source: '{ list { entries(first: 1) { pageInfo { endCursor } } } }',
        contextValue: {},
      });
      const [{ entries }] = first.data?.list as { entries: { pageInfo: { endCursor: string } } }[];
      const result = await graphql({
        schema,
        source: `query ($after: String) ${selection}`,
        variableValues: { after: refusedCursor(entries.pageInfo.endCursor) },
        contextValue: {},
      });
      expect(result.errors?.map(({ message }) => message)).toEqual(['Invalid cursor.']);
    });
  });

  it('applies native null placement and the orderBy option in both directions', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, PrismaNextPlugin],
      relay: {},
      prismaNext: { client },
    });
    builder.prismaObject('Entry', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        entries: t.prismaConnection({
          type: 'Entry',
          args: { nullsFirst: t.arg.boolean() },
          query: (args) => ({
            orderBy: {
              sortLabel: { direction: 'asc', nulls: args.nullsFirst ? 'first' : 'last' },
            },
          }),
          collection: () => client.orm.public.Entry,
        }),
      }),
    });
    const schema = builder.toSchema();
    const ids = async (query: string) => {
      const result = await graphql({
        schema,
        source: `{ ${query} { edges { node { id } } } }`,
        contextValue: {},
      });
      expect(result.errors).toBeUndefined();
      return (result.data?.entries as { edges: { node: { id: string } }[] }).edges.map(
        (edge) => edge.node.id,
      );
    };
    await raw.query(
      `UPDATE pothos_next_entry SET "sortLabel" = CASE id WHEN 'e1' THEN 'x' ELSE NULL END`,
    );
    try {
      expect(await ids('entries(first: 5)')).toEqual(['e1', 'e2']);
      expect(await ids('entries(first: 5, nullsFirst: true)')).toEqual(['e2', 'e1']);
      expect(await ids('entries(last: 5)')).toEqual(['e1', 'e2']);
      expect(await ids('entries(last: 1, nullsFirst: true)')).toEqual(['e1']);
    } finally {
      await raw.query(`UPDATE pothos_next_entry SET "sortLabel" = NULL`);
    }
  });

  it('executes the complete selection inside the caller transaction', async () => {
    const rollback = new Error('rollback fixture');
    await expect(
      client.transaction(async (tx) => {
        await tx.orm.public.Account.where({ id: 'a' }).update({ name: 'In transaction' });
        const result = await graphql({
          schema: createSchema(tx),
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
        // A transaction has no `context`, so node IDs encode and decode with the codecs of the
        // `context` passed beside the client function.
        const schema = createSchema(tx);
        const ids = await graphql({ schema, source: '{ accounts { id name } }', contextValue: {} });
        const id = (ids.data?.accounts as { id: string; name: string }[]).find(
          (account) => account.name === 'In transaction',
        )?.id;
        const node = await graphql({
          schema,
          source: 'query ($id: ID!) { node(id: $id) { ... on Account { name } } }',
          variableValues: { id },
          contextValue: {},
        });
        expect(node.errors).toBeUndefined();
        expect(node.data).toEqual({ node: { name: 'In transaction' } });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    const result = await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a']);
    expect(result.rows[0].name).toBe('Alice');
  });

  it('batch-loads reloads through the context transaction', async () => {
    let providerCalls = 0;
    const builder = new SchemaBuilder<{
      PrismaNextContract: Contract;
      Context: { tx: { orm: typeof client.orm } };
    }>({
      plugins: [PrismaNextPlugin],
      prismaNext: {
        client: (ctx) => {
          providerCalls += 1;
          return ctx.tx;
        },
        context: client.context,
      },
    });
    const Account = builder.prismaObject('Account', {
      fields: (t) => ({ name: t.exposeString('name') }),
    });
    builder.prismaObject('Entry', {
      fields: (t) => ({
        account: t.field({
          type: Account,
          select: ['accountId'],
          // @ts-expect-error a row built by hand isn't planned; it reloads
          resolve: (entry) => ({ id: entry.accountId }),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        entries: t.prismaField({
          type: ['Entry'],
          collection: (_parent, _args, context) => context.tx.orm.public.Entry,
        }),
      }),
    });
    const schema = builder.toSchema();
    const rollback = new Error('rollback reload fixture');
    await expect(
      client.transaction(async (tx) => {
        await tx.orm.public.Account.where({ id: 'a' }).update({ name: 'In transaction' });
        statements = 0;
        const result = await graphql({
          schema,
          source: '{ entries { account { name } } }',
          contextValue: { tx },
        });
        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual({
          entries: [
            { account: { name: 'In transaction' } },
            { account: { name: 'In transaction' } },
          ],
        });
        // The entries, then one batch reloading both parents' accounts.
        expect(statements).toBe(2);
        expect(providerCalls).toBe(1);
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

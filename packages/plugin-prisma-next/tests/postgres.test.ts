import { Temporal } from '@js-temporal/polyfill';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import postgres from '@prisma/orm-postgres/runtime';
import postgresServerless from '@prisma/orm-postgres/serverless';
import { graphql } from 'graphql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
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
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client: () => db, contract },
  });
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
        cursor: [{ field: 'createdAt', direction: 'desc' }, 'id'],
        resolve: () => orm.public.Entry,
      }),
      entries: t.prismaConnection({
        type: 'Entry',
        cursor: 'id',
        totalCount: true,
        resolve: () => orm.public.Entry,
      }),
      byWide: t.prismaConnection({
        type: 'Entry',
        cursor: [{ field: 'wide', direction: 'desc' }, 'id'],
        resolve: () => orm.public.Entry,
      }),
      byExact: t.prismaConnection({
        type: 'Entry',
        cursor: ['exact', 'id'],
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
    prismaNext: { client },
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

function createMutationSchema() {
  const events: string[] = [];
  let providerCalls = 0;
  const builder = new SchemaBuilder<{
    PrismaNextContract: Contract;
    Context: { orm: typeof client.orm };
  }>({
    plugins: [prismaNextPlugin, WithInputPlugin],
    prismaNext: {
      // The request context carries the transaction's `orm`.
      client: (context) => {
        providerCalls += 1;
        return context;
      },
      contract,
    },
  });
  builder.prismaObject('Account', {
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      entries: t.relation('entries', { query: { orderBy: (entry) => entry.id.asc() } }),
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
      original: t.relation('account', { nullable: true, query: { where: { name: 'Alice' } } }),
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
        resolve: async (_root, args, context) => {
          await context.orm.public.Account.create(args);
          return context.orm.public.Account.where({ id: args.id });
        },
      }),
      rename: t.prismaFieldWithInput({
        type: 'Account',
        nullable: false,
        input: { name: t.input.string({ required: true }) },
        resolve: async (_root, args, context) => {
          events.push(`write:${args.input.name}`);
          await context.orm.public.Account.where({ id: 'a' }).update({ name: args.input.name });
          return context.orm.public.Account.where({ id: 'a' });
        },
      }),
      closedTransaction: t.prismaField({
        type: 'Account',
        nullable: true,
        resolve: () => client.transaction(async (tx) => tx.orm.public.Account.where({ id: 'a' })),
      }),
      missing: t.prismaField({
        type: 'Account',
        nullable: true,
        resolve: (_root, _args, context) => context.orm.public.Account.where({ id: 'absent' }),
      }),
    }),
  });
  return { schema: builder.toSchema(), events, providerCalls: () => providerCalls };
}

describe('PostgreSQL through the shared SQL-family plugin', () => {
  describe('GraphQL mutation results', () => {
    it('creates through prismaField and commits only after completing the selected result', async () => {
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

    it('completes serial input mutations and nested fallback reads before the next write', async () => {
      const fixture = createMutationSchema();
      const rollback = new Error('rollback serial mutation fixture');
      await expect(
        client.transaction(async (tx) => {
          const result = await graphql({
            schema: fixture.schema,
            source: `mutation {
            first: rename(input: { name: "First" }) { completedName entries { original { name } current { name } } }
            second: rename(input: { name: "Second" }) { completedName entries { original { name } current { name } } }
          }`,
            contextValue: { orm: tx.orm },
          });
          expect(result.errors).toBeUndefined();
          expect(result.data).toEqual({
            first: {
              completedName: 'First',
              entries: [
                { original: null, current: { name: 'First' } },
                { original: null, current: { name: 'First' } },
              ],
            },
            second: {
              completedName: 'Second',
              entries: [
                { original: null, current: { name: 'Second' } },
                { original: null, current: { name: 'Second' } },
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
    expect(result.data?.accounts).toEqual(
      expect.arrayContaining([expect.objectContaining({ count: expect.any(Number) })]),
    );
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
        plugins: [RelayPlugin, prismaNextPlugin],
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
            cursor: 'at',
            resolve: () => client.orm.public.Event,
          }),
          keyed: t.field({
            type: [Event],
            resolve: () =>
              ['2026-09-10T12:00:00.000003Z', '2026-09-10T12:00:00.000001Z'].map((at) => ({
                at: globalThis.Temporal.Instant.from(at),
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

    it('batches fallback loads keyed by Temporal identities', async () => {
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
        plugins: [RelayPlugin, prismaNextPlugin],
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
          tokens: t.prismaField({ type: [Token], resolve: tokens }),
          byWide: t.prismaField({ type: [ByWide], resolve: tokens }),
          byBin: t.prismaField({ type: [ByBin], resolve: tokens }),
          // The database reads these back as 0.50 and 1.50.
          written: t.field({
            type: [Token],
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
        plugins: [RelayPlugin, prismaNextPlugin],
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
            resolve: () => client.orm.public.Token.orderBy((token) => token.label.asc()),
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
  });

  it('applies native null placement and the orderBy option in both directions', async () => {
    await raw.query(
      `UPDATE pothos_next_entry SET "sortLabel" = CASE id WHEN 'e1' THEN 'x' ELSE NULL END`,
    );
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client },
    });
    builder.prismaObject('Entry', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        entries: t.prismaConnection({
          type: 'Entry',
          cursor: ['sortLabel', 'id'],
          args: { nullsFirst: t.arg.boolean() },
          orderBy: (entry, args) =>
            entry.sortLabel.asc({ nulls: args.nullsFirst ? 'first' : 'last' }),
          resolve: () => client.orm.public.Entry,
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
    expect(await ids('entries(first: 5)')).toEqual(['e1', 'e2']);
    expect(await ids('entries(first: 5, nullsFirst: true)')).toEqual(['e2', 'e1']);
    expect(await ids('entries(last: 5)')).toEqual(['e1', 'e2']);
    expect(await ids('entries(last: 1, nullsFirst: true)')).toEqual(['e1']);
    await raw.query(`UPDATE pothos_next_entry SET "sortLabel" = NULL`);
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
      Context: { tx: { orm: typeof client.orm } };
    }>({
      plugins: [prismaNextPlugin],
      prismaNext: {
        client: (context) => {
          providerCalls += 1;
          return context.tx;
        },
        contract,
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
          resolve: (_parent, _args, context) => context.tx.orm.public.Entry,
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
          contextValue: { tx },
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

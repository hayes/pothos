import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/pg-core';
import type { ExecutionResult } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { queryClient } from './postgres/db';
import {
  type DrizzleRelations,
  db,
  drop,
  ITEM_COUNT,
  items,
  OWNER_ID,
  relations,
  seed,
} from './postgres/id-cursor/db';

// The postgres twin of `id-cursor-validation.test.ts`, on tables of its own. Postgres refuses a
// malformed parameter itself, with the SQL in the error, so a value has to be refused before it is
// sent. The cursors of a related connection are written from nested rows, which postgres returns
// through JSON, and have to read back like a root row's.

const ORDERS = {
  uid: { uid: 'asc' },
  bigNum: { bigNum: 'asc' },
  bigBig: { bigBig: 'asc' },
  ts: { ts: 'asc' },
  tsString: { tsString: 'asc' },
  tsz: { tsz: 'asc' },
  tszString: { tszString: 'asc' },
  day: { day: 'asc' },
  amount: { amount: 'asc' },
  score: { score: 'asc' },
  flag: { flag: 'asc' },
  label: { label: 'asc' },
  mood: { mood: 'asc' },
  code: { code: 'asc' },
} as const;

type Order = keyof typeof ORDERS;

const ORDER_KEYS = Object.keys(ORDERS) as Order[];

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

const ItemOrder = builder.enumType('ItemOrder', { values: ORDER_KEYS });

builder.drizzleNode('items', {
  name: 'Item',
  id: { column: items.uid },
  fields: (t) => ({ key: t.exposeInt('id') }),
});

const ItemByBig = builder.drizzleNode('items', {
  variant: 'ItemByBig',
  id: { column: items.bigBig },
  fields: (t) => ({ key: t.exposeInt('id') }),
});

builder.drizzleObject('owners', {
  name: 'Owner',
  fields: (t) => ({
    items: t.relatedConnection('items', {
      args: { order: t.arg({ type: ItemOrder, required: true }) },
      query: (args) => ({ orderBy: ORDERS[args.order] }),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    owner: t.drizzleField({
      type: 'owners',
      resolve: (query) => db.query.owners.findFirst(query({ where: { id: OWNER_ID } })),
    }),
    items: t.drizzleConnection({
      type: 'items',
      args: { order: t.arg({ type: ItemOrder, required: true }) },
      resolve: (query, _root, args) =>
        db.query.items.findMany(
          query({ where: { ownerId: OWNER_ID }, orderBy: ORDERS[args.order] }),
        ),
    }),
    itemsByBig: t.drizzleField({
      type: [ItemByBig],
      resolve: (query) =>
        db.query.items.findMany(query({ where: { ownerId: OWNER_ID }, orderBy: { id: 'asc' } })),
    }),
  }),
});

const schema = builder.toSchema();

const statements: string[] = [];

const session = Object.getPrototypeOf((db as unknown as { _: { session: object } })._.session) as {
  prepareQuery: (...args: unknown[]) => unknown;
};
const prepareQuery = session.prepareQuery;

session.prepareQuery = function patched(this: unknown, ...args: unknown[]) {
  statements.push((args[0] as { sql: string }).sql);

  return prepareQuery.apply(this, args);
};

beforeAll(seed);

afterAll(async () => {
  await drop();
  await queryClient.end();
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

function globalID(type: string, id: string) {
  return Buffer.from(`${type}:${id}`).toString('base64');
}

function cursor(payload: string) {
  return Buffer.from(payload).toString('base64');
}

function expectRefused(result: Awaited<ReturnType<typeof run>>, message: string) {
  expect(result.errors?.map((error) => error.message)).toEqual([message]);
  expect(result.statements).toEqual([]);
}

interface Page {
  edges: { cursor: string; node: { key: number } }[];
}

type Connection = 'root' | 'related';

const PAGE_ARGS = 'order: $order, first: $first, last: $last, after: $after, before: $before';
const PAGE = 'edges { cursor node { key } }';
const VARIABLES = '$order: ItemOrder!, $first: Int, $last: Int, $after: String, $before: String';

const DOCUMENTS: Record<Connection, string> = {
  root: `query (${VARIABLES}) { items(${PAGE_ARGS}) { ${PAGE} } }`,
  related: `query (${VARIABLES}) { owner { items(${PAGE_ARGS}) { ${PAGE} } } }`,
};

function pageOf(connection: Connection, data: unknown) {
  return connection === 'root'
    ? (data as { items: Page }).items
    : (data as { owner: { items: Page } }).owner.items;
}

async function page(connection: Connection, order: Order, args: Record<string, unknown>) {
  const result = await run(DOCUMENTS[connection], { order, ...args });

  expect(result.errors).toBeUndefined();

  return pageOf(connection, result.data);
}

describe('cursors on postgres', () => {
  describe.each(['root', 'related'] as const)('a %s connection', (connection) => {
    it.each(ORDER_KEYS)('pages by %s forward and backward from its own cursors', async (order) => {
      const all = await page(connection, order, { first: 100 });

      expect(all.edges).toHaveLength(ITEM_COUNT);

      for (const [index, edge] of all.edges.entries()) {
        const after = await page(connection, order, { first: 100, after: edge.cursor });
        const before = await page(connection, order, { last: 100, before: edge.cursor });
        const nextTwo = await page(connection, order, { first: 2, after: edge.cursor });
        const previousTwo = await page(connection, order, { last: 2, before: edge.cursor });

        expect(after.edges).toEqual(all.edges.slice(index + 1));
        expect(before.edges).toEqual(all.edges.slice(0, index));
        expect(nextTwo.edges).toEqual(all.edges.slice(index + 1, index + 3));
        expect(previousTwo.edges).toEqual(all.edges.slice(Math.max(0, index - 2), index));
      }
    });
  });

  it.each(ORDER_KEYS)('orders root and nested rows by %s alike', async (order) => {
    const root = await page('root', order, { first: 100 });
    const related = await page('related', order, { first: 100 });

    expect(related.edges.map((edge) => edge.node)).toEqual(root.edges.map((edge) => edge.node));
  });

  it.each([
    ['uid', 'DC:S:abc'],
    ['uid', 'DC:O:{"a":1}'],
    ['bigNum', 'DC:N:1.5'],
    ['bigBig', 'DC:S:abc'],
    ['bigBig', 'DC:N:1.5'],
    ['ts', 'DC:N:1'],
    ['ts', 'DC:S:2024-01-01'],
    ['tsz', 'DC:O:true'],
    ['flag', 'DC:N:1'],
    ['score', 'DC:O:{"a":1}'],
    ['mood', 'DC:O:[1]'],
    ['amount', 'DC:O:{}'],
  ] as const)('refuses a %s cursor %s before any SQL', async (order, payload) => {
    for (const connection of ['root', 'related'] as const) {
      const result = await run(DOCUMENTS[connection], {
        order,
        first: 2,
        after: cursor(payload),
      });

      expectRefused(result, 'Invalid cursor.');
    }
  });
});

describe('node IDs on postgres', () => {
  const nodeQuery = 'query ($id: ID!) { node(id: $id) { id ... on Item { key } } }';

  it('loads a row by the uuid ID it writes', async () => {
    const all = await run('{ items(order: uid, first: 100) { edges { node { id key } } } }');
    const nodes = (all.data as { items: { edges: { node: { id: string; key: number } }[] } }).items
      .edges;

    expect(nodes).toHaveLength(ITEM_COUNT);

    for (const { node } of nodes) {
      const result = await run(nodeQuery, { id: node.id });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ node });
    }
  });

  it('loads a row by the bigint ID it writes', async () => {
    const all = await run('{ itemsByBig { id key } }');
    const nodes = (all.data as { itemsByBig: { id: string; key: number }[] }).itemsByBig;

    expect(all.errors).toBeUndefined();
    expect(nodes).toHaveLength(ITEM_COUNT);
    // the largest bigint is written in full
    expect(nodes[0].id).toBe(globalID('ItemByBig', '9223372036854775807'));

    for (const node of nodes) {
      const result = await run(
        'query ($id: ID!) { node(id: $id) { id ... on ItemByBig { key } } }',
        {
          id: node.id,
        },
      );

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ node });
    }
  });

  it.each([
    ['Item', 'abc'],
    ['Item', 'c0000000-0000-4000-8000-00000000000'],
    ['ItemByBig', 'abc'],
    ['ItemByBig', '1.5'],
    ['ItemByBig', '01'],
  ])('refuses the %s ID %s before any SQL', async (type, id) => {
    const result = await run(nodeQuery, { id: globalID(type, id) });

    expectRefused(result, 'Invalid ID.');
  });
});

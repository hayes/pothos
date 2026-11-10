import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { type ExecutionResult, parse } from 'graphql';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

/**
 * Every page is checked against the connection's own unpaged list, `list`. With `window` the rows
 * of `list` strictly after `after` and strictly before `before`, and `size` `first ?? last`, or
 * the default page size:
 *
 * - edges are `window.slice(-size)` when only `last` is given, and `window.slice(0, size)`
 *   otherwise (so `before` alone, as by design in this plugin, gives the first rows up to it);
 * - `hasNextPage` is true with `before`, false with `last`, else whether `window` is longer than
 *   `size`; `hasPreviousPage` is true with `after`, else with only `last` whether `window` is
 *   longer than `size`, else false;
 * - `startCursor` and `endCursor` are the first and last edge's cursors, or null.
 *
 * Orderings are over non-null columns only: a nullable one drops rows by design.
 */

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
});

const ORDERS = {
  idAsc: { postId: 'asc' },
  idDesc: { postId: 'desc' },
  // ties, broken by the primary key the plugin appends
  publishedAsc: { published: 'asc' },
  publishedDesc: { published: 'desc' },
  twoColumns: { published: 'desc', title: 'asc' },
} as const;

type Order = keyof typeof ORDERS;

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({ id: t.exposeInt('postId') }),
});

builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    // five posts: published 0, 1, 0, 1, 0
    posts: t.relatedConnection('posts', {
      args: { order: t.arg.string({ required: true }) },
      query: (args) => ({
        where: { postId: { lte: 5 } },
        orderBy: ORDERS[args.order as Order],
      }),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: 'users',
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    // five posts: published 0, 1, 1, 1, 1; authors 1, 1, 2, 2, 2
    posts: t.drizzleConnection({
      type: 'posts',
      args: { order: t.arg.string({ required: true }) },
      resolve: (query, _root, args) =>
        db.query.posts.findMany(
          query({
            where: { postId: { gte: 14, lte: 18 } },
            orderBy: ORDERS[args.order as Order],
          }),
        ),
    }),
  }),
});

const schema = builder.toSchema();

interface Page {
  edges: { cursor: string; node: { id: number } }[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

interface Args {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

const PAGE =
  'edges { cursor node { id } } pageInfo { hasNextPage hasPreviousPage startCursor endCursor }';

const CONNECTIONS = {
  root: (fields: string) => `{ ${fields} }`,
  related: (fields: string) => `{ user { ${fields} } }`,
};

type Connection = keyof typeof CONNECTIONS;

// Every page of one ordering is an alias in one document, so a combination costs a query, not an
// execution.
async function pages(connection: Connection, order: Order, combinations: Args[]) {
  const aliases = combinations.map((args, i) => {
    const list = Object.entries({ order, ...args })
      .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
      .join(', ');

    return `p${i}: posts(${list}) { ${PAGE} }`;
  });

  const result = (await execute({
    schema,
    document: parse(CONNECTIONS[connection](aliases.join('\n'))),
    contextValue: {},
  })) as ExecutionResult<Record<string, unknown>>;

  expect(result.errors).toBeUndefined();

  const data = (connection === 'root' ? result.data : result.data?.user) as Record<string, Page>;

  return combinations.map((_, i) => data[`p${i}`]);
}

function expected(list: Page['edges'], { first, last, after, before }: Args): Page {
  const position = (cursor: string) => list.findIndex((edge) => edge.cursor === cursor);
  const start = after ? position(after) + 1 : 0;
  const end = before ? position(before) : list.length;
  const window = list.slice(start, Math.max(start, end));
  // with neither, the default page size, larger than any list here
  const size = first ?? last ?? 20;
  const backward = first == null && last != null;
  const edges = backward
    ? window.slice(window.length - Math.min(size, window.length))
    : window.slice(0, size);

  return {
    edges,
    pageInfo: {
      hasNextPage: before ? true : last != null ? false : window.length > size,
      hasPreviousPage: after ? true : backward ? window.length > size : false,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
    },
  };
}

function combinationsFor(list: Page['edges']): Args[] {
  const sizes = [0, 1, 2, list.length + 1];
  const cursors = [undefined, ...list.map((edge) => edge.cursor)];
  const counts: Args[] = [
    {},
    ...sizes.map((first) => ({ first })),
    ...sizes.map((last) => ({ last })),
  ];
  const combinations: Args[] = [];

  for (const after of cursors) {
    for (const before of cursors) {
      for (const count of counts) {
        combinations.push({
          ...count,
          ...(after ? { after } : {}),
          ...(before ? { before } : {}),
        });
      }
    }
  }

  return combinations;
}

let total = 0;

describe.each(['root', 'related'] as const)('%s connection', (connection) => {
  it.each(
    Object.keys(ORDERS) as Order[],
  )('pages %s like a slice of its own list', async (order) => {
    const [unpaged] = await pages(connection, order, [{ first: 100 }]);

    expect(unpaged.edges).toHaveLength(5);
    expect(unpaged.pageInfo.hasNextPage).toBe(false);

    const combinations = combinationsFor(unpaged.edges);
    const results = await pages(connection, order, combinations);

    total += combinations.length;

    combinations.forEach((args, i) => {
      expect({ args, page: results[i] }).toEqual({ args, page: expected(unpaged.edges, args) });
    });
  });
});

afterAll(() => {
  // 2 connections x 5 orderings x 6 `after` x 6 `before` x 9 sizes
  expect(total).toBe(2 * 5 * 6 * 6 * 9);
});

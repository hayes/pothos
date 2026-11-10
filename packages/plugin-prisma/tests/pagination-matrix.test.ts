import { isDeepStrictEqual } from 'node:util';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient, prismaConnectionHelpers } from '../src';
import type { Prisma } from './client/client.js';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Every page of a connection is compared with a slice of the same connection's unpaged list.
// User 1's posts 97 to 106 are five unpublished posts followed by five published ones, so
// ordering by `published` leaves ties; `author` is the same for all of them.

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const orders = {
  ID_ASC: { id: 'asc' },
  NONE: undefined,
  PUBLISHED_ASC: { published: 'asc' },
  PUBLISHED_DESC: { published: 'desc' },
  AUTHOR_NAME_DESC: { author: { name: 'desc' } },
  // Names no direction, so the cursor is appended ascending.
  AUTHOR_EMPTY: { author: {} },
  // Prisma leaves out a key set to `undefined`, so this orders nothing.
  PUBLISHED_UNDEFINED: { published: undefined },
  PUBLISHED_THEN_ID: [{ published: 'asc' }, { id: 'desc' }],
  // Names no unique column, so the cursor is appended in the direction of the last entry.
  PUBLISHED_THEN_AUTHOR_ID: [{ published: 'desc' }, { authorId: 'asc' }],
} satisfies Record<
  string,
  Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[] | undefined
>;

// User 1's followers all share `toId`, and `compositeID` is a two-column cursor.
const followerOrders = {
  NONE: undefined,
  KEY: [{ toId: 'asc' }, { fromId: 'desc' }],
  TO_ID_DESC: { toId: 'desc' },
  // Names neither cursor column, so both are appended.
  FROM_NAME_ASC: { from: { name: 'asc' } },
} satisfies Record<
  string,
  Prisma.FollowOrderByWithRelationInput | Prisma.FollowOrderByWithRelationInput[] | undefined
>;

const PostOrder = builder.enumType('PostOrder', {
  values: Object.keys(orders) as (keyof typeof orders)[],
});

const HelperPostOrder = builder.enumType('HelperPostOrder', {
  values: Object.keys(orders) as (keyof typeof orders)[],
});

const FollowerOrder = builder.enumType('FollowerOrder', {
  values: Object.keys(followerOrders) as (keyof typeof followerOrders)[],
});

const where = { id: { gte: 97, lte: 106 } };

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeInt('id'),
  }),
});

builder.prismaObject('Follow', {
  fields: (t) => ({
    id: t.exposeInt('fromId'),
  }),
});

const postHelpers = prismaConnectionHelpers(builder, 'Post', {
  cursor: 'id',
  args: (t) => ({ order: t.field({ type: HelperPostOrder, required: true }) }),
  query: (args) => ({ where, orderBy: orders[args.order] }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    posts: t.relatedConnection('posts', {
      cursor: 'id',
      args: { order: t.arg({ type: PostOrder, required: true }) },
      query: (args) => ({ where, orderBy: orders[args.order] }),
    }),
    helperPosts: t.connection({
      type: Post,
      args: postHelpers.getArgs(),
      select: (args, ctx, nestedSelection) => ({
        posts: postHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (user, args, ctx) => postHelpers.resolve(user.posts, args, ctx),
    }),
    followers: t.relatedConnection('followers', {
      cursor: 'compositeID',
      args: { order: t.arg({ type: FollowerOrder, required: true }) },
      query: (args) => ({ orderBy: followerOrders[args.order] }),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: 'User',
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

const connections = {
  posts: { orderType: 'PostOrder', orders },
  helperPosts: { orderType: 'HelperPostOrder', orders },
  followers: { orderType: 'FollowerOrder', orders: followerOrders },
};

type ConnectionName = keyof typeof connections;

interface Page {
  edges: { cursor: string; node: Record<string, number> }[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
}

interface PageArgs {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

async function page(field: ConnectionName, order: string, args: PageArgs) {
  const result = await execute({
    schema,
    document: gql`
      query ($order: ${connections[field].orderType}!, $first: Int, $last: Int, $after: String, $before: String) {
        user {
          connection: ${field}(order: $order, first: $first, last: $last, after: $after, before: $before) {
            edges {
              cursor
              node {
                id
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      }
    `,
    variableValues: { order, ...args },
    contextValue: {},
  });

  return result as { data?: { user: { connection: Page } }; errors?: readonly Error[] };
}

function expectedPage(
  list: Page['edges'],
  start: number,
  end: number,
  hasNextPage: boolean,
  hasPreviousPage: boolean,
) {
  const edges = list.slice(Math.max(0, start), Math.max(0, end));

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges[edges.length - 1]?.cursor ?? null,
    },
  };
}

const sizes = [0, 1, 4, 15];

async function checkMatrix(field: ConnectionName, order: string, expectedLength: number) {
  const full = await page(field, order, { first: 100 });
  expect(full.errors).toBeUndefined();
  const list = full.data!.user.connection.edges;
  expect(list).toHaveLength(expectedLength);

  const length = list.length;
  const cursorIndexes = [0, Math.floor(length / 2), length - 1];
  const mismatches: unknown[] = [];

  const check = async (args: PageArgs, expected: ReturnType<typeof expectedPage>) => {
    const result = await page(field, order, args);
    expect(result.errors).toBeUndefined();
    const actual = result.data!.user.connection;

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push({ args, expected, actual });
    }
  };

  for (const n of sizes) {
    await check({ first: n }, expectedPage(list, 0, n, n < length, false));
    await check({ last: n }, expectedPage(list, length - n, length, false, n < length));
    // `first` wins over `last`, as in `@pothos/core`.
    await check({ first: n, last: 2 }, expectedPage(list, 0, n, n < length, false));

    for (const i of cursorIndexes) {
      const cursor = list[i].cursor;

      await check(
        { first: n, after: cursor },
        expectedPage(list, i + 1, i + 1 + n, i + 1 + n < length, true),
      );
      await check({ last: n, before: cursor }, expectedPage(list, i - n, i, true, i > n));
    }
  }

  expect(mismatches).toEqual([]);

  return list;
}

const ordersOf = (field: ConnectionName) => Object.keys(connections[field].orders);

describe('pagination matrix', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe.each(['posts', 'helperPosts'] as const)('%s', (field) => {
    it.each(ordersOf(field))('%s', async (order) => {
      const ids = (await checkMatrix(field, order, 10)).map((edge) => edge.node.id);

      // Ties are broken by the cursor, in the direction of the last ordering.
      if (order === 'PUBLISHED_ASC') {
        expect(ids).toEqual([97, 98, 99, 100, 101, 102, 103, 104, 105, 106]);
      }
      if (order === 'PUBLISHED_DESC') {
        expect(ids).toEqual([106, 105, 104, 103, 102, 101, 100, 99, 98, 97]);
      }
      if (order === 'PUBLISHED_THEN_AUTHOR_ID') {
        expect(ids).toEqual([102, 103, 104, 105, 106, 97, 98, 99, 100, 101]);
      }
    });
  });

  it.each(ordersOf('followers'))('followers %s', async (order) => {
    await checkMatrix('followers', order, await prisma.follow.count({ where: { toId: 1 } }));
  });

  it('pages from a cursor issued before the order became unique', async () => {
    // Post 100's cursor, as every release so far has written it.
    const result = await page('posts', 'PUBLISHED_ASC', { first: 2, after: 'R1BDOk46MTAw' });

    expect(result.errors).toBeUndefined();
    expect(result.data!.user.connection.edges.map((edge) => edge.node.id)).toEqual([101, 102]);
  });

  it('rejects conflicting arguments', async () => {
    const list = (await page('posts', 'ID_ASC', { first: 3 })).data!.user.connection.edges;
    const cursor = list[1].cursor;

    const messages = [];
    for (const args of [
      { before: cursor, after: cursor },
      { first: 1, before: cursor },
      { last: 1, after: cursor },
    ]) {
      const result = await page('posts', 'ID_ASC', args);
      messages.push(result.errors?.map((error) => error.message));
    }

    expect(messages).toMatchInlineSnapshot(`
      [
        [
          "Arguments "before" and "after" are not supported at the same time",
        ],
        [
          "Arguments "before" and "first" are not supported at the same time",
        ],
        [
          "Arguments "after" and "last" are not supported at the same time",
        ],
      ]
    `);
  });

  it('adds the cursor to an order only when the order is not unique', async () => {
    const orderBys: Record<string, unknown> = {};

    for (const field of Object.keys(connections) as ConnectionName[]) {
      const relation = field === 'followers' ? 'followers' : 'posts';
      const fieldOrders: Record<string, unknown> = connections[field].orders;

      for (const order of ordersOf(field)) {
        queries.length = 0;
        await page(field, order, { last: 1 });
        // An order that is unique already (or absent) reaches prisma as it was given.
        orderBys[`${field} ${order}`] = queries.map((query) => {
          const { orderBy } = (
            query as { args: { include: Record<string, { orderBy?: unknown }> } }
          ).args.include[relation];
          return isDeepStrictEqual(orderBy, fieldOrders[order]) ? 'unchanged' : orderBy;
        });
      }
    }

    expect(orderBys).toMatchInlineSnapshot(`
      {
        "followers FROM_NAME_ASC": [
          [
            {
              "from": {
                "name": "asc",
              },
            },
            {
              "fromId": "asc",
            },
            {
              "toId": "asc",
            },
          ],
        ],
        "followers KEY": [
          "unchanged",
        ],
        "followers NONE": [
          "unchanged",
        ],
        "followers TO_ID_DESC": [
          [
            {
              "toId": "desc",
            },
            {
              "fromId": "desc",
            },
          ],
        ],
        "helperPosts AUTHOR_EMPTY": [
          [
            {
              "author": {},
            },
            {
              "id": "asc",
            },
          ],
        ],
        "helperPosts AUTHOR_NAME_DESC": [
          [
            {
              "author": {
                "name": "desc",
              },
            },
            {
              "id": "desc",
            },
          ],
        ],
        "helperPosts ID_ASC": [
          "unchanged",
        ],
        "helperPosts NONE": [
          "unchanged",
        ],
        "helperPosts PUBLISHED_ASC": [
          [
            {
              "published": "asc",
            },
            {
              "id": "asc",
            },
          ],
        ],
        "helperPosts PUBLISHED_DESC": [
          [
            {
              "published": "desc",
            },
            {
              "id": "desc",
            },
          ],
        ],
        "helperPosts PUBLISHED_THEN_AUTHOR_ID": [
          [
            {
              "published": "desc",
            },
            {
              "authorId": "asc",
            },
            {
              "id": "asc",
            },
          ],
        ],
        "helperPosts PUBLISHED_THEN_ID": [
          "unchanged",
        ],
        "helperPosts PUBLISHED_UNDEFINED": [
          "unchanged",
        ],
        "posts AUTHOR_EMPTY": [
          [
            {
              "author": {},
            },
            {
              "id": "asc",
            },
          ],
        ],
        "posts AUTHOR_NAME_DESC": [
          [
            {
              "author": {
                "name": "desc",
              },
            },
            {
              "id": "desc",
            },
          ],
        ],
        "posts ID_ASC": [
          "unchanged",
        ],
        "posts NONE": [
          "unchanged",
        ],
        "posts PUBLISHED_ASC": [
          [
            {
              "published": "asc",
            },
            {
              "id": "asc",
            },
          ],
        ],
        "posts PUBLISHED_DESC": [
          [
            {
              "published": "desc",
            },
            {
              "id": "desc",
            },
          ],
        ],
        "posts PUBLISHED_THEN_AUTHOR_ID": [
          [
            {
              "published": "desc",
            },
            {
              "authorId": "asc",
            },
            {
              "id": "asc",
            },
          ],
        ],
        "posts PUBLISHED_THEN_ID": [
          "unchanged",
        ],
        "posts PUBLISHED_UNDEFINED": [
          "unchanged",
        ],
      }
    `);
  });

  it('does not count a nullable unique column as making the order unique', () => {
    // `c` is unique but nullable, and rows without one tie.
    const helpers = prismaConnectionHelpers(builder, 'WithCompositeUnique', {
      cursor: 'a_b',
      query: { orderBy: { c: 'asc' } },
    });

    expect(helpers.getQuery({ first: 2 }, {}, () => true).orderBy).toEqual([
      { c: 'asc' },
      { a: 'asc' },
      { b: 'asc' },
    ]);
  });

  it("returns the helper's order as a list only when the cursor is appended", () => {
    const query = (orderBy: Prisma.CommentOrderByWithRelationInput) =>
      prismaConnectionHelpers(builder, 'Comment', { cursor: 'id', query: { orderBy } }).getQuery(
        { first: 2 },
        {},
        () => true,
      );

    expect(query({ content: 'asc' }).orderBy).toEqual([{ content: 'asc' }, { id: 'asc' }]);
    expect(query({ createdAt: 'desc' }).orderBy).toEqual({ createdAt: 'desc' });
  });
});

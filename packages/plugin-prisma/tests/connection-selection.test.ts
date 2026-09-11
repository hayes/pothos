import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// A related connection reads what the document selects beneath it (totalCount, edges, ...) for
// every parent row, in its loaded check and again in its resolver. The selection is traversed
// once per request and the result shared by every row.
const selectedFieldNames = vi.hoisted(() => vi.fn());

vi.mock('@pothos/selection-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pothos/selection-mapper')>();

  selectedFieldNames.mockImplementation(actual.selectedFieldNames);

  return { ...actual, selectedFieldNames };
});

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    postsConnection: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
    customConnection: t.relatedConnection(
      'posts',
      { cursor: 'id', totalCount: true },
      {
        fields: (c) => ({ pageSize: c.int({ resolve: (connection) => connection.edges.length }) }),
      },
    ),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.prismaField({
      type: [User],
      resolve: (query) => prisma.user.findMany({ ...query, take: 3, orderBy: { id: 'asc' } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('connection selection facts', () => {
  afterEach(() => {
    queries.length = 0;
    selectedFieldNames.mockClear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('preserves rows for custom fields when totalCount is selected through a fragment', async () => {
    const run = (selection: string) =>
      execute({
        schema,
        document: gql(`{ users { customConnection(first: 1) { ${selection} } } }`),
        contextValue: {},
      });
    const plain = await run('pageSize');
    queries.length = 0;
    const counted = await run('pageSize ... { count: totalCount }');

    expect(plain.errors).toBeUndefined();
    expect(counted.errors).toBeUndefined();
    const rows = counted.data?.users as { customConnection: { pageSize: number; count: number } }[];
    expect(rows.map((row) => row.customConnection.pageSize)).toEqual([1, 1, 1]);
    expect(
      rows.map((row) => ({ customConnection: { pageSize: row.customConnection.pageSize } })),
    ).toEqual(plain.data?.users);
    expect(queries).toMatchObject([
      {
        args: {
          include: {
            posts: { take: 2 },
            _count: { select: { posts: true } },
          },
        },
      },
    ]);
  });

  it('reads the selection once and shares it with every parent row', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          users {
            postsConnection(first: 1) {
              totalCount
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();

    const { users } = result.data as {
      users: { postsConnection: { totalCount: number; edges: { node: { id: string } }[] } }[];
    };

    expect(users.length).toBeGreaterThan(1);

    for (const user of users) {
      expect(user.postsConnection.totalCount).toEqual(expect.any(Number));
      expect(user.postsConnection.edges.length).toBeLessThanOrEqual(1);
    }

    expect(queries).toEqual([
      {
        action: 'findMany',
        model: 'User',
        args: {
          include: {
            _count: { select: { posts: true } },
            posts: { skip: 0, take: 2 },
          },
          orderBy: { id: 'asc' },
          take: 3,
        },
      },
    ]);

    // Read for every row, but traversed once: every read returns the same set.
    expect(selectedFieldNames.mock.calls.length).toBeGreaterThanOrEqual(users.length);
    expect(new Set(selectedFieldNames.mock.results.map((call) => call.value)).size).toBe(1);
    expect([...(selectedFieldNames.mock.results[0].value as Set<string>)]).toEqual([
      'totalCount',
      'edges',
    ]);
  });
});

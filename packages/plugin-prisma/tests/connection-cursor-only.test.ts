import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// A connection whose document selects neither `nodes` nor `edges.node` needs its rows only for
// their cursors, so the relation query selects the cursor columns and nothing else.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number } };
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
    postsConnection: t.relatedConnection('posts', { cursor: 'id' }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('connection selecting only pageInfo', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('loads only the cursor columns of the related rows', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 2) {
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: { postsConnection: { pageInfo: { hasNextPage: true, endCursor: expect.any(String) } } },
    });
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          include: { posts: { select: { id: true }, skip: 0, take: 3 } },
          where: { id: 1 },
        },
      },
    ]);
  });
});

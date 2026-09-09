import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// A relatedConnection wrapped by the errors plugin sits under `... on <Field>Success { data }`.
// Its select callback looks up `totalCount` through that wrapper.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number } };
}>({
  plugins: [ErrorsPlugin, PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

builder.objectType(Error, {
  name: 'BaseError',
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      totalCount: true,
      errors: { types: [Error] },
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
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

describe('relatedConnection wrapped by the errors plugin', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('plans totalCount selected under the success type', async () => {
    const expectedCount = await prisma.post.count({ where: { authorId: 1 } });
    queries.length = 0;

    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 1) {
              ... on UserPostsConnectionSuccess {
                data {
                  totalCount
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: { postsConnection: { data: { totalCount: expectedCount } } },
    });
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { include: { _count: { select: { posts: true } } }, where: { id: 1 } },
      },
    ]);
  });

  it('plans the count and the rows when success fragments select them separately', async () => {
    const expectedCount = await prisma.post.count({ where: { authorId: 1 } });
    const posts = await prisma.post.findMany({ where: { authorId: 1 }, take: 2 });
    queries.length = 0;

    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 2) {
              ... on UserPostsConnectionSuccess {
                data {
                  totalCount
                }
              }
              ... on UserPostsConnectionSuccess {
                data {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: {
        postsConnection: {
          data: {
            totalCount: expectedCount,
            edges: posts.map((post) => ({ node: { id: String(post.id) } })),
          },
        },
      },
    });
    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
              },
              "posts": {
                "skip": 0,
                "take": 3,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "model": "User",
        },
      ]
    `);
  });
});

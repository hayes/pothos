import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// graphql merges every occurrence of a response key into one `info.fieldNodes`. A connection
// selected under a fragment as well as directly is planned from every occurrence, whichever
// comes first, so what one occurrence asks for is not loaded separately.
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
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    posts: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      resolve: (query) => prisma.post.findMany({ ...query, where: { authorId: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('a field selected more than once', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('plans a related connection from every occurrence: totalCount in one, edges in another', async () => {
    const totalCountFirst = gql`
      query {
        user {
          postsConnection(first: 2) {
            totalCount
          }
        }
        ...More
      }

      fragment More on Query {
        user {
          postsConnection(first: 2) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;
    const edgesFirst = gql`
      query {
        ...More
        user {
          postsConnection(first: 2) {
            totalCount
          }
        }
      }

      fragment More on Query {
        user {
          postsConnection(first: 2) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;
    const seen: unknown[][] = [];

    for (const document of [totalCountFirst, edgesFirst]) {
      const result = await execute({ schema, document, contextValue: {} });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        user: {
          postsConnection: {
            totalCount: expect.any(Number),
            edges: [{ node: { id: expect.any(String) } }, { node: { id: expect.any(String) } }],
          },
        },
      });
      // Both the count and the rows come from the one query.
      expect(queries).toHaveLength(1);
      seen.push([...queries]);
      queries.length = 0;
    }

    expect(seen[1]).toEqual(seen[0]);
    expect(seen[0]).toMatchInlineSnapshot(`
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

  it('matches the paths of a root connection in every occurrence', async () => {
    const edgesFirst = gql`
      query {
        posts(first: 2) {
          edges {
            node {
              id
            }
          }
        }
        ...More
      }

      fragment More on Query {
        posts(first: 2) {
          edges {
            node {
              author {
                id
              }
            }
          }
        }
      }
    `;
    const authorFirst = gql`
      query {
        ...More
        posts(first: 2) {
          edges {
            node {
              id
            }
          }
        }
      }

      fragment More on Query {
        posts(first: 2) {
          edges {
            node {
              author {
                id
              }
            }
          }
        }
      }
    `;
    const seen: unknown[][] = [];

    for (const document of [edgesFirst, authorFirst]) {
      const result = await execute({ schema, document, contextValue: {} });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        posts: {
          edges: [
            { node: { id: expect.any(String), author: { id: '1' } } },
            { node: { id: expect.any(String), author: { id: '1' } } },
          ],
        },
      });
      // The author selected in the fragment's occurrence is included in the one query.
      expect(queries).toHaveLength(1);
      seen.push([...queries]);
      queries.length = 0;
    }

    expect(seen[1]).toEqual(seen[0]);
    expect(seen[0]).toMatchInlineSnapshot(`
      [
        {
          "action": "findMany",
          "args": {
            "include": {
              "author": true,
            },
            "skip": 0,
            "take": 3,
            "where": {
              "authorId": 1,
            },
          },
          "model": "Post",
        },
      ]
    `);
  });
});

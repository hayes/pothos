import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma } from './example/builder';
import schema from './example/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('prisma', () => {
  afterEach(() => {
    queries = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('loads type-level includes directly, indirectly and merges with relations', async () => {
    const query = gql`
      query {
        me {
          commentsConnection(first: 1) {
            edges {
              node {
                authorBio
              }
            }
          }
          twoComments: commentsConnection(first: 2) {
            edges {
              node {
                authorBio
                author {
                  id
                }
              }
            }
          }
          postsConnection(first: 1) {
            edges {
              node {
                commentAuthorIds
              }
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchSnapshot();

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "comments": Object {
          "include": Object {
            "author": Object {
              "include": Object {
                "profile": true,
              },
            },
          },
          "skip": 0,
          "take": 2,
        },
        "posts": Object {
          "include": Object {
            "comments": Object {
              "include": Object {
                "author": true,
              },
            },
          },
          "orderBy": Object {
            "createdAt": "desc",
          },
          "skip": 0,
          "take": 2,
        },
      },
      "where": Object {
        "id": 1,
      },
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "comments": Object {
          "include": Object {
            "author": Object {
              "include": Object {
                "profile": true,
              },
            },
          },
          "skip": 0,
          "take": 3,
        },
      },
      "where": Object {
        "id": 1,
      },
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });
});

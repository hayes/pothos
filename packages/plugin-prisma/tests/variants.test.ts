import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma } from './example/builder';
import schema from './example/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('variants', () => {
  afterEach(() => {
    queries = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('query with multiple variant fields and conflicting relations', async () => {
    const query = gql`
      query {
        viewerNode {
          __typename
          id
        }
        me {
          __typename
          profile {
            bio
          }
          viewer {
            __typename
            posts {
              id
            }
            bio
            user {
              __typename
              posts {
                id
              }
              profile {
                bio
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "me": Object {
            "__typename": "User",
            "profile": Object {
              "bio": "Sequi minus inventore itaque similique et.",
            },
            "viewer": Object {
              "__typename": "Viewer",
              "bio": "Sequi minus inventore itaque similique et.",
              "posts": Array [
                Object {
                  "id": "1",
                },
                Object {
                  "id": "2",
                },
                Object {
                  "id": "3",
                },
                Object {
                  "id": "4",
                },
                Object {
                  "id": "5",
                },
              ],
              "user": Object {
                "__typename": "User",
                "posts": Array [
                  Object {
                    "id": "250",
                  },
                  Object {
                    "id": "249",
                  },
                  Object {
                    "id": "248",
                  },
                  Object {
                    "id": "247",
                  },
                  Object {
                    "id": "246",
                  },
                  Object {
                    "id": "245",
                  },
                  Object {
                    "id": "244",
                  },
                  Object {
                    "id": "243",
                  },
                  Object {
                    "id": "242",
                  },
                  Object {
                    "id": "241",
                  },
                ],
                "profile": Object {
                  "bio": "Sequi minus inventore itaque similique et.",
                },
              },
            },
          },
          "viewerNode": Object {
            "__typename": "ViewerNode",
            "id": "Vmlld2VyTm9kZTox",
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "profile": true,
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
              "posts": Object {
                "include": Object {
                  "comments": Object {
                    "include": Object {
                      "author": true,
                    },
                  },
                },
                "take": 5,
              },
              "profile": true,
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
          "action": "findMany",
          "args": Object {
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
            "take": 10,
            "where": Object {
              "authorId": 1,
            },
          },
          "dataPath": Array [],
          "model": "Post",
          "runInTransaction": false,
        },
      ]
    `);
  });
});

import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma } from './example/builder';
import schema from './example/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('nested query', () => {
  afterEach(() => {
    queries = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('query with custom nested selections', async () => {
    const query = gql`
      query {
        viewer {
          postPreviews {
            preview
            post {
              createdAt
              content
            }
          }
        }
        me {
          postsConnection(first: 1) {
            edges {
              node {
                id
                comments {
                  postAuthor {
                    name
                  }
                }
                media {
                  url
                }
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
            "postsConnection": Object {
              "edges": Array [
                Object {
                  "node": Object {
                    "comments": Array [
                      Object {
                        "postAuthor": Object {
                          "name": "Maurine Rath",
                        },
                      },
                      Object {
                        "postAuthor": Object {
                          "name": "Maurine Rath",
                        },
                      },
                      Object {
                        "postAuthor": Object {
                          "name": "Maurine Rath",
                        },
                      },
                    ],
                    "id": "250",
                    "media": Array [
                      Object {
                        "url": "http://misty-dilapidation.org",
                      },
                      Object {
                        "url": "https://fumbling-jack.net",
                      },
                    ],
                  },
                },
              ],
            },
          },
          "viewer": Object {
            "postPreviews": Array [
              Object {
                "post": Object {
                  "content": "Deleniti eos reprehenderit in nisi et qui. Odio et inventore eligendi in. Id harum sit odio quia vitae provident. Provident molestiae harum ullam pariatur quos est quod. Ea quisquam esse quia expedita commodi autem.",
                  "createdAt": "2012-12-12T00:00:00.000Z",
                },
                "preview": "os reprehenderit in nisi et qui. Odio et inventore eligendi in. Id harum sit odio quia vitae provident. Provident molestiae harum ullam pariatur quos est quod. Ea quisquam esse quia expedita commodi autem.",
              },
              Object {
                "post": Object {
                  "content": "Necessitatibus molestiae placeat saepe eligendi. Excepturi et laudantium fuga similique fugit corporis voluptatem dolores esse. Et sint magnam aut atque dolores maiores incidunt.",
                  "createdAt": "2012-12-12T00:00:00.001Z",
                },
                "preview": "ibus molestiae placeat saepe eligendi. Excepturi et laudantium fuga similique fugit corporis voluptatem dolores esse. Et sint magnam aut atque dolores maiores incidunt.",
              },
            ],
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "select": Object {
              "id": true,
              "posts": Object {
                "select": Object {
                  "content": true,
                  "createdAt": true,
                  "id": true,
                },
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
              "posts": Object {
                "include": Object {
                  "comments": Object {
                    "include": Object {
                      "author": Object {
                        "include": Object {
                          "profile": true,
                        },
                      },
                      "post": Object {
                        "select": Object {
                          "author": true,
                        },
                      },
                    },
                    "take": 3,
                  },
                  "media": Object {
                    "select": Object {
                      "media": Object {
                        "select": Object {
                          "id": true,
                          "posts": true,
                          "url": true,
                        },
                      },
                      "order": true,
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
      ]
    `);
  });
});

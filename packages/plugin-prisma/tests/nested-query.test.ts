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
      {
        "data": {
          "me": {
            "postsConnection": {
              "edges": [
                {
                  "node": {
                    "comments": [
                      {
                        "postAuthor": {
                          "name": "Maurine Rath",
                        },
                      },
                      {
                        "postAuthor": {
                          "name": "Maurine Rath",
                        },
                      },
                      {
                        "postAuthor": {
                          "name": "Maurine Rath",
                        },
                      },
                    ],
                    "id": "250",
                    "media": [
                      {
                        "url": "http://misty-dill.org",
                      },
                      {
                        "url": "https://fumbling-jackfruit.net",
                      },
                    ],
                  },
                },
              ],
            },
          },
          "viewer": {
            "postPreviews": [
              {
                "post": {
                  "content": "Deleniti eos reprehenderit in nisi et qui. Odio et inventore eligendi in. Id harum sit odio quia vitae provident. Provident molestiae harum ullam pariatur quos est quod. Ea quisquam esse quia expedita commodi autem.",
                  "createdAt": "2012-12-12T00:00:00.000Z",
                },
                "preview": "os reprehenderit in nisi et qui. Odio et inventore eligendi in. Id harum sit odio quia vitae provident. Provident molestiae harum ullam pariatur quos est quod. Ea quisquam esse quia expedita commodi autem.",
              },
              {
                "post": {
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
      [
        {
          "action": "findUnique",
          "args": {
            "select": {
              "id": true,
              "posts": {
                "select": {
                  "content": true,
                  "createdAt": true,
                  "id": true,
                },
                "take": 2,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "posts": {
                "include": {
                  "comments": {
                    "include": {
                      "author": {
                        "include": {
                          "profile": true,
                        },
                      },
                      "post": {
                        "select": {
                          "author": true,
                        },
                      },
                    },
                    "take": 3,
                  },
                  "media": {
                    "select": {
                      "media": {
                        "select": {
                          "id": true,
                          "posts": true,
                          "url": true,
                        },
                      },
                      "order": true,
                    },
                  },
                },
                "orderBy": {
                  "createdAt": "desc",
                },
                "skip": 0,
                "take": 2,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('queryFromInfo with nested path', async () => {
    const query = gql`
      query {
        blog {
          posts {
            id
            author {
              name
            }
          }
          pages
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "blog": {
            "pages": [
              1,
              2,
              3,
            ],
            "posts": [
              {
                "author": {
                  "name": "Maurine Rath",
                },
                "id": "1",
              },
              {
                "author": {
                  "name": "Maurine Rath",
                },
                "id": "2",
              },
              {
                "author": {
                  "name": "Maurine Rath",
                },
                "id": "3",
              },
            ],
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findMany",
          "args": {
            "include": {
              "author": true,
              "comments": {
                "include": {
                  "author": true,
                },
                "take": 3,
              },
            },
            "take": 3,
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
      ]
    `);
  });
});

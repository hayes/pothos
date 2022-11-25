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
                          "name": "Maurine Ratke",
                        },
                      },
                      {
                        "postAuthor": {
                          "name": "Maurine Ratke",
                        },
                      },
                      {
                        "postAuthor": {
                          "name": "Maurine Ratke",
                        },
                      },
                    ],
                    "id": "250",
                    "media": [
                      {
                        "url": "http://mixed-dill.org",
                      },
                      {
                        "url": "https://fussy-jackfruit.net",
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
                  "content": "Iusto odit nisi aliquid nostrum similique libero. Iure velit ipsa quidem aliquid. Cum similique qui reprehenderit dolores veritatis voluptatum. Voluptatum vel culpa magnam illum dignissimos nam cum. Corporis nam commodi ad animi corporis voluptas.",
                  "createdAt": "2012-12-12T00:00:00.000Z",
                },
                "preview": " nisi aliquid nostrum similique libero. Iure velit ipsa quidem aliquid. Cum similique qui reprehenderit dolores veritatis voluptatum. Voluptatum vel culpa magnam illum dignissimos nam cum. Corporis nam commodi ad animi corporis voluptas.",
              },
              {
                "post": {
                  "content": "Officiis vel nobis debitis quidem. Laudantium blanditiis quam error excepturi dicta aliquam enim ducimus commodi. Pariatur voluptates non beatae iusto ducimus doloribus consectetur.",
                  "createdAt": "2012-12-12T00:00:00.001Z",
                },
                "preview": "el nobis debitis quidem. Laudantium blanditiis quam error excepturi dicta aliquam enim ducimus commodi. Pariatur voluptates non beatae iusto ducimus doloribus consectetur.",
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
                  "name": "Maurine Ratke",
                },
                "id": "1",
              },
              {
                "author": {
                  "name": "Maurine Ratke",
                },
                "id": "2",
              },
              {
                "author": {
                  "name": "Maurine Ratke",
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

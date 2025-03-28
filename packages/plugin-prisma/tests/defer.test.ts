import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma } from './example/builder';
import schema from './example/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('defer', () => {
  afterEach(() => {
    queries = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('defers count fields', async () => {
    const query = gql`
          query {
            me {
              id
              ...@defer {
                postCount
              }
              ...@defer {
                postCount2: postCount
              }
              ...@defer(if: true) {
                  publishedCount
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
            "id": "VXNlcjox",
            "postCount": 250,
            "postCount2": 250,
            "publishedCount": 149,
          },
        },
      }
    `);
    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "where": {
              "id": 1,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": {
                    "where": {
                      "published": true,
                    },
                  },
                },
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

  it('resolves relatedConnection totalCount when connection is deferred', async () => {
    const query = gql`
      query {
        me {
          postsConnection(first: 2) {
            totalCount
            ... @defer {
              edges {
                node {
                  # Connection edges are loaded, but author is deferred, because the initial query happens outside of the fragment
                  author {
                    id
                  }
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
                    "author": {
                      "id": "VXNlcjox",
                    },
                  },
                },
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                  },
                },
              ],
              "totalCount": 250,
            },
          },
        },
      }
    `);
    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
              },
              "posts": {
                "include": {
                  "comments": {
                    "include": {
                      "author": true,
                    },
                    "take": 3,
                  },
                },
                "orderBy": {
                  "createdAt": "desc",
                },
                "skip": 0,
                "take": 3,
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "author": true,
            },
            "where": {
              "id": 250,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "author": true,
            },
            "where": {
              "id": 249,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('resolves relatedConnection totalCount inside a deferred fragment', async () => {
    const query = gql`
      query {
        me {
          postsConnection(first: 2) {
            ... @defer {
              totalCount
              edges {
                node {
                  # Connection edges are loaded, but author is deferred, because the initial query happens outside of the fragment
                  author {
                    id
                  }
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
              "edges": [],
              "totalCount": 250,
            },
          },
        },
      }
    `);
    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
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

  it('resolves prismaConnection totalCount when connection is deferred', async () => {
    const query = gql`
      {
        userConnection(first: 2) {
          totalCount
          ... @defer {
            edges {
              node {
                id
                postCount
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
          "userConnection": {
            "edges": [
              {
                "node": {
                  "id": "VXNlcjox",
                  "postCount": 250,
                },
              },
              {
                "node": {
                  "id": "VXNlcjoy",
                  "postCount": 250,
                },
              },
            ],
            "totalCount": 100,
          },
        },
      }
    `);
    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findMany",
          "args": {
            "skip": 0,
            "take": 3,
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "count",
          "args": undefined,
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
              },
            },
            "where": {
              "id": 2,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('resolves prismaConnection totalCount inside a deferred fragment', async () => {
    const query = gql`
      {
        userConnection(first: 2) {
          ... @defer {
            totalCount
            edges {
              node {
                id
                postCount
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
          "userConnection": {
            "edges": [
              {
                "node": {
                  "id": "VXNlcjox",
                  "postCount": 250,
                },
              },
              {
                "node": {
                  "id": "VXNlcjoy",
                  "postCount": 250,
                },
              },
            ],
            "totalCount": 100,
          },
        },
      }
    `);
    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findMany",
          "args": {
            "skip": 0,
            "take": 3,
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "count",
          "args": undefined,
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
              },
            },
            "where": {
              "id": 2,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('defer on prismaConnection edge', async () => {
    const query = gql`
      {
        userConnection(first: 2) {
          edges {
            ... @defer {
              node {
                id
                postCount
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
          "userConnection": {
            "edges": [
              {
                "node": {
                  "id": "VXNlcjox",
                  "postCount": 250,
                },
              },
              {
                "node": {
                  "id": "VXNlcjoy",
                  "postCount": 250,
                },
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
            "skip": 0,
            "take": 3,
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
              },
            },
            "where": {
              "id": 2,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('defer on prismaConnection node', async () => {
    const query = gql`
      {
        userConnection(first: 2) {
          edges {
            node {
              id
              ... @defer {
                postCount
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
          "userConnection": {
            "edges": [
              {
                "node": {
                  "id": "VXNlcjox",
                  "postCount": 250,
                },
              },
              {
                "node": {
                  "id": "VXNlcjoy",
                  "postCount": 250,
                },
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
            "skip": 0,
            "take": 3,
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "_count": {
                "select": {
                  "posts": true,
                },
              },
            },
            "where": {
              "id": 2,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('defer on relatedConnection edge', async () => {
    const query = gql`
      {
        me {
          postsConnection(first: 2) {
            edges {
              ... @defer(if: true) {
                node {
                  commentAuthorIds
                  author {
                    id
                  }
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
                    "author": {
                      "id": "VXNlcjox",
                    },
                    "commentAuthorIds": [
                      "1",
                      "2",
                      "3",
                    ],
                  },
                },
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                    "commentAuthorIds": [
                      "1",
                      "2",
                      "3",
                    ],
                  },
                },
              ],
            },
          },
        },
      }
    `);
    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "posts": {
                "include": {
                  "comments": {
                    "include": {
                      "author": true,
                    },
                    "take": 3,
                  },
                },
                "orderBy": {
                  "createdAt": "desc",
                },
                "skip": 0,
                "take": 3,
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "author": true,
            },
            "where": {
              "id": 250,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "author": true,
            },
            "where": {
              "id": 249,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('defer on relatedConnection node', async () => {
    const query = gql`
      {
        me {
          postsConnection(first: 2) {
            edges {
              node {
                ... @defer(if: true) {
                  commentAuthorIds
                  author {
                    id
                  }
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
                    "author": {
                      "id": "VXNlcjox",
                    },
                    "commentAuthorIds": [
                      "1",
                      "2",
                      "3",
                    ],
                  },
                },
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                    "commentAuthorIds": [
                      "1",
                      "2",
                      "3",
                    ],
                  },
                },
              ],
            },
          },
        },
      }
    `);
    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "posts": {
                "include": {
                  "comments": {
                    "include": {
                      "author": true,
                    },
                    "take": 3,
                  },
                },
                "orderBy": {
                  "createdAt": "desc",
                },
                "skip": 0,
                "take": 3,
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "author": true,
            },
            "where": {
              "id": 250,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "author": true,
            },
            "where": {
              "id": 249,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('defer relation', async () => {
    const query = gql`
      {
        userConnection(first: 2) {
          edges {
            node {
              id
              postCount
              ... @defer {
                posts(limit: 1) {
                  id
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
          "userConnection": {
            "edges": [
              {
                "node": {
                  "id": "VXNlcjox",
                  "postCount": 250,
                  "posts": [
                    {
                      "id": "250",
                    },
                  ],
                },
              },
              {
                "node": {
                  "id": "VXNlcjoy",
                  "postCount": 250,
                  "posts": [
                    {
                      "id": "500",
                    },
                  ],
                },
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
              "_count": {
                "select": {
                  "posts": true,
                },
              },
            },
            "skip": 0,
            "take": 3,
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "findMany",
          "args": {
            "include": {
              "comments": {
                "include": {
                  "author": true,
                },
                "take": 3,
              },
            },
            "orderBy": {
              "createdAt": "desc",
            },
            "take": 1,
            "where": {
              "authorId": 1,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
        {
          "action": "findMany",
          "args": {
            "include": {
              "comments": {
                "include": {
                  "author": true,
                },
                "take": 3,
              },
            },
            "orderBy": {
              "createdAt": "desc",
            },
            "take": 1,
            "where": {
              "authorId": 2,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('defer field includes', async () => {
    const query = gql`
      {
        post(id: 1) {
          ... @defer {
            comments {
              id
              author {
                profile {
                  bio
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
          "post": {
            "comments": [
              {
                "author": {
                  "profile": {
                    "bio": "Debitis perspiciatis unde sunt.",
                  },
                },
                "id": "1",
              },
              {
                "author": {
                  "profile": null,
                },
                "id": "1001",
              },
              {
                "author": {
                  "profile": {
                    "bio": "Vitae facere minima distinctio libero quas hic.",
                  },
                },
                "id": "2001",
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
            "include": {
              "comments": {
                "include": {
                  "author": true,
                },
                "take": 3,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "comments": {
                "include": {
                  "author": {
                    "include": {
                      "profile": true,
                    },
                  },
                },
                "take": 3,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('defer type includes', async () => {
    const query = gql`
      {
        post(id: 1) {
          comments {
            id
            author {
              ... @defer {
                profile {
                  bio
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
          "post": {
            "comments": [
              {
                "author": {
                  "profile": {
                    "bio": "Debitis perspiciatis unde sunt.",
                  },
                },
                "id": "1",
              },
              {
                "author": {
                  "profile": null,
                },
                "id": "1001",
              },
              {
                "author": {
                  "profile": {
                    "bio": "Vitae facere minima distinctio libero quas hic.",
                  },
                },
                "id": "2001",
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
            "include": {
              "comments": {
                "include": {
                  "author": {
                    "include": {
                      "profile": true,
                    },
                  },
                },
                "take": 3,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "profile": true,
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
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "profile": true,
            },
            "where": {
              "id": 2,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "profile": true,
            },
            "where": {
              "id": 3,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });
});

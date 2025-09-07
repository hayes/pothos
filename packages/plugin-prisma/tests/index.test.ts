import { execute, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('prisma', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('generates schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });

  it('queries for single item', async () => {
    const query = gql`
      query {
        me {
          id
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
          "model": "User",
        },
      ]
    `);
  });

  it('skips fields based on @skip, @include, and @defer directives', async () => {
    const query = gql`
      query {
        me {
          id
          profile @skip(if: true) {
            bio
          }
          posts(limit: 1) @include(if: false) {
            id
          }
          ...@defer {
            postCount
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
          "model": "User",
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
          "model": "User",
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
          "model": "User",
        },
      ]
    `);
  });

  it('includes fields based on @skip, @include, and @defer directives', async () => {
    const query = gql`
      query {
        me {
          id
          profile @skip(if: false) {
            bio
          }
          posts(limit: 1) @include(if: true) {
            id
          }
          ...@defer(if: false) {
          	postCount
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
            "posts": [
              {
                "id": "250",
              },
            ],
            "profile": {
              "bio": "Debitis perspiciatis unde sunt.",
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
                "take": 1,
                "where": undefined,
              },
              "profile": true,
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

  it('queries decimals', async () => {
    const query = gql`
      query {
        me {
          posts(limit: 2) {
            id
            views
            viewsFloat
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
            "posts": [
              {
                "id": "250",
                "views": "0",
                "viewsFloat": 0,
              },
              {
                "id": "249",
                "views": "0",
                "viewsFloat": 0,
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
                "take": 2,
                "where": undefined,
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

  it('queries for a list of records', async () => {
    const query = gql`
      query {
        users {
          id
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
          "users": [
            {
              "id": "VXNlcjox",
            },
            {
              "id": "VXNlcjoy",
            },
          ],
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findMany",
          "args": {
            "take": 2,
          },
          "model": "User",
        },
      ]
    `);
  });

  it('queries for record with nested relations', async () => {
    const query = gql`
      query {
        me {
          posts {
            author {
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

    expect(result).toMatchSnapshot();

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "posts": {
                "include": {
                  "author": {
                    "include": {
                      "profile": true,
                    },
                  },
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
                "take": 10,
                "where": undefined,
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

  it('queries for list with nested relations', async () => {
    const query = gql`
      query {
        users {
          name
          profile {
            bio
          }
          posts {
            id
            author {
              profile {
                id
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
      [
        {
          "action": "findMany",
          "args": {
            "include": {
              "posts": {
                "include": {
                  "author": {
                    "include": {
                      "profile": true,
                    },
                  },
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
                "take": 10,
                "where": undefined,
              },
              "profile": true,
            },
            "take": 2,
          },
          "model": "User",
        },
      ]
    `);
  });
  it('queries with arguments and aliases', async () => {
    const query = gql`
      query {
        me {
          posts {
            id
            author {
              id
            }
          }
          oldestPosts: posts(oldestFirst: true) {
            id
            author {
              id
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
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "posts": {
                "include": {
                  "author": true,
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
                "take": 10,
                "where": undefined,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "model": "User",
        },
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
            "orderBy": {
              "createdAt": "asc",
            },
            "take": 10,
            "where": {
              "authorId": 1,
            },
          },
          "model": "Post",
        },
      ]
    `);
  });

  it('queries with variables and alieases', async () => {
    const query = gql`
      query ($oldest: Boolean) {
        me {
          posts {
            id
            author {
              id
            }
          }
          postIds: posts {
            id
          }
          oldestPosts: posts(oldestFirst: $oldest) {
            id
            author {
              id
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
      variableValues: {
        oldest: true,
      },
    });

    expect(result).toMatchSnapshot();

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "posts": {
                "include": {
                  "author": true,
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
                "take": 10,
                "where": undefined,
              },
            },
            "where": {
              "id": 1,
            },
          },
          "model": "User",
        },
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
            "orderBy": {
              "createdAt": "asc",
            },
            "take": 10,
            "where": {
              "authorId": 1,
            },
          },
          "model": "Post",
        },
      ]
    `);
  });

  it('queries through non-prisma fields', async () => {
    const query = gql`
      query ($oldest: Boolean) {
        me {
          profileThroughManualLookup {
            user {
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
      variableValues: {
        oldest: true,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "profileThroughManualLookup": {
              "user": {
                "profile": {
                  "bio": "Debitis perspiciatis unde sunt.",
                },
              },
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
            "where": {
              "id": 1,
            },
          },
          "model": "User",
        },
        {
          "action": "findUnique",
          "args": {
            "select": {
              "profile": true,
            },
            "where": {
              "id": 1,
            },
          },
          "model": "User",
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "profile": true,
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

  it('queries with errors plugin', async () => {
    const query = gql`
      query {
        usersWithError {
          __typename
          ... on Error {
            message
          }
          ... on QueryUsersWithErrorSuccess {
            data {
              name
              profileWithErrors {
                ... on Error {
                  message
                }
                ... on UserProfileWithErrorsSuccess {
                  data {
                    bio
                    user {
                      id
                    }
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
      variableValues: {
        oldest: true,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "usersWithError": {
            "__typename": "QueryUsersWithErrorSuccess",
            "data": [
              {
                "name": "Maurine Ratke",
                "profileWithErrors": {
                  "data": {
                    "bio": "Debitis perspiciatis unde sunt.",
                    "user": {
                      "id": "VXNlcjox",
                    },
                  },
                },
              },
              {
                "name": "Kyle Schoen",
                "profileWithErrors": null,
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
              "profile": {
                "include": {
                  "user": true,
                },
              },
            },
            "take": 2,
          },
          "model": "User",
        },
      ]
    `);
  });

  it('queries direct results with errors plugin', async () => {
    const query = gql`
      query {
        usersWithError {
          __typename
          ... on Error {
            message
          }
          ... on QueryUsersWithErrorSuccess {
            data {
              name
              directProfileWithErrors {
                ... on Error {
                  message
                }
                ... on Profile {
                  bio
                  user {
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
      variableValues: {
        oldest: true,
      },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "usersWithError": {
            "__typename": "QueryUsersWithErrorSuccess",
            "data": [
              {
                "directProfileWithErrors": {
                  "bio": "Debitis perspiciatis unde sunt.",
                  "user": {
                    "id": "VXNlcjox",
                  },
                },
                "name": "Maurine Ratke",
              },
              {
                "directProfileWithErrors": null,
                "name": "Kyle Schoen",
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
              "profile": {
                "include": {
                  "user": true,
                },
              },
            },
            "take": 2,
          },
          "model": "User",
        },
      ]
    `);
  });

  it('diffs date arguments from field aliases', async () => {
    const query = gql`
      query {
        users {
          a: posts(limit: 2, createdAt: "2012-12-12T00:00:00.749Z") {
            id
          }
          b: posts(limit: 2, createdAt: "2012-12-12T00:00:00.249Z") {
            id
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "users": [
            {
              "a": [],
              "b": [
                {
                  "id": "250",
                },
              ],
            },
            {
              "a": [
                {
                  "id": "500",
                },
              ],
              "b": [],
            },
          ],
        },
      }
    `);
  });
});

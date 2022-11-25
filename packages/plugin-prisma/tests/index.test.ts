import { execute, printSchema } from 'graphql';
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
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
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
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
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
              },
              "profile": true,
            },
            "take": 2,
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
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
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
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
          "dataPath": [],
          "model": "Post",
          "runInTransaction": false,
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
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
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
          "dataPath": [
            "select",
            "profile",
          ],
          "model": "User",
          "runInTransaction": false,
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
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
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
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });
});

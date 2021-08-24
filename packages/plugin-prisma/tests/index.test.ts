import { gql } from 'apollo-server';
import { execute, printSchema } from 'graphql';
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
      Object {
        "data": Object {
          "me": Object {
            "id": "VXNlcjox",
          },
        },
      }
      `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
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
      Object {
        "data": Object {
          "users": Array [
            Object {
              "id": "VXNlcjox",
            },
            Object {
              "id": "VXNlcjoy",
            },
          ],
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findMany",
    "args": Object {
      "take": 2,
    },
    "dataPath": Array [],
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
Array [
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "posts": Object {
          "include": Object {
            "author": Object {
              "include": Object {
                "profile": true,
              },
            },
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
Array [
  Object {
    "action": "findMany",
    "args": Object {
      "include": Object {
        "posts": Object {
          "include": Object {
            "author": Object {
              "include": Object {
                "profile": true,
              },
            },
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
        },
        "profile": true,
      },
      "take": 2,
    },
    "dataPath": Array [],
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
Array [
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "posts": Object {
          "include": Object {
            "author": true,
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "author": true,
        "comments": Object {
          "include": Object {
            "author": true,
          },
        },
      },
      "orderBy": Object {
        "createdAt": "asc",
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
Array [
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "posts": Object {
          "include": Object {
            "author": true,
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "author": true,
        "comments": Object {
          "include": Object {
            "author": true,
          },
        },
      },
      "orderBy": Object {
        "createdAt": "asc",
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
Object {
  "data": Object {
    "me": Object {
      "profileThroughManualLookup": Object {
        "user": Object {
          "profile": Object {
            "bio": "Sequi minus inventore itaque similique et.",
          },
        },
      },
    },
  },
}
`);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
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
            "select": Object {
              "profile": true,
            },
            "where": Object {
              "id": 1,
            },
          },
          "dataPath": Array [
            "select",
            "profile",
          ],
          "model": "User",
          "runInTransaction": false,
        },
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
Object {
  "data": Object {
    "usersWithError": Object {
      "__typename": "QueryUsersWithErrorSuccess",
      "data": Array [
        Object {
          "name": "Maurine Ratke",
          "profileWithErrors": Object {
            "data": Object {
              "bio": "Sequi minus inventore itaque similique et.",
              "user": Object {
                "id": "VXNlcjox",
              },
            },
          },
        },
        Object {
          "name": "Nichole Koss",
          "profileWithErrors": null,
        },
      ],
    },
  },
}
`);

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findMany",
    "args": Object {
      "include": Object {
        "profile": Object {
          "include": Object {
            "user": true,
          },
        },
      },
      "take": 2,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });
});

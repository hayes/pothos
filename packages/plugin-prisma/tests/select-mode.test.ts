import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma } from './example/builder';
import schema from './example/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('select mode', () => {
  afterEach(() => {
    queries = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('pure select', async () => {
    const query = gql`
      query {
        withIDSelectConnection(first: 2, after: "R1BDOlM6MQ==") {
          edges {
            cursor
          }
        }
        withCompositeConnection(first: 2, after: "R1BDOko6WyIxIiwiMSJd") {
          edges {
            cursor
            node {
              id
            }
          }
        }
        selectMe {
          postsConnection(first: 2) {
            edges {
              cursor
            }
          }
        }
        viewer {
          bio
          postCount
          selectUser {
            name
            postCount
            posts {
              id
              title
            }
            postsConnection(first: 1) {
              totalCount
              edges {
                node {
                  id
                  title
                  createdAt
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
          "selectMe": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "R1BDOk46MjUw",
                },
                {
                  "cursor": "R1BDOk46MjQ5",
                },
              ],
            },
          },
          "viewer": {
            "bio": "Saepe deserunt animi quia.",
            "postCount": 250,
            "selectUser": {
              "name": "Maurine Rath",
              "postCount": 250,
              "posts": [
                {
                  "id": "U2VsZWN0UG9zdDox",
                  "title": "Omnis quisquam quisquam quos nihil dolor voluptatibus velit.",
                },
                {
                  "id": "U2VsZWN0UG9zdDoy",
                  "title": "Accusantium et quia quos sequi molestiae.",
                },
                {
                  "id": "U2VsZWN0UG9zdDoz",
                  "title": "Veniam perspiciatis et nisi aut corporis laboriosam.",
                },
                {
                  "id": "U2VsZWN0UG9zdDo0",
                  "title": "Sit voluptatum mollitia enim iste molestias nesciunt minima sequi voluptas.",
                },
                {
                  "id": "U2VsZWN0UG9zdDo1",
                  "title": "Omnis odit labore magni rerum quia praesentium distinctio.",
                },
              ],
              "postsConnection": {
                "edges": [
                  {
                    "node": {
                      "createdAt": "2012-12-12T00:00:00.249Z",
                      "id": "U2VsZWN0UG9zdDoyNTA=",
                      "title": "Inventore quas reiciendis.",
                    },
                  },
                ],
                "totalCount": 250,
              },
            },
          },
          "withCompositeConnection": {
            "edges": [
              {
                "cursor": "R1BDOko6WyIyIiwiMiJd",
                "node": {
                  "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGVTZWxlY3Q6WyIyIiwiMiJd",
                },
              },
              {
                "cursor": "R1BDOko6WyIzIiwiMyJd",
                "node": {
                  "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGVTZWxlY3Q6WyIzIiwiMyJd",
                },
              },
            ],
          },
          "withIDSelectConnection": {
            "edges": [
              {
                "cursor": "R1BDOlM6Mg==",
              },
              {
                "cursor": "R1BDOlM6Mw==",
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
            "cursor": {
              "id": "1",
            },
            "select": {
              "id": true,
            },
            "skip": 1,
            "take": 3,
          },
          "dataPath": [],
          "model": "WithID",
          "runInTransaction": false,
        },
        {
          "action": "findMany",
          "args": {
            "cursor": {
              "a_b": {
                "a": "1",
                "b": "1",
              },
            },
            "select": {
              "a": true,
              "b": true,
            },
            "skip": 1,
            "take": 3,
          },
          "dataPath": [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "select": {
              "id": true,
              "posts": {
                "orderBy": {
                  "createdAt": "desc",
                },
                "select": {
                  "id": true,
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
          "action": "findUnique",
          "args": {
            "select": {
              "_count": {
                "select": {
                  "posts": true,
                },
              },
              "id": true,
              "name": true,
              "posts": {
                "select": {
                  "id": true,
                  "title": true,
                },
                "take": 5,
              },
              "profile": {
                "select": {
                  "bio": true,
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
          "action": "findUnique",
          "args": {
            "select": {
              "_count": {
                "select": {
                  "posts": true,
                },
              },
              "posts": {
                "orderBy": {
                  "createdAt": "desc",
                },
                "select": {
                  "createdAt": true,
                  "id": true,
                  "title": true,
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

  it('variant include', async () => {
    const query = gql`
      query {
        viewer {
          bio
          user {
            id
          }
          selectUser {
            postsConnection(first: 1) {
              edges {
                node {
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
          "viewer": {
            "bio": "Saepe deserunt animi quia.",
            "selectUser": {
              "postsConnection": {
                "edges": [
                  {
                    "node": {
                      "id": "U2VsZWN0UG9zdDoyNTA=",
                    },
                  },
                ],
              },
            },
            "user": {
              "id": "VXNlcjox",
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
                "orderBy": {
                  "createdAt": "desc",
                },
                "select": {
                  "id": true,
                },
                "skip": 0,
                "take": 2,
              },
              "profile": {
                "select": {
                  "bio": true,
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

  it('duplicate relations (compatible)', async () => {
    const query = gql`
      query {
        viewer {
          user {
            postsConnection(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
          selectUser {
            postsConnection(first: 1) {
              edges {
                node {
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
          "viewer": {
            "selectUser": {
              "postsConnection": {
                "edges": [
                  {
                    "node": {
                      "id": "U2VsZWN0UG9zdDoyNTA=",
                    },
                  },
                ],
              },
            },
            "user": {
              "postsConnection": {
                "edges": [
                  {
                    "node": {
                      "id": "250",
                    },
                  },
                ],
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

  it('duplicate relations (incompatible)', async () => {
    const query = gql`
      query {
        viewer {
          user {
            postsConnection(first: 2) {
              edges {
                node {
                  id
                }
              }
            }
          }
          selectUser {
            postsConnection(first: 1) {
              edges {
                node {
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
          "viewer": {
            "selectUser": {
              "postsConnection": {
                "edges": [
                  {
                    "node": {
                      "id": "U2VsZWN0UG9zdDoyNTA=",
                    },
                  },
                ],
              },
            },
            "user": {
              "postsConnection": {
                "edges": [
                  {
                    "node": {
                      "id": "250",
                    },
                  },
                  {
                    "node": {
                      "id": "249",
                    },
                  },
                ],
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
          "action": "findUnique",
          "args": {
            "select": {
              "id": true,
              "posts": {
                "orderBy": {
                  "createdAt": "desc",
                },
                "select": {
                  "id": true,
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
});

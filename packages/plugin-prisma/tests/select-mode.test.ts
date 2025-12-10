import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('select mode', () => {
  afterEach(() => {
    queries.length = 0;
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
            "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
            "postCount": 250,
            "selectUser": {
              "name": "Maurine Farrell",
              "postCount": 250,
              "posts": [
                {
                  "id": "U2VsZWN0UG9zdDox",
                  "title": "Denique cruciamentum conicio suspendo decens adulatio cubicularis taceo.",
                },
                {
                  "id": "U2VsZWN0UG9zdDoy",
                  "title": "Voro earum placeat animi trepide pax.",
                },
                {
                  "id": "U2VsZWN0UG9zdDoz",
                  "title": "Contabesco adimpleo cogo cubicularis sufficio vulnero constans tempus optio.",
                },
                {
                  "id": "U2VsZWN0UG9zdDo0",
                  "title": "Vorago causa magni timor cruentus suus arto paulatim uredo vorago.",
                },
                {
                  "id": "U2VsZWN0UG9zdDo1",
                  "title": "Debitis teneo maxime ago nostrum tot.",
                },
              ],
              "postsConnection": {
                "edges": [
                  {
                    "node": {
                      "createdAt": "2012-12-12T00:00:00.249Z",
                      "id": "U2VsZWN0UG9zdDoyNTA=",
                      "title": "Ambulo conduco quod cilicium.",
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
          "model": "WithID",
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
          "model": "WithCompositeUnique",
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
          "model": "User",
        },
        {
          "action": "findUniqueOrThrow",
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
          "model": "User",
        },
        {
          "action": "findUniqueOrThrow",
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
          "model": "User",
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
            "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
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
          "action": "findUniqueOrThrow",
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
          "model": "User",
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
          "action": "findUniqueOrThrow",
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
          "model": "User",
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
          "action": "findUniqueOrThrow",
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
          "model": "User",
        },
        {
          "action": "findUniqueOrThrow",
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
          "model": "User",
        },
      ]
    `);
  });
});

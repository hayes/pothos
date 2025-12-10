import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('query on relations', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('queries relations', async () => {
    const query = gql`
      query {
        me {
          commentedPostsConnection(first: 3) {
            edges {
              node {
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

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "commentedPostsConnection": {
              "edges": [
                {
                  "node": {
                    "id": "1",
                  },
                },
                {
                  "node": {
                    "id": "2",
                  },
                },
                {
                  "node": {
                    "id": "3",
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
                "skip": 0,
                "take": 4,
                "where": {
                  "comments": {
                    "some": {
                      "authorId": 1,
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

  it('queries related connections', async () => {
    const query = gql`
      query {
        me {
          commentedPostsConnection(first: 3) {
            edges {
              node {
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

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "commentedPostsConnection": {
              "edges": [
                {
                  "node": {
                    "id": "1",
                  },
                },
                {
                  "node": {
                    "id": "2",
                  },
                },
                {
                  "node": {
                    "id": "3",
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
                "skip": 0,
                "take": 4,
                "where": {
                  "comments": {
                    "some": {
                      "authorId": 1,
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

  it('queries with conflicting selections', async () => {
    const query = gql`
      query {
        post(id: 1) {
          ownComments {
            id
            content
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
            "ownComments": [
              {
                "content": "Vilicus autus vis copia urbs arbustum summopere.",
                "id": "1",
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
          "model": "Post",
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
                "where": {
                  "authorId": 1,
                },
              },
            },
            "where": {
              "id": 1,
            },
          },
          "model": "Post",
        },
      ]
    `);
  });

  it('queries with conflicting selections on connections', async () => {
    const query = gql`
      query {
        post(id: 1) {
          ownCommentsConnection {
            edges {
              node {
                author {
                  name
                }
                content
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
            "ownCommentsConnection": {
              "edges": [
                {
                  "node": {
                    "author": {
                      "name": "Maurine Farrell",
                    },
                    "content": "Vilicus autus vis copia urbs arbustum summopere.",
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
          "model": "Post",
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
                "skip": 0,
                "take": 21,
                "where": {
                  "authorId": 1,
                },
              },
            },
            "where": {
              "id": 1,
            },
          },
          "model": "Post",
        },
      ]
    `);
  });
});

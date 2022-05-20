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
      Object {
        "data": Object {
          "viewer": Object {
            "bio": "Saepe deserunt animi quia.",
            "postCount": 250,
            "selectUser": Object {
              "name": "Maurine Rath",
              "postCount": 250,
              "posts": Array [
                Object {
                  "id": "U2VsZWN0UG9zdDox",
                  "title": "Omnis quisquam quisquam quos nihil dolor voluptatibus velit.",
                },
                Object {
                  "id": "U2VsZWN0UG9zdDoy",
                  "title": "Accusantium et quia quos sequi molestiae.",
                },
                Object {
                  "id": "U2VsZWN0UG9zdDoz",
                  "title": "Veniam perspiciatis et nisi aut corporis laboriosam.",
                },
                Object {
                  "id": "U2VsZWN0UG9zdDo0",
                  "title": "Sit voluptatum mollitia enim iste molestias nesciunt minima sequi voluptas.",
                },
                Object {
                  "id": "U2VsZWN0UG9zdDo1",
                  "title": "Omnis odit labore magni rerum quia praesentium distinctio.",
                },
              ],
              "postsConnection": Object {
                "edges": Array [
                  Object {
                    "node": Object {
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
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "select": Object {
              "_count": Object {
                "select": Object {
                  "posts": true,
                },
              },
              "id": true,
              "name": true,
              "posts": Object {
                "select": Object {
                  "id": true,
                  "title": true,
                },
                "take": 5,
              },
              "profile": Object {
                "select": Object {
                  "bio": true,
                },
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
            "select": Object {
              "_count": Object {
                "select": Object {
                  "posts": true,
                },
              },
              "posts": Object {
                "orderBy": Object {
                  "createdAt": "desc",
                },
                "select": Object {
                  "createdAt": true,
                  "id": true,
                  "title": true,
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
      Object {
        "data": Object {
          "viewer": Object {
            "bio": "Saepe deserunt animi quia.",
            "selectUser": Object {
              "postsConnection": Object {
                "edges": Array [
                  Object {
                    "node": Object {
                      "id": "U2VsZWN0UG9zdDoyNTA=",
                    },
                  },
                ],
              },
            },
            "user": Object {
              "id": "VXNlcjox",
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
            "include": Object {
              "posts": Object {
                "orderBy": Object {
                  "createdAt": "desc",
                },
                "select": Object {
                  "id": true,
                },
                "skip": 0,
                "take": 2,
              },
              "profile": Object {
                "select": Object {
                  "bio": true,
                },
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
      Object {
        "data": Object {
          "viewer": Object {
            "selectUser": Object {
              "postsConnection": Object {
                "edges": Array [
                  Object {
                    "node": Object {
                      "id": "U2VsZWN0UG9zdDoyNTA=",
                    },
                  },
                ],
              },
            },
            "user": Object {
              "postsConnection": Object {
                "edges": Array [
                  Object {
                    "node": Object {
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
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "posts": Object {
                "include": Object {
                  "comments": Object {
                    "include": Object {
                      "author": true,
                    },
                    "take": 3,
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
      Object {
        "data": Object {
          "viewer": Object {
            "selectUser": Object {
              "postsConnection": Object {
                "edges": Array [
                  Object {
                    "node": Object {
                      "id": "U2VsZWN0UG9zdDoyNTA=",
                    },
                  },
                ],
              },
            },
            "user": Object {
              "postsConnection": Object {
                "edges": Array [
                  Object {
                    "node": Object {
                      "id": "250",
                    },
                  },
                  Object {
                    "node": Object {
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
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "posts": Object {
                "include": Object {
                  "comments": Object {
                    "include": Object {
                      "author": true,
                    },
                    "take": 3,
                  },
                },
                "orderBy": Object {
                  "createdAt": "desc",
                },
                "skip": 0,
                "take": 3,
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
            "select": Object {
              "id": true,
              "posts": Object {
                "orderBy": Object {
                  "createdAt": "desc",
                },
                "select": Object {
                  "id": true,
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

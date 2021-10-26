import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma } from './example/builder';
import schema from './example/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('query on relations', () => {
  afterEach(() => {
    queries = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('with context', () => {});

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
Object {
  "data": Object {
    "me": Object {
      "commentedPostsConnection": Object {
        "edges": Array [
          Object {
            "node": Object {
              "id": "1",
            },
          },
          Object {
            "node": Object {
              "id": "2",
            },
          },
          Object {
            "node": Object {
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
            },
          },
          "skip": 0,
          "take": 4,
          "where": Object {
            "comments": Object {
              "some": Object {
                "authorId": 1,
              },
            },
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
Object {
  "data": Object {
    "me": Object {
      "commentedPostsConnection": Object {
        "edges": Array [
          Object {
            "node": Object {
              "id": "1",
            },
          },
          Object {
            "node": Object {
              "id": "2",
            },
          },
          Object {
            "node": Object {
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
            },
          },
          "skip": 0,
          "take": 4,
          "where": Object {
            "comments": Object {
              "some": Object {
                "authorId": 1,
              },
            },
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
Object {
  "data": Object {
    "post": Object {
      "ownComments": Array [
        Object {
          "content": "Adipisci autem ducimus sunt et expedita consequuntur esse nam.",
          "id": "1",
        },
      ],
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
        "comments": Object {
          "include": Object {
            "author": true,
          },
        },
      },
      "where": Object {
        "id": 1,
      },
    },
    "dataPath": Array [],
    "model": "Post",
    "runInTransaction": false,
  },
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "comments": Object {
          "include": Object {
            "author": Object {
              "include": Object {
                "profile": true,
              },
            },
          },
          "where": Object {
            "authorId": 1,
          },
        },
      },
      "where": Object {
        "id": 1,
      },
    },
    "dataPath": Array [],
    "model": "Post",
    "runInTransaction": false,
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
Object {
  "data": Object {
    "post": Object {
      "ownCommentsConnection": Object {
        "edges": Array [
          Object {
            "node": Object {
              "author": Object {
                "name": "Maurine Ratke",
              },
              "content": "Adipisci autem ducimus sunt et expedita consequuntur esse nam.",
            },
          },
        ],
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
        "comments": Object {
          "include": Object {
            "author": true,
          },
        },
      },
      "where": Object {
        "id": 1,
      },
    },
    "dataPath": Array [],
    "model": "Post",
    "runInTransaction": false,
  },
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "comments": Object {
          "include": Object {
            "author": Object {
              "include": Object {
                "profile": true,
              },
            },
          },
          "skip": 0,
          "take": 21,
          "where": Object {
            "authorId": 1,
          },
        },
      },
      "where": Object {
        "id": 1,
      },
    },
    "dataPath": Array [],
    "model": "Post",
    "runInTransaction": false,
  },
]
`);
  });
});

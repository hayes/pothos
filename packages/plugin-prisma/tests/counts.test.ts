import { gql } from 'apollo-server';
import { execute } from 'graphql';
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

  it('relationCount and count on connections', async () => {
    const query = gql`
      query {
        me {
          postCount
          anotherPostCount: postCount
          postsConnection(first: 1) {
            totalCount
            edges {
              node {
                id
              }
            }
          }
          oldPosts: postsConnection(first: 1, oldestFirst: true) {
            totalCount
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
      "anotherPostCount": 250,
      "oldPosts": Object {
        "edges": Array [
          Object {
            "node": Object {
              "id": "1",
            },
          },
        ],
        "totalCount": 250,
      },
      "postCount": 250,
      "postsConnection": Object {
        "edges": Array [
          Object {
            "node": Object {
              "id": "250",
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
Array [
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "_count": Object {
          "select": Object {
            "posts": true,
          },
        },
        "posts": Object {
          "include": Object {
            "comments": Object {
              "include": Object {
                "author": true,
              },
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
          "orderBy": Object {
            "createdAt": "asc",
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

  it('nested in single item', async () => {
    const query = gql`
      query {
        post(id: 1) {
          id
          author {
            postCount
            profile {
              user {
                postCount
              }
            }
            postsConnection {
              totalCount
            }
          }
        }
        users {
          profile {
            user {
              profile {
                user {
                  profile {
                    user {
                      postCount
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
    });

    expect(result).toMatchInlineSnapshot(`
Object {
  "data": Object {
    "post": Object {
      "author": Object {
        "postCount": 250,
        "postsConnection": Object {
          "totalCount": 250,
        },
        "profile": Object {
          "user": Object {
            "postCount": 250,
          },
        },
      },
      "id": "1",
    },
    "users": Array [
      Object {
        "profile": Object {
          "user": Object {
            "profile": Object {
              "user": Object {
                "profile": Object {
                  "user": Object {
                    "postCount": 250,
                  },
                },
              },
            },
          },
        },
      },
      Object {
        "profile": null,
      },
    ],
  },
}
`);

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findUnique",
    "args": Object {
      "include": Object {
        "author": Object {
          "include": Object {
            "_count": Object {
              "select": Object {
                "posts": true,
              },
            },
            "posts": Object {
              "include": Object {
                "comments": Object {
                  "include": Object {
                    "author": true,
                  },
                },
              },
              "orderBy": Object {
                "createdAt": "desc",
              },
              "skip": 0,
              "take": 21,
            },
            "profile": Object {
              "include": Object {
                "user": Object {
                  "include": Object {
                    "_count": Object {
                      "select": Object {
                        "posts": true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "profile": Object {
          "include": Object {
            "user": Object {
              "include": Object {
                "profile": Object {
                  "include": Object {
                    "user": Object {
                      "include": Object {
                        "profile": Object {
                          "include": Object {
                            "user": Object {
                              "include": Object {
                                "_count": Object {
                                  "select": Object {
                                    "posts": true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
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

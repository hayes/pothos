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
            "id": "1",
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "include": undefined,
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
              "id": "1",
            },
            Object {
              "id": "2",
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
            "include": undefined,
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "me": Object {
            "posts": Array [
              Object {
                "author": Object {
                  "profile": Object {
                    "bio": "This is a bio",
                  },
                },
              },
              Object {
                "author": Object {
                  "profile": Object {
                    "bio": "This is a bio",
                  },
                },
              },
              Object {
                "author": Object {
                  "profile": Object {
                    "bio": "This is a bio",
                  },
                },
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
              "posts": Object {
                "include": Object {
                  "author": Object {
                    "include": Object {
                      "profile": true,
                    },
                  },
                },
                "orderBy": Object {
                  "createdAt": "desc",
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

  it('queries for list with nested relations', async () => {
    const query = gql`
      query {
        users {
          profile {
            bio
          }
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "users": Array [
            Object {
              "posts": Array [
                Object {
                  "author": Object {
                    "profile": Object {
                      "bio": "This is a bio",
                    },
                  },
                },
                Object {
                  "author": Object {
                    "profile": Object {
                      "bio": "This is a bio",
                    },
                  },
                },
                Object {
                  "author": Object {
                    "profile": Object {
                      "bio": "This is a bio",
                    },
                  },
                },
              ],
              "profile": Object {
                "bio": "This is a bio",
              },
            },
            Object {
              "posts": Array [
                Object {
                  "author": Object {
                    "profile": Object {
                      "bio": "Bio of user 2",
                    },
                  },
                },
                Object {
                  "author": Object {
                    "profile": Object {
                      "bio": "Bio of user 2",
                    },
                  },
                },
              ],
              "profile": Object {
                "bio": "Bio of user 2",
              },
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
            "include": Object {
              "posts": Object {
                "include": Object {
                  "author": Object {
                    "include": Object {
                      "profile": true,
                    },
                  },
                },
                "orderBy": Object {
                  "createdAt": "desc",
                },
              },
              "profile": true,
            },
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "me": Object {
            "oldestPosts": Array [
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "1",
              },
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "2",
              },
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "3",
              },
            ],
            "posts": Array [
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "3",
              },
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "2",
              },
              Object {
                "author": Object {
                  "id": "1",
                },
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
        "posts": Object {
          "include": Object {
            "author": Object {
              "include": Object {
                "profile": true,
              },
            },
          },
          "orderBy": Object {
            "createdAt": "desc",
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "author": Object {
          "include": Object {
            "profile": true,
          },
        },
      },
      "orderBy": Object {
        "createdAt": "asc",
      },
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "me": Object {
            "oldestPosts": Array [
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "1",
              },
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "2",
              },
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "3",
              },
            ],
            "postIds": Array [
              Object {
                "id": "3",
              },
              Object {
                "id": "2",
              },
              Object {
                "id": "1",
              },
            ],
            "posts": Array [
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "3",
              },
              Object {
                "author": Object {
                  "id": "1",
                },
                "id": "2",
              },
              Object {
                "author": Object {
                  "id": "1",
                },
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
        "posts": Object {
          "include": Object {
            "author": Object {
              "include": Object {
                "profile": true,
              },
            },
          },
          "orderBy": Object {
            "createdAt": "desc",
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
    "action": "findMany",
    "args": Object {
      "orderBy": Object {
        "createdAt": "desc",
      },
      "where": Object {
        "authorId": 1,
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
        "author": Object {
          "include": Object {
            "profile": true,
          },
        },
      },
      "orderBy": Object {
        "createdAt": "asc",
      },
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
                  "bio": "This is a bio",
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
            "include": undefined,
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
});

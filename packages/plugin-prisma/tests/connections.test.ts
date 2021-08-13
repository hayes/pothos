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

  it('connection with nested relations', async () => {
    const query = gql`
      query {
        userConnection {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            node {
              id
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
    "userConnection": Object {
      "edges": Array [
        Object {
          "node": Object {
            "id": "VXNlcjox",
            "profile": Object {
              "bio": "Sequi minus inventore itaque similique et.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjoy",
            "profile": Object {
              "bio": "Ut quo accusantium fuga veritatis.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjoz",
            "profile": Object {
              "bio": "Tenetur nam ut sed dolorem sit sed dolorem.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjo0",
            "profile": Object {
              "bio": "Accusamus reprehenderit possimus cumque nulla eum mollitia possimus placeat architecto.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjo1",
            "profile": Object {
              "bio": "Dignissimos tempora magnam error aut neque corrupti ut et.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjo2",
            "profile": Object {
              "bio": "Itaque eius distinctio provident minus alias tenetur fugiat doloribus repellendus.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjo3",
            "profile": Object {
              "bio": "Minima autem dolorem natus.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjo4",
            "profile": Object {
              "bio": "Porro consequuntur animi vero.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjo5",
            "profile": Object {
              "bio": "Atque enim facilis repellendus officia.",
            },
          },
        },
        Object {
          "node": Object {
            "id": "VXNlcjoxMA==",
            "profile": Object {
              "bio": "Cumque temporibus eum et laboriosam adipisci est odit id.",
            },
          },
        },
      ],
      "pageInfo": Object {
        "endCursor": "R1BDOk46MTA=",
        "hasNextPage": true,
        "hasPreviousPage": false,
        "startCursor": "R1BDOk46MQ==",
      },
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
        "profile": true,
      },
      "skip": 0,
      "take": 11,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });
  it('after', async () => {
    const query = gql`
      query {
        userConnection(first: 1, after: "R1BDOk46MQ==") {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            cursor
            node {
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
    "userConnection": Object {
      "edges": Array [
        Object {
          "cursor": "R1BDOk46Mg==",
          "node": Object {
            "id": "VXNlcjoy",
          },
        },
      ],
      "pageInfo": Object {
        "endCursor": "R1BDOk46Mg==",
        "hasNextPage": true,
        "hasPreviousPage": true,
        "startCursor": "R1BDOk46Mg==",
      },
    },
  },
}
`);

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findMany",
    "args": Object {
      "cursor": Object {
        "id": 1,
      },
      "skip": 1,
      "take": 2,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });
  it('limit', async () => {
    const query = gql`
      query {
        userConnection(first: 100, after: "R1BDOk46MQ==") {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            cursor
            node {
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
    "userConnection": Object {
      "edges": Array [
        Object {
          "cursor": "R1BDOk46Mg==",
          "node": Object {
            "id": "VXNlcjoy",
          },
        },
        Object {
          "cursor": "R1BDOk46Mw==",
          "node": Object {
            "id": "VXNlcjoz",
          },
        },
        Object {
          "cursor": "R1BDOk46NA==",
          "node": Object {
            "id": "VXNlcjo0",
          },
        },
        Object {
          "cursor": "R1BDOk46NQ==",
          "node": Object {
            "id": "VXNlcjo1",
          },
        },
        Object {
          "cursor": "R1BDOk46Ng==",
          "node": Object {
            "id": "VXNlcjo2",
          },
        },
        Object {
          "cursor": "R1BDOk46Nw==",
          "node": Object {
            "id": "VXNlcjo3",
          },
        },
        Object {
          "cursor": "R1BDOk46OA==",
          "node": Object {
            "id": "VXNlcjo4",
          },
        },
        Object {
          "cursor": "R1BDOk46OQ==",
          "node": Object {
            "id": "VXNlcjo5",
          },
        },
        Object {
          "cursor": "R1BDOk46MTA=",
          "node": Object {
            "id": "VXNlcjoxMA==",
          },
        },
        Object {
          "cursor": "R1BDOk46MTE=",
          "node": Object {
            "id": "VXNlcjoxMQ==",
          },
        },
        Object {
          "cursor": "R1BDOk46MTI=",
          "node": Object {
            "id": "VXNlcjoxMg==",
          },
        },
        Object {
          "cursor": "R1BDOk46MTM=",
          "node": Object {
            "id": "VXNlcjoxMw==",
          },
        },
        Object {
          "cursor": "R1BDOk46MTQ=",
          "node": Object {
            "id": "VXNlcjoxNA==",
          },
        },
        Object {
          "cursor": "R1BDOk46MTU=",
          "node": Object {
            "id": "VXNlcjoxNQ==",
          },
        },
        Object {
          "cursor": "R1BDOk46MTY=",
          "node": Object {
            "id": "VXNlcjoxNg==",
          },
        },
      ],
      "pageInfo": Object {
        "endCursor": "R1BDOk46MTY=",
        "hasNextPage": true,
        "hasPreviousPage": true,
        "startCursor": "R1BDOk46Mg==",
      },
    },
  },
}
`);

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findMany",
    "args": Object {
      "cursor": Object {
        "id": 1,
      },
      "skip": 1,
      "take": 16,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });
  it('before', async () => {
    const query = gql`
      query {
        userConnection(last: 100, before: "R1BDOk46NA==") {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            cursor
            node {
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
    "userConnection": Object {
      "edges": Array [
        Object {
          "cursor": "R1BDOk46MQ==",
          "node": Object {
            "id": "VXNlcjox",
          },
        },
        Object {
          "cursor": "R1BDOk46Mg==",
          "node": Object {
            "id": "VXNlcjoy",
          },
        },
        Object {
          "cursor": "R1BDOk46Mw==",
          "node": Object {
            "id": "VXNlcjoz",
          },
        },
      ],
      "pageInfo": Object {
        "endCursor": "R1BDOk46Mw==",
        "hasNextPage": true,
        "hasPreviousPage": false,
        "startCursor": "R1BDOk46MQ==",
      },
    },
  },
}
`);

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findMany",
    "args": Object {
      "cursor": Object {
        "id": 4,
      },
      "skip": 1,
      "take": -16,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });
  it('end', async () => {
    const query = gql`
      query {
        userConnection(after: "R1BDOk46OTc=") {
          pageInfo {
            startCursor
            endCursor
            hasNextPage
            hasPreviousPage
          }
          edges {
            cursor
            node {
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
    "userConnection": Object {
      "edges": Array [
        Object {
          "cursor": "R1BDOk46OTg=",
          "node": Object {
            "id": "VXNlcjo5OA==",
          },
        },
        Object {
          "cursor": "R1BDOk46OTk=",
          "node": Object {
            "id": "VXNlcjo5OQ==",
          },
        },
        Object {
          "cursor": "R1BDOk46MTAw",
          "node": Object {
            "id": "VXNlcjoxMDA=",
          },
        },
      ],
      "pageInfo": Object {
        "endCursor": "R1BDOk46MTAw",
        "hasNextPage": false,
        "hasPreviousPage": true,
        "startCursor": "R1BDOk46OTg=",
      },
    },
  },
}
`);

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findMany",
    "args": Object {
      "cursor": Object {
        "id": 97,
      },
      "skip": 1,
      "take": 11,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });

  it('nested connection', async () => {
    const query = gql`
      query {
        userConnection(first: 1) {
          edges {
            cursor
            node {
              postsConnection {
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  startCursor
                  endCursor
                }
                edges {
                  node {
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
    });

    expect(result).toMatchInlineSnapshot(`
Object {
  "data": Object {
    "userConnection": Object {
      "edges": Array [
        Object {
          "cursor": "R1BDOk46MQ==",
          "node": Object {
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
                Object {
                  "node": Object {
                    "id": "248",
                  },
                },
                Object {
                  "node": Object {
                    "id": "247",
                  },
                },
                Object {
                  "node": Object {
                    "id": "246",
                  },
                },
                Object {
                  "node": Object {
                    "id": "245",
                  },
                },
                Object {
                  "node": Object {
                    "id": "244",
                  },
                },
                Object {
                  "node": Object {
                    "id": "243",
                  },
                },
                Object {
                  "node": Object {
                    "id": "242",
                  },
                },
                Object {
                  "node": Object {
                    "id": "241",
                  },
                },
                Object {
                  "node": Object {
                    "id": "240",
                  },
                },
                Object {
                  "node": Object {
                    "id": "239",
                  },
                },
                Object {
                  "node": Object {
                    "id": "238",
                  },
                },
                Object {
                  "node": Object {
                    "id": "237",
                  },
                },
                Object {
                  "node": Object {
                    "id": "236",
                  },
                },
                Object {
                  "node": Object {
                    "id": "235",
                  },
                },
                Object {
                  "node": Object {
                    "id": "234",
                  },
                },
                Object {
                  "node": Object {
                    "id": "233",
                  },
                },
                Object {
                  "node": Object {
                    "id": "232",
                  },
                },
                Object {
                  "node": Object {
                    "id": "231",
                  },
                },
              ],
              "pageInfo": Object {
                "endCursor": "R1BDOkQ6MTYyNzk1NTE2OTc0NA==",
                "hasNextPage": true,
                "hasPreviousPage": false,
                "startCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
              },
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "posts": Object {
          "orderBy": Object {
            "createdAt": "desc",
          },
          "skip": 0,
          "take": 21,
        },
      },
      "skip": 0,
      "take": 2,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });

  it('nested connection after', async () => {
    const query = gql`
      query {
        userConnection(first: 1) {
          edges {
            cursor
            node {
              postsConnection(first: 2, after: "R1BDOk46NQ==") {
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  startCursor
                  endCursor
                }
                edges {
                  cursor
                  node {
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
    });

    expect(result).toMatchInlineSnapshot(`
Object {
  "data": null,
  "errors": Array [
    [GraphQLError: 
Invalid \`prisma.user.findMany()\` invocation:

{
  include: {
    posts: {
      orderBy: {
        createdAt: 'desc'
      },
      cursor: {
        createdAt: 5
                   ~
      },
      take: 3,
      skip: 1
    }
  },
  take: 2,
  skip: 0
}

Argument createdAt: Got invalid value 5 on prisma.findManyUser. Provided Int, expected DateTime.

],
  ],
}
`);

    expect(queries).toMatchInlineSnapshot(`
Array [
  Object {
    "action": "findMany",
    "args": Object {
      "include": Object {
        "posts": Object {
          "cursor": Object {
            "createdAt": 5,
          },
          "orderBy": Object {
            "createdAt": "desc",
          },
          "skip": 1,
          "take": 3,
        },
      },
      "skip": 0,
      "take": 2,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });

  it('query from args', async () => {
    const query = gql`
      query {
        userConnection(first: 1) {
          edges {
            cursor
            node {
              postsConnection(first: 2, after: "R1BDOkQ6MTYyNzk1NTE2OTc2Mg==", oldestFirst: true) {
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  startCursor
                  endCursor
                }
                edges {
                  cursor
                  node {
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
    });

    expect(result).toMatchInlineSnapshot(`
Object {
  "data": Object {
    "userConnection": Object {
      "edges": Array [
        Object {
          "cursor": "R1BDOk46MQ==",
          "node": Object {
            "postsConnection": Object {
              "edges": Array [
                Object {
                  "cursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
                  "node": Object {
                    "id": "250",
                  },
                },
              ],
              "pageInfo": Object {
                "endCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
                "hasNextPage": false,
                "hasPreviousPage": true,
                "startCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
              },
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "posts": Object {
          "cursor": Object {
            "createdAt": 2021-08-03T01:46:09.762Z,
          },
          "orderBy": Object {
            "createdAt": "asc",
          },
          "skip": 1,
          "take": 3,
        },
      },
      "skip": 0,
      "take": 2,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });

  it('double related connection', async () => {
    const query = gql`
      query {
        userConnection(first: 1) {
          edges {
            cursor
            node {
              postsConnection(first: 2, after: "R1BDOkQ6MTYyNzk1NTE2OTc2Mg==", oldestFirst: true) {
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  startCursor
                  endCursor
                }
                edges {
                  cursor
                  node {
                    id
                  }
                }
              }
              newPosts: postsConnection(first: 2) {
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  startCursor
                  endCursor
                }
                edges {
                  cursor
                  node {
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
    });

    expect(result).toMatchInlineSnapshot(`
Object {
  "data": Object {
    "userConnection": Object {
      "edges": Array [
        Object {
          "cursor": "R1BDOk46MQ==",
          "node": Object {
            "newPosts": Object {
              "edges": Array [
                Object {
                  "cursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
                  "node": Object {
                    "id": "250",
                  },
                },
                Object {
                  "cursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mg==",
                  "node": Object {
                    "id": "249",
                  },
                },
              ],
              "pageInfo": Object {
                "endCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mg==",
                "hasNextPage": true,
                "hasPreviousPage": false,
                "startCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
              },
            },
            "postsConnection": Object {
              "edges": Array [
                Object {
                  "cursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
                  "node": Object {
                    "id": "250",
                  },
                },
              ],
              "pageInfo": Object {
                "endCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
                "hasNextPage": false,
                "hasPreviousPage": true,
                "startCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
              },
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "posts": Object {
          "cursor": Object {
            "createdAt": 2021-08-03T01:46:09.762Z,
          },
          "orderBy": Object {
            "createdAt": "asc",
          },
          "skip": 1,
          "take": 3,
        },
      },
      "skip": 0,
      "take": 2,
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
]
`);
  });

  it('multiple nested queries', async () => {
    const query = gql`
      query {
        userConnection(first: 1) {
          edges {
            cursor
            node {
              postsConnection(first: 2, after: "R1BDOkQ6MTYyNzk1NTE2OTc2Mg==", oldestFirst: true) {
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  startCursor
                  endCursor
                }
                edges {
                  cursor
                  node {
                    id
                    author {
                      profile {
                        bio
                      }
                    }
                  }
                }
              }
              newPosts: postsConnection(first: 2) {
                pageInfo {
                  hasNextPage
                  hasPreviousPage
                  startCursor
                  endCursor
                }
                edges {
                  cursor
                  node {
                    id
                    author {
                      profile {
                        bio
                      }
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
    "userConnection": Object {
      "edges": Array [
        Object {
          "cursor": "R1BDOk46MQ==",
          "node": Object {
            "newPosts": Object {
              "edges": Array [
                Object {
                  "cursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
                  "node": Object {
                    "author": Object {
                      "profile": Object {
                        "bio": "Sequi minus inventore itaque similique et.",
                      },
                    },
                    "id": "250",
                  },
                },
                Object {
                  "cursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mg==",
                  "node": Object {
                    "author": Object {
                      "profile": Object {
                        "bio": "Sequi minus inventore itaque similique et.",
                      },
                    },
                    "id": "249",
                  },
                },
              ],
              "pageInfo": Object {
                "endCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mg==",
                "hasNextPage": true,
                "hasPreviousPage": false,
                "startCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
              },
            },
            "postsConnection": Object {
              "edges": Array [
                Object {
                  "cursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
                  "node": Object {
                    "author": Object {
                      "profile": Object {
                        "bio": "Sequi minus inventore itaque similique et.",
                      },
                    },
                    "id": "250",
                  },
                },
              ],
              "pageInfo": Object {
                "endCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
                "hasNextPage": false,
                "hasPreviousPage": true,
                "startCursor": "R1BDOkQ6MTYyNzk1NTE2OTc2Mw==",
              },
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "posts": Object {
          "cursor": Object {
            "createdAt": 2021-08-03T01:46:09.762Z,
          },
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
          "skip": 1,
          "take": 3,
        },
      },
      "skip": 0,
      "take": 2,
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
            "author": Object {
              "include": Object {
                "profile": true,
              },
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
]
`);
  });

  it('connection with errors', async () => {
    const query = gql`
      query {
        userConnectionWithErrors(first: 1) {
          __typename
          ... on Error {
            message
          }
          ... on QueryUserConnectionWithErrorsSuccess {
            data {
              edges {
                node {
                  profile {
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
    });

    expect(result).toMatchInlineSnapshot(`
Object {
  "data": Object {
    "userConnectionWithErrors": Object {
      "__typename": "QueryUserConnectionWithErrorsSuccess",
      "data": Object {
        "edges": Array [
          Object {
            "node": Object {
              "profile": Object {
                "bio": "Sequi minus inventore itaque similique et.",
                "user": Object {
                  "id": "VXNlcjox",
                },
              },
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
    "action": "findMany",
    "args": Object {
      "include": Object {
        "profile": Object {
          "include": Object {
            "user": true,
          },
        },
      },
      "skip": 0,
      "take": 2,
    },
    "dataPath": Array [],
    "model": "User",
    "runInTransaction": false,
  },
]
`);
  });

  it('connected relation with errors', async () => {
    const query = gql`
      query {
        me {
          postsConnectionWithErrors(first: 1) {
            __typename
            ... on Error {
              message
            }
            ... on UserPostsConnectionWithErrorsSuccess {
              data {
                edges {
                  node {
                    author {
                      profile {
                        bio
                      }
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
    "me": Object {
      "postsConnectionWithErrors": Object {
        "__typename": "UserPostsConnectionWithErrorsSuccess",
        "data": Object {
          "edges": Array [
            Object {
              "node": Object {
                "author": Object {
                  "profile": Object {
                    "bio": "Sequi minus inventore itaque similique et.",
                  },
                },
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
            "author": Object {
              "include": Object {
                "profile": Object {
                  "include": Object {
                    "user": true,
                  },
                },
              },
            },
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

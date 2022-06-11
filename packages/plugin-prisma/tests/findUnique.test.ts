import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma } from './example/builder';
import schema from './example/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('findUnique', () => {
  afterEach(() => {
    queries = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('query default and custom findUnique variations', async () => {
    const query = gql`
      {
        findUniqueRelations {
          withID {
            id
            relations {
              id
            }
          }
          withUnique {
            id
            relations {
              id
            }
          }
          withCompositeID {
            id
            relations {
              id
            }
          }
          withCompositeUnique {
            id
            relations {
              id
            }
          }
          withIDNode {
            id
            relations {
              id
            }
          }
          withUniqueNode {
            id
            relations {
              id
            }
          }
          withCompositeIDNode {
            id
            relations {
              id
            }
          }
          withCompositeUniqueNode {
            id
            relations {
              id
            }
          }
          withCompositeUniqueCustom {
            id
            relations {
              id
            }
          }
          withCompositeUniqueNodeCustom {
            id
            relations {
              id
            }
          }
        }
        findUniqueRelationsSelect {
          withIDSelect {
            relations {
              id
            }
          }
          withCompositeUniqueNodeSelect {
            relations {
              id
            }
          }
        }
        nodes(
          ids: [
            "V2l0aElETm9kZTox"
            "V2l0aFVuaXF1ZU5vZGU6MQ=="
            "V2l0aENvbXBvc2l0ZUlETm9kZTpbIjEiLCIxIl0="
            "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGU6WyIxIiwiMSJd"
            "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGVDdXN0b206MQ=="
          ]
        ) {
          __typename
          ... on WithIDNode {
            id
            relations {
              id
            }
          }
          ... on WithUniqueNode {
            id
            relations {
              id
            }
          }
          ... on WithCompositeIDNode {
            id
            relations {
              id
            }
          }
          ... on WithCompositeUniqueNode {
            id
            relations {
              id
            }
          }
          ... on WithCompositeUniqueNodeCustom {
            id
            relations {
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
          "findUniqueRelations": Object {
            "withCompositeID": Object {
              "id": "1",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withCompositeIDNode": Object {
              "id": "V2l0aENvbXBvc2l0ZUlETm9kZTpbIjEiLCIxIl0=",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withCompositeUnique": Object {
              "id": "1",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withCompositeUniqueCustom": Object {
              "id": "1",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withCompositeUniqueNode": Object {
              "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGU6WyIxIiwiMSJd",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withCompositeUniqueNodeCustom": Object {
              "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGVDdXN0b206MQ==",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withID": Object {
              "id": "1",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withIDNode": Object {
              "id": "V2l0aElETm9kZTox",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withUnique": Object {
              "id": "1",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withUniqueNode": Object {
              "id": "V2l0aFVuaXF1ZU5vZGU6MQ==",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
          },
          "findUniqueRelationsSelect": Object {
            "withCompositeUniqueNodeSelect": Object {
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            "withIDSelect": Object {
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
          },
          "nodes": Array [
            Object {
              "__typename": "WithIDNode",
              "id": "V2l0aElETm9kZTox",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            Object {
              "__typename": "WithUniqueNode",
              "id": "V2l0aFVuaXF1ZU5vZGU6MQ==",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            Object {
              "__typename": "WithCompositeIDNode",
              "id": "V2l0aENvbXBvc2l0ZUlETm9kZTpbIjEiLCIxIl0=",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            Object {
              "__typename": "WithCompositeUniqueNode",
              "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGU6WyIxIiwiMSJd",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
            },
            Object {
              "__typename": "WithCompositeUniqueNodeCustom",
              "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGVDdXN0b206MQ==",
              "relations": Array [
                Object {
                  "id": "1",
                },
              ],
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
              "withCompositeID": true,
              "withCompositeUnique": true,
              "withID": true,
              "withUnique": true,
            },
            "where": Object {
              "id": "1",
            },
          },
          "dataPath": Array [],
          "model": "FindUniqueRelations",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "withCompositeUnique": Object {
                "select": Object {
                  "FindUniqueRelations": true,
                  "a": true,
                  "b": true,
                },
              },
              "withID": Object {
                "select": Object {
                  "FindUniqueRelations": true,
                  "id": true,
                },
              },
            },
            "where": Object {
              "id": "1",
            },
          },
          "dataPath": Array [],
          "model": "FindUniqueRelations",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "id": "1",
            },
          },
          "dataPath": Array [],
          "model": "WithID",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "id": "1",
            },
          },
          "dataPath": Array [],
          "model": "WithUnique",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_b": Object {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeID",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_b": Object {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_c": Object {
                "a": "1",
                "c": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "id": "1",
            },
          },
          "dataPath": Array [],
          "model": "WithID",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "id": "1",
            },
          },
          "dataPath": Array [],
          "model": "WithUnique",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_b": Object {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeID",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_b": Object {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "id": "1",
            },
          },
          "dataPath": Array [],
          "model": "WithID",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "id": "1",
            },
          },
          "dataPath": Array [],
          "model": "WithUnique",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_b": Object {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeID",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_b": Object {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_c": Object {
                "a": "1",
                "c": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "FindUniqueRelations": true,
            },
            "where": Object {
              "a_c": Object {
                "a": "1",
                "c": "1",
              },
            },
          },
          "dataPath": Array [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
      ]
    `);
  });
});

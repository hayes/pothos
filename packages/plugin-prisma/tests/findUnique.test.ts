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
      {
        "data": {
          "findUniqueRelations": {
            "withCompositeID": {
              "id": "1",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withCompositeIDNode": {
              "id": "V2l0aENvbXBvc2l0ZUlETm9kZTpbIjEiLCIxIl0=",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withCompositeUnique": {
              "id": "1",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withCompositeUniqueCustom": {
              "id": "1",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withCompositeUniqueNode": {
              "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGU6WyIxIiwiMSJd",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withCompositeUniqueNodeCustom": {
              "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGVDdXN0b206MQ==",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withID": {
              "id": "1",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withIDNode": {
              "id": "V2l0aElETm9kZTox",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withUnique": {
              "id": "1",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withUniqueNode": {
              "id": "V2l0aFVuaXF1ZU5vZGU6MQ==",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
          },
          "findUniqueRelationsSelect": {
            "withCompositeUniqueNodeSelect": {
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            "withIDSelect": {
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
          },
          "nodes": [
            {
              "__typename": "WithIDNode",
              "id": "V2l0aElETm9kZTox",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            {
              "__typename": "WithUniqueNode",
              "id": "V2l0aFVuaXF1ZU5vZGU6MQ==",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            {
              "__typename": "WithCompositeIDNode",
              "id": "V2l0aENvbXBvc2l0ZUlETm9kZTpbIjEiLCIxIl0=",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            {
              "__typename": "WithCompositeUniqueNode",
              "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGU6WyIxIiwiMSJd",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
            {
              "__typename": "WithCompositeUniqueNodeCustom",
              "id": "V2l0aENvbXBvc2l0ZVVuaXF1ZU5vZGVDdXN0b206MQ==",
              "relations": [
                {
                  "id": "1",
                },
              ],
            },
          ],
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "withCompositeID": true,
              "withCompositeUnique": true,
              "withID": true,
              "withUnique": true,
            },
            "where": {
              "id": "1",
            },
          },
          "dataPath": [],
          "model": "FindUniqueRelations",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "withCompositeUnique": {
                "select": {
                  "FindUniqueRelations": true,
                  "a": true,
                  "b": true,
                },
              },
              "withID": {
                "select": {
                  "FindUniqueRelations": true,
                  "id": true,
                },
              },
            },
            "where": {
              "id": "1",
            },
          },
          "dataPath": [],
          "model": "FindUniqueRelations",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "id": "1",
            },
          },
          "dataPath": [],
          "model": "WithID",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "id": "1",
            },
          },
          "dataPath": [],
          "model": "WithUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_b": {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeID",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_b": {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_c": {
                "a": "1",
                "c": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "id": "1",
            },
          },
          "dataPath": [],
          "model": "WithID",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "id": "1",
            },
          },
          "dataPath": [],
          "model": "WithUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_b": {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeID",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_b": {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "id": "1",
            },
          },
          "dataPath": [],
          "model": "WithID",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "id": "1",
            },
          },
          "dataPath": [],
          "model": "WithUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_b": {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeID",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_b": {
                "a": "1",
                "b": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_c": {
                "a": "1",
                "c": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
        {
          "action": "findUnique",
          "args": {
            "include": {
              "FindUniqueRelations": true,
            },
            "where": {
              "a_c": {
                "a": "1",
                "c": "1",
              },
            },
          },
          "dataPath": [],
          "model": "WithCompositeUnique",
          "runInTransaction": false,
        },
      ]
    `);
  });
});

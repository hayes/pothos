import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('abstract types', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('root interface', async () => {
    const query = gql`
      query {
        named {
          ... on User {
            id
            name
            profile {
              bio
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
          "named": [
            {
              "id": "VXNlcjox",
              "name": "Maurine Farrell",
              "profile": {
                "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
              },
            },
            null,
          ],
        },
        "errors": [
          [GraphQLError: Abstract type "Named" must resolve to an Object type at runtime for field "Query.named". Either the "Named" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.],
        ],
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findFirstOrThrow",
          "args": {
            "where": {
              "id": 1,
            },
          },
          "model": "User",
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "profile": true,
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
  it('root union', async () => {
    const query = gql`
      query {
        namedUnion {
          __typename
          ... on User {
            id
            name
            profile {
              bio
            }
          }
          ... on NormalViewer {
            id
            reverseName
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
          "namedUnion": [
            {
              "__typename": "User",
              "id": "VXNlcjox",
              "name": "Maurine Farrell",
              "profile": {
                "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
              },
            },
          ],
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findFirstOrThrow",
          "args": {
            "where": {
              "id": 1,
            },
          },
          "model": "User",
        },
        {
          "action": "findUniqueOrThrow",
          "args": {
            "include": {
              "profile": true,
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

  it('root interface with query', async () => {
    const query = gql`
      query {
        namedWithQuery {
          ... on User {
            id
            name
            profile {
              bio
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
          "namedWithQuery": [
            {
              "id": "VXNlcjox",
              "name": "Maurine Farrell",
              "profile": {
                "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
              },
            },
            null,
          ],
        },
        "errors": [
          [GraphQLError: Abstract type "Named" must resolve to an Object type at runtime for field "Query.namedWithQuery". Either the "Named" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.],
        ],
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findFirstOrThrow",
          "args": {
            "include": {
              "profile": true,
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

  it('root union with query', async () => {
    const query = gql`
      query {
        namedUnionWithQuery {
          __typename
          ... on User {
            id
            name
            profile {
              bio
            }
          }
          ... on NormalViewer {
            id
            reverseName
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
          "namedUnionWithQuery": [
            {
              "__typename": "User",
              "id": "VXNlcjox",
              "name": "Maurine Farrell",
              "profile": {
                "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
              },
            },
          ],
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findFirstOrThrow",
          "args": {
            "include": {
              "profile": true,
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

  it('select interface', async () => {
    const query = gql`
      query {
        post(id: 1) {
          id
          named {
            ... on User {
              id
              name
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
      {
        "data": {
          "post": {
            "id": "1",
            "named": [
              {
                "id": "VXNlcjox",
                "name": "Maurine Farrell",
                "profile": {
                  "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
                },
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
              "author": {
                "include": {
                  "profile": true,
                },
              },
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
      ]
    `);
  });
  it('select union', async () => {
    const query = gql`
      query {
        post(id: 2) {
          namedUnion {
            __typename
            ... on User {
              id
              name
              profile {
                bio
              }
            }
            ... on NormalViewer {
              id
              reverseName
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
            "namedUnion": [
              {
                "__typename": "NormalViewer",
                "id": "1",
                "reverseName": "llerraF eniruaM",
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
              "author": {
                "select": {
                  "id": true,
                  "name": true,
                  "profile": true,
                },
              },
              "comments": {
                "include": {
                  "author": true,
                },
                "take": 3,
              },
            },
            "where": {
              "id": 2,
            },
          },
          "model": "Post",
        },
      ]
    `);
  });
});

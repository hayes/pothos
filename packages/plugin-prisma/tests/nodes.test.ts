import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('prisma', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('query for single node', async () => {
    const query = gql`
      query {
        node(id: "VXNlcjox") {
          __typename
          id
          ... on User {
            name
            email
            profile {
              id
              bio
              user {
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
          "node": {
            "__typename": "User",
            "email": "Maurine_Farrell@hotmail.com",
            "id": "VXNlcjox",
            "name": "Maurine Farrell",
            "profile": {
              "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
              "id": "1",
              "user": {
                "id": "VXNlcjox",
              },
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
              "profile": {
                "include": {
                  "user": true,
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

  it('query for nullable single node', async () => {
    const query = gql`
      query {
        node(id: "VXNlcjoxMDAw") {
          __typename
          id
          ... on User {
            name
            email
            profile {
              id
              bio
              user {
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
      contextValue: { user: { id: 1000 } },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "node": null,
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUnique",
          "args": {
            "include": {
              "profile": {
                "include": {
                  "user": true,
                },
              },
            },
            "where": {
              "id": 1000,
            },
          },
          "model": "User",
        },
      ]
    `);
  });

  it('query for multiple nodes', async () => {
    const query = gql`
      query {
        nodes(ids: ["VXNlcjox", "VXNlcjoy"]) {
          __typename
          id
          ... on User {
            name
            email
            profile {
              id
              bio
              user {
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
          "nodes": [
            {
              "__typename": "User",
              "email": "Maurine_Farrell@hotmail.com",
              "id": "VXNlcjox",
              "name": "Maurine Farrell",
              "profile": {
                "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
                "id": "1",
                "user": {
                  "id": "VXNlcjox",
                },
              },
            },
            {
              "__typename": "User",
              "email": "Oren_Windler70@gmail.com",
              "id": "VXNlcjoy",
              "name": "Oren Windler",
              "profile": null,
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
              "profile": {
                "include": {
                  "user": true,
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
          "action": "findUnique",
          "args": {
            "include": {
              "profile": {
                "include": {
                  "user": true,
                },
              },
            },
            "where": {
              "id": 2,
            },
          },
          "model": "User",
        },
      ]
    `);
  });

  it('query with multiple fragments', async () => {
    const query = gql`
      query {
        node(id: "VXNlcjox") {
          __typename
          id
          ... on User {
            posts {
              id
            }
          }
          ... on User {
            profile {
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
          "node": {
            "__typename": "User",
            "id": "VXNlcjox",
            "posts": [
              {
                "id": "250",
              },
              {
                "id": "249",
              },
              {
                "id": "248",
              },
              {
                "id": "247",
              },
              {
                "id": "246",
              },
              {
                "id": "245",
              },
              {
                "id": "244",
              },
              {
                "id": "243",
              },
              {
                "id": "242",
              },
              {
                "id": "241",
              },
            ],
            "profile": {
              "id": "1",
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
                "orderBy": {
                  "createdAt": "desc",
                },
                "take": 10,
                "where": undefined,
              },
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

  it('resolvers branded nodes in interfaces', async () => {
    const query = gql`
      query {
        named {
          name
          ... on User {
            id
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
      ]
    `);
  });

  it('resolves unions', async () => {
    const query = gql`
      query {
        userOrProfile {
          __typename
          ... on User {
            id
          }
          ... on Profile {
            id
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
          "userOrProfile": [
            {
              "__typename": "User",
              "id": "VXNlcjox",
            },
            {
              "__typename": "Profile",
              "id": "1",
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
            "where": {
              "id": 1,
            },
          },
          "model": "Profile",
        },
      ]
    `);
  });

  it('loads type includes', async () => {
    const query = gql`
      query {
        node(id: "Vmlld2VyTm9kZTox") {
          id
          ... on ViewerNode {
            bio
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
          "node": {
            "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
            "id": "Vmlld2VyTm9kZTox",
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

  it('decodes global ids in query callback', async () => {
    const query = gql`
      query {
        node(id: "VXNlcjox") {
          __typename
          id
          ... on User {
            id
            postNodes(id: "U2VsZWN0UG9zdDox") {
              id
              title
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
          "node": {
            "__typename": "User",
            "id": "VXNlcjox",
            "postNodes": [
              {
                "id": "U2VsZWN0UG9zdDox",
                "title": "Denique cruciamentum conicio suspendo decens adulatio cubicularis taceo.",
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
              "posts": {
                "select": {
                  "id": true,
                  "title": true,
                },
                "take": 3,
                "where": {
                  "id": 1,
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
});

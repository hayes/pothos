import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('variants', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('query with multiple variant fields and conflicting relations', async () => {
    const query = gql`
      query {
        viewerNode {
          __typename
          id
        }
        viewer {
          __typename
          posts {
            id
          }
          ... on NormalViewer {
            reverseName
          }
        }
        me {
          __typename
          profile {
            bio
          }
          viewer {
            __typename
            posts {
              id
            }
            ... on NormalViewer {
              reverseName
            }
            bio
            user {
              __typename
              posts {
                id
              }
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
          "me": {
            "__typename": "User",
            "profile": {
              "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
            },
            "viewer": {
              "__typename": "NormalViewer",
              "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
              "posts": [
                {
                  "id": "1",
                },
                {
                  "id": "2",
                },
                {
                  "id": "3",
                },
                {
                  "id": "4",
                },
                {
                  "id": "5",
                },
              ],
              "reverseName": "llerraF eniruaM",
              "user": {
                "__typename": "User",
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
                  "bio": "Talus bonus vesica vita harum currus deludo toties amet.",
                },
              },
            },
          },
          "viewer": {
            "__typename": "NormalViewer",
            "posts": [
              {
                "id": "1",
              },
              {
                "id": "2",
              },
              {
                "id": "3",
              },
              {
                "id": "4",
              },
              {
                "id": "5",
              },
            ],
            "reverseName": "llerraF eniruaM",
          },
          "viewerNode": {
            "__typename": "ViewerNode",
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
        {
          "action": "findUniqueOrThrow",
          "args": {
            "select": {
              "id": true,
              "name": true,
              "posts": {
                "include": {
                  "comments": {
                    "include": {
                      "author": true,
                    },
                    "take": 3,
                  },
                },
                "take": 5,
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
              "posts": {
                "include": {
                  "comments": {
                    "include": {
                      "author": true,
                    },
                    "take": 3,
                  },
                },
                "take": 5,
              },
              "profile": true,
            },
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
});

import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

describe('nested query', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('query with custom nested selections', async () => {
    const query = gql`
      query {
        viewer {
          postPreviews {
            preview
            post {
              createdAt
              content
            }
          }
        }
        me {
          postsConnection(first: 1) {
            edges {
              node {
                id
                comments {
                  postAuthor {
                    name
                  }
                }
                media {
                  url
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
      {
        "data": {
          "me": {
            "postsConnection": {
              "edges": [
                {
                  "node": {
                    "comments": [
                      {
                        "postAuthor": {
                          "name": "Maurine Farrell",
                        },
                      },
                      {
                        "postAuthor": {
                          "name": "Maurine Farrell",
                        },
                      },
                      {
                        "postAuthor": {
                          "name": "Maurine Farrell",
                        },
                      },
                    ],
                    "id": "250",
                    "media": [
                      {
                        "url": "https://apt-discourse.name/",
                      },
                      {
                        "url": "https://querulous-pigsty.org/",
                      },
                    ],
                  },
                },
              ],
            },
          },
          "viewer": {
            "postPreviews": [
              {
                "post": {
                  "content": "Atque exercitationem exercitationem reiciendis. Surculus perferendis suppono commodi conturbo calco claudeo quos aliquam. Curvo depulso cursim color cursim varietas.",
                  "createdAt": "2012-12-12T00:00:00.000Z",
                },
                "preview": "citationem exercitationem reiciendis. Surculus perferendis suppono commodi conturbo calco claudeo quos aliquam. Curvo depulso cursim color cursim varietas.",
              },
              {
                "post": {
                  "content": "Conicio cognomen cur stabilis utique dolore sortitus. Quibusdam spero turbo agnosco tenax careo autem. Allatus vae quis supra acceptus paens iusto.",
                  "createdAt": "2012-12-12T00:00:00.001Z",
                },
                "preview": "gnomen cur stabilis utique dolore sortitus. Quibusdam spero turbo agnosco tenax careo autem. Allatus vae quis supra acceptus paens iusto.",
              },
            ],
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findUniqueOrThrow",
          "args": {
            "select": {
              "id": true,
              "posts": {
                "select": {
                  "content": true,
                  "createdAt": true,
                  "id": true,
                },
                "take": 2,
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
                      "author": {
                        "include": {
                          "profile": true,
                        },
                      },
                      "post": {
                        "select": {
                          "author": true,
                        },
                      },
                    },
                    "take": 3,
                  },
                  "media": {
                    "select": {
                      "media": {
                        "select": {
                          "id": true,
                          "posts": true,
                          "url": true,
                        },
                      },
                      "order": true,
                    },
                  },
                },
                "orderBy": {
                  "createdAt": "desc",
                },
                "skip": 0,
                "take": 2,
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

  it('queryFromInfo with nested path', async () => {
    const query = gql`
      query {
        blog {
          posts {
            id
            author {
              name
            }
          }
          pages
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
          "blog": {
            "pages": [
              1,
              2,
              3,
            ],
            "posts": [
              {
                "author": {
                  "name": "Maurine Farrell",
                },
                "id": "1",
              },
              {
                "author": {
                  "name": "Maurine Farrell",
                },
                "id": "2",
              },
              {
                "author": {
                  "name": "Maurine Farrell",
                },
                "id": "3",
              },
            ],
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "findMany",
          "args": {
            "include": {
              "author": true,
              "comments": {
                "include": {
                  "author": true,
                },
                "take": 3,
              },
            },
            "take": 3,
          },
          "model": "Post",
        },
      ]
    `);
  });
});

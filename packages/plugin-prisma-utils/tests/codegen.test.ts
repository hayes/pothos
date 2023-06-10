import { execute, printSchema } from 'graphql';
import gql from 'graphql-tag';
import { prisma } from './examples/codegen/builder';
import schema from './examples/codegen/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('codegen', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: 'test@example.com',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await prisma.user.deleteMany({
      where: {
        email: 'test@example.com',
      },
    });
  });

  afterEach(() => {
    queries = [];
  });

  it('generates schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });

  it('mutates users and relations', async () => {
    const createUser = await execute({
      schema,
      contextValue: {},
      document: gql`
        mutation createUser {
          createUser(
            data: { email: "test@example.com", profile: { create: { bio: "test bio" } } }
          ) {
            name
            profile {
              bio
            }
          }
        }
      `,
    });

    expect(createUser).toMatchInlineSnapshot(`
      {
        "data": {
          "createUser": {
            "name": null,
            "profile": {
              "bio": "test bio",
            },
          },
        },
      }
    `);

    const updateUser = await execute({
      schema,
      contextValue: {},
      document: gql`
        mutation updateUser {
          updateUser(
            where: { email: "test@example.com" }
            data: {
              name: "test name"
              profile: { update: { bio: "updated bio" } }
              posts: {
                create: {
                  title: "test title"
                  tags: ["tag1", "tag2"]
                  content: "test content"
                  categories: [SPORTS, SCIENCE]
                }
              }
            }
          ) {
            name
            email
            profile {
              bio
            }
            posts {
              title
              content
              tags
              categories
            }
          }
        }
      `,
    });

    expect(updateUser).toMatchInlineSnapshot(`
      {
        "data": {
          "updateUser": {
            "email": "test@example.com",
            "name": "test name",
            "posts": [
              {
                "categories": [
                  "SPORTS",
                  "SCIENCE",
                ],
                "content": "test content",
                "tags": [
                  "tag1",
                  "tag2",
                ],
                "title": "test title",
              },
            ],
            "profile": {
              "bio": "updated bio",
            },
          },
        },
      }
    `);

    const updatePost = await execute({
      schema,
      contextValue: {},
      document: gql`
        mutation updatePost {
          updateUser(
            where: { email: "test@example.com" }
            data: {
              posts: {
                updateMany: {
                  where: { title: { equals: "test title" } }
                  data: { tags: ["test1", "test2"], categories: [TECH, SCIENCE], content: null }
                }
              }
            }
          ) {
            posts {
              title
              content
              categories
              tags
            }
          }
        }
      `,
    });

    expect(updatePost).toMatchInlineSnapshot(`
      {
        "data": {
          "updateUser": {
            "posts": [
              {
                "categories": [
                  "TECH",
                  "SCIENCE",
                ],
                "content": null,
                "tags": [
                  "test1",
                  "test2",
                ],
                "title": "test title",
              },
            ],
          },
        },
      }
    `);

    const deletePost = await execute({
      schema,
      contextValue: {},
      document: gql`
        mutation deletePost {
          updateUser(
            where: { email: "test@example.com" }
            data: { posts: { deleteMany: { title: { equals: "test title" } } } }
          ) {
            posts {
              title
            }
          }
        }
      `,
    });

    expect(deletePost).toMatchInlineSnapshot(`
      {
        "data": {
          "updateUser": {
            "posts": [],
          },
        },
      }
    `);

    const deleteUser = await execute({
      schema,
      contextValue: {},
      document: gql`
        mutation deleteUser {
          deleteUser(where: { email: "test@example.com" }) {
            email
          }
        }
      `,
    });

    expect(deleteUser).toMatchInlineSnapshot(`
      {
        "data": {
          "deleteUser": {
            "email": "test@example.com",
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      [
        {
          "action": "create",
          "args": {
            "data": {
              "email": "test@example.com",
              "profile": {
                "create": {
                  "bio": "test bio",
                },
              },
            },
            "include": {
              "profile": true,
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "update",
          "args": {
            "data": {
              "name": "test name",
              "posts": {
                "create": [
                  {
                    "categories": [
                      "SPORTS",
                      "SCIENCE",
                    ],
                    "content": "test content",
                    "tags": [
                      "tag1",
                      "tag2",
                    ],
                    "title": "test title",
                  },
                ],
              },
              "profile": {
                "update": {
                  "bio": "updated bio",
                },
              },
            },
            "include": {
              "posts": {
                "orderBy": {
                  "id": "asc",
                },
                "where": {},
              },
              "profile": true,
            },
            "where": {
              "email": "test@example.com",
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "update",
          "args": {
            "data": {
              "posts": {
                "updateMany": [
                  {
                    "data": {
                      "categories": [
                        "TECH",
                        "SCIENCE",
                      ],
                      "content": null,
                      "tags": [
                        "test1",
                        "test2",
                      ],
                    },
                    "where": {
                      "title": {
                        "equals": "test title",
                      },
                    },
                  },
                ],
              },
            },
            "include": {
              "posts": {
                "orderBy": {
                  "id": "asc",
                },
                "where": {},
              },
            },
            "where": {
              "email": "test@example.com",
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "update",
          "args": {
            "data": {
              "posts": {
                "deleteMany": [
                  {
                    "title": {
                      "equals": "test title",
                    },
                  },
                ],
              },
            },
            "include": {
              "posts": {
                "orderBy": {
                  "id": "asc",
                },
                "where": {},
              },
            },
            "where": {
              "email": "test@example.com",
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
        {
          "action": "delete",
          "args": {
            "where": {
              "email": "test@example.com",
            },
          },
          "dataPath": [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });
});

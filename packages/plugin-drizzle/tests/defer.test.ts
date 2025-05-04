import { execute } from 'graphql';
import gql from 'graphql-tag';
import { type BaseContext, createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

let context: BaseContext;

describe('defer', () => {
  beforeEach(async () => {
    context = await createContext({ userId: '1' });
    clearDrizzleLogs();
  });
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('resolves relatedConnection totalCount when connection is deferred', async () => {
    const query = gql`
        query {
          user(id: "VXNlcjox") {
            postsConnection(first: 2) {
              ... @defer {
                edges {
                  node {
                    # Connection edges are loaded, but author is deferred, because the initial query happens outside of the fragment
                    author {
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                  },
                },
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                  },
                },
              ],
            },
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id")) as "r" from (select "d1"."id" as "id" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."id" in (?, ?) -- params: [1, 1, 15, 13]",
      ]
    `);
  });

  it('resolves relatedConnection inside a deferred fragment', async () => {
    const query = gql`
        query {
          user(id: "VXNlcjox") {
            postsConnection(first: 2) {
              ... @defer {
                edges {
                  node {
                    # Connection edges are loaded, but author is deferred, because the initial query happens outside of the fragment
                    author {
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                  },
                },
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                  },
                },
              ],
            },
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id")) as "r" from (select "d1"."id" as "id" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."id" in (?, ?) -- params: [1, 1, 15, 13]",
      ]
    `);
  });

  it('resolves prismaConnection totalCount when connection is deferred', async () => {
    const query = gql`
        {
          posts(first: 2) {
            totalCount
            ... @defer {
              edges {
                node {
                  id
                  author {
                    id
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "node": {
                  "author": {
                    "id": "VXNlcjoxMA==",
                  },
                  "id": "150",
                },
              },
              {
                "node": {
                  "author": {
                    "id": "VXNlcjoxMA==",
                  },
                  "id": "149",
                },
              },
            ],
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where "d0"."published" = ? order by "d0"."id" desc limit ? -- params: [1, 3]",
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."id" in (?, ?) -- params: [1, 1, 150, 149]",
      ]
    `);
  });

  it('resolves prismaConnection inside a deferred fragment', async () => {
    const query = gql`
        {
          posts(first: 2) {
            ... @defer {
              edges {
                node {
                  id
                  author {
                    id
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "node": {
                  "author": {
                    "id": "VXNlcjoxMA==",
                  },
                  "id": "150",
                },
              },
              {
                "node": {
                  "author": {
                    "id": "VXNlcjoxMA==",
                  },
                  "id": "149",
                },
              },
            ],
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where "d0"."published" = ? order by "d0"."id" desc limit ? -- params: [1, 3]",
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."id" in (?, ?) -- params: [1, 1, 150, 149]",
      ]
    `);
  });

  it('defer on prismaConnection edge', async () => {
    const query = gql`
        {
          posts(first: 2) {
            edges {
              ... @defer {
                node {
                  id
                  author {
                    id
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "node": {
                  "author": {
                    "id": "VXNlcjoxMA==",
                  },
                  "id": "150",
                },
              },
              {
                "node": {
                  "author": {
                    "id": "VXNlcjoxMA==",
                  },
                  "id": "149",
                },
              },
            ],
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where "d0"."published" = ? order by "d0"."id" desc limit ? -- params: [1, 3]",
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."id" in (?, ?) -- params: [1, 1, 150, 149]",
      ]
    `);
  });

  it('defer on prismaConnection node', async () => {
    const query = gql`
        {
          posts(first: 2) {
            edges {
              node {
                id
                ... @defer {
                  author {
                    id
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "node": {
                  "author": {
                    "id": "VXNlcjoxMA==",
                  },
                  "id": "150",
                },
              },
              {
                "node": {
                  "author": {
                    "id": "VXNlcjoxMA==",
                  },
                  "id": "149",
                },
              },
            ],
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where "d0"."published" = ? order by "d0"."id" desc limit ? -- params: [1, 3]",
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."id" in (?, ?) -- params: [1, 1, 150, 149]",
      ]
    `);
  });

  it('defer on relatedConnection edge', async () => {
    const query = gql`
        {
          user(id: "VXNlcjox") {
            postsConnection(first: 2) {
              edges {
                ... @defer(if: true) {
                  node {
                    author {
                      id
                      firstName
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "node": {
                    "author": {
                      "firstName": "Mason",
                      "id": "VXNlcjox",
                    },
                  },
                },
                {
                  "node": {
                    "author": {
                      "firstName": "Mason",
                      "id": "VXNlcjox",
                    },
                  },
                },
              ],
            },
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id")) as "r" from (select "d1"."id" as "id" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."id" in (?, ?) -- params: [1, 1, 15, 13]",
      ]
    `);
  });

  it('defer on relatedConnection node', async () => {
    const query = gql`
        {
          user(id: "VXNlcjox") {
            postsConnection(first: 2) {
              edges {
                node {
                  ... @defer(if: true) {
                    author {
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                  },
                },
                {
                  "node": {
                    "author": {
                      "id": "VXNlcjox",
                    },
                  },
                },
              ],
            },
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id")) as "r" from (select "d1"."id" as "id" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."id" in (?, ?) -- params: [1, 1, 15, 13]",
      ]
    `);
  });

  it('defer relation', async () => {
    const query = gql`
        {
          posts(first: 2) {
            edges {
              node {
                id
                ... @defer {
                    posts(limit: 1) {
                        id
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "node": {
                  "id": "150",
                },
              },
              {
                "node": {
                  "id": "149",
                },
              },
            ],
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where "d0"."published" = ? order by "d0"."id" desc limit ? -- params: [1, 3]",
      ]
    `);
  });

  it('defer field includes', async () => {
    const query = gql`
        {
          post(id: 1) {
            ... @defer {
              comments {
                id
                author {
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "post": {
            "comments": [
              {
                "author": {
                  "bio": "Aestus confugo denique abeo deleo. Celo triduana villa atavus ventosus creta. Theca alter exercitationem beatae damno cernuus.",
                },
                "id": "1",
              },
            ],
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where "d0"."id" = ? order by "d0"."id" desc limit ? -- params: [1, 1]",
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('id', "id", 'text', "text", 'authorId', "authorId", 'postId', "postId", 'createdAt', "createdAt", 'updatedAt', "updatedAt", 'author', jsonb("author"))) as "r" from (select "d1"."id" as "id", "d1"."text" as "text", "d1"."author_id" as "authorId", "d1"."post_id" as "postId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt", (select jsonb_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d2"."first_name" as "firstName", "d2"."last_name" as "lastName", "d2"."id" as "id", (lower("d2"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d3"."id" as "id", "d3"."user_id" as "userId", "d3"."bio" as "bio" from "profile" as "d3" where "d2"."id" = "d3"."user_id" limit ?) as "t") as "profile" from "users" as "d2" where "d1"."author_id" = "d2"."id" limit ?) as "t") as "author" from "comments" as "d1" where "d0"."id" = "d1"."id") as "t"), jsonb_array()) as "comments" from "posts" as "d0" where "d0"."id" in (?) -- params: [1, 1, 1]",
      ]
    `);
  });

  it('defer type includes', async () => {
    const query = gql`
        {
          post(id: 1) {
            comments {
              id
              author {
                ... @defer {
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
      contextValue: context,
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "post": {
            "comments": [
              {
                "author": {
                  "bio": "Aestus confugo denique abeo deleo. Celo triduana villa atavus ventosus creta. Theca alter exercitationem beatae damno cernuus.",
                },
                "id": "1",
              },
            ],
          },
        },
      }
    `);
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('id', "id", 'text', "text", 'authorId', "authorId", 'postId', "postId", 'createdAt', "createdAt", 'updatedAt', "updatedAt", 'author', jsonb("author"))) as "r" from (select "d1"."id" as "id", "d1"."text" as "text", "d1"."author_id" as "authorId", "d1"."post_id" as "postId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt", (select jsonb_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d2"."first_name" as "firstName", "d2"."last_name" as "lastName", "d2"."id" as "id", (lower("d2"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d3"."id" as "id", "d3"."user_id" as "userId", "d3"."bio" as "bio" from "profile" as "d3" where "d2"."id" = "d3"."user_id" limit ?) as "t") as "profile" from "users" as "d2" where "d1"."author_id" = "d2"."id" limit ?) as "t") as "author" from "comments" as "d1" where "d0"."id" = "d1"."id") as "t"), jsonb_array()) as "comments" from "posts" as "d0" where "d0"."id" = ? order by "d0"."id" desc limit ? -- params: [1, 1, 1, 1]",
      ]
    `);
  });
});

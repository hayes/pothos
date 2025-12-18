import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('related connections', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('first', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(first: 2) {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6TjoxNQ==",
                  "node": {
                    "id": "15",
                  },
                },
                {
                  "cursor": "REM6TjoxMw==",
                  "node": {
                    "id": "13",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6TjoxMw==",
                "hasNextPage": true,
                "hasPreviousPage": false,
                "startCursor": "REM6TjoxNQ==",
              },
            },
          },
        },
      }
    `);
  });

  it('last', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(last: 2) {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjo0",
                  "node": {
                    "id": "4",
                  },
                },
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjoy",
                "hasNextPage": false,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjo0",
              },
            },
          },
        },
      }
    `);
  });

  it('first and after', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(first: 2, after: "REM6TjoxNQ==") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" < ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 15, 3, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6TjoxMw==",
                  "node": {
                    "id": "13",
                  },
                },
                {
                  "cursor": "REM6TjoxMg==",
                  "node": {
                    "id": "12",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6TjoxMg==",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6TjoxMw==",
              },
            },
          },
        },
      }
    `);
  });

  it('last and before', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(last: 2, before: "REM6Tjoy") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 2, 3, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjo2",
                  "node": {
                    "id": "6",
                  },
                },
                {
                  "cursor": "REM6Tjo0",
                  "node": {
                    "id": "4",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjo0",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjo2",
              },
            },
          },
        },
      }
    `);
  });

  it('first, after and before', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(first: 1, after: "REM6TjoxNQ==", before: "REM6TjoxMA==") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" < ? and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 15, 10, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6TjoxMw==",
                  "node": {
                    "id": "13",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6TjoxMw==",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6TjoxMw==",
              },
            },
          },
        },
      }
    `);
  });

  it('last, before and after', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(last: 1, before: "REM6Tjoy", after: "REM6Tjo3") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" < ? and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 7, 2, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjo0",
                  "node": {
                    "id": "4",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjo0",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjo0",
              },
            },
          },
        },
      }
    `);
  });

  it('first, after and before - truncated', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(first: 3, after: "REM6TjoxNQ==", before: "REM6TjoxMA==") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" < ? and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 15, 10, 4, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6TjoxMw==",
                  "node": {
                    "id": "13",
                  },
                },
                {
                  "cursor": "REM6TjoxMg==",
                  "node": {
                    "id": "12",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6TjoxMg==",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6TjoxMw==",
              },
            },
          },
        },
      }
    `);
  });

  it('last, before and after - truncated', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(last: 3, before: "REM6Tjoy", after: "REM6Tjo3") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" < ? and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 7, 2, 4, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjo2",
                  "node": {
                    "id": "6",
                  },
                },
                {
                  "cursor": "REM6Tjo0",
                  "node": {
                    "id": "4",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjo0",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjo2",
              },
            },
          },
        },
      }
    `);
  });

  it('first and before', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(first: 1, before: "REM6TjoxMg==") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 12, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6TjoxNQ==",
                  "node": {
                    "id": "15",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6TjoxNQ==",
                "hasNextPage": true,
                "hasPreviousPage": false,
                "startCursor": "REM6TjoxNQ==",
              },
            },
          },
        },
      }
    `);
  });

  it('last and after', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(last: 1, after: "REM6Tjo2") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" < ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 6, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjoy",
                "hasNextPage": false,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjoy",
              },
            },
          },
        },
      }
    `);
  });

  it('first and before - truncated', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(first: 3, before: "REM6TjoxMg==") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 12, 4, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6TjoxNQ==",
                  "node": {
                    "id": "15",
                  },
                },
                {
                  "cursor": "REM6TjoxMw==",
                  "node": {
                    "id": "13",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6TjoxMw==",
                "hasNextPage": true,
                "hasPreviousPage": false,
                "startCursor": "REM6TjoxNQ==",
              },
            },
          },
        },
      }
    `);
  });

  it('last and after - truncated', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(last: 3, after: "REM6Tjo2") {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" < ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 6, 4, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjo0",
                  "node": {
                    "id": "4",
                  },
                },
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjoy",
                "hasNextPage": false,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjo0",
              },
            },
          },
        },
      }
    `);
  });

  it('modified query and order', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(
                  first: 3
                  category: "entertainment"
                  invert: true
                  after: "REM6Tjoy"
                ) {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
                  }
                  edges {
                    cursor
                    node {
                      id
                      category
                    }
                  }
                }
              }
            }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId", 'category', jsonb("category"))) as "r" from (select "d1"."id" as "postId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "categories" as "d2" where "d1"."category_id" = "d2"."id" limit ?) as "t") as "category" from "posts" as "d1" where ((("d1"."published" = ? and exists (select * from "categories" as "f0" where ("d1"."category_id" = "f0"."id" and "f0"."name" = ?) limit 1)) and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, "entertainment", 2, 4, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjo2",
                  "node": {
                    "category": "entertainment",
                    "id": "6",
                  },
                },
                {
                  "cursor": "REM6TjoxMg==",
                  "node": {
                    "category": "entertainment",
                    "id": "12",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6TjoxMg==",
                "hasNextPage": false,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjo2",
              },
            },
          },
        },
      }
    `);
  });

  it('multiple orderBy', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                postsConnection(
                  first: 3,
                  sortByCategory: true,
                  after: "REM6SjpbMSwxM10="
                ) {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
                  }
                  edges {
                    cursor
                    node {
                      id
                      category
                    }
                  }
                }
              }
            }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('categoryId', "categoryId", 'postId', "postId", 'category', jsonb("category"))) as "r" from (select "d1"."category_id" as "categoryId", "d1"."id" as "postId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "categories" as "d2" where "d1"."category_id" = "d2"."id" limit ?) as "t") as "category" from "posts" as "d1" where (("d1"."published" = ? and ("d1"."category_id" > ? or ("d1"."category_id" = ? and "d1"."id" > ?))) and "d0"."id" = "d1"."author_id") order by "d1"."category_id" asc, "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 1, 1, 13, 4, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnection": {
              "edges": [
                {
                  "cursor": "REM6SjpbMSwxNV0=",
                  "node": {
                    "category": "news",
                    "id": "15",
                  },
                },
                {
                  "cursor": "REM6SjpbMiwxMF0=",
                  "node": {
                    "category": "sports",
                    "id": "10",
                  },
                },
                {
                  "cursor": "REM6SjpbMyw3XQ==",
                  "node": {
                    "category": "politics",
                    "id": "7",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6SjpbMyw3XQ==",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6SjpbMSwxNV0=",
              },
            },
          },
        },
      }
    `);
  });

  it('default orderBy', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                unOrderedPostsConnection(
                  first: 3,
                ) {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
                  }
                  edges {
                    cursor
                    node {
                      id
                      category
                    }
                  }
                }
              }
            }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId", 'category', jsonb("category"))) as "r" from (select "d1"."id" as "postId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "categories" as "d2" where "d1"."category_id" = "d2"."id" limit ?) as "t") as "category" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 4, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "unOrderedPostsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "category": "entertainment",
                    "id": "2",
                  },
                },
                {
                  "cursor": "REM6Tjo0",
                  "node": {
                    "category": "news",
                    "id": "4",
                  },
                },
                {
                  "cursor": "REM6Tjo2",
                  "node": {
                    "category": "entertainment",
                    "id": "6",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjo2",
                "hasNextPage": true,
                "hasPreviousPage": false,
                "startCursor": "REM6Tjoy",
              },
            },
          },
        },
      }
    `);
  });

  it('default orderBy after', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                unOrderedPostsConnection(
                  first: 3,
                  after: "REM6Tjoy"
                ) {
                  pageInfo {
                    startCursor
                    endCursor
                    hasPreviousPage
                    hasNextPage
                  }
                  edges {
                    cursor
                    node {
                      id
                      category
                    }
                  }
                }
              }
            }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId", 'category', jsonb("category"))) as "r" from (select "d1"."id" as "postId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "categories" as "d2" where "d1"."category_id" = "d2"."id" limit ?) as "t") as "category" from "posts" as "d1" where (("d1"."published" = ? and "d1"."id" > ?) and "d0"."id" = "d1"."author_id") order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 2, 4, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "unOrderedPostsConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjo0",
                  "node": {
                    "category": "news",
                    "id": "4",
                  },
                },
                {
                  "cursor": "REM6Tjo2",
                  "node": {
                    "category": "entertainment",
                    "id": "6",
                  },
                },
                {
                  "cursor": "REM6Tjo3",
                  "node": {
                    "category": "politics",
                    "id": "7",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjo3",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjo0",
              },
            },
          },
        },
      }
    `);
  });

  it('custom totalCount field', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
            me {
              id
              comments(first: 1) {
                total
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('id', "id", 'text', "text", 'authorId', "authorId", 'postId', "postId", 'createdAt', "createdAt", 'updatedAt', "updatedAt")) as "r" from (select "d1"."id" as "id", "d1"."text" as "text", "d1"."author_id" as "authorId", "d1"."post_id" as "postId", "d1"."createdAt" as "createdAt", "d1"."createdAt" as "updatedAt" from "comments" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "comments" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [2, 1, 1]",
        "Query: select count(*) from "comments" where "comments"."author_id" = ? -- params: [1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "comments": {
              "edges": [
                {
                  "node": {
                    "id": "891",
                  },
                },
              ],
              "total": 13,
            },
            "id": "1",
          },
        },
      }
    `);
  });

  it('totalCount option on relatedConnection', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
        query {
          user(id: "VXNlcjox") {
            postsConnectionWithCount(first: 2) {
              totalCount
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: context,
    });

    // The count should be included in the same query via extras (single query with count(*))
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", ((select count(*) from "posts" where "posts"."author_id" = "d0"."id")) as "_posts_count", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnectionWithCount": {
              "edges": [
                {
                  "node": {
                    "id": "15",
                  },
                },
                {
                  "node": {
                    "id": "13",
                  },
                },
              ],
              "totalCount": 15,
            },
          },
        },
      }
    `);
  });

  it('totalCount option should not include count query when totalCount field is not requested', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
        query {
          user(id: "VXNlcjox") {
            postsConnectionWithCount(first: 2) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: context,
    });

    // The count should NOT be included when totalCount field is not requested (no count(*) in query)
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnectionWithCount": {
              "edges": [
                {
                  "node": {
                    "id": "15",
                  },
                },
                {
                  "node": {
                    "id": "13",
                  },
                },
              ],
            },
          },
        },
      }
    `);
  });

  it('totalCount only - should skip fetching relation data when only totalCount is requested', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
        query {
          user(id: "VXNlcjox") {
            postsConnectionWithCount(first: 2) {
              totalCount
            }
          }
        }
      `,
      contextValue: context,
    });

    // When only totalCount is requested, the relation data should NOT be fetched (no json_group_array for posts)
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", ((select count(*) from "posts" where "posts"."author_id" = "d0"."id")) as "_posts_count", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "postsConnectionWithCount": {
              "totalCount": 15,
            },
          },
        },
      }
    `);
  });

  it('totalCount only with field selecting same relation without cursor (issue #1580)', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
        query {
          user(id: "VXNlcjox") {
            postTitles
            postsConnectionWithCount(first: 2) {
              totalCount
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchInlineSnapshot(`
      {
        "user": {
          "postTitles": [
            "Thalassinus ustilo hic civitas.",
            "Altus suspendo textor ars teneo.",
            "Terga depulso curia tenus.",
          ],
          "postsConnectionWithCount": {
            "totalCount": 15,
          },
        },
      }
    `);
  });
});

import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('dataloaders for incompatible queries', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('simple query with different selections', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
                user(id: "VXNlcjox") {
                    posts(limit: 1) {
                    id
                    }
                    posts2: posts(limit: 1, offset: 1) {
                    id
                    author {
                        id
                    }
                    }
                }
                }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id")) as "r" from (select "d1"."id" as "id" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 0, 1, 1]",
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('id', "id", 'author', jsonb("author"))) as "r" from (select "d1"."id" as "id", (select jsonb_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d2"."first_name" as "firstName", "d2"."last_name" as "lastName", "d2"."id" as "id", (lower("d2"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d3"."id" as "id", "d3"."user_id" as "userId", "d3"."bio" as "bio" from "profile" as "d3" where "d2"."id" = "d3"."user_id" limit ?) as "t") as "profile" from "users" as "d2" where "d1"."author_id" = "d2"."id" limit ?) as "t") as "author" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [1, 1, 1, 1, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "posts": [
              {
                "id": "2",
              },
            ],
            "posts2": [
              {
                "author": {
                  "id": "VXNlcjox",
                },
                "id": "4",
              },
            ],
          },
        },
      }
    `);
  });

  it('batches when nested in lists', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
                posts(first: 3) {
                    edges {
                    node {
                        author {
                        posts (limit: 1, offset: 0) {
                            id
                        }
                        posts2: posts(limit: 1, offset: 1) {
                            id
                            comments {
                            id
                            }
                        }
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
        "Query: select "d0"."id" as "id", (select json_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile"), 'posts', jsonb("posts")) as "r" from (select "d1"."first_name" as "firstName", "d1"."last_name" as "lastName", "d1"."id" as "id", (lower("d1"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d2"."id" as "id", "d2"."user_id" as "userId", "d2"."bio" as "bio" from "profile" as "d2" where "d1"."id" = "d2"."user_id" limit ?) as "t") as "profile", coalesce((select jsonb_group_array(json_object('id', "id")) as "r" from (select "d2"."id" as "id" from "posts" as "d2" where ("d2"."published" = ? and "d1"."id" = "d2"."author_id") order by "d2"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."published" = ? order by "d0"."id" desc limit ? -- params: [1, 1, 1, 0, 1, 1, 4]",
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('id', "id", 'comments', jsonb("comments"))) as "r" from (select "d1"."id" as "id", coalesce((select jsonb_group_array(json_object('id', "id")) as "r" from (select "d2"."id" as "id" from "comments" as "d2" where "d1"."id" = "d2"."id") as "t"), jsonb_array()) as "comments" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?, ?, ?) -- params: [1, 1, 1, 10, 10, 10]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "node": {
                  "author": {
                    "posts": [
                      {
                        "id": "136",
                      },
                    ],
                    "posts2": [
                      {
                        "comments": [
                          {
                            "id": "137",
                          },
                        ],
                        "id": "137",
                      },
                    ],
                  },
                },
              },
              {
                "node": {
                  "author": {
                    "posts": [
                      {
                        "id": "136",
                      },
                    ],
                    "posts2": [
                      {
                        "comments": [
                          {
                            "id": "137",
                          },
                        ],
                        "id": "137",
                      },
                    ],
                  },
                },
              },
              {
                "node": {
                  "author": {
                    "posts": [
                      {
                        "id": "136",
                      },
                    ],
                    "posts2": [
                      {
                        "comments": [
                          {
                            "id": "137",
                          },
                        ],
                        "id": "137",
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      }
    `);
  });
});

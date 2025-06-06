import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('drizzle fields', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('simple query using with, columns, extras on type', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
          {
            user(id: "VXNlcjox") {
              id
              firstName
            }
          }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "firstName": "Mason",
            "id": "VXNlcjox",
          },
        },
      }
    `);
  });

  it('simple query using with, columns, extras on type', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
          {
            me {
              id
            }
          }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "id": "1",
          },
        },
      }
    `);
  });

  it('select nested relations', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
          {
            me {
              id
              roles
              user {
                id
              }
            }
            user(id: "VXNlcjox") {
              posts(limit: 1) {
                author {
                  id
                  posts(limit: 1) {
                    id
                    comments {
                      author {
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
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId", 'author', jsonb("author"))) as "r" from (select "d1"."id" as "postId", (select jsonb_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile"), 'posts', jsonb("posts")) as "r" from (select "d2"."first_name" as "firstName", "d2"."last_name" as "lastName", "d2"."id" as "id", (lower("d2"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d3"."id" as "id", "d3"."user_id" as "userId", "d3"."bio" as "bio" from "profile" as "d3" where "d2"."id" = "d3"."user_id" limit ?) as "t") as "profile", coalesce((select jsonb_group_array(json_object('postId', "postId", 'comments', jsonb("comments"))) as "r" from (select "d3"."id" as "postId", coalesce((select jsonb_group_array(json_object('id', "id", 'text', "text", 'authorId', "authorId", 'postId', "postId", 'createdAt', "createdAt", 'updatedAt', "updatedAt", 'author', jsonb("author"))) as "r" from (select "d4"."id" as "id", "d4"."text" as "text", "d4"."author_id" as "authorId", "d4"."post_id" as "postId", "d4"."createdAt" as "createdAt", "d4"."createdAt" as "updatedAt", (select jsonb_object('firstName', "firstName", 'lastName', "lastName", 'id', "id", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile")) as "r" from (select "d5"."first_name" as "firstName", "d5"."last_name" as "lastName", "d5"."id" as "id", (lower("d5"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d6"."id" as "id", "d6"."user_id" as "userId", "d6"."bio" as "bio" from "profile" as "d6" where "d5"."id" = "d6"."user_id" limit ?) as "t") as "profile" from "users" as "d5" where "d4"."author_id" = "d5"."id" limit ?) as "t") as "author" from "comments" as "d4" where "d3"."id" = "d4"."post_id") as "t"), jsonb_array()) as "comments" from "posts" as "d3" where ("d3"."published" = ? and "d2"."id" = "d3"."author_id") order by "d3"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d2" where "d1"."author_id" = "d2"."id" limit ?) as "t") as "author" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1]",
        "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", (lower("d0"."first_name")) as "lowercaseFirstName", coalesce((select json_group_array(json_object('id', "id", 'name', "name")) as "r" from (select "d1"."id" as "id", "d1"."name" as "name" from "roles" as "d1" inner join "user_roles" as "tr0" on "tr0"."role_id" = "d1"."id" where "d0"."id" = "tr0"."user_id") as "t"), jsonb_array()) as "roles", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "id": "1",
            "roles": [
              "admin",
              "author",
              "user",
            ],
            "user": {
              "id": "VXNlcjox",
            },
          },
          "user": {
            "posts": [
              {
                "author": {
                  "id": "VXNlcjox",
                  "posts": [
                    {
                      "comments": [
                        {
                          "author": {
                            "id": "VXNlcjoyMA==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjo0Ng==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjozMg==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjoxNA==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjo0Ng==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjo0Mg==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjo1",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjozNw==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjoyNw==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjo2NQ==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjo1Nw==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjo4Ng==",
                          },
                        },
                        {
                          "author": {
                            "id": "VXNlcjo5Ng==",
                          },
                        },
                      ],
                      "id": "2",
                    },
                  ],
                },
              },
            ],
          },
        },
      }
    `);
  });

  it('extra on nested field', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
          {
            me {
              id
              user {
                email
              }
            }
          }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", (lower("d0"."first_name")) as "lowercaseFirstName", (lower("d0"."last_name")) as "lowercaseLastName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "id": "1",
            "user": {
              "email": "mason.reichel@example.com",
            },
          },
        },
      }
    `);
  });

  it('simple query using with, columns, extras on type', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
          {
            user(id: "VXNlcjox") {
              email
            }
          }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (lower("d0"."last_name")) as "lowercaseLastName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "email": "mason.reichel@example.com",
          },
        },
      }
    `);
  });
});

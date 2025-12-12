import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('relatedField', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('relatedField with count aggregation', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();

    const result = await execute({
      schema,
      document: gql`
        {
          user(id: "VXNlcjox") {
            firstName
            postsCount
          }
        }
      `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", ((select count(*) from "posts" where "posts"."author_id" = "d0"."id")) as "postsCount", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "firstName": "Mason",
            "postsCount": 15,
          },
        },
      }
    `);
  });

  it('relatedField with posts and postsCount in same query', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();

    const result = await execute({
      schema,
      document: gql`
        {
          user(id: "VXNlcjox") {
            firstName
            postsCount
            posts(limit: 3) {
              id
            }
          }
        }
      `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", ((select count(*) from "posts" where "posts"."author_id" = "d0"."id")) as "postsCount", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 0, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "firstName": "Mason",
            "posts": [
              {
                "id": "2",
              },
              {
                "id": "4",
              },
              {
                "id": "6",
              },
            ],
            "postsCount": 15,
          },
        },
      }
    `);
  });
});

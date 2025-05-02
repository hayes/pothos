import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('related fields', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('skips fields based on @skip and @include', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const query = gql`
        query {
            user(id: "VXNlcjox") {
            id
            email @skip(if: true)
            posts(limit: 1) @include(if: false) {
              id
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
            "id": "VXNlcjox",
          },
        },
      }
    `);

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);
  });

  it('includes fields based on @skip and @include', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const query = gql`
        query {
        user(id: "VXNlcjox") {
            id
            email @skip(if: false)
            posts(limit: 1) @include(if: true) {
              id
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
            "email": "mason.reichel@example.com",
            "id": "VXNlcjox",
            "posts": [
              {
                "id": "2",
              },
            ],
          },
        },
      }
    `);

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (lower("d0"."last_name")) as "lowercaseLastName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id")) as "r" from (select "d1"."id" as "id" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 0, 1, 1]",
      ]
    `);
  });
});

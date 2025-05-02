import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('related fields', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('simple related field query', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
              user(id: "VXNlcjox") {
                posts(limit: 3, offset: 2) {
                  id
                  category {
                    name
                  }
                }
              }
            }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id", 'category', jsonb("category"))) as "r" from (select "d1"."id" as "id", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "categories" as "d2" where "d1"."category_id" = "d2"."id" limit ?) as "t") as "category" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 3, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "posts": [
              {
                "category": "entertainment",
                "id": "6",
              },
              {
                "category": "politics",
                "id": "7",
              },
              {
                "category": "politics",
                "id": "8",
              },
            ],
          },
        },
      }
    `);
  });
});

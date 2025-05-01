import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('related fields', () => {
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
        "Query: select "d0"."id" as "id", "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id")) as "r" from (select "d1"."id" as "id" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."id" desc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
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
});

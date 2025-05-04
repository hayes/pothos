import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('interfaces', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('recursive relations', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const query = gql`
        query {
          me {
            selfList {
                selfList {
                    id
                    user {
                        id
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
          "me": {
            "selfList": [
              {
                "selfList": [
                  {
                    "id": "1",
                    "user": {
                      "id": "VXNlcjox",
                    },
                  },
                ],
              },
            ],
          },
        },
      }
    `);

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('id', "id", 'manySelf', jsonb("manySelf"))) as "r" from (select "d1"."id" as "id", coalesce((select jsonb_group_array(json_object('id', "id", 'firstName', "firstName", 'lastName', "lastName", 'lowercaseFirstName', "lowercaseFirstName", 'profile', jsonb("profile"))) as "r" from (select "d2"."id" as "id", "d2"."first_name" as "firstName", "d2"."last_name" as "lastName", (lower("d2"."first_name")) as "lowercaseFirstName", (select jsonb_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d3"."id" as "id", "d3"."user_id" as "userId", "d3"."bio" as "bio" from "profile" as "d3" where "d2"."id" = "d3"."user_id" limit ?) as "t") as "profile" from "users" as "d2" where "d1"."id" = "d2"."id") as "t"), jsonb_array()) as "manySelf" from "users" as "d1" where "d0"."id" = "d1"."id") as "t"), jsonb_array()) as "manySelf" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);
  });
});

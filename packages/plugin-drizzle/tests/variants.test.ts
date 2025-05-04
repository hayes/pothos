import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('variants', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('can create and query variants of the same table', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              me {
                roles
                user {
                  id
                  firstName
                  lastName
                  viewer {
                    roles
                  }
                }
              }
              user(id: "VXNlcjox") {
                id
                viewer {
                  id
                  rolesConnection {
                    edges {
                      node {
                        name
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
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('roleId', "roleId", 'userId', "userId", 'role', jsonb("role"))) as "r" from (select "d1"."role_id" as "roleId", "d1"."user_id" as "userId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "roles" as "d2" where "d1"."role_id" = "d2"."id" limit ?) as "t") as "role" from "user_roles" as "d1" where "d0"."id" = "d1"."user_id" order by "d1"."role_id" asc limit ?) as "t"), jsonb_array()) as "userRoles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 21, 1, 1]",
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", coalesce((select json_group_array(json_object('id', "id", 'name', "name")) as "r" from (select "d1"."id" as "id", "d1"."name" as "name" from "roles" as "d1" inner join "user_roles" as "tr0" on "tr0"."role_id" = "d1"."id" where "d0"."id" = "tr0"."user_id") as "t"), jsonb_array()) as "roles", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "roles": [
              "admin",
              "author",
              "user",
            ],
            "user": {
              "firstName": "Mason",
              "id": "VXNlcjox",
              "lastName": "Reichel",
              "viewer": {
                "roles": [
                  "admin",
                  "author",
                  "user",
                ],
              },
            },
          },
          "user": {
            "id": "VXNlcjox",
            "viewer": {
              "id": "1",
              "rolesConnection": {
                "edges": [
                  {
                    "node": {
                      "name": "admin",
                    },
                  },
                  {
                    "node": {
                      "name": "author",
                    },
                  },
                  {
                    "node": {
                      "name": "user",
                    },
                  },
                ],
              },
            },
          },
        },
      }
    `);
  });
});

import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('nodes', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('query node and nodes', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const query = gql`
        query {
          node(id: "VXNlcjox") {
            id
            ... on User {
              firstName
              email
              posts(limit: 1) {
                id
              }
            }
          }
          nodes(ids: ["VXNlcjox", "VXNlcjoz", "VXNlcjoxMQ==", "QWRtaW46MQ=="]) {
            id
            ... on User {
              firstName
              email
              posts(limit: 1) {
                id
              }
            }
            ... on Admin {
              id
              isAdmin
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
          "node": {
            "email": "mason.reichel@example.com",
            "firstName": "Mason",
            "id": "VXNlcjox",
            "posts": [
              {
                "id": "2",
              },
            ],
          },
          "nodes": [
            {
              "email": "mason.reichel@example.com",
              "firstName": "Mason",
              "id": "VXNlcjox",
              "posts": [
                {
                  "id": "2",
                },
              ],
            },
            {
              "email": "montana.kessler@example.com",
              "firstName": "Montana",
              "id": "VXNlcjoz",
              "posts": [
                {
                  "id": "31",
                },
              ],
            },
            {
              "email": "demarco.kub@example.com",
              "firstName": "Demarco",
              "id": "VXNlcjoxMQ==",
              "posts": [],
            },
            {
              "id": "QWRtaW46MQ==",
              "isAdmin": true,
            },
          ],
        },
      }
    `);

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (lower("d0"."last_name")) as "lowercaseLastName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?, ?, ?, ?) -- params: [1, 1, 1, 0, 1, 1, 3, 11]",
        "Query: select "d0"."id" as "id" from "users" as "d0" where "d0"."id" in (?) -- params: [1]",
      ]
    `);
  });

  it('node variant', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const query = gql`
        query {
          admin {
            id
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
          "admin": {
            "id": "QWRtaW46MQ==",
          },
        },
      }
    `);

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
      ]
    `);
  });
});

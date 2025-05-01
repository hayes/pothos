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
});

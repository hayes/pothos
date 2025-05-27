import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('merge compatible queries', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('simple query with different selections', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
                user(id: "VXNlcjox") {
                    posts(limit: 1, offset: 2) {
                      id
                    }
                    posts2: posts(limit: 1, offset: 2) {
                    id
                    content
                    }
                }
            }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."id" as "id", (lower("d0"."first_name")) as "lowercaseFirstName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id", 'content', "content")) as "r" from (select "d1"."id" as "id", "d1"."content" as "content" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "user": {
            "posts": [
              {
                "id": "6",
              },
            ],
            "posts2": [
              {
                "content": "Amor perspiciatis concedo articulus eaque acidus. Alius aspernatur soleo thermae ascit bonus caute tepesco. Atavus ut supplanto viridis varietas credo atrox calamitas.
      Tactus ex summa crux voluptatem sufficio alter sublime. Confero atque corporis tametsi tenus vulnero textilis campana vulgo talis. Teres victoria cicuta vicissitudo verus tristis aegrus sono calco apostolus.
      Clamo alii vester cariosus voluptas. Talis cenaculum aduro dignissimos ultra appositus at omnis talis. Comitatus blanditiis asperiores aestas ascit subvenio antea.",
                "id": "6",
              },
            ],
          },
        },
      }
    `);
  });

  it('multiple layers of nesting', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            {
                me {
                    user {
                    posts(limit: 1, offset: 2) {
                        id
                    }
                    posts2: posts(limit: 1, offset: 2) {
                        id
                        content
                    }
                    viewer {
                        roles
                    }
                    }
                    user2: user {
                    email
                    posts(limit: 1, offset: 2) {
                        id
                    }
                    posts2: posts(limit: 1, offset: 2) {
                        id
                        content
                    }
                    viewer {
                        username
                    }
                    }
                }
            }
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", "d0"."username" as "username", (lower("d0"."first_name")) as "lowercaseFirstName", (lower("d0"."last_name")) as "lowercaseLastName", (select json_object('id', "id", 'userId', "userId", 'bio', "bio") as "r" from (select "d1"."id" as "id", "d1"."user_id" as "userId", "d1"."bio" as "bio" from "profile" as "d1" where "d0"."id" = "d1"."user_id" limit ?) as "t") as "profile", coalesce((select json_group_array(json_object('id', "id", 'content', "content")) as "r" from (select "d1"."id" as "id", "d1"."content" as "content" from "posts" as "d1" where ("d1"."published" = ? and "d0"."id" = "d1"."author_id") order by "d1"."createdAt" desc limit ? offset ?) as "t"), jsonb_array()) as "posts", coalesce((select json_group_array(json_object('id', "id", 'name', "name")) as "r" from (select "d1"."id" as "id", "d1"."name" as "name" from "roles" as "d1" inner join "user_roles" as "tr0" on "tr0"."role_id" = "d1"."id" where "d0"."id" = "tr0"."user_id") as "t"), jsonb_array()) as "roles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "user": {
              "posts": [
                {
                  "id": "6",
                },
              ],
              "posts2": [
                {
                  "content": "Amor perspiciatis concedo articulus eaque acidus. Alius aspernatur soleo thermae ascit bonus caute tepesco. Atavus ut supplanto viridis varietas credo atrox calamitas.
      Tactus ex summa crux voluptatem sufficio alter sublime. Confero atque corporis tametsi tenus vulnero textilis campana vulgo talis. Teres victoria cicuta vicissitudo verus tristis aegrus sono calco apostolus.
      Clamo alii vester cariosus voluptas. Talis cenaculum aduro dignissimos ultra appositus at omnis talis. Comitatus blanditiis asperiores aestas ascit subvenio antea.",
                  "id": "6",
                },
              ],
              "viewer": {
                "roles": [
                  "admin",
                  "author",
                  "user",
                ],
              },
            },
            "user2": {
              "email": "mason.reichel@example.com",
              "posts": [
                {
                  "id": "6",
                },
              ],
              "posts2": [
                {
                  "content": "Amor perspiciatis concedo articulus eaque acidus. Alius aspernatur soleo thermae ascit bonus caute tepesco. Atavus ut supplanto viridis varietas credo atrox calamitas.
      Tactus ex summa crux voluptatem sufficio alter sublime. Confero atque corporis tametsi tenus vulnero textilis campana vulgo talis. Teres victoria cicuta vicissitudo verus tristis aegrus sono calco apostolus.
      Clamo alii vester cariosus voluptas. Talis cenaculum aduro dignissimos ultra appositus at omnis talis. Comitatus blanditiis asperiores aestas ascit subvenio antea.",
                  "id": "6",
                },
              ],
              "viewer": {
                "username": "@Maurine.Grant",
              },
            },
          },
        },
      }
    `);
  });
});

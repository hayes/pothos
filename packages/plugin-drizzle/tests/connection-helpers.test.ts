import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('connection helpers', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('basic indirect connection', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
                me {
                    rolesConnection {
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
                                name
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
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('roleId', "roleId", 'userId', "userId", 'role', jsonb("role"))) as "r" from (select "d1"."role_id" as "roleId", "d1"."user_id" as "userId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "roles" as "d2" where "d1"."role_id" = "d2"."id" limit ?) as "t") as "role" from "user_roles" as "d1" where "d0"."id" = "d1"."user_id" order by "d1"."role_id" asc limit ?) as "t"), jsonb_array()) as "userRoles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 21, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "rolesConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjox",
                  "node": {
                    "id": "1",
                    "name": "admin",
                  },
                },
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                    "name": "author",
                  },
                },
                {
                  "cursor": "REM6Tjoz",
                  "node": {
                    "id": "3",
                    "name": "user",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjoz",
                "hasNextPage": false,
                "hasPreviousPage": false,
                "startCursor": "REM6Tjox",
              },
            },
          },
        },
      }
    `);
  });

  it('first and after', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
                me {
                    rolesConnection(first: 1, after: "REM6Tjox") {
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
                                name
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
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('roleId', "roleId", 'userId', "userId", 'role', jsonb("role"))) as "r" from (select "d1"."role_id" as "roleId", "d1"."user_id" as "userId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "roles" as "d2" where "d1"."role_id" = "d2"."id" limit ?) as "t") as "role" from "user_roles" as "d1" where ("d1"."role_id" > ? and "d0"."id" = "d1"."user_id") order by "d1"."role_id" asc limit ?) as "t"), jsonb_array()) as "userRoles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "rolesConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                    "name": "author",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjoy",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjoy",
              },
            },
          },
        },
      }
    `);
  });

  it('last before', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
                me {
                    rolesConnection(last: 1, before: "REM6Tjoz") {
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
                                name
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
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('roleId', "roleId", 'userId', "userId", 'role', jsonb("role"))) as "r" from (select "d1"."role_id" as "roleId", "d1"."user_id" as "userId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "roles" as "d2" where "d1"."role_id" = "d2"."id" limit ?) as "t") as "role" from "user_roles" as "d1" where ("d1"."role_id" < ? and "d0"."id" = "d1"."user_id") order by "d1"."role_id" desc limit ?) as "t"), jsonb_array()) as "userRoles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 3, 2, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "rolesConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                    "name": "author",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjoy",
                "hasNextPage": true,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjoy",
              },
            },
          },
        },
      }
    `);
  });

  it('custom args', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
                me {
                    rolesConnection(invert: true) {
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
                                name
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
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('roleId', "roleId", 'userId', "userId", 'role', jsonb("role"))) as "r" from (select "d1"."role_id" as "roleId", "d1"."user_id" as "userId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "roles" as "d2" where "d1"."role_id" = "d2"."id" limit ?) as "t") as "role" from "user_roles" as "d1" where "d0"."id" = "d1"."user_id" order by "d1"."role_id" desc limit ?) as "t"), jsonb_array()) as "userRoles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 21, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "rolesConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjoz",
                  "node": {
                    "id": "3",
                    "name": "user",
                  },
                },
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                    "name": "author",
                  },
                },
                {
                  "cursor": "REM6Tjox",
                  "node": {
                    "id": "1",
                    "name": "admin",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjox",
                "hasNextPage": false,
                "hasPreviousPage": false,
                "startCursor": "REM6Tjoz",
              },
            },
          },
        },
      }
    `);
  });

  it('custom order with after', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
                me {
                    rolesConnection(invert: true, after: "REM6Tjoz") {
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
                                name
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
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('roleId', "roleId", 'userId', "userId", 'role', jsonb("role"))) as "r" from (select "d1"."role_id" as "roleId", "d1"."user_id" as "userId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "roles" as "d2" where "d1"."role_id" = "d2"."id" limit ?) as "t") as "role" from "user_roles" as "d1" where ("d1"."role_id" < ? and "d0"."id" = "d1"."user_id") order by "d1"."role_id" desc limit ?) as "t"), jsonb_array()) as "userRoles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 3, 21, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "rolesConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                    "name": "author",
                  },
                },
                {
                  "cursor": "REM6Tjox",
                  "node": {
                    "id": "1",
                    "name": "admin",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjox",
                "hasNextPage": false,
                "hasPreviousPage": true,
                "startCursor": "REM6Tjoy",
              },
            },
          },
        },
      }
    `);
  });

  it('custom order with before', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
                me {
                    rolesConnection(invert: true, before: "REM6Tjox", last: 2) {
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
                                name
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
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('roleId', "roleId", 'userId', "userId", 'role', jsonb("role"))) as "r" from (select "d1"."role_id" as "roleId", "d1"."user_id" as "userId", (select jsonb_object('id', "id", 'name', "name") as "r" from (select "d2"."id" as "id", "d2"."name" as "name" from "roles" as "d2" where "d1"."role_id" = "d2"."id" limit ?) as "t") as "role" from "user_roles" as "d1" where ("d1"."role_id" > ? and "d0"."id" = "d1"."user_id") order by "d1"."role_id" asc limit ?) as "t"), jsonb_array()) as "userRoles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 3, 1, 1]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "rolesConnection": {
              "edges": [
                {
                  "cursor": "REM6Tjoz",
                  "node": {
                    "id": "3",
                    "name": "user",
                  },
                },
                {
                  "cursor": "REM6Tjoy",
                  "node": {
                    "id": "2",
                    "name": "author",
                  },
                },
              ],
              "pageInfo": {
                "endCursor": "REM6Tjoy",
                "hasNextPage": true,
                "hasPreviousPage": false,
                "startCursor": "REM6Tjoz",
              },
            },
          },
        },
      }
    `);
  });

  it('entry connection', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
              query {
                  userRolesConnection(userId: 1) {
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
        "Query: select "d0"."role_id" as "roleId", "d0"."user_id" as "userId", (select json_object('id', "id", 'name', "name") as "r" from (select "d1"."id" as "id", "d1"."name" as "name" from "roles" as "d1" where "d0"."role_id" = "d1"."id" limit ?) as "t") as "role" from "user_roles" as "d0" where "d0"."user_id" = ? order by "d0"."role_id" asc limit ? -- params: [1, 1, 21]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "userRolesConnection": {
            "edges": [
              {
                "cursor": "REM6Tjox",
                "node": {
                  "id": "1",
                  "name": "admin",
                },
              },
              {
                "cursor": "REM6Tjoy",
                "node": {
                  "id": "2",
                  "name": "author",
                },
              },
              {
                "cursor": "REM6Tjoz",
                "node": {
                  "id": "3",
                  "name": "user",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6Tjoz",
              "hasNextPage": false,
              "hasPreviousPage": false,
              "startCursor": "REM6Tjox",
            },
          },
        },
      }
    `);
  });
});

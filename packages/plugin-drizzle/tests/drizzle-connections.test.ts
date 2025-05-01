import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

describe('drizzle connections', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });
  it('first', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(first: 2) {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where "d0"."published" = ? order by "d0"."id" desc limit ? -- params: [1, 3]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6TjoxNTA=",
                "node": {
                  "id": "150",
                },
              },
              {
                "cursor": "REM6TjoxNDk=",
                "node": {
                  "id": "149",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6TjoxNDk=",
              "hasNextPage": true,
              "hasPreviousPage": false,
              "startCursor": "REM6TjoxNTA=",
            },
          },
        },
      }
    `);
  });

  it('last', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(last: 2) {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where "d0"."published" = ? order by "d0"."id" asc limit ? -- params: [1, 3]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6Tjo0",
                "node": {
                  "id": "4",
                },
              },
              {
                "cursor": "REM6Tjoy",
                "node": {
                  "id": "2",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6Tjoy",
              "hasNextPage": false,
              "hasPreviousPage": true,
              "startCursor": "REM6Tjo0",
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
              posts(first: 2, after: "REM6TjoxNTA=") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and "d0"."id" < ?) order by "d0"."id" desc limit ? -- params: [1, 150, 3]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6TjoxNDk=",
                "node": {
                  "id": "149",
                },
              },
              {
                "cursor": "REM6TjoxNDg=",
                "node": {
                  "id": "148",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6TjoxNDg=",
              "hasNextPage": true,
              "hasPreviousPage": true,
              "startCursor": "REM6TjoxNDk=",
            },
          },
        },
      }
    `);
  });

  it('last and before', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(last: 2, before: "REM6Tjoy") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and "d0"."id" > ?) order by "d0"."id" asc limit ? -- params: [1, 2, 3]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6Tjo2",
                "node": {
                  "id": "6",
                },
              },
              {
                "cursor": "REM6Tjo0",
                "node": {
                  "id": "4",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6Tjo0",
              "hasNextPage": true,
              "hasPreviousPage": true,
              "startCursor": "REM6Tjo2",
            },
          },
        },
      }
    `);
  });

  it('first, after and before', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(first: 2, after: "REM6TjoxNTA=", before: "REM6TjoxNDc=") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and ("d0"."id" < ? and "d0"."id" > ?)) order by "d0"."id" desc limit ? -- params: [1, 150, 147, 3]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6TjoxNDk=",
                "node": {
                  "id": "149",
                },
              },
              {
                "cursor": "REM6TjoxNDg=",
                "node": {
                  "id": "148",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6TjoxNDg=",
              "hasNextPage": true,
              "hasPreviousPage": true,
              "startCursor": "REM6TjoxNDk=",
            },
          },
        },
      }
    `);
  });

  it('last, before and after', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(last: 3, before: "REM6Tjoy", after: "REM6Tjo3") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and ("d0"."id" < ? and "d0"."id" > ?)) order by "d0"."id" asc limit ? -- params: [1, 7, 2, 4]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6Tjo2",
                "node": {
                  "id": "6",
                },
              },
              {
                "cursor": "REM6Tjo0",
                "node": {
                  "id": "4",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6Tjo0",
              "hasNextPage": true,
              "hasPreviousPage": true,
              "startCursor": "REM6Tjo2",
            },
          },
        },
      }
    `);
  });

  it('first, after and before - truncated', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(first: 1, after: "REM6TjoxNTA=", before: "REM6TjoxNDc=") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and ("d0"."id" < ? and "d0"."id" > ?)) order by "d0"."id" desc limit ? -- params: [1, 150, 147, 2]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6TjoxNDk=",
                "node": {
                  "id": "149",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6TjoxNDk=",
              "hasNextPage": true,
              "hasPreviousPage": true,
              "startCursor": "REM6TjoxNDk=",
            },
          },
        },
      }
    `);
  });

  it('last, before and after - truncated', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(last: 1, before: "REM6Tjoy", after: "REM6Tjo3") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and ("d0"."id" < ? and "d0"."id" > ?)) order by "d0"."id" asc limit ? -- params: [1, 7, 2, 2]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6Tjo0",
                "node": {
                  "id": "4",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6Tjo0",
              "hasNextPage": true,
              "hasPreviousPage": true,
              "startCursor": "REM6Tjo0",
            },
          },
        },
      }
    `);
  });

  it('first and before', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(first: 3, before: "REM6TjoxNDg=") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and "d0"."id" > ?) order by "d0"."id" desc limit ? -- params: [1, 148, 4]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6TjoxNTA=",
                "node": {
                  "id": "150",
                },
              },
              {
                "cursor": "REM6TjoxNDk=",
                "node": {
                  "id": "149",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6TjoxNDk=",
              "hasNextPage": true,
              "hasPreviousPage": false,
              "startCursor": "REM6TjoxNTA=",
            },
          },
        },
      }
    `);
  });

  it('last and after', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(last: 3, after: "REM6Tjo2") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and "d0"."id" < ?) order by "d0"."id" asc limit ? -- params: [1, 6, 4]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6Tjo0",
                "node": {
                  "id": "4",
                },
              },
              {
                "cursor": "REM6Tjoy",
                "node": {
                  "id": "2",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6Tjoy",
              "hasNextPage": false,
              "hasPreviousPage": true,
              "startCursor": "REM6Tjo0",
            },
          },
        },
      }
    `);
  });

  it('first and before - truncated', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(first: 1, before: "REM6TjoxNDg=") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and "d0"."id" > ?) order by "d0"."id" desc limit ? -- params: [1, 148, 2]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6TjoxNTA=",
                "node": {
                  "id": "150",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6TjoxNTA=",
              "hasNextPage": true,
              "hasPreviousPage": false,
              "startCursor": "REM6TjoxNTA=",
            },
          },
        },
      }
    `);
  });

  it('last and after - truncated', async () => {
    const context = await createContext({ userId: '1' });
    clearDrizzleLogs();
    const result = await execute({
      schema,
      document: gql`
            query {
              posts(last: 1, after: "REM6Tjo2") {
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
        `,
      contextValue: context,
    });

    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id" from "posts" as "d0" where ("d0"."published" = ? and "d0"."id" < ?) order by "d0"."id" asc limit ? -- params: [1, 6, 2]",
      ]
    `);

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "posts": {
            "edges": [
              {
                "cursor": "REM6Tjoy",
                "node": {
                  "id": "2",
                },
              },
            ],
            "pageInfo": {
              "endCursor": "REM6Tjoy",
              "hasNextPage": false,
              "hasPreviousPage": true,
              "startCursor": "REM6Tjoy",
            },
          },
        },
      }
    `);
  });
});

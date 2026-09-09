import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// graphql merges every occurrence of a response key into one `info.fieldNodes`. A connection
// selected under a fragment as well as directly is planned from every occurrence, whichever
// comes first, so what one occurrence asks for is not loaded separately.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

const User = builder.drizzleObject('users', {
  name: 'User',
  select: {
    columns: {
      id: true,
    },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    postsConnection: t.relatedConnection('posts', { totalCount: true }),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  select: {
    columns: {
      postId: true,
    },
  },
  fields: (t) => ({
    id: t.exposeID('postId'),
    author: t.relation('author'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    posts: t.drizzleConnection({
      type: 'posts',
      resolve: (query) => db.query.posts.findMany(query({ where: { authorId: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('a field selected more than once', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('plans a related connection from every occurrence: totalCount in one, edges in another', async () => {
    const totalCountFirst = gql`
      query {
        user {
          postsConnection(first: 2) {
            totalCount
          }
        }
        ...More
      }

      fragment More on Query {
        user {
          postsConnection(first: 2) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;
    const edgesFirst = gql`
      query {
        ...More
        user {
          postsConnection(first: 2) {
            totalCount
          }
        }
      }

      fragment More on Query {
        user {
          postsConnection(first: 2) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;
    const logs: string[][] = [];

    for (const document of [totalCountFirst, edgesFirst]) {
      const result = await execute({ schema, document, contextValue: {} });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        user: {
          postsConnection: {
            totalCount: expect.any(Number),
            edges: [{ node: { id: expect.any(String) } }, { node: { id: expect.any(String) } }],
          },
        },
      });
      // Both the count and the rows come from the one query.
      expect(drizzleLogs).toHaveLength(1);
      logs.push([...drizzleLogs]);
      clearDrizzleLogs();
    }

    expect(logs[1]).toEqual(logs[0]);
    expect(logs[0]).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", ((select count(*) from "posts" where "posts"."author_id" = "d0"."id")) as "_posts_count", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [3, 1, 1]",
      ]
    `);
  });

  it('matches the paths of a root connection in every occurrence', async () => {
    const edgesFirst = gql`
      query {
        posts(first: 2) {
          edges {
            node {
              id
            }
          }
        }
        ...More
      }

      fragment More on Query {
        posts(first: 2) {
          edges {
            node {
              author {
                id
              }
            }
          }
        }
      }
    `;
    const authorFirst = gql`
      query {
        ...More
        posts(first: 2) {
          edges {
            node {
              id
            }
          }
        }
      }

      fragment More on Query {
        posts(first: 2) {
          edges {
            node {
              author {
                id
              }
            }
          }
        }
      }
    `;
    const logs: string[][] = [];

    for (const document of [edgesFirst, authorFirst]) {
      const result = await execute({ schema, document, contextValue: {} });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        posts: {
          edges: [
            { node: { id: expect.any(String), author: { id: '1' } } },
            { node: { id: expect.any(String), author: { id: '1' } } },
          ],
        },
      });
      // The author selected in the fragment's occurrence is joined in the one query.
      expect(drizzleLogs).toHaveLength(1);
      logs.push([...drizzleLogs]);
      clearDrizzleLogs();
    }

    expect(logs[1]).toEqual(logs[0]);
    expect(logs[0]).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "postId", (select json_object('id', "id") as "r" from (select "d1"."id" as "id" from "users" as "d1" where "d0"."author_id" = "d1"."id" limit ?) as "t") as "author" from "posts" as "d0" where "d0"."author_id" = ? order by "d0"."id" asc limit ? -- params: [1, 1, 3]",
      ]
    `);
  });
});

import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// Two selections of the same relation with different arguments cannot share one query. The one
// the document lists first is planned into the parent's query, whether it sits in a fragment or
// is a direct field; the other loads on its own.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
}>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
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
    posts: t.relation('posts', {
      args: {
        limit: t.arg.int({ required: true }),
      },
      query: (args) => ({
        limit: args.limit,
        orderBy: { postId: 'asc' },
      }),
    }),
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
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('selections are walked in document order', () => {
  let posts: { postId: number }[];

  beforeAll(async () => {
    posts = await db.query.posts.findMany({
      where: { authorId: 1 },
      orderBy: { postId: 'asc' },
      limit: 2,
    });
    clearDrizzleLogs();
  });

  afterEach(() => {
    clearDrizzleLogs();
  });

  const expectedData = () => ({
    user: {
      first: [{ id: String(posts[0].postId) }],
      second: posts.map((post) => ({ id: String(post.postId) })),
    },
  });

  it('plans the relation from a fragment listed before a field', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            ... on User {
              first: posts(limit: 1) {
                id
              }
            }
            second: posts(limit: 2) {
              id
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual(expectedData());
    // `first` is planned; `second` loads on its own.
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1, 1]",
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [2, 1]",
      ]
    `);
  });

  it('plans the relation from a field listed before a fragment', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            second: posts(limit: 2) {
              id
            }
            ... on User {
              first: posts(limit: 1) {
                id
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual(expectedData());
    // `second` is planned; `first` loads on its own.
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [2, 1, 1]",
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('postId', "postId")) as "r" from (select "d1"."id" as "postId" from "posts" as "d1" where "d0"."id" = "d1"."author_id" order by "d1"."id" asc limit ?) as "t"), jsonb_array()) as "posts" from "users" as "d0" where "d0"."id" in (?) -- params: [1, 1]",
      ]
    `);
  });
});

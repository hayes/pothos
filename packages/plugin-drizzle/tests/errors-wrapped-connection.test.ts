import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// A relatedConnection wrapped by the errors plugin sits under `... on <Field>Success { data }`.
// Its select callback looks up `totalCount` through that wrapper.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { user: { id: number } };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin, ErrorsPlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

builder.objectType(Error, {
  name: 'BaseError',
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    postsConnection: t.relatedConnection('posts', {
      totalCount: true,
      errors: { types: [Error] },
    }),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
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

describe('relatedConnection wrapped by the errors plugin', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('plans totalCount selected under the success type', async () => {
    const expectedCount = (await db.query.posts.findMany({ where: { authorId: 1 } })).length;
    clearDrizzleLogs();

    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 1) {
              ... on UserPostsConnectionSuccess {
                data {
                  totalCount
                }
              }
              ... on BaseError {
                message
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: { postsConnection: { data: { totalCount: expectedCount } } },
    });
    expect(drizzleLogs).toHaveLength(1);
    expect(drizzleLogs[0]).toContain('count(*)');
    expect(drizzleLogs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", "d0"."username" as "username", "d0"."first_name" as "firstName", "d0"."last_name" as "lastName", ((select count(*) from "posts" where "d0"."id" = "posts"."author_id")) as "_posts_count" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
      ]
    `);
  });

  it('plans the count and the rows when success fragments select them separately', async () => {
    const posts = await db.query.posts.findMany({ where: { authorId: 1 } });
    clearDrizzleLogs();

    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 2) {
              ... on UserPostsConnectionSuccess {
                data {
                  totalCount
                }
              }
              ... on UserPostsConnectionSuccess {
                data {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: {
        postsConnection: {
          data: {
            totalCount: posts.length,
            edges: posts.slice(0, 2).map((post) => ({ node: { id: String(post.postId) } })),
          },
        },
      },
    });
    expect(drizzleLogs).toHaveLength(1);
    expect(drizzleLogs[0]).toContain('count(*)');
    expect(drizzleLogs[0]).toContain('"posts"');
  });
});
